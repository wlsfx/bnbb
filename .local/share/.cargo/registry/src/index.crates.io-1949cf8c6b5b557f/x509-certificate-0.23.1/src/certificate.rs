// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

//! Defines high-level interface to X.509 certificates.

use {
    crate::{
        algorithm::DigestAlgorithm, asn1time::Time, rfc2986, rfc3280::Name, rfc5280, rfc5652,
        rfc5958::Attributes, rfc8017::RsaPublicKey, signing::Sign, InMemorySigningKeyPair,
        KeyAlgorithm, KeyInfoSigner, SignatureAlgorithm, X509CertificateError as Error,
    },
    bcder::{
        decode::Constructed,
        encode::Values,
        int::Integer,
        string::{BitString, OctetString},
        ConstOid, Mode, Oid,
    },
    bytes::Bytes,
    chrono::{DateTime, Duration, Utc},
    der::{Decode, Document},
    ring::signature as ringsig,
    signature::Signer,
    spki::EncodePublicKey,
    std::{
        cmp::Ordering,
        collections::HashSet,
        fmt::{Debug, Formatter},
        hash::{Hash, Hasher},
        io::Write,
        ops::{Deref, DerefMut},
    },
};

/// Key Usage extension.
///
/// 2.5.29.15
const OID_EXTENSION_KEY_USAGE: ConstOid = Oid(&[85, 29, 15]);

/// Basic Constraints X.509 extension.
///
/// 2.5.29.19
const OID_EXTENSION_BASIC_CONSTRAINTS: ConstOid = Oid(&[85, 29, 19]);

/// Provides an interface to the RFC 5280 [rfc5280::Certificate] ASN.1 type.
///
/// This type provides the main high-level API that this crate exposes
/// for reading and writing X.509 certificates.
///
/// Instances are backed by an actual ASN.1 [rfc5280::Certificate] instance.
/// Read operations are performed against the raw ASN.1 values. Mutations
/// result in mutations of the ASN.1 data structures.
///
/// Instances can be converted to/from [rfc5280::Certificate] using traits.
/// [AsRef]/[AsMut] are implemented to obtain a reference to the backing
/// [rfc5280::Certificate].
///
/// We have chosen not to implement [Deref]/[DerefMut] because we don't
/// want to pollute the type's API with lower-level ASN.1 primitives.
///
/// This type does not track the original data from which it came.
/// If you want a type that does that, consider [CapturedX509Certificate],
/// which implements [Deref] and therefore behaves like this type.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct X509Certificate(rfc5280::Certificate);

impl X509Certificate {
    /// Construct an instance by parsing DER encoded ASN.1 data.
    pub fn from_der(data: impl AsRef<[u8]>) -> Result<Self, Error> {
        let cert = Constructed::decode(data.as_ref(), Mode::Der, |cons| {
            rfc5280::Certificate::take_from(cons)
        })?;

        Ok(Self(cert))
    }

    /// Construct an instance by parsing BER encoded ASN.1 data.
    ///
    /// X.509 certificates are likely (and should be) using DER encoding.
    /// However, some specifications do mandate the use of BER, so this
    /// method is provided.
    pub fn from_ber(data: impl AsRef<[u8]>) -> Result<Self, Error> {
        let cert = Constructed::decode(data.as_ref(), Mode::Ber, |cons| {
            rfc5280::Certificate::take_from(cons)
        })?;

        Ok(Self(cert))
    }

    /// Construct an instance by parsing PEM encoded ASN.1 data.
    ///
    /// The data is a human readable string likely containing
    /// `--------- BEGIN CERTIFICATE ----------`.
    pub fn from_pem(data: impl AsRef<[u8]>) -> Result<Self, Error> {
        let data = pem::parse(data.as_ref()).map_err(Error::PemDecode)?;

        Self::from_der(data.contents())
    }

    /// Construct instances by parsing PEM with potentially multiple records.
    ///
    /// By default, we only look for `--------- BEGIN CERTIFICATE --------`
    /// entries and silently ignore unknown ones. If you would like to specify
    /// an alternate set of tags (this is the value after the `BEGIN`) to search,
    /// call [Self::from_pem_multiple_tags].
    pub fn from_pem_multiple(data: impl AsRef<[u8]>) -> Result<Vec<Self>, Error> {
        Self::from_pem_multiple_tags(data, &["CERTIFICATE"])
    }

    /// Construct instances by parsing PEM armored DER encoded certificates with specific PEM tags.
    ///
    /// This is like [Self::from_pem_multiple] except you control the filter for
    /// which `BEGIN <tag>` values are filtered through to the DER parser.
    pub fn from_pem_multiple_tags(
        data: impl AsRef<[u8]>,
        tags: &[&str],
    ) -> Result<Vec<Self>, Error> {
        let pem = pem::parse_many(data.as_ref()).map_err(Error::PemDecode)?;

        pem.into_iter()
            .filter(|pem| tags.contains(&pem.tag()))
            .map(|pem| Self::from_der(pem.contents()))
            .collect::<Result<_, _>>()
    }

    /// Obtain the serial number as the ASN.1 [Integer] type.
    pub fn serial_number_asn1(&self) -> &Integer {
        &self.0.tbs_certificate.serial_number
    }

    /// Obtain the certificate's subject, as its ASN.1 [Name] type.
    pub fn subject_name(&self) -> &Name {
        &self.0.tbs_certificate.subject
    }

    /// Obtain the Common Name (CN) attribute from the certificate's subject, if set and decodable.
    pub fn subject_common_name(&self) -> Option<String> {
        self.0
            .tbs_certificate
            .subject
            .iter_common_name()
            .next()
            .and_then(|cn| cn.to_string().ok())
    }

    /// Obtain the certificate's issuer, as its ASN.1 [Name] type.
    pub fn issuer_name(&self) -> &Name {
        &self.0.tbs_certificate.issuer
    }

    /// Obtain the Common Name (CN) attribute from the certificate's issuer, if set and decodable.
    pub fn issuer_common_name(&self) -> Option<String> {
        self.0
            .tbs_certificate
            .issuer
            .iter_common_name()
            .next()
            .and_then(|cn| cn.to_string().ok())
    }

    /// Iterate over extensions defined in this certificate.
    pub fn iter_extensions(&self) -> impl Iterator<Item = &crate::rfc5280::Extension> {
        self.0.iter_extensions()
    }

    /// Encode the certificate data structure using DER encoding.
    ///
    /// (This is the common ASN.1 encoding format for X.509 certificates.)
    ///
    /// This always serializes the internal ASN.1 data structure. If you
    /// call this on a wrapper type that has retained a copy of the original
    /// data, this may emit different data than that copy.
    pub fn encode_der_to(&self, fh: &mut impl Write) -> Result<(), std::io::Error> {
        self.0.encode_ref().write_encoded(Mode::Der, fh)
    }

    /// Encode the certificate data structure use BER encoding.
    pub fn encode_ber_to(&self, fh: &mut impl Write) -> Result<(), std::io::Error> {
        self.0.encode_ref().write_encoded(Mode::Ber, fh)
    }

    /// Encode the internal ASN.1 data structures to DER.
    pub fn encode_der(&self) -> Result<Vec<u8>, std::io::Error> {
        let mut buffer = Vec::<u8>::new();
        self.encode_der_to(&mut buffer)?;

        Ok(buffer)
    }

    /// Obtain the BER encoded representation of this certificate.
    pub fn encode_ber(&self) -> Result<Vec<u8>, std::io::Error> {
        let mut buffer = Vec::<u8>::new();
        self.encode_ber_to(&mut buffer)?;

        Ok(buffer)
    }

    /// Encode the certificate to PEM.
    ///
    /// This will write a human-readable string with `------ BEGIN CERTIFICATE -------`
    /// armoring. This is a very common method for encoding certificates.
    ///
    /// The underlying binary data is DER encoded.
    pub fn write_pem(&self, fh: &mut impl Write) -> Result<(), std::io::Error> {
        let encoded = pem::Pem::new("CERTIFICATE", self.encode_der()?).to_string();

        fh.write_all(encoded.as_bytes())
    }

    /// Encode the certificate to a PEM string.
    pub fn encode_pem(&self) -> Result<String, std::io::Error> {
        Ok(pem::Pem::new("CERTIFICATE", self.encode_der()?).to_string())
    }

    /// Attempt to resolve a known [KeyAlgorithm] used by the private key associated with this certificate.
    ///
    /// If this crate isn't aware of the OID associated with the key algorithm,
    /// `None` is returned.
    pub fn key_algorithm(&self) -> Option<KeyAlgorithm> {
        KeyAlgorithm::try_from(&self.0.tbs_certificate.subject_public_key_info.algorithm).ok()
    }

    /// Obtain the OID of the private key's algorithm.
    pub fn key_algorithm_oid(&self) -> &Oid {
        &self
            .0
            .tbs_certificate
            .subject_public_key_info
            .algorithm
            .algorithm
    }

    /// Obtain the [SignatureAlgorithm this certificate will use.
    ///
    /// Returns [None] if we failed to resolve an instance (probably because we don't
    /// recognize the algorithm).
    pub fn signature_algorithm(&self) -> Option<SignatureAlgorithm> {
        SignatureAlgorithm::try_from(&self.0.tbs_certificate.signature.algorithm).ok()
    }

    /// Obtain the OID of the signature algorithm this certificate will use.
    pub fn signature_algorithm_oid(&self) -> &Oid {
        &self.0.tbs_certificate.signature.algorithm
    }

    /// Obtain the [SignatureAlgorithm] used to sign this certificate.
    ///
    /// Returns [None] if we failed to resolve an instance (probably because we
    /// don't recognize that algorithm).
    pub fn signature_signature_algorithm(&self) -> Option<SignatureAlgorithm> {
        SignatureAlgorithm::try_from(&self.0.signature_algorithm).ok()
    }

    /// Obtain the OID of the signature algorithm used to sign this certificate.
    pub fn signature_signature_algorithm_oid(&self) -> &Oid {
        &self.0.signature_algorithm.algorithm
    }

    /// Obtain the raw data constituting this certificate's public key.
    ///
    /// A copy of the data is returned.
    pub fn public_key_data(&self) -> Bytes {
        self.0
            .tbs_certificate
            .subject_public_key_info
            .subject_public_key
            .octet_bytes()
    }

    /// Attempt to parse the public key data as [RsaPublicKey] parameters.
    ///
    /// Note that the raw integer value for modulus has a leading 0 byte. So its
    /// raw length will be 1 greater than key length. e.g. an RSA 2048 key will
    /// have `value.modulus.as_slice().len() == 257` instead of `256`.
    pub fn rsa_public_key_data(&self) -> Result<RsaPublicKey, Error> {
        let der = self.public_key_data();

        Ok(Constructed::decode(
            der.as_ref(),
            Mode::Der,
            RsaPublicKey::take_from,
        )?)
    }

    /// Compare 2 instances, sorting them so the issuer comes before the issued.
    ///
    /// This function examines the [Self::issuer_name] and [Self::subject_name]
    /// fields of 2 certificates, attempting to sort them so the issuing
    /// certificate comes before the issued certificate.
    ///
    /// This function performs a strict compare of the ASN.1 [Name] data.
    /// The assumption here is that the issuing certificate's subject [Name]
    /// is identical to the issued's issuer [Name]. This assumption is often
    /// true. But it likely isn't always true, so this function may not produce
    /// reliable results.
    pub fn compare_issuer(&self, other: &Self) -> Ordering {
        // Self signed certificate has no ordering.
        if self.0.tbs_certificate.subject == self.0.tbs_certificate.issuer {
            Ordering::Equal
            // We were issued by the other certificate. The issuer comes first.
        } else if self.0.tbs_certificate.issuer == other.0.tbs_certificate.subject {
            Ordering::Greater
        } else if self.0.tbs_certificate.subject == other.0.tbs_certificate.issuer {
            // We issued the other certificate. We come first.
            Ordering::Less
        } else {
            Ordering::Equal
        }
    }

    /// Whether the subject [Name] is also the issuer's [Name].
    ///
    /// This might be a way of determining if a certificate is self-signed.
    /// But there can likely be false negatives due to differences in ASN.1
    /// encoding of the underlying data. So we don't claim this is a test for
    /// being self-signed.
    pub fn subject_is_issuer(&self) -> bool {
        self.0.tbs_certificate.subject == self.0.tbs_certificate.issuer
    }

    /// Obtain the fingerprint for this certificate given a digest algorithm.
    pub fn fingerprint(
        &self,
        algorithm: DigestAlgorithm,
    ) -> Result<ring::digest::Digest, std::io::Error> {
        let raw = self.encode_der()?;

        let mut h = algorithm.digester();
        h.update(&raw);

        Ok(h.finish())
    }

    /// Obtain the SHA-1 fingerprint of this certificate.
    pub fn sha1_fingerprint(&self) -> Result<ring::digest::Digest, std::io::Error> {
        self.fingerprint(DigestAlgorithm::Sha1)
    }

    /// Obtain the SHA-256 fingerprint of this certificate.
    pub fn sha256_fingerprint(&self) -> Result<ring::digest::Digest, std::io::Error> {
        self.fingerprint(DigestAlgorithm::Sha256)
    }

    /// Obtain the raw [rfc5280::TbsCertificate] for this certificate.
    pub fn tbs_certificate(&self) -> &rfc5280::TbsCertificate {
        &self.0.tbs_certificate
    }

    /// Obtain the certificate validity "not before" time.
    pub fn validity_not_before(&self) -> DateTime<Utc> {
        self.0.tbs_certificate.validity.not_before.clone().into()
    }

    /// Obtain the certificate validity "not after" time.
    pub fn validity_not_after(&self) -> DateTime<Utc> {
        self.0.tbs_certificate.validity.not_after.clone().into()
    }

    /// Determine whether a time is between the validity constraints in the certificate.
    ///
    /// i.e. check whether a certificate is "expired."
    ///
    /// Receives a date time to check against.
    ///
    /// If `None`, the current time is used. This relies on the machine's
    /// wall clock to be accurate, of course.
    pub fn time_constraints_valid(&self, compare_time: Option<DateTime<Utc>>) -> bool {
        let compare_time = compare_time.unwrap_or(Utc::now());

        compare_time >= self.validity_not_before() && compare_time <= self.validity_not_after()
    }
}

impl From<rfc5280::Certificate> for X509Certificate {
    fn from(v: rfc5280::Certificate) -> Self {
        Self(v)
    }
}

impl From<X509Certificate> for rfc5280::Certificate {
    fn from(v: X509Certificate) -> Self {
        v.0
    }
}

impl AsRef<rfc5280::Certificate> for X509Certificate {
    fn as_ref(&self) -> &rfc5280::Certificate {
        &self.0
    }
}

impl AsMut<rfc5280::Certificate> for X509Certificate {
    fn as_mut(&mut self) -> &mut rfc5280::Certificate {
        &mut self.0
    }
}

impl EncodePublicKey for X509Certificate {
    fn to_public_key_der(&self) -> spki::Result<Document> {
        let mut data = vec![];

        self.0
            .tbs_certificate
            .subject_public_key_info
            .encode_ref()
            .write_encoded(Mode::Der, &mut data)
            .map_err(|_| spki::Error::Asn1(der::Error::new(der::ErrorKind::Failed, 0u8.into())))?;

        Document::from_der(&data).map_err(spki::Error::Asn1)
    }
}

#[derive(Clone, Eq, PartialEq)]
enum OriginalData {
    Ber(Vec<u8>),
    Der(Vec<u8>),
}

impl Debug for OriginalData {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!(
            "{}({})",
            match self {
                Self::Ber(_) => "Ber",
                Self::Der(_) => "Der",
            },
            match self {
                Self::Ber(data) => hex::encode(data),
                Self::Der(data) => hex::encode(data),
            }
        ))
    }
}

/// Represents an immutable (read-only) X.509 certificate that was parsed from data.
///
/// This type implements [Deref] but not [DerefMut], so only functions
/// taking a non-mutable instance are usable.
///
/// A copy of the certificate's raw backing data is stored, facilitating
/// subsequent access.
#[derive(Clone, Debug)]
pub struct CapturedX509Certificate {
    original: OriginalData,
    inner: X509Certificate,
}

impl CapturedX509Certificate {
    /// Construct an instance from DER encoded data.
    ///
    /// A copy of this data will be stored in the instance and is guaranteed
    /// to be immutable for the lifetime of the instance. The original constructing
    /// data can be retrieved later.
    pub fn from_der(data: impl Into<Vec<u8>>) -> Result<Self, Error> {
        let der_data = data.into();

        let inner = X509Certificate::from_der(&der_data)?;

        Ok(Self {
            original: OriginalData::Der(der_data),
            inner,
        })
    }

    /// Construct an instance from BER encoded data.
    ///
    /// A copy of this data will be stored in the instance and is guaranteed
    /// to be immutable for the lifetime of the instance, allowing it to
    /// be retrieved later.
    pub fn from_ber(data: impl Into<Vec<u8>>) -> Result<Self, Error> {
        let data = data.into();

        let inner = X509Certificate::from_ber(&data)?;

        Ok(Self {
            original: OriginalData::Ber(data),
            inner,
        })
    }

    /// Construct an instance by parsing PEM encoded ASN.1 data.
    ///
    /// The data is a human readable string likely containing
    /// `--------- BEGIN CERTIFICATE ----------`.
    pub fn from_pem(data: impl AsRef<[u8]>) -> Result<Self, Error> {
        let data = pem::parse(data.as_ref()).map_err(Error::PemDecode)?;

        Self::from_der(data.contents())
    }

    /// Construct instances by parsing PEM with potentially multiple records.
    ///
    /// By default, we only look for `--------- BEGIN CERTIFICATE --------`
    /// entries and silently ignore unknown ones. If you would like to specify
    /// an alternate set of tags (this is the value after the `BEGIN`) to search,
    /// call [Self::from_pem_multiple_tags].
    pub fn from_pem_multiple(data: impl AsRef<[u8]>) -> Result<Vec<Self>, Error> {
        Self::from_pem_multiple_tags(data, &["CERTIFICATE"])
    }

    /// Construct instances by parsing PEM armored DER encoded certificates with specific PEM tags.
    ///
    /// This is like [Self::from_pem_multiple] except you control the filter for
    /// which `BEGIN <tag>` values are filtered through to the DER parser.
    pub fn from_pem_multiple_tags(
        data: impl AsRef<[u8]>,
        tags: &[&str],
    ) -> Result<Vec<Self>, Error> {
        let pem = pem::parse_many(data.as_ref()).map_err(Error::PemDecode)?;

        pem.into_iter()
            .filter(|pem| tags.contains(&pem.tag()))
            .map(|pem| Self::from_der(pem.contents()))
            .collect::<Result<_, _>>()
    }

    /// Obtain the DER data that was used to construct this instance.
    ///
    /// The data is guaranteed to not have been modified since the instance
    /// was constructed.
    pub fn constructed_data(&self) -> &[u8] {
        match &self.original {
            OriginalData::Ber(data) => data,
            OriginalData::Der(data) => data,
        }
    }

    /// Encode the original contents of this certificate to PEM.
    pub fn encode_pem(&self) -> String {
        pem::Pem::new("CERTIFICATE", self.constructed_data()).to_string()
    }

    /// Verify that another certificate, `other`, signed this certificate.
    ///
    /// If this is a self-signed certificate, you can pass `self` as the 2nd
    /// argument.
    ///
    /// This function isn't exposed on [X509Certificate] because the exact
    /// bytes constituting the certificate's internals need to be consulted
    /// to verify signatures. And since this type tracks the underlying
    /// bytes, we are guaranteed to have a pristine copy.
    pub fn verify_signed_by_certificate(
        &self,
        other: impl AsRef<X509Certificate>,
    ) -> Result<(), Error> {
        let public_key = other
            .as_ref()
            .0
            .tbs_certificate
            .subject_public_key_info
            .subject_public_key
            .octet_bytes();

        self.verify_signed_by_public_key(public_key)
    }

    /// Verify a signature over signed data purportedly signed by this certificate.
    ///
    /// This is a wrapper to [Self::verify_signed_data_with_algorithm()] that will derive
    /// the verification algorithm from the public key type type and the signature algorithm
    /// indicated in this certificate. Typically these align. However, it is possible for
    /// a signature to be produced with a different digest algorithm from that indicated
    /// in this certificate.
    pub fn verify_signed_data(
        &self,
        signed_data: impl AsRef<[u8]>,
        signature: impl AsRef<[u8]>,
    ) -> Result<(), Error> {
        let key_algorithm = KeyAlgorithm::try_from(self.key_algorithm_oid())?;
        let signature_algorithm = SignatureAlgorithm::try_from(self.signature_algorithm_oid())?;
        let verify_algorithm = signature_algorithm.resolve_verification_algorithm(key_algorithm)?;

        self.verify_signed_data_with_algorithm(signed_data, signature, verify_algorithm)
    }

    /// Verify a signature over signed data using an explicit verification algorithm.
    ///
    /// This is like [Self::verify_signed_data()] except the verification algorithm to use
    /// is passed in instead of derived from the default algorithm for the signing key's
    /// type.
    pub fn verify_signed_data_with_algorithm(
        &self,
        signed_data: impl AsRef<[u8]>,
        signature: impl AsRef<[u8]>,
        verify_algorithm: &'static dyn ringsig::VerificationAlgorithm,
    ) -> Result<(), Error> {
        let public_key = ringsig::UnparsedPublicKey::new(verify_algorithm, self.public_key_data());

        public_key
            .verify(signed_data.as_ref(), signature.as_ref())
            .map_err(|_| Error::CertificateSignatureVerificationFailed)
    }

    /// Verifies that this certificate was cryptographically signed using raw public key data from a signing key.
    ///
    /// This function does the low-level work of extracting the signature and
    /// verification details from the current certificate and figuring out
    /// the correct combination of cryptography settings to apply to perform
    /// signature verification.
    ///
    /// In many cases, an X.509 certificate is signed by another certificate. And
    /// since the public key is embedded in the X.509 certificate, it is easier
    /// to go through [Self::verify_signed_by_certificate] instead.
    pub fn verify_signed_by_public_key(
        &self,
        public_key_data: impl AsRef<[u8]>,
    ) -> Result<(), Error> {
        // Always verify against the original content, as the inner
        // certificate could be mutated via the mutable wrapper of this
        // type.
        let this_cert = match &self.original {
            OriginalData::Ber(data) => X509Certificate::from_ber(data),
            OriginalData::Der(data) => X509Certificate::from_der(data),
        }
        .expect("certificate re-parse should never fail");

        let signed_data = this_cert
            .0
            .tbs_certificate
            .raw_data
            .as_ref()
            .expect("original certificate data should have persisted as part of re-parse");
        let signature = this_cert.0.signature.octet_bytes();

        let key_algorithm = KeyAlgorithm::try_from(
            &this_cert
                .0
                .tbs_certificate
                .subject_public_key_info
                .algorithm,
        )?;
        let signature_algorithm = SignatureAlgorithm::try_from(&this_cert.0.signature_algorithm)?;

        let verify_algorithm = signature_algorithm.resolve_verification_algorithm(key_algorithm)?;

        let public_key = ringsig::UnparsedPublicKey::new(verify_algorithm, public_key_data);

        public_key
            .verify(signed_data, &signature)
            .map_err(|_| Error::CertificateSignatureVerificationFailed)
    }

    /// Attempt to find the issuing certificate of this one.
    ///
    /// Given an iterable of certificates, we find the first certificate
    /// where we are able to verify that our signature was made by their public
    /// key.
    ///
    /// This function can yield false negatives for cases where we don't
    /// support the signature algorithm on the incoming certificates.
    pub fn find_signing_certificate<'a>(
        &self,
        mut certs: impl Iterator<Item = &'a Self>,
    ) -> Option<&'a Self> {
        certs.find(|candidate| self.verify_signed_by_certificate(candidate).is_ok())
    }

    /// Attempt to resolve the signing chain of this certificate.
    ///
    /// Given an iterable of certificates, we recursively resolve the
    /// chain of certificates that signed this one until we are no longer able
    /// to find any more certificates in the input set.
    ///
    /// Like [Self::find_signing_certificate], this can yield false
    /// negatives (read: an incomplete chain) due to run-time failures,
    /// such as lack of support for a certificate's signature algorithm.
    ///
    /// As a certificate is encountered, it is removed from the set of
    /// future candidates.
    ///
    /// The traversal ends when we get to an identical certificate (its
    /// DER data is equivalent) or we couldn't find a certificate in
    /// the remaining set that signed the last one.
    ///
    /// Because we need to recursively verify certificates, the incoming
    /// iterator is buffered.
    pub fn resolve_signing_chain<'a>(
        &self,
        certs: impl Iterator<Item = &'a Self>,
    ) -> Vec<&'a Self> {
        // The logic here is a bit wonky. As we build up the collection of certificates,
        // we want to filter out ourself and remove duplicates. We remove duplicates by
        // storing encountered certificates in a HashSet.
        #[allow(clippy::mutable_key_type)]
        let mut seen = HashSet::new();
        let mut remaining = vec![];

        for cert in certs {
            if cert == self || seen.contains(cert) {
                continue;
            } else {
                remaining.push(cert);
                seen.insert(cert);
            }
        }

        drop(seen);

        let mut chain = vec![];

        let mut last_cert = self;
        while let Some(issuer) = last_cert.find_signing_certificate(remaining.iter().copied()) {
            chain.push(issuer);
            last_cert = issuer;

            remaining = remaining
                .drain(..)
                .filter(|cert| *cert != issuer)
                .collect::<Vec<_>>();
        }

        chain
    }
}

impl PartialEq for CapturedX509Certificate {
    fn eq(&self, other: &Self) -> bool {
        self.constructed_data() == other.constructed_data()
    }
}

impl Eq for CapturedX509Certificate {}

impl Hash for CapturedX509Certificate {
    fn hash<H: Hasher>(&self, state: &mut H) {
        state.write(self.constructed_data());
    }
}

impl Deref for CapturedX509Certificate {
    type Target = X509Certificate;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl AsRef<X509Certificate> for CapturedX509Certificate {
    fn as_ref(&self) -> &X509Certificate {
        &self.inner
    }
}

impl AsRef<rfc5280::Certificate> for CapturedX509Certificate {
    fn as_ref(&self) -> &rfc5280::Certificate {
        self.inner.as_ref()
    }
}

impl TryFrom<&X509Certificate> for CapturedX509Certificate {
    type Error = Error;

    fn try_from(cert: &X509Certificate) -> Result<Self, Self::Error> {
        let mut buffer = Vec::<u8>::new();
        cert.encode_der_to(&mut buffer)?;

        Self::from_der(buffer)
    }
}

impl TryFrom<X509Certificate> for CapturedX509Certificate {
    type Error = Error;

    fn try_from(cert: X509Certificate) -> Result<Self, Self::Error> {
        let mut buffer = Vec::<u8>::new();
        cert.encode_der_to(&mut buffer)?;

        Self::from_der(buffer)
    }
}

impl From<CapturedX509Certificate> for rfc5280::Certificate {
    fn from(cert: CapturedX509Certificate) -> Self {
        cert.inner.0
    }
}

/// Provides a mutable wrapper to an X.509 certificate that was parsed from data.
///
/// This is like [CapturedX509Certificate] except it implements [DerefMut],
/// enabling you to modify the certificate while still being able to access
/// the raw data the certificate is backed by. However, mutations are
/// only performed against the parsed ASN.1 data structure, not the original
/// data it was constructed with.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MutableX509Certificate(CapturedX509Certificate);

impl Deref for MutableX509Certificate {
    type Target = X509Certificate;

    fn deref(&self) -> &Self::Target {
        &self.0.inner
    }
}

impl DerefMut for MutableX509Certificate {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0.inner
    }
}

impl From<CapturedX509Certificate> for MutableX509Certificate {
    fn from(cert: CapturedX509Certificate) -> Self {
        Self(cert)
    }
}

/// Whether one certificate is a subset of another certificate.
///
/// This returns true iff the two certificates have the same serial number
/// and every `Name` attribute in the first certificate is present in the other.
pub fn certificate_is_subset_of(
    a_serial: &Integer,
    a_name: &Name,
    b_serial: &Integer,
    b_name: &Name,
) -> bool {
    if a_serial != b_serial {
        return false;
    }

    let Name::RdnSequence(a_sequence) = &a_name;
    let Name::RdnSequence(b_sequence) = &b_name;

    a_sequence.iter().all(|rdn| b_sequence.contains(rdn))
}

/// X.509 extension to define how a certificate can be used.
///
/// ```asn.1
/// KeyUsage ::= BIT STRING {
///   digitalSignature(0),
///   nonRepudiation(1),
///   keyEncipherment(2),
///   dataEncipherment(3),
///   keyAgreement(4),
///   keyCertSign(5),
///   cRLSign(6)
/// }
/// ```
pub enum KeyUsage {
    DigitalSignature,
    NonRepudiation,
    KeyEncipherment,
    DataEncipherment,
    KeyAgreement,
    KeyCertSign,
    CrlSign,
}

impl From<KeyUsage> for u8 {
    fn from(ku: KeyUsage) -> Self {
        match ku {
            KeyUsage::DigitalSignature => 0,
            KeyUsage::NonRepudiation => 1,
            KeyUsage::KeyEncipherment => 2,
            KeyUsage::DataEncipherment => 3,
            KeyUsage::KeyAgreement => 4,
            KeyUsage::KeyCertSign => 5,
            KeyUsage::CrlSign => 6,
        }
    }
}

/// Interface for constructing new X.509 certificates.
///
/// This holds fields for various certificate metadata and allows you
/// to incrementally derive a new X.509 certificate.
///
/// The certificate is populated with defaults:
///
/// * The serial number is 1.
/// * The time validity is now until 1 hour from now.
/// * There is no issuer. If no attempt is made to define an issuer,
///   the subject will be copied to the issuer field and this will be
///   a self-signed certificate.
///
/// This type can also be used to produce certificate signing requests. In this mode,
/// only the subject value and additional registered attributes are meaningful.
pub struct X509CertificateBuilder {
    subject: Name,
    issuer: Option<Name>,
    extensions: rfc5280::Extensions,
    serial_number: i64,
    not_before: chrono::DateTime<Utc>,
    not_after: chrono::DateTime<Utc>,
    csr_attributes: Attributes,
}

impl Default for X509CertificateBuilder {
    fn default() -> Self {
        let not_before = Utc::now();
        let not_after = not_before + Duration::hours(1);

        Self {
            subject: Name::default(),
            issuer: None,
            extensions: rfc5280::Extensions::default(),
            serial_number: 1,
            not_before,
            not_after,
            csr_attributes: Attributes::default(),
        }
    }
}

impl X509CertificateBuilder {
    /// Deprecated. Use [Self::default()] instead.
    #[deprecated]
    pub fn new() -> Self {
        Self::default()
    }

    /// Obtain a mutable reference to the subject [Name].
    ///
    /// The type has functions that will allow you to add attributes with ease.
    pub fn subject(&mut self) -> &mut Name {
        &mut self.subject
    }

    /// Obtain a mutable reference to the issuer [Name].
    ///
    /// If no issuer has been created yet, an empty one will be created.
    pub fn issuer(&mut self) -> &mut Name {
        self.issuer.get_or_insert_with(Name::default)
    }

    /// Set the serial number for the certificate.
    pub fn serial_number(&mut self, value: i64) {
        self.serial_number = value;
    }

    /// Obtain the raw certificate extensions.
    pub fn extensions(&self) -> &rfc5280::Extensions {
        &self.extensions
    }

    /// Obtain a mutable reference to raw certificate extensions.
    pub fn extensions_mut(&mut self) -> &mut rfc5280::Extensions {
        &mut self.extensions
    }

    /// Add an extension to the certificate with its value as pre-encoded DER data.
    pub fn add_extension_der_data(&mut self, oid: Oid, critical: bool, data: impl AsRef<[u8]>) {
        self.extensions.push(rfc5280::Extension {
            id: oid,
            critical: Some(critical),
            value: OctetString::new(Bytes::copy_from_slice(data.as_ref())),
        });
    }

    /// Set the expiration time in terms of [Duration] since its currently set start time.
    pub fn validity_duration(&mut self, duration: Duration) {
        self.not_after = self.not_before + duration;
    }

    /// Add a basic constraint extension that this isn't a CA certificate.
    pub fn constraint_not_ca(&mut self) {
        self.extensions.push(rfc5280::Extension {
            id: Oid(OID_EXTENSION_BASIC_CONSTRAINTS.as_ref().into()),
            critical: Some(true),
            value: OctetString::new(Bytes::copy_from_slice(&[0x30, 00])),
        });
    }

    /// Add a key usage extension.
    pub fn key_usage(&mut self, key_usage: KeyUsage) {
        let value: u8 = key_usage.into();

        self.extensions.push(rfc5280::Extension {
            id: Oid(OID_EXTENSION_KEY_USAGE.as_ref().into()),
            critical: Some(true),
            // Value is a bit string. We just encode it manually since it is easy.
            value: OctetString::new(Bytes::copy_from_slice(&[3, 2, 7, 128 | value])),
        });
    }

    /// Add an [Attribute] to a future certificate signing requests.
    ///
    /// Has no effect on regular certificate creation: only if creating certificate
    /// signing requests.
    pub fn add_csr_attribute(&mut self, attribute: rfc5652::Attribute) {
        self.csr_attributes.push(attribute);
    }

    /// Create a new certificate given settings using the provided key pair.
    pub fn create_with_key_pair(
        &self,
        key_pair: &InMemorySigningKeyPair,
    ) -> Result<CapturedX509Certificate, Error> {
        let key_pair_signature_algorithm = key_pair.signature_algorithm();

        let issuer = if let Some(issuer) = &self.issuer {
            issuer
        } else {
            &self.subject
        };

        let tbs_certificate = rfc5280::TbsCertificate {
            version: Some(rfc5280::Version::V3),
            serial_number: self.serial_number.into(),
            signature: key_pair_signature_algorithm?.into(),
            issuer: issuer.clone(),
            validity: rfc5280::Validity {
                not_before: Time::from(self.not_before),
                not_after: Time::from(self.not_after),
            },
            subject: self.subject.clone(),
            subject_public_key_info: rfc5280::SubjectPublicKeyInfo {
                algorithm: key_pair
                    .key_algorithm()
                    .expect("InMemorySigningKeyPair always has known key algorithm")
                    .into(),
                subject_public_key: BitString::new(0, key_pair.public_key_data()),
            },
            issuer_unique_id: None,
            subject_unique_id: None,
            extensions: if self.extensions.is_empty() {
                None
            } else {
                Some(self.extensions.clone())
            },
            raw_data: None,
        };

        // Now encode the TBS certificate so we can sign it with the private key
        // and include its signature.
        let mut tbs_der = Vec::<u8>::new();
        tbs_certificate
            .encode_ref()
            .write_encoded(Mode::Der, &mut tbs_der)?;

        let signature = key_pair.try_sign(&tbs_der)?;
        let signature_algorithm = key_pair.signature_algorithm()?;

        let cert = rfc5280::Certificate {
            tbs_certificate,
            signature_algorithm: signature_algorithm.into(),
            signature: BitString::new(0, Bytes::copy_from_slice(signature.as_ref())),
        };

        let cert = X509Certificate::from(cert);
        let cert_der = cert.encode_der()?;

        CapturedX509Certificate::from_der(cert_der)
    }

    /// Create a new certificate given settings, using a randomly generated key pair.
    pub fn create_with_random_keypair(
        &self,
        key_algorithm: KeyAlgorithm,
    ) -> Result<(CapturedX509Certificate, InMemorySigningKeyPair), Error> {
        let key_pair = InMemorySigningKeyPair::generate_random(key_algorithm)?;
        let cert = self.create_with_key_pair(&key_pair)?;

        Ok((cert, key_pair))
    }

    /// Create a new certificate signing request (CSR).
    ///
    /// The CSR is derived according to the process defined in RFC 2986 Section 3.
    /// Essentially, we collect metadata about the request, sign that metadata using
    /// a provided signing/private key, then attach the signature to form a complete
    /// certification request.
    pub fn create_certificate_signing_request(
        &self,
        signer: &dyn KeyInfoSigner,
    ) -> Result<rfc2986::CertificationRequest, Error> {
        let info = rfc2986::CertificationRequestInfo {
            version: rfc2986::Version::V1,
            subject: self.subject.clone(),
            subject_public_key_info: rfc5280::SubjectPublicKeyInfo {
                algorithm: signer
                    .key_algorithm()
                    .ok_or_else(|| {
                        Error::UnknownKeyAlgorithm(
                            "OID not available due to API limitations".into(),
                        )
                    })?
                    .into(),
                subject_public_key: BitString::new(0, signer.public_key_data()),
            },
            attributes: self.csr_attributes.clone(),
        };

        // The signature is produced over the DER encoding of CertificationRequestInfo
        // per RFC 2986 Section 4.2.
        let mut info_der = vec![];
        info.write_encoded(Mode::Der, &mut info_der)?;

        let signature = signer.try_sign(&info_der)?;
        let signature_algorithm = signer.signature_algorithm()?;

        let request = rfc2986::CertificationRequest {
            certificate_request_info: info,
            signature_algorithm: signature_algorithm.into(),
            signature: BitString::new(0, signature.into()),
        };

        Ok(request)
    }
}

#[cfg(test)]
mod test {
    use {
        super::*,
        crate::{EcdsaCurve, X509CertificateError},
    };

    #[test]
    fn builder_ed25519_default() {
        let builder = X509CertificateBuilder::default();
        builder
            .create_with_random_keypair(KeyAlgorithm::Ed25519)
            .unwrap();
    }

    #[test]
    fn build_ecdsa_default() {
        for curve in EcdsaCurve::all() {
            let key_algorithm = KeyAlgorithm::Ecdsa(*curve);

            let builder = X509CertificateBuilder::default();
            builder.create_with_random_keypair(key_algorithm).unwrap();
        }
    }

    #[test]
    fn build_subject_populate() {
        let mut builder = X509CertificateBuilder::default();
        builder
            .subject()
            .append_common_name_utf8_string("My Name")
            .unwrap();
        builder
            .subject()
            .append_country_utf8_string("Wakanda")
            .unwrap();

        builder
            .create_with_random_keypair(KeyAlgorithm::Ed25519)
            .unwrap();
    }

    #[test]
    fn builder_csr_ecdsa() -> Result<(), Error> {
        for curve in EcdsaCurve::all() {
            let key_algorithm = KeyAlgorithm::Ecdsa(*curve);

            let key = InMemorySigningKeyPair::generate_random(key_algorithm)?;

            let builder = X509CertificateBuilder::default();

            let csr = builder.create_certificate_signing_request(&key)?;

            assert_eq!(
                csr.certificate_request_info
                    .subject_public_key_info
                    .algorithm,
                key_algorithm.into()
            );
        }

        Ok(())
    }

    #[test]
    fn ecdsa_p256_sha256_self_signed() {
        let der = include_bytes!("testdata/ecdsa-p256-sha256-self-signed.cer");

        let cert = CapturedX509Certificate::from_der(der.to_vec()).unwrap();
        cert.verify_signed_by_certificate(&cert).unwrap();

        cert.to_public_key_der().unwrap();
    }

    #[test]
    fn ecdsa_p384_sha256_self_signed() {
        let der = include_bytes!("testdata/ecdsa-p384-sha256-self-signed.cer");

        let cert = CapturedX509Certificate::from_der(der.to_vec()).unwrap();
        cert.verify_signed_by_certificate(&cert).unwrap();
        cert.to_public_key_der().unwrap();
    }

    #[test]
    fn ecdsa_p512_sha256_self_signed() {
        let der = include_bytes!("testdata/ecdsa-p512-sha256-self-signed.cer");

        // We can parse this. But we don't support secp512 elliptic curves because ring
        // doesn't support it.
        let cert = CapturedX509Certificate::from_der(der.to_vec()).unwrap();
        cert.to_public_key_der().unwrap();

        assert!(matches!(
            cert.verify_signed_by_certificate(&cert),
            Err(Error::UnknownEllipticCurve(_))
        ));
    }

    #[test]
    fn ecdsa_prime256v1_cert_validation() -> Result<(), X509CertificateError> {
        let root = include_bytes!("testdata/ecdsa-prime256v1-root.der");
        let signed = include_bytes!("testdata/ecdsa-prime256v1-signed.der");

        let root = CapturedX509Certificate::from_der(root.as_ref())?;
        let signed = CapturedX509Certificate::from_der(signed.as_ref())?;

        root.verify_signed_by_certificate(&root)?;
        signed.verify_signed_by_certificate(&root)?;

        Ok(())
    }
}
