// Authentication method implementations for DbStorage class
// This file contains the authentication-related methods to be added to DbStorage

import { eq, desc, and, isNull, gte } from "drizzle-orm";
import type { AccessKey, UserSession, AuditLog, InsertAccessKey, InsertUserSession, InsertAuditLog } from "@shared/schema";
import { accessKeys, userSessions, auditLogs } from "@shared/schema";

// These methods should be added to the DbStorage class in storage.ts

export const authMethods = {
  // Access Key methods
  async getAccessKey(id: string): Promise<AccessKey | undefined> {
    try {
      const result = await this.db
        .select()
        .from(accessKeys)
        .where(eq(accessKeys.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting access key:", error);
      throw new Error(`Failed to retrieve access key: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async getAccessKeyByHash(keyHash: string): Promise<AccessKey | undefined> {
    try {
      const result = await this.db
        .select()
        .from(accessKeys)
        .where(eq(accessKeys.keyHash, keyHash))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting access key by hash:", error);
      throw new Error(`Failed to retrieve access key by hash: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async getActiveAccessKeys(): Promise<AccessKey[]> {
    try {
      const result = await this.db
        .select()
        .from(accessKeys)
        .where(isNull(accessKeys.revokedAt))
        .orderBy(desc(accessKeys.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting active access keys:", error);
      throw new Error(`Failed to retrieve active access keys: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async getAccessKeysByRole(role: string): Promise<AccessKey[]> {
    try {
      const result = await this.db
        .select()
        .from(accessKeys)
        .where(and(
          eq(accessKeys.role, role),
          isNull(accessKeys.revokedAt)
        ))
        .orderBy(desc(accessKeys.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting access keys by role:", error);
      throw new Error(`Failed to retrieve access keys by role: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async createAccessKey(key: InsertAccessKey): Promise<AccessKey> {
    try {
      const result = await this.db
        .insert(accessKeys)
        .values(key)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating access key:", error);
      throw new Error(`Failed to create access key: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async updateAccessKeyUsage(id: string): Promise<AccessKey | undefined> {
    try {
      const result = await this.db
        .update(accessKeys)
        .set({
          lastUsed: new Date(),
          usageCount: this.db.sql`usage_count + 1`
        })
        .where(eq(accessKeys.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating access key usage:", error);
      throw new Error(`Failed to update access key usage: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async revokeAccessKey(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(accessKeys)
        .set({ revokedAt: new Date() })
        .where(eq(accessKeys.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error revoking access key:", error);
      throw new Error(`Failed to revoke access key: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  // User Session methods
  async getUserSession(id: string): Promise<UserSession | undefined> {
    try {
      const result = await this.db
        .select()
        .from(userSessions)
        .where(eq(userSessions.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting user session:", error);
      throw new Error(`Failed to retrieve user session: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async getUserSessionByToken(sessionToken: string): Promise<UserSession | undefined> {
    try {
      const result = await this.db
        .select()
        .from(userSessions)
        .where(eq(userSessions.sessionToken, sessionToken))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting user session by token:", error);
      throw new Error(`Failed to retrieve user session by token: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async getSessionsByAccessKey(accessKeyId: string): Promise<UserSession[]> {
    try {
      const result = await this.db
        .select()
        .from(userSessions)
        .where(eq(userSessions.accessKeyId, accessKeyId))
        .orderBy(desc(userSessions.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting sessions by access key:", error);
      throw new Error(`Failed to retrieve sessions by access key: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async getActiveSessions(): Promise<UserSession[]> {
    try {
      const now = new Date();
      const result = await this.db
        .select()
        .from(userSessions)
        .where(gte(userSessions.expiresAt, now))
        .orderBy(desc(userSessions.lastActivity));
      return result;
    } catch (error) {
      console.error("Error getting active sessions:", error);
      throw new Error(`Failed to retrieve active sessions: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async createUserSession(session: InsertUserSession): Promise<UserSession> {
    try {
      const result = await this.db
        .insert(userSessions)
        .values(session)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating user session:", error);
      throw new Error(`Failed to create user session: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async updateSessionActivity(id: string): Promise<UserSession | undefined> {
    try {
      const result = await this.db
        .update(userSessions)
        .set({ lastActivity: new Date() })
        .where(eq(userSessions.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating session activity:", error);
      throw new Error(`Failed to update session activity: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async deleteUserSession(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(userSessions)
        .where(eq(userSessions.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting user session:", error);
      throw new Error(`Failed to delete user session: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async deleteSessionsByAccessKey(accessKeyId: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(userSessions)
        .where(eq(userSessions.accessKeyId, accessKeyId))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting sessions by access key:", error);
      throw new Error(`Failed to delete sessions by access key: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const now = new Date();
      const result = await this.db
        .delete(userSessions)
        .where(this.db.lt(userSessions.expiresAt, now))
        .returning();
      return result.length;
    } catch (error) {
      console.error("Error cleaning up expired sessions:", error);
      throw new Error(`Failed to cleanup expired sessions: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  // Audit Log methods
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    try {
      const result = await this.db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);
      return result;
    } catch (error) {
      console.error("Error getting audit logs:", error);
      throw new Error(`Failed to retrieve audit logs: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async getAuditLogsByAccessKey(accessKeyId: string, limit: number = 100): Promise<AuditLog[]> {
    try {
      const result = await this.db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.accessKeyId, accessKeyId))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);
      return result;
    } catch (error) {
      console.error("Error getting audit logs by access key:", error);
      throw new Error(`Failed to retrieve audit logs by access key: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async getAuditLogsByAction(action: string, limit: number = 100): Promise<AuditLog[]> {
    try {
      const result = await this.db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, action))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);
      return result;
    } catch (error) {
      console.error("Error getting audit logs by action:", error);
      throw new Error(`Failed to retrieve audit logs by action: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  },

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    try {
      const result = await this.db
        .insert(auditLogs)
        .values(log)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating audit log:", error);
      throw new Error(`Failed to create audit log: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }
};