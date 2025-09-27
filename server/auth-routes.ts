import { Router, Request, Response } from 'express';
import { AuthService } from './auth-service';
import type { DbStorage } from './storage';
import { z } from 'zod';

// Extend Request type to include auth info
declare module 'express-serve-static-core' {
  interface Request {
    session?: {
      accessKeyId?: string;
      role?: string;
      sessionToken?: string;
    };
  }
}

// Validation schemas
const loginSchema = z.object({
  accessKey: z.string().min(24).max(25).regex(/^(WLSFX-[A-Za-z0-9]{18,19}|JJIT-[A-Za-z0-9]{18,19})$/)
});

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  role: z.enum(['user', 'admin'])
});

export function createAuthRoutes(storage: DbStorage, authService: AuthService) {
  const router = Router();

  // Public route: Login
  router.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { accessKey } = loginSchema.parse(req.body);
      
      // Verify access key
      const keyInfo = await authService.verifyAccessKey(accessKey);
      if (!keyInfo) {
        await storage.createAuditLog({
          action: 'login_failed',
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          details: JSON.stringify({ reason: 'invalid_key' })
        });
        
        return res.status(401).json({
          success: false,
          message: 'Invalid access key'
        });
      }
      
      // Check if key is revoked
      if (keyInfo.revokedAt) {
        await storage.createAuditLog({
          action: 'login_failed',
          accessKeyId: keyInfo.id,
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          details: JSON.stringify({ reason: 'revoked_key' })
        });
        
        return res.status(401).json({
          success: false,
          message: 'Access key has been revoked'
        });
      }
      
      // Create session
      const sessionToken = authService.generateSessionToken();
      const session = await storage.createUserSession({
        accessKeyId: keyInfo.id,
        sessionToken,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
      
      // Update access key usage
      await storage.updateAccessKeyUsage(keyInfo.id);
      
      // Log successful login
      await storage.createAuditLog({
        action: 'login',
        accessKeyId: keyInfo.id,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        details: JSON.stringify({ sessionId: session.id })
      });
      
      // Set session data
      req.session = {
        accessKeyId: keyInfo.id,
        role: keyInfo.role,
        sessionToken
      };
      
      // Set session token as a cookie (Replit-friendly settings)
      res.cookie('sessionToken', sessionToken, {
        httpOnly: false, // Allow frontend access for debugging
        secure: false, // Disable secure for Replit development
        sameSite: 'none', // Allow cross-origin cookies  
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      res.json({
        success: true,
        sessionToken,
        role: keyInfo.role,
        name: keyInfo.name
      });
      
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof z.ZodError ? 'Invalid request data' : 'Login failed'
      });
    }
  });

  // Public route: Logout
  router.post('/api/auth/logout', async (req: Request, res: Response) => {
    try {
      const sessionToken = req.session?.sessionToken || 
                          req.headers.authorization?.replace('Bearer ', '') ||
                          req.cookies?.sessionToken;
      
      if (sessionToken) {
        const session = await storage.getUserSessionByToken(sessionToken);
        if (session) {
          await storage.deleteUserSession(session.id);
          await storage.createAuditLog({
            action: 'logout',
            accessKeyId: session.accessKeyId,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
            details: JSON.stringify({ sessionId: session.id })
          });
        }
      }
      
      req.session = undefined;
      
      // Clear the session cookie
      res.clearCookie('sessionToken');
      
      res.json({ success: true, message: 'Logged out successfully' });
      
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  });

  // Admin route: Get all access keys
  router.get('/api/admin/access-keys', requireAdmin, async (req: Request, res: Response) => {
    try {
      const keys = await storage.getActiveAccessKeys();
      
      // Format keys for response (hide full key hash)
      const formattedKeys = keys.map(key => {
        const metadata = key.metadata ? JSON.parse(key.metadata as string) : {};
        return {
          id: key.id,
          name: key.name,
          role: key.role,
          createdAt: key.createdAt,
          lastUsed: key.lastUsed,
          usageCount: key.usageCount,
          revokedAt: key.revokedAt,
          metadata: {
            ...metadata,
            keyPreview: metadata.keyPreview || 'Preview not available'
          }
        };
      });
      
      res.json(formattedKeys);
      
    } catch (error) {
      console.error('Failed to get access keys:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve access keys'
      });
    }
  });

  // Admin route: Create new access key
  router.post('/api/admin/access-keys', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { name, role } = createKeySchema.parse(req.body);
      
      // Generate new access key with proper role prefix
      const accessKey = authService.generateAccessKey(role);
      const keyHash = await authService.hashAccessKey(accessKey);
      
      // Store key with preview
      const keyInfo = await storage.createAccessKey({
        name,
        keyHash,
        role,
        createdBy: req.session?.accessKeyId || 'system',
        metadata: JSON.stringify({
          keyPreview: accessKey.substring(0, 4) + '****' + accessKey.substring(20)
        })
      });
      
      // Log key creation
      await storage.createAuditLog({
        action: 'key_created',
        accessKeyId: req.session?.accessKeyId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        details: JSON.stringify({
          newKeyId: keyInfo.id,
          keyName: name,
          role
        })
      });
      
      res.json({
        success: true,
        key: accessKey, // Return the full key only once
        keyInfo: {
          id: keyInfo.id,
          name: keyInfo.name,
          role: keyInfo.role,
          createdAt: keyInfo.createdAt
        }
      });
      
    } catch (error) {
      console.error('Failed to create access key:', error);
      res.status(400).json({
        success: false,
        message: error instanceof z.ZodError ? 'Invalid request data' : 'Failed to create access key'
      });
    }
  });

  // Admin route: Get detailed access key information (secure alternative to full key reveal)
  router.get('/api/admin/access-keys/:id/details', requireAdmin, async (req: Request, res: Response) => {
    try {
      const keyId = req.params.id;
      
      // Get the access key
      const accessKey = await storage.getAccessKey(keyId);
      if (!accessKey) {
        return res.status(404).json({
          success: false,
          message: 'Access key not found'
        });
      }

      // Get related sessions
      const sessions = await storage.getSessionsByAccessKey(keyId);
      
      // Get audit logs for this key (last 50 entries)
      const auditLogs = await storage.getAuditLogsByAccessKey(keyId, 50);
      
      // Parse metadata
      const metadata = accessKey.metadata ? JSON.parse(accessKey.metadata as string) : {};
      
      // Log the access attempt
      await storage.createAuditLog({
        action: 'key_details_accessed',
        accessKeyId: req.session?.accessKeyId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        details: JSON.stringify({ 
          viewedKeyId: keyId,
          viewedKeyName: accessKey.name,
          viewedKeyRole: accessKey.role
        })
      });

      // Return detailed information (but not the actual key)
      res.json({
        success: true,
        keyDetails: {
          id: accessKey.id,
          name: accessKey.name,
          role: accessKey.role,
          createdAt: accessKey.createdAt,
          lastUsed: accessKey.lastUsed,
          usageCount: accessKey.usageCount,
          revokedAt: accessKey.revokedAt,
          createdBy: accessKey.createdBy,
          metadata: {
            ...metadata,
            securityNote: 'Original access key cannot be retrieved for security reasons. Key is securely hashed.'
          },
          activeSessions: sessions.filter(s => s.expiresAt > new Date()).length,
          totalSessions: sessions.length,
          recentAuditLogs: auditLogs
        }
      });
      
    } catch (error) {
      console.error('Failed to get access key details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve access key details'
      });
    }
  });

  // Admin route: Revoke access key
  router.post('/api/admin/access-keys/:id/revoke', requireAdmin, async (req: Request, res: Response) => {
    try {
      const keyId = req.params.id;
      
      // Prevent revoking own key
      if (req.session?.accessKeyId === keyId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot revoke your own access key'
        });
      }
      
      const success = await storage.revokeAccessKey(keyId);
      
      if (success) {
        // Invalidate all sessions for this key
        await storage.deleteSessionsByAccessKey(keyId);
        
        // Log revocation
        await storage.createAuditLog({
          action: 'key_revoked',
          accessKeyId: req.session?.accessKeyId,
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          details: JSON.stringify({ revokedKeyId: keyId })
        });
        
        res.json({
          success: true,
          message: 'Access key revoked successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Access key not found'
        });
      }
      
    } catch (error) {
      console.error('Failed to revoke access key:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to revoke access key'
      });
    }
  });

  // Admin route: Get audit logs
  router.get('/api/admin/audit-logs', requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAuditLogs(limit);
      res.json(logs);
      
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit logs'
      });
    }
  });

  // Admin route: Get system stats
  router.get('/api/admin/system-stats', requireAdmin, async (req: Request, res: Response) => {
    try {
      const [activeSessions, activeKeys] = await Promise.all([
        storage.getActiveSessions(),
        storage.getActiveAccessKeys()
      ]);
      
      res.json({
        activeSessions: activeSessions.length,
        totalKeys: activeKeys.length,
        adminKeys: activeKeys.filter(k => k.role === 'admin').length,
        userKeys: activeKeys.filter(k => k.role === 'user').length
      });
      
    } catch (error) {
      console.error('Failed to get system stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve system statistics'
      });
    }
  });

  // Middleware: Require authentication
  async function requireAuth(req: Request, res: Response, next: Function) {
    try {
      const sessionToken = req.session?.sessionToken || 
                          req.headers.authorization?.replace('Bearer ', '') || 
                          req.headers['x-session-token'] ||
                          req.cookies?.sessionToken;
      
      
      if (!sessionToken) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      const session = await storage.getUserSessionByToken(sessionToken);
      
      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({
          success: false,
          message: 'Session expired or invalid'
        });
      }
      
      // Update session activity
      await storage.updateSessionActivity(session.id);
      
      // Set session data
      req.session = {
        accessKeyId: session.accessKeyId,
        role: (await storage.getAccessKey(session.accessKeyId))?.role || 'user',
        sessionToken
      };
      
      next();
      
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication error'
      });
    }
  }

  // Middleware: Require admin role
  async function requireAdmin(req: Request, res: Response, next: Function) {
    await requireAuth(req, res, async () => {
      if (req.session?.role !== 'admin') {
        await storage.createAuditLog({
          action: 'access_denied',
          accessKeyId: req.session?.accessKeyId,
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          details: JSON.stringify({ route: req.path })
        });
        
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }
      next();
    });
  }

  return { router, requireAuth, requireAdmin };
}