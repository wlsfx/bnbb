// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

//! Cryptographic algorithms commonly encountered in X.509 certificates.

use {
    crate::{
        rfc3447::DigestInfo,
        rfc5280::{AlgorithmIdentifier, AlgorithmParameter},
        X509CertificateError as Error,
    },
    bcder::{encode::Values, ConstOid, OctetString, Oid},
    ring::{digest, signature},
    spki::ObjectIdentifier,
    std::fmt::{Display, Formatter},
};

/// SHA-1 digest algorithm.
///
/// 1.3.14.3.2.26
const OID_SHA1: ConstOid = Oid(&[43, 14, 3, 2, 26]);

/// SHA-256 digest algorithm.
///
/// 2.16.840.1.101.3.4.2.1
const OID_SHA256: ConstOid = Oid(&[96, 134, 72, 1, 101, 3, 4, 2, 1]);

/// SHA-512 digest algorithm.
///
/// 2.16.840.1.101.3.4.2.2
const OID_SHA384: ConstOid = Oid(&[96, 134, 72, 1, 101, 3, 4, 2, 2]);

/// SHA-512 digest algorithm.
///
/// 2.16.840.1.101.3.4.2.3
const OID_SHA512: ConstOid = Oid(&[96, 134, 72, 1, 101, 3, 4, 2, 3]);

/// RSA+SHA-1 encryption.
///
/// 1.2.840.113549.1.1.5
const OID_SHA1_RSA: ConstOid = Oid(&[42, 134, 72, 134, 247, 13, 1, 1, 5]);

/// RSA+SHA-256 encryption.
///
/// 1.2.840.113549.1.1.11
const OID_SHA256_RSA: ConstOid = Oid(&[42, 134, 72, 134, 247, 13, 1, 1, 11]);

/// RSA+SHA-384 encryption.
///
/// 1.2.840.113549.1.1.12
const OID_SHA384_RSA: ConstOid = Oid(&[42, 134, 72, 134, 247, 13, 1, 1, 12]);

/// RSA+SHA-512 encryption.
///
/// 1.2.840.113549.1.1.13
const OID_SHA512_RSA: ConstOid = Oid(&[42, 134, 72, 134, 247, 13, 1, 1, 13]);

/// RSA encryption.
///
/// 1.2.840.113549.1.1.1
const OID_RSA: ConstOid = Oid(&[42, 134, 72, 134, 247, 13, 1, 1, 1]);

/// ECDSA with SHA-256.
///
/// 1.2.840.10045.4.3.2
pub(crate) const OID_ECDSA_SHA256: ConstOid = Oid(&[42, 134, 72, 206, 61, 4, 3, 2]);

/// ECDSA with SHA-384.
///
/// 1.2.840.10045.4.3.2
pub(crate) const OID_ECDSA_SHA384: ConstOid = Oid(&[42, 134, 72, 206, 61, 4, 3, 3]);

/// Elliptic curve public key cryptography.
///
/// 1.2.840.10045.2.1
pub(crate) const OID_EC_PUBLIC_KEY: ConstOid = Oid(&[42, 134, 72, 206, 61, 2, 1]);

/// ED25519 key agreement.
///
/// 1.3.101.110
const OID_ED25519_KEY_AGREEMENT: ConstOid = Oid(&[43, 101, 110]);

/// Edwards curve digital signature algorithm.
///
/// 1.3.101.112
const OID_ED25519_SIGNATURE_ALGORITHM: ConstOid = Oid(&[43, 101, 112]);

/// Elliptic curve identifier for secp256r1.
///
/// 1.2.840.10045.3.1.7
pub(crate) const OID_EC_SECP256R1: ConstOid = Oid(&[42, 134, 72, 206, 61, 3, 1, 7]);

/// Elliptic curve identifier for secp384r1.
///
/// 1.3.132.0.34
pub(crate) const OID_EC_SECP384R1: ConstOid = Oid(&[43, 129, 4, 0, 34]);

/// No signature identifier
/// 
/// 1.3.6.1.5.5.7.6.2
pub(crate) const OID_NO_SIGNATURE_ALGORITHM: ConstOid = Oid(&[43, 6, 1, 5, 5, 7, 6, 2]);

/// A hashing algorithm used for digesting data.
///
/// Instances can be converted to and from [Oid] via `From`/`Into`
/// implementations.
///
/// They can also be converted to and from The ASN.1 [AlgorithmIdentifier],
/// which is commonly used to represent them in X.509 certificates.
///
/// Instances can be converted into a [digest::Context] capable of computing
/// digests via `From`/`Into`.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum DigestAlgorithm {
    /// SHA-1.
    ///
    /// Corresponds to OID 1.3.14.3.2.26.
    Sha1,

    /// SHA-256.
    ///
    /// Corresponds to OID 2.16.840.1.101.3.4.2.1.
    Sha256,

    /// SHA-384.
    ///
    /// Corresponds to OID 2.16.840.1.101.3.4.2.2.
    Sha384,

    /// SHA-512.
    ///
    /// Corresponds to OID 2.16.840.1.101.3.4.2.3.
    Sha512,
}

impl Display for DigestAlgorithm {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            DigestAlgorithm::Sha1 => f.write_str("SHA-1"),
            DigestAlgorithm::Sha256 => f.write_str("SHA-256"),
            DigestAlgorithm::Sha384 => f.write_str("SHA-384"),
            DigestAlgorithm::Sha512 => f.write_str("SHA-512"),
        }
    }
}

impl From<DigestAlgorithm> for Oid {
    fn from(alg: DigestAlgorithm) -> Self {
        Oid(match alg {
            DigestAlgorithm::Sha1 => OID_SHA1.as_ref(),
            DigestAlgorithm::Sha256 => OID_SHA256.as_ref(),
            DigestAlgorithm::Sha384 => OID_SHA384.as_ref(),
            DigestAlgorithm::Sha512 => OID_SHA512.as_ref(),
        }
        .into())
    }
}

impl TryFrom<&Oid> for DigestAlgorithm {
    type Error = Error;

    fn try_from(v: &Oid) -> Result<Self, Self::Error> {
        if v == &OID_SHA1 {
            Ok(Self::Sha1)
        } else if v == &OID_SHA256 {
            Ok(Self::Sha256)
        } else if v == &OID_SHA384 {
            Ok(Self::Sha384)
        } else if v == &OID_SHA512 {
            Ok(Self::Sha512)
        } else {
            Err(Error::UnknownDigestAlgorithm(format!("{}", v)))
        }
    }
}

impl TryFrom<&AlgorithmIdentifier> for DigestAlgorithm {
    type Error = Error;

    fn try_from(v: &AlgorithmIdentifier) -> Result<Self, Self::Error> {
        Self::try_from(&v.algorithm)
    }
}

impl From<DigestAlgorithm> for AlgorithmIdentifier {
    fn from(alg: DigestAlgorithm) -> Self {
        Self {
            algorithm: alg.into(),
            parameters: None,
        }
    }
}

impl From<DigestAlgorithm> for digest::Context {
    fn from(alg: DigestAlgorithm) -> Self {
        digest::Context::new(match alg {
            DigestAlgorithm::Sha1 => &digest::SHA1_FOR_LEGACY_USE_ONLY,
            DigestAlgorithm::Sha256 => &digest::SHA256,
            DigestAlgorithm::Sha384 => &digest::SHA384,
            DigestAlgorithm::Sha512 => &digest::SHA512,
        })
    }
}

impl DigestAlgorithm {
    /// Obtain an object that can be used to digest content using this algorithm.
    pub fn digester(&self) -> digest::Context {
        digest::Context::from(*self)
    }

    /// Digest a slice of data.
    pub fn digest_data(&self, data: &[u8]) -> Vec<u8> {
        let mut h = self.digester();
        h.update(data);
        h.finish().as_ref().to_vec()
    }

    /// Digest content from a reader.
    pub fn digest_reader<R: std::io::Read>(&self, fh: &mut R) -> Result<Vec<u8>, std::io::Error> {
        let mut h = self.digester();

        loop {
            let mut buffer = [0u8; 16384];
            let count = fh.read(&mut buffer)?;

            h.update(&buffer[0..count]);

            if count < buffer.len() {
                break;
            }
        }

        Ok(h.finish().as_ref().to_vec())
    }

    /// Digest the content of a path.
    pub fn digest_path(&self, path: &std::path::Path) -> Result<Vec<u8>, std::io::Error> {
        self.digest_reader(&mut std::fs::File::open(path)?)
    }

    /// EMSA-PKCS1-v1_5 padding procedure.
    ///
    /// As defined by https://tools.ietf.org/html/rfc3447#section-9.2.
    ///
    /// `message` is the message to digest and encode.
    ///
    /// `target_length_in_bytes` is the target length of the padding. This should match the RSA
    /// key length. e.g. 2048 bit keys are length 256.
    pub fn rsa_pkcs1_encode(
        &self,
        message: &[u8],
        target_length_in_bytes: usize,
    ) -> Result<Vec<u8>, Error> {
        let digest = self.digest_data(message);

        let digest_info = DigestInfo {
            algorithm: (*self).into(),
            digest: OctetString::new(digest.into()),
        };
        let mut digest_info_der = vec![];
        digest_info.write_encoded(bcder::Mode::Der, &mut digest_info_der)?;

        let encoded_digest_len = digest_info_der.len();

        // At least 8 bytes of padding are required. And there's a 2 byte header plus NULL
        // termination of the padding. So the target length must be 11+ bytes longer than
        // the encoded digest.
        if encoded_digest_len + 11 > target_length_in_bytes {
            return Err(Error::PkcsEncodeTooShort);
        }

        let pad_len = target_length_in_bytes - encoded_digest_len - 3;

        let mut res = vec![0xff; target_length_in_bytes];
        // Constant header.
        res[0] = 0x00;
        // Private key block type.
        res[1] = 0x01;
        // Padding bytes are already filled in.
        // NULL terminate padding.
        res[2 + pad_len] = 0x00;

        let digest_destination = &mut res[3 + pad_len..];
        digest_destination.copy_from_slice(&digest_info_der);

        Ok(res)
    }
}

/// An algorithm used to digitally sign content.
///
/// Instances can be converted to/from [Oid] via `From`/`Into`.
///
/// Similarly, instances can be converted to/from an ASN.1
/// [AlgorithmIdentifier].
///
/// It is also possible to obtain a [signature::VerificationAlgorithm] from
/// an instance. This type can perform actual cryptographic verification
/// that was signed with this algorithm.
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum SignatureAlgorithm {
    /// SHA-1 with RSA encryption.
    ///
    /// Corresponds to OID 1.2.840.113549.1.1.5.
    RsaSha1,

    /// SHA-256 with RSA encryption.
    ///
    /// Corresponds to OID 1.2.840.113549.1.1.11.
    RsaSha256,

    /// SHA-384 with RSA encryption.
    ///
    /// Corresponds to OID 1.2.840.113549.1.1.12.
    RsaSha384,

    /// SHA-512 with RSA encryption.
    ///
    /// Corresponds to OID 1.2.840.113549.1.1.13.
    RsaSha512,

    /// ECDSA with SHA-256.
    ///
    /// Corresponds to OID 1.2.840.10045.4.3.2.
    EcdsaSha256,

    /// ECDSA with SHA-384.
    ///
    /// Corresponds to OID 1.2.840.10045.4.3.3.
    EcdsaSha384,

    /// ED25519
    ///
    /// Corresponds to OID 1.3.101.112.
    Ed25519,

    /// No signature with digest algorithm
    /// 
    /// Corresponds to OID 1.3.6.1.5.5.7.6.2
    NoSignature(DigestAlgorithm)
}

impl SignatureAlgorithm {
    /// Attempt to resolve an instance from an OID, known [KeyAlgorithm], and optional [DigestAlgorithm].
    ///
    /// Signature algorithm OIDs in the wild are typically either:
    ///
    /// a) an OID that denotes the key algorithm and corresponding digest format (what this
    ///    enumeration represents)
    /// b) an OID that denotes just the key algorithm.
    ///
    /// What this function does is attempt to construct an instance from any OID.
    /// If the OID defines a key + digest algorithm, we get a [SignatureAlgorithm]
    /// from that. If we get a key algorithm we combine with the provided [DigestAlgorithm]
    /// to resolve an appropriate [SignatureAlgorithm].
    pub fn from_oid_and_digest_algorithm(
        oid: &Oid,
        digest_algorithm: DigestAlgorithm,
    ) -> Result<Self, Error> {
        if let Ok(alg) = Self::try_from(oid) {
            Ok(alg)
        } else if let Ok(key_alg) = KeyAlgorithm::try_from(oid) {
            match key_alg {
                KeyAlgorithm::Rsa => match digest_algorithm {
                    DigestAlgorithm::Sha1 => Ok(Self::RsaSha1),
                    DigestAlgorithm::Sha256 => Ok(Self::RsaSha256),
                    DigestAlgorithm::Sha384 => Ok(Self::RsaSha384),
                    DigestAlgorithm::Sha512 => Ok(Self::RsaSha512),
                },
                KeyAlgorithm::Ed25519 => Ok(Self::Ed25519),
                KeyAlgorithm::Ecdsa(_) => match digest_algorithm {
                    DigestAlgorithm::Sha256 => Ok(Self::EcdsaSha256),
                    DigestAlgorithm::Sha384 => Ok(Self::EcdsaSha384),
                    DigestAlgorithm::Sha1 | DigestAlgorithm::Sha512 => {
                        Err(Error::UnknownSignatureAlgorithm(format!(
                            "cannot use digest {:?} with ECDSA",
                            digest_algorithm
                        )))
                    }
                },
            }
        } else if oid == &OID_NO_SIGNATURE_ALGORITHM {
            Ok(Self::NoSignature(digest_algorithm))
        } else {
            Err(Error::UnknownSignatureAlgorithm(format!(
                "do not know how to resolve {} to a signature algorithm",
                oid
            )))
        }
    }

    /// Creates an instance with the noSignature mechanism and [DigestAlgorithm]
    pub fn from_digest_algorithm(
        digest_algorithm: DigestAlgorithm,
    ) -> Self {
        Self::NoSignature(digest_algorithm)
    }

    /// Attempt to resolve the verification algorithm using info about the signing key algorithm.
    ///
    /// Only specific combinations of methods are supported. e.g. you can only use
    /// RSA verification with RSA signing keys. Same for ECDSA and ED25519.
    pub fn resolve_verification_algorithm(
        &self,
        key_algorithm: KeyAlgorithm,
    ) -> Result<&'static dyn signature::VerificationAlgorithm, Error> {
        match key_algorithm {
            KeyAlgorithm::Rsa => match self {
                Self::RsaSha1 => Ok(&signature::RSA_PKCS1_2048_8192_SHA1_FOR_LEGACY_USE_ONLY),
                Self::RsaSha256 => Ok(&signature::RSA_PKCS1_2048_8192_SHA256),
                Self::RsaSha384 => Ok(&signature::RSA_PKCS1_2048_8192_SHA384),
                Self::RsaSha512 => Ok(&signature::RSA_PKCS1_2048_8192_SHA512),
                alg => Err(Error::UnsupportedSignatureVerification(key_algorithm, *alg)),
            },
            KeyAlgorithm::Ed25519 => match self {
                Self::Ed25519 => Ok(&signature::ED25519),
                alg => Err(Error::UnsupportedSignatureVerification(key_algorithm, *alg)),
            },
            KeyAlgorithm::Ecdsa(curve) => match curve {
                EcdsaCurve::Secp256r1 => match self {
                    Self::EcdsaSha256 => Ok(&signature::ECDSA_P256_SHA256_ASN1),
                    Self::EcdsaSha384 => Ok(&signature::ECDSA_P256_SHA384_ASN1),
                    alg => Err(Error::UnsupportedSignatureVerification(key_algorithm, *alg)),
                },
                EcdsaCurve::Secp384r1 => match self {
                    Self::EcdsaSha256 => Ok(&signature::ECDSA_P384_SHA256_ASN1),
                    Self::EcdsaSha384 => Ok(&signature::ECDSA_P384_SHA384_ASN1),
                    alg => Err(Error::UnsupportedSignatureVerification(key_algorithm, *alg)),
                },
            },
        }
    }

    /// Resolve the [DigestAlgorithm] for this signature algorithm.
    pub fn digest_algorithm(&self) -> Option<DigestAlgorithm> {
        match self {
            SignatureAlgorithm::RsaSha1 => Some(DigestAlgorithm::Sha1),
            SignatureAlgorithm::RsaSha256 => Some(DigestAlgorithm::Sha256),
            SignatureAlgorithm::RsaSha384 => Some(DigestAlgorithm::Sha384),
            SignatureAlgorithm::RsaSha512 => Some(DigestAlgorithm::Sha512),
            SignatureAlgorithm::EcdsaSha256 => Some(DigestAlgorithm::Sha256),
            SignatureAlgorithm::EcdsaSha384 => Some(DigestAlgorithm::Sha384),
            // TODO there's got to be a digest algorithm, right?
            SignatureAlgorithm::Ed25519 => None,
            SignatureAlgorithm::NoSignature(digest_algorithm) => Some(*digest_algorithm),
        }
    }
}

impl Display for SignatureAlgorithm {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            SignatureAlgorithm::RsaSha1 => f.write_str("SHA-1 with RSA encryption"),
            SignatureAlgorithm::RsaSha256 => f.write_str("SHA-256 with RSA encryption"),
            SignatureAlgorithm::RsaSha384 => f.write_str("SHA-384 with RSA encryption"),
            SignatureAlgorithm::RsaSha512 => f.write_str("SHA-512 with RSA encryption"),
            SignatureAlgorithm::EcdsaSha256 => f.write_str("ECDSA with SHA-256"),
            SignatureAlgorithm::EcdsaSha384 => f.write_str("ECDSA with SHA-384"),
            SignatureAlgorithm::Ed25519 => f.write_str("ED25519"),
            SignatureAlgorithm::NoSignature(digest_algorithm) => f.write_fmt(format_args!("No signature with {}", digest_algorithm)),
        }
    }
}

impl From<SignatureAlgorithm> for Oid {
    fn from(alg: SignatureAlgorithm) -> Self {
        Oid(match alg {
            SignatureAlgorithm::RsaSha1 => OID_SHA1_RSA.as_ref(),
            SignatureAlgorithm::RsaSha256 => OID_SHA256_RSA.as_ref(),
            SignatureAlgorithm::RsaSha384 => OID_SHA384_RSA.as_ref(),
            SignatureAlgorithm::RsaSha512 => OID_SHA512_RSA.as_ref(),
            SignatureAlgorithm::EcdsaSha256 => OID_ECDSA_SHA256.as_ref(),
            SignatureAlgorithm::EcdsaSha384 => OID_ECDSA_SHA384.as_ref(),
            SignatureAlgorithm::Ed25519 => OID_ED25519_SIGNATURE_ALGORITHM.as_ref(),
            SignatureAlgorithm::NoSignature(_) => OID_NO_SIGNATURE_ALGORITHM.as_ref(),
        }
        .into())
    }
}

impl TryFrom<&Oid> for SignatureAlgorithm {
    type Error = Error;

    fn try_from(v: &Oid) -> Result<Self, Self::Error> {
        if v == &OID_SHA1_RSA {
            Ok(Self::RsaSha1)
        } else if v == &OID_SHA256_RSA {
            Ok(Self::RsaSha256)
        } else if v == &OID_SHA384_RSA {
            Ok(Self::RsaSha384)
        } else if v == &OID_SHA512_RSA {
            Ok(Self::RsaSha512)
        } else if v == &OID_ECDSA_SHA256 {
            Ok(Self::EcdsaSha256)
        } else if v == &OID_ECDSA_SHA384 {
            Ok(Self::EcdsaSha384)
        } else if v == &OID_ED25519_SIGNATURE_ALGORITHM {
            Ok(Self::Ed25519)
        } else {
            Err(Error::UnknownSignatureAlgorithm(format!("{}", v)))
        }
    }
}

impl TryFrom<&AlgorithmIdentifier> for SignatureAlgorithm {
    type Error = Error;

    fn try_from(v: &AlgorithmIdentifier) -> Result<Self, Self::Error> {
        Self::try_from(&v.algorithm)
    }
}

impl From<SignatureAlgorithm> for AlgorithmIdentifier {
    fn from(alg: SignatureAlgorithm) -> Self {
        Self {
            algorithm: alg.into(),
            parameters: None,
        }
    }
}

/// Represents a known curve used with ECDSA.
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum EcdsaCurve {
    Secp256r1,
    Secp384r1,
}

impl EcdsaCurve {
    /// Obtain all variants of this type.
    pub fn all() -> &'static [Self] {
        &[Self::Secp256r1, Self::Secp384r1]
    }

    /// Obtain the OID representing this elliptic curve.
    pub fn as_signature_oid(&self) -> Oid {
        Oid(match self {
            Self::Secp256r1 => OID_EC_SECP256R1.as_ref().into(),
            Self::Secp384r1 => OID_EC_SECP384R1.as_ref().into(),
        })
    }
}

impl TryFrom<&Oid> for EcdsaCurve {
    type Error = Error;

    fn try_from(v: &Oid) -> Result<Self, Self::Error> {
        if v == &OID_EC_SECP256R1 {
            Ok(Self::Secp256r1)
        } else if v == &OID_EC_SECP384R1 {
            Ok(Self::Secp384r1)
        } else {
            Err(Error::UnknownEllipticCurve(format!("{}", v)))
        }
    }
}

impl From<EcdsaCurve> for &'static signature::EcdsaSigningAlgorithm {
    fn from(curve: EcdsaCurve) -> Self {
        match curve {
            EcdsaCurve::Secp256r1 => &signature::ECDSA_P256_SHA256_ASN1_SIGNING,
            EcdsaCurve::Secp384r1 => &signature::ECDSA_P384_SHA384_ASN1_SIGNING,
        }
    }
}

/// Cryptographic algorithm used by a private key.
///
/// Instances can be converted to/from the underlying ASN.1 type and
/// OIDs.
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum KeyAlgorithm {
    /// RSA
    ///
    /// Corresponds to OID 1.2.840.113549.1.1.1.
    Rsa,

    /// Corresponds to OID 1.2.840.10045.2.1
    ///
    /// The inner OID tracks the curve / parameter in use.
    Ecdsa(EcdsaCurve),

    /// Corresponds to OID 1.3.101.110
    Ed25519,
}

impl Display for KeyAlgorithm {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Rsa => f.write_str("RSA"),
            Self::Ecdsa(_) => f.write_str("ECDSA"),
            Self::Ed25519 => f.write_str("ED25519"),
        }
    }
}

impl TryFrom<&Oid> for KeyAlgorithm {
    type Error = Error;

    fn try_from(v: &Oid) -> Result<Self, Self::Error> {
        if v == &OID_RSA {
            Ok(Self::Rsa)
        } else if v == &OID_EC_PUBLIC_KEY {
            // Default to an arbitrary elliptic curve when just the OID is given to us.
            Ok(Self::Ecdsa(EcdsaCurve::Secp384r1))
        // ED25519 appears to use the signature algorithm OID for private key
        // identification, so we need to accept both.
        } else if v == &OID_ED25519_KEY_AGREEMENT || v == &OID_ED25519_SIGNATURE_ALGORITHM {
            Ok(Self::Ed25519)
        } else {
            Err(Error::UnknownKeyAlgorithm(format!("{}", v)))
        }
    }
}

impl TryFrom<&ObjectIdentifier> for KeyAlgorithm {
    type Error = Error;

    fn try_from(v: &ObjectIdentifier) -> Result<Self, Self::Error> {
        // Similar implementation as above.
        match v.as_bytes() {
            x if x == OID_RSA.as_ref() => Ok(Self::Rsa),
            x if x == OID_EC_PUBLIC_KEY.as_ref() => Ok(Self::Ecdsa(EcdsaCurve::Secp384r1)),
            x if x == OID_ED25519_KEY_AGREEMENT.as_ref()
                || x == OID_ED25519_SIGNATURE_ALGORITHM.as_ref() =>
            {
                Ok(Self::Ed25519)
            }
            _ => Err(Error::UnknownKeyAlgorithm(v.to_string())),
        }
    }
}

impl From<KeyAlgorithm> for Oid {
    fn from(alg: KeyAlgorithm) -> Self {
        Oid(match alg {
            KeyAlgorithm::Rsa => OID_RSA.as_ref(),
            KeyAlgorithm::Ecdsa(_) => OID_EC_PUBLIC_KEY.as_ref(),
            KeyAlgorithm::Ed25519 => OID_ED25519_KEY_AGREEMENT.as_ref(),
        }
        .into())
    }
}

impl From<KeyAlgorithm> for ObjectIdentifier {
    fn from(alg: KeyAlgorithm) -> Self {
        let bytes = match alg {
            KeyAlgorithm::Rsa => OID_RSA.as_ref(),
            KeyAlgorithm::Ecdsa(_) => OID_EC_PUBLIC_KEY.as_ref(),
            KeyAlgorithm::Ed25519 => OID_ED25519_KEY_AGREEMENT.as_ref(),
        };

        ObjectIdentifier::from_bytes(bytes).expect("OID bytes should be valid")
    }
}

impl TryFrom<&AlgorithmIdentifier> for KeyAlgorithm {
    type Error = Error;

    fn try_from(v: &AlgorithmIdentifier) -> Result<Self, Self::Error> {
        // This will obtain a generic instance with defaults for configurable
        // parameters. So check for and apply parameters.
        let ka = Self::try_from(&v.algorithm)?;

        let ka = if let Some(params) = &v.parameters {
            match ka {
                Self::Ecdsa(_) => {
                    let curve_oid = params.decode_oid()?;
                    let curve = EcdsaCurve::try_from(&curve_oid)?;

                    Ok(Self::Ecdsa(curve))
                }
                Self::Ed25519 => {
                    // NULL is meaningless. Just a placeholder. Allow it through.
                    if params.as_slice() == [0x05, 0x00] {
                        Ok(ka)
                    } else {
                        Err(Error::UnhandledKeyAlgorithmParameters("on ED25519"))
                    }
                }
                Self::Rsa => {
                    // NULL is meaningless. Just a placeholder. Allow it through.
                    if params.as_slice() == [0x05, 0x00] {
                        Ok(ka)
                    } else {
                        Err(Error::UnhandledKeyAlgorithmParameters("on RSA"))
                    }
                }
            }?
        } else {
            ka
        };

        Ok(ka)
    }
}

impl From<KeyAlgorithm> for AlgorithmIdentifier {
    fn from(alg: KeyAlgorithm) -> Self {
        let parameters = match alg {
            KeyAlgorithm::Ed25519 => None,
            KeyAlgorithm::Rsa => None,
            KeyAlgorithm::Ecdsa(curve) => {
                Some(AlgorithmParameter::from_oid(curve.as_signature_oid()))
            }
        };

        Self {
            algorithm: alg.into(),
            parameters,
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn digest_pkcs1() -> Result<(), Error> {
        let message = b"deadbeef";
        let raw_digest = DigestAlgorithm::Sha256.digest_data(message);

        // RSA 1024.
        let encoded = DigestAlgorithm::Sha256.rsa_pkcs1_encode(message, 128)?;
        assert_eq!(&encoded[0..3], &[0x00, 0x01, 0xff]);
        assert_eq!(&encoded[96..], &raw_digest);

        Ok(())
    }

    #[test]
    fn key_algorithm_oids() -> Result<(), Error> {
        let oid = ObjectIdentifier::from(KeyAlgorithm::Rsa);
        assert_eq!(oid.to_string(), "1.2.840.113549.1.1.1");
        let oid = ObjectIdentifier::new("1.2.840.113549.1.1.1").unwrap();
        assert_eq!(KeyAlgorithm::try_from(&oid)?, KeyAlgorithm::Rsa);

        let oid = ObjectIdentifier::from(KeyAlgorithm::Ecdsa(EcdsaCurve::Secp256r1));
        assert_eq!(oid.to_string(), "1.2.840.10045.2.1");
        let oid = ObjectIdentifier::new("1.2.840.10045.2.1").unwrap();
        assert_eq!(
            KeyAlgorithm::try_from(&oid)?,
            KeyAlgorithm::Ecdsa(EcdsaCurve::Secp384r1)
        );

        let oid = ObjectIdentifier::from(KeyAlgorithm::Ed25519);
        assert_eq!(oid.to_string(), "1.3.101.110");
        let oid = ObjectIdentifier::new("1.3.101.110").unwrap();
        assert_eq!(KeyAlgorithm::try_from(&oid)?, KeyAlgorithm::Ed25519);

        Ok(())
    }
}
