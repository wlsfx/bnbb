import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import type { DbStorage } from './storage';
import type { AccessKey, UserSession } from '@shared/schema';
import csrf from 'csrf';

const csrfTokens = new csrf();

export interface AuthRequest extends Request {
  session?: {
    userId?: string;
    accessKeyId?: string;
    role?: string;
    sessionToken?: string;
    csrfToken?: string;
  };
}

export class AuthService {
  private readonly SALT_ROUNDS = 10;
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly KEY_LENGTH = 24;
  private readonly KEY_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  private readonly ADMIN_KEY_PREFIX = 'WLSFX-';
  private readonly USER_KEY_PREFIX = 'JJIT-';

  constructor(private storage: DbStorage) {}

  /**
   * Validate key format (24-25 chars, proper prefix)
   */
  private isValidKeyFormat(key: string): boolean {
    if (key.length < 24 || key.length > 25) return false;
    return key.startsWith(this.ADMIN_KEY_PREFIX) || key.startsWith(this.USER_KEY_PREFIX);
  }

  /**
   * Generate a secure 24-character access key with proper prefix
   * @param role - 'admin' or 'user' to determine the prefix
   */
  generateAccessKey(role: 'admin' | 'user' = 'user'): string {
    const chars = this.KEY_CHARSET;
    const prefix = role === 'admin' ? this.ADMIN_KEY_PREFIX : this.USER_KEY_PREFIX;
    const suffixLength = this.KEY_LENGTH - prefix.length;
    
    let suffix = '';
    const randomBytes = crypto.randomBytes(suffixLength);
    
    for (let i = 0; i < suffixLength; i++) {
      suffix += chars[randomBytes[i] % chars.length];
    }
    
    return prefix + suffix;
  }

  /**
   * Generate a secure session token
   */
  generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash an access key using bcrypt
   */
  async hashAccessKey(key: string): Promise<string> {
    return await bcrypt.hash(key, this.SALT_ROUNDS);
  }

  /**
   * Verify an access key against stored keys
   */
  async verifyAccessKey(key: string): Promise<AccessKey | null> {
    try {
      // Validate key format
      if (!this.isValidKeyFormat(key)) {
        return null;
      }
      
      // Get all active access keys
      const accessKeys = await this.storage.getActiveAccessKeys();
      
      // Find the matching key
      for (const accessKey of accessKeys) {
        const isValid = await bcrypt.compare(key, accessKey.keyHash);
        if (isValid) {
          return accessKey;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error verifying access key:', error);
      return null;
    }
  }

  /**
   * Create a new access key
   */
  async createAccessKey(
    name: string,
    role: 'user' | 'admin' = 'user',
    createdBy?: string
  ): Promise<{ key: string; accessKey: AccessKey }> {
    const key = this.generateAccessKey(role);
    const keyHash = await bcrypt.hash(key, this.SALT_ROUNDS);

    const accessKey = await this.storage.createAccessKey({
      keyHash,
      name,
      role,
      createdBy,
      metadata: JSON.stringify({
        createdAt: new Date().toISOString(),
        keyPreview: `${key.slice(0, 4)}****${key.slice(-4)}`,
      }),
    } as any);

    await this.storage.createAuditLog({
      accessKeyId: accessKey.id,
      action: 'key_created',
      details: JSON.stringify({ name, role, createdBy }),
    });

    return { key, accessKey };
  }

  /**
   * Validate an access key and create a session
   */
  async validateAccessKey(
    key: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserSession | null> {
    try {
      // Validate key format
      if (!this.isValidKeyFormat(key)) {
        await this.storage.createAuditLog({
          action: 'access_denied',
          ipAddress,
          userAgent,
          details: JSON.stringify({ reason: 'invalid_key_format' }),
        });
        return null;
      }
      
      // Get all active access keys
      const accessKeys = await this.storage.getActiveAccessKeys();

      // Find the matching key
      for (const accessKey of accessKeys) {
        const isValid = await bcrypt.compare(key, accessKey.keyHash);
        if (isValid) {
          // Update last used
          await this.storage.updateAccessKeyUsage(accessKey.id);

          // Create session
          const sessionToken = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + this.SESSION_DURATION);

          const session = await this.storage.createUserSession({
            accessKeyId: accessKey.id,
            sessionToken,
            ipAddress,
            userAgent,
            expiresAt,
          });

          // Log authentication
          await this.storage.createAuditLog({
            accessKeyId: accessKey.id,
            action: 'login',
            ipAddress,
            userAgent,
            details: JSON.stringify({ sessionId: session.id }),
          });

          return session;
        }
      }

      // Log failed attempt
      await this.storage.createAuditLog({
        action: 'access_denied',
        ipAddress,
        userAgent,
        details: JSON.stringify({ reason: 'invalid_key' }),
      });

      return null;
    } catch (error) {
      console.error('❌ Error validating access key:', error);
      return null;
    }
  }

  /**
   * Validate a session token
   */
  async validateSession(sessionToken: string): Promise<{
    valid: boolean;
    accessKey?: AccessKey;
    session?: UserSession;
  }> {
    try {
      const session = await this.storage.getUserSessionByToken(sessionToken);
      if (!session) {
        return { valid: false };
      }

      // Check if session has expired
      if (new Date(session.expiresAt) < new Date()) {
        await this.storage.deleteUserSession(session.id);
        return { valid: false };
      }

      // Get access key
      const accessKey = await this.storage.getAccessKey(session.accessKeyId);
      if (!accessKey || accessKey.revokedAt) {
        return { valid: false };
      }

      // Update last activity
      await this.storage.updateSessionActivity(session.id);

      return { valid: true, accessKey, session };
    } catch (error) {
      console.error('❌ Error validating session:', error);
      return { valid: false };
    }
  }

  /**
   * Revoke an access key
   */
  async revokeAccessKey(
    accessKeyId: string,
    revokedBy?: string
  ): Promise<boolean> {
    const success = await this.storage.revokeAccessKey(accessKeyId);
    
    if (success) {
      // Delete all sessions for this key
      await this.storage.deleteSessionsByAccessKey(accessKeyId);

      // Log revocation
      await this.storage.createAuditLog({
        accessKeyId,
        action: 'key_revoked',
        details: JSON.stringify({ revokedBy }),
      });
    }

    return success;
  }

  /**
   * End a session
   */
  async logout(sessionToken: string): Promise<boolean> {
    const session = await this.storage.getUserSessionByToken(sessionToken);
    if (session) {
      await this.storage.deleteUserSession(session.id);
      await this.storage.createAuditLog({
        accessKeyId: session.accessKeyId,
        action: 'logout',
        details: JSON.stringify({ sessionId: session.id }),
      });
      return true;
    }
    return false;
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(): string {
    const secret = csrfTokens.secretSync();
    const token = csrfTokens.create(secret);
    return token;
  }

  /**
   * Verify CSRF token
   */
  verifyCSRFToken(secret: string, token: string): boolean {
    return csrfTokens.verify(secret, token);
  }

  /**
   * Authentication middleware
   */
  authenticate(requireAdmin: boolean = false) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        // Check for session token in cookies or headers
        const sessionToken = req.cookies?.sessionToken || req.headers['x-session-token'];
        
        if (!sessionToken) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        const validation = await this.validateSession(sessionToken as string);
        
        if (!validation.valid || !validation.accessKey || !validation.session) {
          return res.status(401).json({ message: 'Invalid or expired session' });
        }

        // Check admin requirement
        if (requireAdmin && validation.accessKey.role !== 'admin') {
          await this.storage.createAuditLog({
            accessKeyId: validation.accessKey.id,
            action: 'access_denied',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: JSON.stringify({ reason: 'admin_required' }),
          });
          return res.status(403).json({ message: 'Admin access required' });
        }

        // Attach session info to request
        req.session = {
          accessKeyId: validation.accessKey.id,
          role: validation.accessKey.role,
          sessionToken: validation.session.sessionToken,
        };

        next();
      } catch (error) {
        console.error('❌ Authentication error:', error);
        res.status(500).json({ message: 'Authentication failed' });
      }
    };
  }

  /**
   * Rate limiting for authentication attempts
   */
  createLoginRateLimiter() {
    const attempts = new Map<string, { count: number; resetTime: number }>();
    const MAX_ATTEMPTS = 5;
    const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip || 'unknown';
      const now = Date.now();
      
      const record = attempts.get(key);
      
      if (record && record.resetTime > now) {
        if (record.count >= MAX_ATTEMPTS) {
          return res.status(429).json({ 
            message: 'Too many login attempts. Please try again later.',
            retryAfter: Math.ceil((record.resetTime - now) / 1000)
          });
        }
        record.count++;
      } else {
        attempts.set(key, { count: 1, resetTime: now + WINDOW_MS });
      }
      
      next();
    };
  }

  /**
   * Get access key statistics
   */
  async getAccessKeyStats(accessKeyId: string) {
    const accessKey = await this.storage.getAccessKey(accessKeyId);
    if (!accessKey) return null;

    const sessions = await this.storage.getSessionsByAccessKey(accessKeyId);
    const auditLogs = await this.storage.getAuditLogsByAccessKey(accessKeyId, 100);

    return {
      accessKey: {
        ...accessKey,
        keyHash: undefined, // Never expose the hash
      },
      activeSessions: sessions.filter(s => new Date(s.expiresAt) > new Date()).length,
      totalSessions: sessions.length,
      recentActivity: auditLogs,
      usageCount: accessKey.usageCount,
      lastUsed: accessKey.lastUsed,
    };
  }
}

// Export factory function
export function createAuthService(storage: DbStorage): AuthService {
  return new AuthService(storage);
}