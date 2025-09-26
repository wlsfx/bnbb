import { 
  type User, type InsertUser, 
  type Wallet, type InsertWallet, 
  type LaunchPlan, type InsertLaunchPlan, 
  type BundleExecution, type InsertBundleExecution, 
  type Activity, type InsertActivity, 
  type SystemMetrics, type InsertSystemMetrics, 
  type StealthFundingSnapshot, type InsertStealthFundingSnapshot, 
  type EnvironmentConfig, type InsertEnvironmentConfig, 
  type LaunchSession, type InsertLaunchSession,
  type BundleTransaction, type InsertBundleTransaction,
  type TransactionEvent, type InsertTransactionEvent,
  type BundleAnalytics, type InsertBundleAnalytics,
  type ProxyConfig, type InsertProxyConfig,
  type ProxyRotationLog, type InsertProxyRotationLog,
  type NetworkConfig, type InsertNetworkConfig,
  type NetworkHealthMetrics, type InsertNetworkHealthMetrics,
  users, wallets, launchPlans, bundleExecutions, activities, systemMetrics, 
  stealthFundingSnapshots, environmentConfig, launchSessions,
  bundleTransactions, transactionEvents, bundleAnalytics,
  proxyConfig, proxyRotationLog, networkConfig, networkHealthMetrics,
  BUNDLE_STATUS, TRANSACTION_STATUS
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, sql, and, gte, lte, inArray } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Wallet methods
  getWallet(id: string): Promise<Wallet | undefined>;
  getWallets(): Promise<Wallet[]>;
  getWalletsByStatus(status: string): Promise<Wallet[]>;
  getWalletsByHealth(health: string): Promise<Wallet[]>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  updateWallet(id: string, updates: Partial<Wallet>): Promise<Wallet | undefined>;
  updateWalletHeartbeat(id: string): Promise<Wallet | undefined>;
  deleteWallet(id: string): Promise<boolean>;

  // Launch Plan methods
  getLaunchPlan(id: string): Promise<LaunchPlan | undefined>;
  getLaunchPlans(): Promise<LaunchPlan[]>;
  createLaunchPlan(plan: InsertLaunchPlan): Promise<LaunchPlan>;
  updateLaunchPlan(id: string, updates: Partial<LaunchPlan>): Promise<LaunchPlan | undefined>;
  deleteLaunchPlan(id: string): Promise<boolean>;

  // Bundle Execution methods
  getBundleExecution(id: string): Promise<BundleExecution | undefined>;
  getBundleExecutions(): Promise<BundleExecution[]>;
  createBundleExecution(execution: InsertBundleExecution): Promise<BundleExecution>;
  updateBundleExecution(id: string, updates: Partial<BundleExecution>): Promise<BundleExecution | undefined>;

  // Activity methods
  getActivities(limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // System Metrics methods
  getLatestSystemMetrics(): Promise<SystemMetrics | undefined>;
  createSystemMetrics(metrics: InsertSystemMetrics): Promise<SystemMetrics>;

  // Stealth Funding Snapshot methods
  getStealthFundingSnapshot(id: string): Promise<StealthFundingSnapshot | undefined>;
  getStealthFundingSnapshots(limit?: number): Promise<StealthFundingSnapshot[]>;
  getStealthFundingSnapshotsBySession(sessionId: string): Promise<StealthFundingSnapshot[]>;
  getStealthFundingSnapshotsByWallet(walletId: string): Promise<StealthFundingSnapshot[]>;
  createStealthFundingSnapshot(snapshot: InsertStealthFundingSnapshot): Promise<StealthFundingSnapshot>;
  updateStealthFundingSnapshot(id: string, updates: Partial<StealthFundingSnapshot>): Promise<StealthFundingSnapshot | undefined>;

  // Environment Configuration methods
  getEnvironmentConfig(environment: string): Promise<EnvironmentConfig | undefined>;
  getEnvironmentConfigs(): Promise<EnvironmentConfig[]>;
  getActiveEnvironment(): Promise<EnvironmentConfig | undefined>;
  createEnvironmentConfig(config: InsertEnvironmentConfig): Promise<EnvironmentConfig>;
  updateEnvironmentConfig(environment: string, updates: Partial<EnvironmentConfig>): Promise<EnvironmentConfig | undefined>;
  switchActiveEnvironment(environment: string): Promise<EnvironmentConfig | undefined>;

  // Launch Session methods
  getLaunchSession(id: string): Promise<LaunchSession | undefined>;
  getLaunchSessions(): Promise<LaunchSession[]>;
  getActiveLaunchSessions(): Promise<LaunchSession[]>;
  getLaunchSessionsByPlan(launchPlanId: string): Promise<LaunchSession[]>;
  createLaunchSession(session: InsertLaunchSession): Promise<LaunchSession>;
  updateLaunchSession(id: string, updates: Partial<LaunchSession>): Promise<LaunchSession | undefined>;

  // Bundle Transaction methods
  getBundleTransaction(id: string): Promise<BundleTransaction | undefined>;
  getBundleTransactionsByBundleId(bundleExecutionId: string): Promise<BundleTransaction[]>;
  getBundleTransactionsByWalletId(walletId: string): Promise<BundleTransaction[]>;
  getBundleTransactionsByStatus(status: string): Promise<BundleTransaction[]>;
  createBundleTransaction(transaction: InsertBundleTransaction): Promise<BundleTransaction>;
  updateBundleTransaction(id: string, updates: Partial<BundleTransaction>): Promise<BundleTransaction | undefined>;
  updateBundleTransactionStatus(id: string, status: string, errorMessage?: string): Promise<BundleTransaction | undefined>;

  // Transaction Event methods
  getTransactionEvent(id: string): Promise<TransactionEvent | undefined>;
  getTransactionEventsByTransactionId(bundleTransactionId: string): Promise<TransactionEvent[]>;
  getTransactionEventTimeline(bundleTransactionId: string): Promise<TransactionEvent[]>;
  createTransactionEvent(event: InsertTransactionEvent): Promise<TransactionEvent>;
  recordTransactionStatusChange(bundleTransactionId: string, status: string, details?: Partial<InsertTransactionEvent>): Promise<TransactionEvent>;

  // Bundle Analytics methods
  getBundleAnalytics(id: string): Promise<BundleAnalytics | undefined>;
  getBundleAnalyticsByBundleId(bundleExecutionId: string): Promise<BundleAnalytics[]>;
  getBundleAnalyticsByLaunchPlanId(launchPlanId: string): Promise<BundleAnalytics[]>;
  getBundleAnalyticsByTimeframe(timeframe: string, limit?: number): Promise<BundleAnalytics[]>;
  createBundleAnalytics(analytics: InsertBundleAnalytics): Promise<BundleAnalytics>;
  updateBundleAnalytics(id: string, updates: Partial<BundleAnalytics>): Promise<BundleAnalytics | undefined>;
  aggregateBundleAnalytics(bundleExecutionId: string, timeframe: string): Promise<BundleAnalytics>;

  // Paginated history methods
  getBundleHistory(options: {
    page?: number;
    pageSize?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ data: BundleExecution[]; total: number; page: number; pageSize: number }>;

  // Real-time progress methods
  getBundleProgress(bundleExecutionId: string): Promise<{
    bundle: BundleExecution;
    transactions: BundleTransaction[];
    events: TransactionEvent[];
    analytics?: BundleAnalytics;
  }>;

  // Execute transaction helper
  executeInTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T>;
  
  // Proxy Configuration methods
  getProxyConfig(id: string): Promise<ProxyConfig | undefined>;
  getProxyConfigByName(name: string): Promise<ProxyConfig | undefined>;
  getActiveProxies(environment: string): Promise<ProxyConfig[]>;
  getHealthyProxies(environment: string): Promise<ProxyConfig[]>;
  createProxyConfig(proxy: InsertProxyConfig): Promise<ProxyConfig>;
  updateProxyConfig(id: string, updates: Partial<ProxyConfig>): Promise<ProxyConfig | undefined>;
  rotateProxy(fromProxyId: string, toProxyId: string, reason: string, walletId?: string): Promise<ProxyRotationLog>;
  updateProxyHealth(id: string, status: string): Promise<ProxyConfig | undefined>;
  
  // Proxy Rotation Log methods
  getProxyRotationLogs(limit?: number): Promise<ProxyRotationLog[]>;
  getProxyRotationLogsByWallet(walletId: string): Promise<ProxyRotationLog[]>;
  createProxyRotationLog(log: InsertProxyRotationLog): Promise<ProxyRotationLog>;
  
  // Network Configuration methods
  getNetworkConfig(environment: string): Promise<NetworkConfig | undefined>;
  getNetworkConfigs(): Promise<NetworkConfig[]>;
  createNetworkConfig(config: InsertNetworkConfig): Promise<NetworkConfig>;
  updateNetworkConfig(environment: string, updates: Partial<NetworkConfig>): Promise<NetworkConfig | undefined>;
  
  // Network Health Metrics methods
  getLatestNetworkHealth(environment: string, endpoint: string): Promise<NetworkHealthMetrics | undefined>;
  getNetworkHealthHistory(environment: string, endpoint: string, limit?: number): Promise<NetworkHealthMetrics[]>;
  createNetworkHealthMetrics(metrics: InsertNetworkHealthMetrics): Promise<NetworkHealthMetrics>;
  updateCircuitBreaker(environment: string, endpoint: string, status: string): Promise<NetworkHealthMetrics | undefined>;
}

// Database Storage Implementation using Drizzle ORM
export class DbStorage implements IStorage {
  private db;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    
    const sql = neon(process.env.DATABASE_URL);
    this.db = drizzle(sql);
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    try {
      const result = await this.db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting user:", error);
      throw new Error(`Failed to retrieve user: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await this.db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting user by username:", error);
      throw new Error(`Failed to retrieve user by username: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const result = await this.db
        .insert(users)
        .values(insertUser)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  // Wallet methods
  async getWallet(id: string): Promise<Wallet | undefined> {
    try {
      const result = await this.db
        .select()
        .from(wallets)
        .where(eq(wallets.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting wallet:", error);
      throw new Error(`Failed to retrieve wallet: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getWallets(): Promise<Wallet[]> {
    try {
      const result = await this.db
        .select()
        .from(wallets)
        .orderBy(desc(wallets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting wallets:", error);
      throw new Error(`Failed to retrieve wallets: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getWalletsByStatus(status: string): Promise<Wallet[]> {
    try {
      const result = await this.db
        .select()
        .from(wallets)
        .where(eq(wallets.status, status))
        .orderBy(desc(wallets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting wallets by status:", error);
      throw new Error(`Failed to retrieve wallets by status: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    try {
      const result = await this.db
        .insert(wallets)
        .values(insertWallet)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating wallet:", error);
      throw error;
    }
  }

  async updateWallet(id: string, updates: Partial<Wallet>): Promise<Wallet | undefined> {
    try {
      const result = await this.db
        .update(wallets)
        .set(updates)
        .where(eq(wallets.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating wallet:", error);
      throw new Error(`Failed to update wallet: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async deleteWallet(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(wallets)
        .where(eq(wallets.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting wallet:", error);
      throw new Error(`Failed to delete wallet: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Launch Plan methods
  async getLaunchPlan(id: string): Promise<LaunchPlan | undefined> {
    try {
      const result = await this.db
        .select()
        .from(launchPlans)
        .where(eq(launchPlans.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting launch plan:", error);
      throw new Error(`Failed to retrieve launch plan: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getLaunchPlans(): Promise<LaunchPlan[]> {
    try {
      const result = await this.db
        .select()
        .from(launchPlans)
        .orderBy(desc(launchPlans.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting launch plans:", error);
      throw new Error(`Failed to retrieve launch plans: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createLaunchPlan(insertPlan: InsertLaunchPlan): Promise<LaunchPlan> {
    try {
      const result = await this.db
        .insert(launchPlans)
        .values(insertPlan)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating launch plan:", error);
      throw error;
    }
  }

  async updateLaunchPlan(id: string, updates: Partial<LaunchPlan>): Promise<LaunchPlan | undefined> {
    try {
      const result = await this.db
        .update(launchPlans)
        .set(updates)
        .where(eq(launchPlans.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating launch plan:", error);
      throw new Error(`Failed to update launch plan: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async deleteLaunchPlan(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(launchPlans)
        .where(eq(launchPlans.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting launch plan:", error);
      throw new Error(`Failed to delete launch plan: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Bundle Execution methods
  async getBundleExecution(id: string): Promise<BundleExecution | undefined> {
    try {
      const result = await this.db
        .select()
        .from(bundleExecutions)
        .where(eq(bundleExecutions.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting bundle execution:", error);
      throw new Error(`Failed to retrieve bundle execution: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getBundleExecutions(): Promise<BundleExecution[]> {
    try {
      const result = await this.db
        .select()
        .from(bundleExecutions)
        .orderBy(desc(bundleExecutions.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting bundle executions:", error);
      throw new Error(`Failed to retrieve bundle executions: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createBundleExecution(insertExecution: InsertBundleExecution): Promise<BundleExecution> {
    try {
      const result = await this.db
        .insert(bundleExecutions)
        .values(insertExecution)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating bundle execution:", error);
      throw error;
    }
  }

  async updateBundleExecution(id: string, updates: Partial<BundleExecution>): Promise<BundleExecution | undefined> {
    try {
      const result = await this.db
        .update(bundleExecutions)
        .set(updates)
        .where(eq(bundleExecutions.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating bundle execution:", error);
      throw new Error(`Failed to update bundle execution: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Activity methods
  async getActivities(limit: number = 50): Promise<Activity[]> {
    try {
      const result = await this.db
        .select()
        .from(activities)
        .orderBy(desc(activities.createdAt))
        .limit(limit);
      return result;
    } catch (error) {
      console.error("Error getting activities:", error);
      throw new Error(`Failed to retrieve activities: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    try {
      const result = await this.db
        .insert(activities)
        .values(insertActivity)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating activity:", error);
      throw error;
    }
  }

  // System Metrics methods
  async getLatestSystemMetrics(): Promise<SystemMetrics | undefined> {
    try {
      const result = await this.db
        .select()
        .from(systemMetrics)
        .orderBy(desc(systemMetrics.createdAt))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting latest system metrics:", error);
      throw new Error(`Failed to retrieve latest system metrics: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createSystemMetrics(insertMetrics: InsertSystemMetrics): Promise<SystemMetrics> {
    try {
      const result = await this.db
        .insert(systemMetrics)
        .values(insertMetrics)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating system metrics:", error);
      throw error;
    }
  }

  // Enhanced Wallet methods
  async getWalletsByHealth(health: string): Promise<Wallet[]> {
    try {
      const result = await this.db
        .select()
        .from(wallets)
        .where(eq(wallets.health, health))
        .orderBy(desc(wallets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting wallets by health:", error);
      throw new Error(`Failed to retrieve wallets by health: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async updateWalletHeartbeat(id: string): Promise<Wallet | undefined> {
    try {
      const result = await this.db
        .update(wallets)
        .set({ 
          lastHeartbeat: new Date(),
          connectionStatus: 'connected'
        })
        .where(eq(wallets.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating wallet heartbeat:", error);
      throw new Error(`Failed to update wallet heartbeat: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Stealth Funding Snapshot methods
  async getStealthFundingSnapshot(id: string): Promise<StealthFundingSnapshot | undefined> {
    try {
      const result = await this.db
        .select()
        .from(stealthFundingSnapshots)
        .where(eq(stealthFundingSnapshots.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting stealth funding snapshot:", error);
      throw new Error(`Failed to retrieve stealth funding snapshot: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getStealthFundingSnapshots(limit: number = 50): Promise<StealthFundingSnapshot[]> {
    try {
      const result = await this.db
        .select()
        .from(stealthFundingSnapshots)
        .orderBy(desc(stealthFundingSnapshots.createdAt))
        .limit(limit);
      return result;
    } catch (error) {
      console.error("Error getting stealth funding snapshots:", error);
      throw new Error(`Failed to retrieve stealth funding snapshots: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getStealthFundingSnapshotsBySession(sessionId: string): Promise<StealthFundingSnapshot[]> {
    try {
      const result = await this.db
        .select()
        .from(stealthFundingSnapshots)
        .where(eq(stealthFundingSnapshots.sessionId, sessionId))
        .orderBy(desc(stealthFundingSnapshots.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting stealth funding snapshots by session:", error);
      throw new Error(`Failed to retrieve stealth funding snapshots by session: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getStealthFundingSnapshotsByWallet(walletId: string): Promise<StealthFundingSnapshot[]> {
    try {
      const result = await this.db
        .select()
        .from(stealthFundingSnapshots)
        .where(eq(stealthFundingSnapshots.walletId, walletId))
        .orderBy(desc(stealthFundingSnapshots.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting stealth funding snapshots by wallet:", error);
      throw new Error(`Failed to retrieve stealth funding snapshots by wallet: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createStealthFundingSnapshot(insertSnapshot: InsertStealthFundingSnapshot): Promise<StealthFundingSnapshot> {
    try {
      const result = await this.db
        .insert(stealthFundingSnapshots)
        .values(insertSnapshot)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating stealth funding snapshot:", error);
      throw error;
    }
  }

  async updateStealthFundingSnapshot(id: string, updates: Partial<StealthFundingSnapshot>): Promise<StealthFundingSnapshot | undefined> {
    try {
      const result = await this.db
        .update(stealthFundingSnapshots)
        .set(updates)
        .where(eq(stealthFundingSnapshots.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating stealth funding snapshot:", error);
      throw new Error(`Failed to update stealth funding snapshot: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Environment Configuration methods
  async getEnvironmentConfig(environment: string): Promise<EnvironmentConfig | undefined> {
    try {
      const result = await this.db
        .select()
        .from(environmentConfig)
        .where(eq(environmentConfig.environment, environment))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting environment config:", error);
      throw new Error(`Failed to retrieve environment config: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getEnvironmentConfigs(): Promise<EnvironmentConfig[]> {
    try {
      const result = await this.db
        .select()
        .from(environmentConfig)
        .orderBy(desc(environmentConfig.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting environment configs:", error);
      throw new Error(`Failed to retrieve environment configs: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getActiveEnvironment(): Promise<EnvironmentConfig | undefined> {
    try {
      const result = await this.db
        .select()
        .from(environmentConfig)
        .where(eq(environmentConfig.isActive, true))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting active environment:", error);
      throw new Error(`Failed to retrieve active environment: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createEnvironmentConfig(insertConfig: InsertEnvironmentConfig): Promise<EnvironmentConfig> {
    try {
      const result = await this.db
        .insert(environmentConfig)
        .values(insertConfig)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating environment config:", error);
      throw error;
    }
  }

  async updateEnvironmentConfig(environment: string, updates: Partial<EnvironmentConfig>): Promise<EnvironmentConfig | undefined> {
    try {
      const result = await this.db
        .update(environmentConfig)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(environmentConfig.environment, environment))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating environment config:", error);
      throw new Error(`Failed to update environment config: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async switchActiveEnvironment(environment: string): Promise<EnvironmentConfig | undefined> {
    try {
      return await this.db.transaction(async (tx) => {
        // Deactivate all environments
        await tx
          .update(environmentConfig)
          .set({ 
            isActive: false,
            updatedAt: new Date()
          });

        // Activate the specified environment
        const result = await tx
          .update(environmentConfig)
          .set({ 
            isActive: true,
            updatedAt: new Date()
          })
          .where(eq(environmentConfig.environment, environment))
          .returning();

        return result[0];
      });
    } catch (error) {
      console.error("Error switching active environment:", error);
      throw new Error(`Failed to switch active environment: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Launch Session methods
  async getLaunchSession(id: string): Promise<LaunchSession | undefined> {
    try {
      const result = await this.db
        .select()
        .from(launchSessions)
        .where(eq(launchSessions.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting launch session:", error);
      throw new Error(`Failed to retrieve launch session: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getLaunchSessions(): Promise<LaunchSession[]> {
    try {
      const result = await this.db
        .select()
        .from(launchSessions)
        .orderBy(desc(launchSessions.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting launch sessions:", error);
      throw new Error(`Failed to retrieve launch sessions: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getActiveLaunchSessions(): Promise<LaunchSession[]> {
    try {
      const result = await this.db
        .select()
        .from(launchSessions)
        .where(eq(launchSessions.status, 'active'))
        .orderBy(desc(launchSessions.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting active launch sessions:", error);
      throw new Error(`Failed to retrieve active launch sessions: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getLaunchSessionsByPlan(launchPlanId: string): Promise<LaunchSession[]> {
    try {
      const result = await this.db
        .select()
        .from(launchSessions)
        .where(eq(launchSessions.launchPlanId, launchPlanId))
        .orderBy(desc(launchSessions.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting launch sessions by plan:", error);
      throw new Error(`Failed to retrieve launch sessions by plan: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createLaunchSession(insertSession: InsertLaunchSession): Promise<LaunchSession> {
    try {
      const result = await this.db
        .insert(launchSessions)
        .values(insertSession)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating launch session:", error);
      throw error;
    }
  }

  async updateLaunchSession(id: string, updates: Partial<LaunchSession>): Promise<LaunchSession | undefined> {
    try {
      const result = await this.db
        .update(launchSessions)
        .set(updates)
        .where(eq(launchSessions.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating launch session:", error);
      throw new Error(`Failed to update launch session: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Bundle Transaction methods
  async getBundleTransaction(id: string): Promise<BundleTransaction | undefined> {
    try {
      const result = await this.db
        .select()
        .from(bundleTransactions)
        .where(eq(bundleTransactions.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting bundle transaction:", error);
      throw new Error(`Failed to retrieve bundle transaction: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getBundleTransactionsByBundleId(bundleExecutionId: string): Promise<BundleTransaction[]> {
    try {
      const result = await this.db
        .select()
        .from(bundleTransactions)
        .where(eq(bundleTransactions.bundleExecutionId, bundleExecutionId))
        .orderBy(desc(bundleTransactions.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting bundle transactions by bundle ID:", error);
      throw new Error(`Failed to retrieve bundle transactions by bundle ID: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getBundleTransactionsByWalletId(walletId: string): Promise<BundleTransaction[]> {
    try {
      const result = await this.db
        .select()
        .from(bundleTransactions)
        .where(eq(bundleTransactions.walletId, walletId))
        .orderBy(desc(bundleTransactions.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting bundle transactions by wallet ID:", error);
      throw new Error(`Failed to retrieve bundle transactions by wallet ID: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getBundleTransactionsByStatus(status: string): Promise<BundleTransaction[]> {
    try {
      const result = await this.db
        .select()
        .from(bundleTransactions)
        .where(eq(bundleTransactions.status, status))
        .orderBy(desc(bundleTransactions.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting bundle transactions by status:", error);
      throw new Error(`Failed to retrieve bundle transactions by status: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createBundleTransaction(insertTransaction: InsertBundleTransaction): Promise<BundleTransaction> {
    try {
      const result = await this.db
        .insert(bundleTransactions)
        .values(insertTransaction)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating bundle transaction:", error);
      throw error;
    }
  }

  async updateBundleTransaction(id: string, updates: Partial<BundleTransaction>): Promise<BundleTransaction | undefined> {
    try {
      const result = await this.db
        .update(bundleTransactions)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(bundleTransactions.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating bundle transaction:", error);
      throw new Error(`Failed to update bundle transaction: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async updateBundleTransactionStatus(id: string, status: string, errorMessage?: string): Promise<BundleTransaction | undefined> {
    try {
      const updates: any = {
        status,
        updatedAt: new Date()
      };
      if (errorMessage) {
        updates.errorMessage = errorMessage;
      }
      const result = await this.db
        .update(bundleTransactions)
        .set(updates)
        .where(eq(bundleTransactions.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating bundle transaction status:", error);
      throw new Error(`Failed to update bundle transaction status: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Transaction Event methods
  async getTransactionEvent(id: string): Promise<TransactionEvent | undefined> {
    try {
      const result = await this.db
        .select()
        .from(transactionEvents)
        .where(eq(transactionEvents.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting transaction event:", error);
      throw new Error(`Failed to retrieve transaction event: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getTransactionEventsByTransactionId(bundleTransactionId: string): Promise<TransactionEvent[]> {
    try {
      const result = await this.db
        .select()
        .from(transactionEvents)
        .where(eq(transactionEvents.bundleTransactionId, bundleTransactionId))
        .orderBy(desc(transactionEvents.timestamp));
      return result;
    } catch (error) {
      console.error("Error getting transaction events by transaction ID:", error);
      throw new Error(`Failed to retrieve transaction events by transaction ID: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getTransactionEventTimeline(bundleTransactionId: string): Promise<TransactionEvent[]> {
    try {
      const result = await this.db
        .select()
        .from(transactionEvents)
        .where(eq(transactionEvents.bundleTransactionId, bundleTransactionId))
        .orderBy(transactionEvents.timestamp);
      return result;
    } catch (error) {
      console.error("Error getting transaction event timeline:", error);
      throw new Error(`Failed to retrieve transaction event timeline: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createTransactionEvent(insertEvent: InsertTransactionEvent): Promise<TransactionEvent> {
    try {
      const result = await this.db
        .insert(transactionEvents)
        .values(insertEvent)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating transaction event:", error);
      throw error;
    }
  }

  async recordTransactionStatusChange(bundleTransactionId: string, status: string, details?: Partial<InsertTransactionEvent>): Promise<TransactionEvent> {
    try {
      const insertEvent: InsertTransactionEvent = {
        bundleTransactionId,
        status,
        eventType: 'status_change',
        description: details?.description || `Status changed to ${status}`,
        ...details
      };
      const result = await this.db
        .insert(transactionEvents)
        .values(insertEvent)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error recording transaction status change:", error);
      throw new Error(`Failed to record transaction status change: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Bundle Analytics methods
  async getBundleAnalytics(id: string): Promise<BundleAnalytics | undefined> {
    try {
      const result = await this.db
        .select()
        .from(bundleAnalytics)
        .where(eq(bundleAnalytics.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting bundle analytics:", error);
      throw new Error(`Failed to retrieve bundle analytics: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getBundleAnalyticsByBundleId(bundleExecutionId: string): Promise<BundleAnalytics[]> {
    try {
      const result = await this.db
        .select()
        .from(bundleAnalytics)
        .where(eq(bundleAnalytics.bundleExecutionId, bundleExecutionId))
        .orderBy(desc(bundleAnalytics.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting bundle analytics by bundle ID:", error);
      throw new Error(`Failed to retrieve bundle analytics by bundle ID: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getBundleAnalyticsByLaunchPlanId(launchPlanId: string): Promise<BundleAnalytics[]> {
    try {
      const result = await this.db
        .select()
        .from(bundleAnalytics)
        .where(eq(bundleAnalytics.launchPlanId, launchPlanId))
        .orderBy(desc(bundleAnalytics.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting bundle analytics by launch plan ID:", error);
      throw new Error(`Failed to retrieve bundle analytics by launch plan ID: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getBundleAnalyticsByTimeframe(timeframe: string, limit: number = 50): Promise<BundleAnalytics[]> {
    try {
      const result = await this.db
        .select()
        .from(bundleAnalytics)
        .where(eq(bundleAnalytics.timeframe, timeframe))
        .orderBy(desc(bundleAnalytics.createdAt))
        .limit(limit);
      return result;
    } catch (error) {
      console.error("Error getting bundle analytics by timeframe:", error);
      throw new Error(`Failed to retrieve bundle analytics by timeframe: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createBundleAnalytics(insertAnalytics: InsertBundleAnalytics): Promise<BundleAnalytics> {
    try {
      const result = await this.db
        .insert(bundleAnalytics)
        .values(insertAnalytics)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating bundle analytics:", error);
      throw error;
    }
  }

  async updateBundleAnalytics(id: string, updates: Partial<BundleAnalytics>): Promise<BundleAnalytics | undefined> {
    try {
      const result = await this.db
        .update(bundleAnalytics)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(bundleAnalytics.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating bundle analytics:", error);
      throw new Error(`Failed to update bundle analytics: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async aggregateBundleAnalytics(bundleExecutionId: string, timeframe: string): Promise<BundleAnalytics> {
    try {
      // Get all transactions for the bundle
      const transactions = await this.getBundleTransactionsByBundleId(bundleExecutionId);
      
      // Calculate aggregated metrics
      const totalTransactions = transactions.length;
      const successfulTransactions = transactions.filter(t => t.status === 'confirmed').length;
      const failedTransactions = transactions.filter(t => t.status === 'failed').length;
      const successRate = totalTransactions > 0 ? ((successfulTransactions / totalTransactions) * 100).toFixed(2) : '0';
      
      // Calculate gas and value metrics
      const totalGasUsed = transactions.reduce((sum, t) => {
        const gas = t.gasUsed ? BigInt(t.gasUsed) : BigInt(0);
        return sum + gas;
      }, BigInt(0)).toString();
      
      const totalValue = transactions.reduce((sum, t) => {
        const value = t.value ? parseFloat(t.value) : 0;
        return sum + value;
      }, 0).toFixed(8);
      
      const avgGasPrice = transactions.length > 0 
        ? (transactions.reduce((sum, t) => {
            const price = t.gasPrice ? parseFloat(t.gasPrice) : 0;
            return sum + price;
          }, 0) / transactions.length).toFixed(9)
        : '0';
      
      const walletsInvolved = new Set(transactions.map(t => t.walletId)).size;
      
      const now = new Date();
      const insertAnalytics: InsertBundleAnalytics = {
        bundleExecutionId,
        timeframe,
        totalTransactions,
        successfulTransactions,
        failedTransactions,
        successRate,
        totalGasUsed,
        avgGasPrice,
        totalValue,
        walletsInvolved,
        periodStartAt: now,
        periodEndAt: now
      };
      
      return await this.createBundleAnalytics(insertAnalytics);
    } catch (error) {
      console.error("Error aggregating bundle analytics:", error);
      throw new Error(`Failed to aggregate bundle analytics: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Paginated history methods
  async getBundleHistory(options: {
    page?: number;
    pageSize?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ data: BundleExecution[]; total: number; page: number; pageSize: number }> {
    try {
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const offset = (page - 1) * pageSize;
      
      // Build query with filters
      const conditions = [];
      if (options.status) {
        conditions.push(eq(bundleExecutions.status, options.status));
      }
      if (options.startDate) {
        conditions.push(gte(bundleExecutions.createdAt, options.startDate));
      }
      if (options.endDate) {
        conditions.push(lte(bundleExecutions.createdAt, options.endDate));
      }
      
      // Get total count
      const countQuery = conditions.length > 0
        ? this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(bundleExecutions)
            .where(and(...conditions))
        : this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(bundleExecutions);
      
      const countResult = await countQuery;
      const total = countResult[0]?.count || 0;
      
      // Get paginated data
      const dataQuery = conditions.length > 0
        ? this.db
            .select()
            .from(bundleExecutions)
            .where(and(...conditions))
            .orderBy(desc(bundleExecutions.createdAt))
            .limit(pageSize)
            .offset(offset)
        : this.db
            .select()
            .from(bundleExecutions)
            .orderBy(desc(bundleExecutions.createdAt))
            .limit(pageSize)
            .offset(offset);
      
      const data = await dataQuery;
      
      return {
        data,
        total,
        page,
        pageSize
      };
    } catch (error) {
      console.error("Error getting bundle history:", error);
      throw new Error(`Failed to retrieve bundle history: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Real-time progress methods
  async getBundleProgress(bundleExecutionId: string): Promise<{
    bundle: BundleExecution;
    transactions: BundleTransaction[];
    events: TransactionEvent[];
    analytics?: BundleAnalytics;
  }> {
    try {
      const bundle = await this.getBundleExecution(bundleExecutionId);
      if (!bundle) {
        throw new Error('Bundle execution not found');
      }
      
      const transactions = await this.getBundleTransactionsByBundleId(bundleExecutionId);
      
      // Get all events for all transactions
      const events: TransactionEvent[] = [];
      for (const tx of transactions) {
        const txEvents = await this.getTransactionEventsByTransactionId(tx.id);
        events.push(...txEvents);
      }
      
      // Get the latest analytics for this bundle
      const analyticsResults = await this.getBundleAnalyticsByBundleId(bundleExecutionId);
      const analytics = analyticsResults[0];
      
      return {
        bundle,
        transactions,
        events,
        analytics
      };
    } catch (error) {
      console.error("Error getting bundle progress:", error);
      throw new Error(`Failed to retrieve bundle progress: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Transaction support for multi-step operations
  async executeInTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction(callback);
    } catch (error) {
      console.error("Transaction failed:", error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Proxy Configuration methods
  async getProxyConfig(id: string): Promise<ProxyConfig | undefined> {
    try {
      const result = await this.db
        .select()
        .from(proxyConfig)
        .where(eq(proxyConfig.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting proxy config:", error);
      throw new Error(`Failed to retrieve proxy config: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getProxyConfigByName(name: string): Promise<ProxyConfig | undefined> {
    try {
      const result = await this.db
        .select()
        .from(proxyConfig)
        .where(eq(proxyConfig.name, name))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting proxy config by name:", error);
      throw new Error(`Failed to retrieve proxy config by name: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getActiveProxies(environment: string): Promise<ProxyConfig[]> {
    try {
      const result = await this.db
        .select()
        .from(proxyConfig)
        .where(and(
          eq(proxyConfig.environment, environment),
          eq(proxyConfig.isActive, true)
        ))
        .orderBy(desc(proxyConfig.priority));
      return result;
    } catch (error) {
      console.error("Error getting active proxies:", error);
      throw new Error(`Failed to retrieve active proxies: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getHealthyProxies(environment: string): Promise<ProxyConfig[]> {
    try {
      const result = await this.db
        .select()
        .from(proxyConfig)
        .where(and(
          eq(proxyConfig.environment, environment),
          eq(proxyConfig.isActive, true),
          eq(proxyConfig.healthStatus, 'healthy')
        ))
        .orderBy(desc(proxyConfig.priority));
      return result;
    } catch (error) {
      console.error("Error getting healthy proxies:", error);
      throw new Error(`Failed to retrieve healthy proxies: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createProxyConfig(insertProxy: InsertProxyConfig): Promise<ProxyConfig> {
    try {
      const result = await this.db
        .insert(proxyConfig)
        .values(insertProxy)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating proxy config:", error);
      throw error;
    }
  }

  async updateProxyConfig(id: string, updates: Partial<ProxyConfig>): Promise<ProxyConfig | undefined> {
    try {
      const result = await this.db
        .update(proxyConfig)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(proxyConfig.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating proxy config:", error);
      throw new Error(`Failed to update proxy config: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async rotateProxy(fromProxyId: string, toProxyId: string, reason: string, walletId?: string): Promise<ProxyRotationLog> {
    try {
      const insertLog: InsertProxyRotationLog = {
        fromProxyId,
        toProxyId,
        reason,
        walletId: walletId || null,
        environment: process.env.NODE_ENV || 'development'
      };
      
      const result = await this.db
        .insert(proxyRotationLog)
        .values(insertLog)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error rotating proxy:", error);
      throw new Error(`Failed to rotate proxy: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async updateProxyHealth(id: string, status: string): Promise<ProxyConfig | undefined> {
    try {
      const result = await this.db
        .update(proxyConfig)
        .set({
          healthStatus: status,
          lastHealthCheck: new Date(),
          updatedAt: new Date()
        })
        .where(eq(proxyConfig.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating proxy health:", error);
      throw new Error(`Failed to update proxy health: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Proxy Rotation Log methods
  async getProxyRotationLogs(limit: number = 50): Promise<ProxyRotationLog[]> {
    try {
      const result = await this.db
        .select()
        .from(proxyRotationLog)
        .orderBy(desc(proxyRotationLog.rotatedAt))
        .limit(limit);
      return result;
    } catch (error) {
      console.error("Error getting proxy rotation logs:", error);
      throw new Error(`Failed to retrieve proxy rotation logs: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getProxyRotationLogsByWallet(walletId: string): Promise<ProxyRotationLog[]> {
    try {
      const result = await this.db
        .select()
        .from(proxyRotationLog)
        .where(eq(proxyRotationLog.walletId, walletId))
        .orderBy(desc(proxyRotationLog.rotatedAt));
      return result;
    } catch (error) {
      console.error("Error getting proxy rotation logs by wallet:", error);
      throw new Error(`Failed to retrieve proxy rotation logs by wallet: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createProxyRotationLog(insertLog: InsertProxyRotationLog): Promise<ProxyRotationLog> {
    try {
      const result = await this.db
        .insert(proxyRotationLog)
        .values(insertLog)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating proxy rotation log:", error);
      throw error;
    }
  }

  // Network Configuration methods
  async getNetworkConfig(environment: string): Promise<NetworkConfig | undefined> {
    try {
      const result = await this.db
        .select()
        .from(networkConfig)
        .where(eq(networkConfig.environment, environment))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting network config:", error);
      throw new Error(`Failed to retrieve network config: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getNetworkConfigs(): Promise<NetworkConfig[]> {
    try {
      const result = await this.db
        .select()
        .from(networkConfig)
        .orderBy(networkConfig.environment);
      return result;
    } catch (error) {
      console.error("Error getting network configs:", error);
      throw new Error(`Failed to retrieve network configs: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createNetworkConfig(insertConfig: InsertNetworkConfig): Promise<NetworkConfig> {
    try {
      const result = await this.db
        .insert(networkConfig)
        .values(insertConfig)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating network config:", error);
      throw error;
    }
  }

  async updateNetworkConfig(environment: string, updates: Partial<NetworkConfig>): Promise<NetworkConfig | undefined> {
    try {
      const result = await this.db
        .update(networkConfig)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(networkConfig.environment, environment))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating network config:", error);
      throw new Error(`Failed to update network config: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Network Health Metrics methods
  async getLatestNetworkHealth(environment: string, endpoint: string): Promise<NetworkHealthMetrics | undefined> {
    try {
      const result = await this.db
        .select()
        .from(networkHealthMetrics)
        .where(and(
          eq(networkHealthMetrics.environment, environment),
          eq(networkHealthMetrics.endpoint, endpoint)
        ))
        .orderBy(desc(networkHealthMetrics.createdAt))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting latest network health:", error);
      throw new Error(`Failed to retrieve latest network health: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getNetworkHealthHistory(environment: string, endpoint: string, limit: number = 50): Promise<NetworkHealthMetrics[]> {
    try {
      const result = await this.db
        .select()
        .from(networkHealthMetrics)
        .where(and(
          eq(networkHealthMetrics.environment, environment),
          eq(networkHealthMetrics.endpoint, endpoint)
        ))
        .orderBy(desc(networkHealthMetrics.createdAt))
        .limit(limit);
      return result;
    } catch (error) {
      console.error("Error getting network health history:", error);
      throw new Error(`Failed to retrieve network health history: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createNetworkHealthMetrics(insertMetrics: InsertNetworkHealthMetrics): Promise<NetworkHealthMetrics> {
    try {
      const result = await this.db
        .insert(networkHealthMetrics)
        .values(insertMetrics)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating network health metrics:", error);
      throw error;
    }
  }

  async updateCircuitBreaker(environment: string, endpoint: string, status: string): Promise<NetworkHealthMetrics | undefined> {
    try {
      // First get the latest metric
      const latest = await this.getLatestNetworkHealth(environment, endpoint);
      
      if (!latest) {
        // Create new metric if none exists
        const newMetric: InsertNetworkHealthMetrics = {
          environment,
          endpoint,
          circuitBreakerStatus: status,
          requestCount: 0,
          failureCount: 0,
          avgResponseTime: 0,
          successRate: 100,
          lastErrorMessage: null,
          metadata: {}
        };
        return await this.createNetworkHealthMetrics(newMetric);
      }
      
      // Update existing metric
      const result = await this.db
        .update(networkHealthMetrics)
        .set({
          circuitBreakerStatus: status,
          updatedAt: new Date()
        })
        .where(eq(networkHealthMetrics.id, latest.id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating circuit breaker:", error);
      throw new Error(`Failed to update circuit breaker: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private wallets: Map<string, Wallet>;
  private launchPlans: Map<string, LaunchPlan>;
  private bundleExecutions: Map<string, BundleExecution>;
  private activities: Activity[];
  private systemMetrics: SystemMetrics[];

  constructor() {
    this.users = new Map();
    this.wallets = new Map();
    this.launchPlans = new Map();
    this.bundleExecutions = new Map();
    this.activities = [];
    this.systemMetrics = [];
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Wallet methods
  async getWallet(id: string): Promise<Wallet | undefined> {
    return this.wallets.get(id);
  }

  async getWallets(): Promise<Wallet[]> {
    return Array.from(this.wallets.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getWalletsByStatus(status: string): Promise<Wallet[]> {
    return Array.from(this.wallets.values()).filter(wallet => wallet.status === status);
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const id = randomUUID();
    const wallet: Wallet = { 
      ...insertWallet, 
      id, 
      createdAt: new Date(),
      lastActivity: null,
      label: insertWallet.label || null,
      status: insertWallet.status || "idle",
      balance: insertWallet.balance || "0",
      health: insertWallet.health || "healthy",
      connectionStatus: insertWallet.connectionStatus || "disconnected",
      lastHeartbeat: null,
      gasEstimate: null
    };
    this.wallets.set(id, wallet);
    return wallet;
  }

  async updateWallet(id: string, updates: Partial<Wallet>): Promise<Wallet | undefined> {
    const wallet = this.wallets.get(id);
    if (!wallet) return undefined;
    
    const updatedWallet = { ...wallet, ...updates };
    this.wallets.set(id, updatedWallet);
    return updatedWallet;
  }

  async deleteWallet(id: string): Promise<boolean> {
    return this.wallets.delete(id);
  }

  // Launch Plan methods
  async getLaunchPlan(id: string): Promise<LaunchPlan | undefined> {
    return this.launchPlans.get(id);
  }

  async getLaunchPlans(): Promise<LaunchPlan[]> {
    return Array.from(this.launchPlans.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createLaunchPlan(insertPlan: InsertLaunchPlan): Promise<LaunchPlan> {
    const id = randomUUID();
    const plan: LaunchPlan = { 
      ...insertPlan, 
      id, 
      createdAt: new Date(),
      status: insertPlan.status || "draft"
    };
    this.launchPlans.set(id, plan);
    return plan;
  }

  async updateLaunchPlan(id: string, updates: Partial<LaunchPlan>): Promise<LaunchPlan | undefined> {
    const plan = this.launchPlans.get(id);
    if (!plan) return undefined;
    
    const updatedPlan = { ...plan, ...updates };
    this.launchPlans.set(id, updatedPlan);
    return updatedPlan;
  }

  async deleteLaunchPlan(id: string): Promise<boolean> {
    return this.launchPlans.delete(id);
  }

  // Bundle Execution methods
  async getBundleExecution(id: string): Promise<BundleExecution | undefined> {
    return this.bundleExecutions.get(id);
  }

  async getBundleExecutions(): Promise<BundleExecution[]> {
    return Array.from(this.bundleExecutions.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createBundleExecution(insertExecution: InsertBundleExecution): Promise<BundleExecution> {
    const id = randomUUID();
    const execution: BundleExecution = { 
      ...insertExecution, 
      id, 
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      status: insertExecution.status || "pending",
      completedWallets: insertExecution.completedWallets || 0,
      failedWallets: insertExecution.failedWallets || 0,
      progressPercentage: insertExecution.progressPercentage || "0",
      failureReason: insertExecution.failureReason || null,
      quicknodeSubscriptionId: insertExecution.quicknodeSubscriptionId || null
    };
    this.bundleExecutions.set(id, execution);
    return execution;
  }

  async updateBundleExecution(id: string, updates: Partial<BundleExecution>): Promise<BundleExecution | undefined> {
    const execution = this.bundleExecutions.get(id);
    if (!execution) return undefined;
    
    const updatedExecution = { ...execution, ...updates };
    this.bundleExecutions.set(id, updatedExecution);
    return updatedExecution;
  }

  // Activity methods
  async getActivities(limit: number = 50): Promise<Activity[]> {
    return this.activities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const id = randomUUID();
    const activity: Activity = { 
      ...insertActivity, 
      id, 
      createdAt: new Date(),
      walletId: insertActivity.walletId || null,
      amount: insertActivity.amount || null,
      transactionHash: insertActivity.transactionHash || null
    };
    this.activities.push(activity);
    return activity;
  }

  // System Metrics methods
  async getLatestSystemMetrics(): Promise<SystemMetrics | undefined> {
    return this.systemMetrics.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  }

  async createSystemMetrics(insertMetrics: InsertSystemMetrics): Promise<SystemMetrics> {
    const id = randomUUID();
    const metrics: SystemMetrics = { 
      ...insertMetrics, 
      id, 
      createdAt: new Date(),
      taxCollected: insertMetrics.taxCollected || "0"
    };
    this.systemMetrics.push(metrics);
    return metrics;
  }

  // Enhanced Wallet methods
  async getWalletsByHealth(health: string): Promise<Wallet[]> {
    throw new Error("getWalletsByHealth not implemented in memory storage");
  }

  async updateWalletHeartbeat(id: string): Promise<Wallet | undefined> {
    throw new Error("updateWalletHeartbeat not implemented in memory storage");
  }

  // Stealth Funding Snapshot methods
  async getStealthFundingSnapshot(id: string): Promise<StealthFundingSnapshot | undefined> {
    throw new Error("getStealthFundingSnapshot not implemented in memory storage");
  }

  async getStealthFundingSnapshots(limit?: number): Promise<StealthFundingSnapshot[]> {
    throw new Error("getStealthFundingSnapshots not implemented in memory storage");
  }

  async getStealthFundingSnapshotsBySession(sessionId: string): Promise<StealthFundingSnapshot[]> {
    throw new Error("getStealthFundingSnapshotsBySession not implemented in memory storage");
  }

  async getStealthFundingSnapshotsByWallet(walletId: string): Promise<StealthFundingSnapshot[]> {
    throw new Error("getStealthFundingSnapshotsByWallet not implemented in memory storage");
  }

  async createStealthFundingSnapshot(snapshot: InsertStealthFundingSnapshot): Promise<StealthFundingSnapshot> {
    throw new Error("createStealthFundingSnapshot not implemented in memory storage");
  }

  async updateStealthFundingSnapshot(id: string, updates: Partial<StealthFundingSnapshot>): Promise<StealthFundingSnapshot | undefined> {
    throw new Error("updateStealthFundingSnapshot not implemented in memory storage");
  }

  // Environment Configuration methods
  async getEnvironmentConfig(environment: string): Promise<EnvironmentConfig | undefined> {
    throw new Error("getEnvironmentConfig not implemented in memory storage");
  }

  async getEnvironmentConfigs(): Promise<EnvironmentConfig[]> {
    throw new Error("getEnvironmentConfigs not implemented in memory storage");
  }

  async getActiveEnvironment(): Promise<EnvironmentConfig | undefined> {
    throw new Error("getActiveEnvironment not implemented in memory storage");
  }

  async createEnvironmentConfig(config: InsertEnvironmentConfig): Promise<EnvironmentConfig> {
    throw new Error("createEnvironmentConfig not implemented in memory storage");
  }

  async updateEnvironmentConfig(environment: string, updates: Partial<EnvironmentConfig>): Promise<EnvironmentConfig | undefined> {
    throw new Error("updateEnvironmentConfig not implemented in memory storage");
  }

  async switchActiveEnvironment(environment: string): Promise<EnvironmentConfig | undefined> {
    throw new Error("switchActiveEnvironment not implemented in memory storage");
  }

  // Launch Session methods
  async getLaunchSession(id: string): Promise<LaunchSession | undefined> {
    throw new Error("getLaunchSession not implemented in memory storage");
  }

  async getLaunchSessions(): Promise<LaunchSession[]> {
    throw new Error("getLaunchSessions not implemented in memory storage");
  }

  async getActiveLaunchSessions(): Promise<LaunchSession[]> {
    throw new Error("getActiveLaunchSessions not implemented in memory storage");
  }

  async getLaunchSessionsByPlan(launchPlanId: string): Promise<LaunchSession[]> {
    throw new Error("getLaunchSessionsByPlan not implemented in memory storage");
  }

  async createLaunchSession(session: InsertLaunchSession): Promise<LaunchSession> {
    throw new Error("createLaunchSession not implemented in memory storage");
  }

  async updateLaunchSession(id: string, updates: Partial<LaunchSession>): Promise<LaunchSession | undefined> {
    throw new Error("updateLaunchSession not implemented in memory storage");
  }

  // Bundle Transaction methods
  async getBundleTransaction(id: string): Promise<BundleTransaction | undefined> {
    throw new Error("getBundleTransaction not implemented in memory storage");
  }

  async getBundleTransactionsByBundleId(bundleExecutionId: string): Promise<BundleTransaction[]> {
    throw new Error("getBundleTransactionsByBundleId not implemented in memory storage");
  }

  async getBundleTransactionsByWalletId(walletId: string): Promise<BundleTransaction[]> {
    throw new Error("getBundleTransactionsByWalletId not implemented in memory storage");
  }

  async getBundleTransactionsByStatus(status: string): Promise<BundleTransaction[]> {
    throw new Error("getBundleTransactionsByStatus not implemented in memory storage");
  }

  async createBundleTransaction(transaction: InsertBundleTransaction): Promise<BundleTransaction> {
    throw new Error("createBundleTransaction not implemented in memory storage");
  }

  async updateBundleTransaction(id: string, updates: Partial<BundleTransaction>): Promise<BundleTransaction | undefined> {
    throw new Error("updateBundleTransaction not implemented in memory storage");
  }

  async updateBundleTransactionStatus(id: string, status: string, errorMessage?: string): Promise<BundleTransaction | undefined> {
    throw new Error("updateBundleTransactionStatus not implemented in memory storage");
  }

  // Transaction Event methods
  async getTransactionEvent(id: string): Promise<TransactionEvent | undefined> {
    throw new Error("getTransactionEvent not implemented in memory storage");
  }

  async getTransactionEventsByTransactionId(bundleTransactionId: string): Promise<TransactionEvent[]> {
    throw new Error("getTransactionEventsByTransactionId not implemented in memory storage");
  }

  async getTransactionEventTimeline(bundleTransactionId: string): Promise<TransactionEvent[]> {
    throw new Error("getTransactionEventTimeline not implemented in memory storage");
  }

  async createTransactionEvent(event: InsertTransactionEvent): Promise<TransactionEvent> {
    throw new Error("createTransactionEvent not implemented in memory storage");
  }

  async recordTransactionStatusChange(bundleTransactionId: string, status: string, details?: Partial<InsertTransactionEvent>): Promise<TransactionEvent> {
    throw new Error("recordTransactionStatusChange not implemented in memory storage");
  }

  // Bundle Analytics methods
  async getBundleAnalytics(id: string): Promise<BundleAnalytics | undefined> {
    throw new Error("getBundleAnalytics not implemented in memory storage");
  }

  async getBundleAnalyticsByBundleId(bundleExecutionId: string): Promise<BundleAnalytics[]> {
    throw new Error("getBundleAnalyticsByBundleId not implemented in memory storage");
  }

  async getBundleAnalyticsByLaunchPlanId(launchPlanId: string): Promise<BundleAnalytics[]> {
    throw new Error("getBundleAnalyticsByLaunchPlanId not implemented in memory storage");
  }

  async getBundleAnalyticsByTimeframe(timeframe: string, limit?: number): Promise<BundleAnalytics[]> {
    throw new Error("getBundleAnalyticsByTimeframe not implemented in memory storage");
  }

  async createBundleAnalytics(analytics: InsertBundleAnalytics): Promise<BundleAnalytics> {
    throw new Error("createBundleAnalytics not implemented in memory storage");
  }

  async updateBundleAnalytics(id: string, updates: Partial<BundleAnalytics>): Promise<BundleAnalytics | undefined> {
    throw new Error("updateBundleAnalytics not implemented in memory storage");
  }

  async aggregateBundleAnalytics(bundleExecutionId: string, timeframe: string): Promise<BundleAnalytics> {
    throw new Error("aggregateBundleAnalytics not implemented in memory storage");
  }

  // Paginated history methods
  async getBundleHistory(options: {
    page?: number;
    pageSize?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ data: BundleExecution[]; total: number; page: number; pageSize: number }> {
    throw new Error("getBundleHistory not implemented in memory storage");
  }

  // Real-time progress methods
  async getBundleProgress(bundleExecutionId: string): Promise<{
    bundle: BundleExecution;
    transactions: BundleTransaction[];
    events: TransactionEvent[];
    analytics?: BundleAnalytics;
  }> {
    throw new Error("getBundleProgress not implemented in memory storage");
  }

  // Execute transaction helper
  async executeInTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    throw new Error("executeInTransaction not implemented in memory storage");
  }

  // Proxy Configuration methods (stub implementations for now)
  async getProxyConfig(id: string): Promise<ProxyConfig | undefined> {
    return undefined;
  }

  async getProxyConfigByName(name: string): Promise<ProxyConfig | undefined> {
    return undefined;
  }

  async getActiveProxies(environment: string): Promise<ProxyConfig[]> {
    return [];
  }

  async getHealthyProxies(environment: string): Promise<ProxyConfig[]> {
    // Return empty array to prevent errors
    return [];
  }

  async createProxyConfig(proxy: InsertProxyConfig): Promise<ProxyConfig> {
    throw new Error("createProxyConfig not implemented in memory storage");
  }

  async updateProxyConfig(id: string, updates: Partial<ProxyConfig>): Promise<ProxyConfig | undefined> {
    return undefined;
  }

  async rotateProxy(fromProxyId: string, toProxyId: string, reason: string, walletId?: string): Promise<ProxyRotationLog> {
    throw new Error("rotateProxy not implemented in memory storage");
  }

  async updateProxyHealth(id: string, status: string): Promise<ProxyConfig | undefined> {
    return undefined;
  }
  
  // Proxy Rotation Log methods
  async getProxyRotationLogs(limit?: number): Promise<ProxyRotationLog[]> {
    return [];
  }

  async getProxyRotationLogsByWallet(walletId: string): Promise<ProxyRotationLog[]> {
    return [];
  }

  async createProxyRotationLog(log: InsertProxyRotationLog): Promise<ProxyRotationLog> {
    throw new Error("createProxyRotationLog not implemented in memory storage");
  }
  
  // Network Configuration methods
  async getNetworkConfig(environment: string): Promise<NetworkConfig | undefined> {
    return undefined;
  }

  async getNetworkConfigs(): Promise<NetworkConfig[]> {
    return [];
  }

  async createNetworkConfig(config: InsertNetworkConfig): Promise<NetworkConfig> {
    throw new Error("createNetworkConfig not implemented in memory storage");
  }

  async updateNetworkConfig(environment: string, updates: Partial<NetworkConfig>): Promise<NetworkConfig | undefined> {
    return undefined;
  }
  
  // Network Health Metrics methods
  async getLatestNetworkHealth(environment: string, endpoint: string): Promise<NetworkHealthMetrics | undefined> {
    return undefined;
  }

  async getNetworkHealthHistory(environment: string, endpoint: string, limit?: number): Promise<NetworkHealthMetrics[]> {
    return [];
  }

  async createNetworkHealthMetrics(metrics: InsertNetworkHealthMetrics): Promise<NetworkHealthMetrics> {
    throw new Error("createNetworkHealthMetrics not implemented in memory storage");
  }

  async updateCircuitBreaker(environment: string, endpoint: string, status: string): Promise<NetworkHealthMetrics | undefined> {
    return undefined;
  }
}

// Use database storage instead of memory storage
export const storage = new DbStorage();