import { Request, Response, NextFunction } from 'express';
import { Session, SessionData } from 'express-session';

interface SessionWithCSRF extends Session, SessionData {
  csrfSecret?: string;
}
import rateLimit from 'express-rate-limit';
import csrf from 'csrf';
import crypto from 'crypto';

// CSRF Token Manager
const csrfTokens = new csrf();

// Rate limiting configurations
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts',
      retryAfter: 15 * 60,
    });
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per minute
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // limit each IP to 50 admin requests per minute
  message: 'Too many admin requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

// CSRF Protection middleware
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for public endpoints and authenticated wallet operations
  const publicEndpoints = ['/api/auth/login', '/api/network/status', '/api/health', '/api/wallets/sync-balances'];
  if (publicEndpoints.includes(req.path)) {
    return next();
  }

  // Generate CSRF token for GET requests
  if (req.method === 'GET') {
    const csrfToken = csrfTokens.create((req.session as SessionWithCSRF)?.csrfSecret || '');
    res.locals.csrfToken = csrfToken;
    return next();
  }

  // Verify CSRF token for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const secret = (req.session as SessionWithCSRF)?.csrfSecret;

    if (!secret || !csrfTokens.verify(secret, token as string)) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }

  next();
}

// Initialize CSRF secret in session
export function initializeCSRF(req: Request, res: Response, next: NextFunction) {
  if (!req.session) {
    return next();
  }

  if (!(req.session as SessionWithCSRF).csrfSecret) {
    (req.session as SessionWithCSRF).csrfSecret = csrfTokens.secretSync();
  }

  next();
}

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );
  
  // Strict Transport Security (only for HTTPS)
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

// Encryption utilities for private keys
// Use WALLET_ENCRYPTION_KEY for consistency, with development fallback
const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || 
  '582710df0ebb9d793ff28e6aa7239eb9200b487a7360af2932d0654c29e086d6';

if (!process.env.WALLET_ENCRYPTION_KEY) {
  console.warn('⚠️  WALLET_ENCRYPTION_KEY not set, using default development key');
}

const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

export function encryptPrivateKey(privateKey: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32),
    iv
  );
  
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptPrivateKey(encryptedKey: string): string {
  const [ivHex, encrypted] = encryptedKey.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32),
    iv
  );
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Request sanitization middleware
export function sanitizeRequest(req: Request, res: Response, next: NextFunction) {
  // Sanitize query parameters
  for (const key in req.query) {
    if (typeof req.query[key] === 'string') {
      req.query[key] = (req.query[key] as string).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
  }

  // Sanitize body parameters
  if (req.body && typeof req.body === 'object') {
    const sanitizeObject = (obj: any): any => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };
    sanitizeObject(req.body);
  }

  next();
}

// IP-based access control
const WHITELIST_IPS = process.env.WHITELIST_IPS?.split(',') || [];
const BLACKLIST_IPS = process.env.BLACKLIST_IPS?.split(',') || [];

export function ipAccessControl(req: Request, res: Response, next: NextFunction) {
  const clientIp = req.ip || req.socket.remoteAddress || '';

  // Check blacklist first
  if (BLACKLIST_IPS.length > 0 && BLACKLIST_IPS.includes(clientIp)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // If whitelist is configured, only allow whitelisted IPs
  if (WHITELIST_IPS.length > 0 && !WHITELIST_IPS.includes(clientIp)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
}

// Session security configuration
export const sessionConfig = {
  secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict' as const, // CSRF protection
  },
  name: 'stealth.sid', // Custom session name
};

// Audit logging middleware
export function auditLog(action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const auditEntry = {
      action,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path,
      timestamp: new Date(),
      userId: (req as any).user?.id,
      sessionId: req.sessionID || 'unknown',
    };

    // Log to database (implement based on your storage)
    console.log('🔍 Audit:', JSON.stringify(auditEntry));

    next();
  };
}

// Export all middleware as a bundle
export const securityMiddleware = {
  loginRateLimiter,
  apiRateLimiter,
  adminRateLimiter,
  csrfProtection,
  initializeCSRF,
  securityHeaders,
  sanitizeRequest,
  ipAccessControl,
  sessionConfig,
  auditLog,
  encryptPrivateKey,
  decryptPrivateKey,
};