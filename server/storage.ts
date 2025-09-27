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
  type AccessKey, type InsertAccessKey,
  type UserSession, type InsertUserSession,
  type AuditLog, type InsertAuditLog,
  // P&L tracking types
  type PortfolioSnapshot, type InsertPortfolioSnapshot,
  type TransactionPnL, type InsertTransactionPnL,
  type TokenPosition, type InsertTokenPosition,
  type PerformanceMetrics, type InsertPerformanceMetrics,
  type PnLAlert, type InsertPnLAlert,
  type MarketDataCache, type InsertMarketDataCache,
  // Wallet pool and bulk operations types
  type WalletPool, type InsertWalletPool,
  type WalletPoolMembership, type InsertWalletPoolMembership,
  type BulkOperation, type InsertBulkOperation,
  type BulkOperationProgress, type InsertBulkOperationProgress,
  type WalletTag, type InsertWalletTag,
  // Token types
  type Token, type InsertToken,
  type LiquidityPool, type InsertLiquidityPool,
  type TokenHolder, type InsertTokenHolder,
  type TokenDeployment, type InsertTokenDeployment,
  users, wallets, launchPlans, bundleExecutions, activities, systemMetrics, 
  stealthFundingSnapshots, environmentConfig, launchSessions,
  bundleTransactions, transactionEvents, bundleAnalytics,
  proxyConfig, proxyRotationLog, networkConfig, networkHealthMetrics,
  accessKeys, userSessions, auditLogs,
  // P&L tracking tables
  portfolioSnapshots, transactionPnL, tokenPositions, performanceMetrics,
  pnlAlerts, marketDataCache,
  // Wallet pool and bulk operations tables
  walletPools, walletPoolMemberships, bulkOperations, bulkOperationProgress, walletTags,
  // Token tables
  tokens, liquidityPools, tokenHolders, tokenDeployments,
  // Preset system tables and types
  type LaunchPreset, type InsertLaunchPreset,
  type UserPreset, type InsertUserPreset, 
  type PresetAnalytics, type InsertPresetAnalytics,
  launchPresets, userPresets, presetAnalytics, PRESET_CATEGORIES,
  BUNDLE_STATUS, TRANSACTION_STATUS
} from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { eq, desc, sql, and, gte, lte, inArray, isNull } from "drizzle-orm";
import { db } from "./db";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Wallet methods (user-scoped)
  getWallet(id: string, accessKeyId: string): Promise<Wallet | undefined>;
  getWallets(accessKeyId: string): Promise<Wallet[]>;
  getWalletsByStatus(status: string, accessKeyId: string): Promise<Wallet[]>;
  getWalletsByHealth(health: string, accessKeyId: string): Promise<Wallet[]>;
  createWallet(wallet: InsertWallet, accessKeyId: string): Promise<Wallet>;
  updateWallet(id: string, updates: Partial<Wallet>, accessKeyId: string): Promise<Wallet | undefined>;
  updateWalletHeartbeat(id: string, accessKeyId: string): Promise<Wallet | undefined>;
  deleteWallet(id: string, accessKeyId: string): Promise<boolean>;
  // Admin methods (for admin access to all wallets)
  getAllWallets(): Promise<Wallet[]>;
  getAllWalletsByStatus(status: string): Promise<Wallet[]>;
  getAllWalletsByHealth(health: string): Promise<Wallet[]>;

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
  
  // Authentication & Access Key methods
  getAccessKey(id: string): Promise<AccessKey | undefined>;
  getAccessKeyByHash(keyHash: string): Promise<AccessKey | undefined>;
  getActiveAccessKeys(): Promise<AccessKey[]>;
  getAccessKeysByRole(role: string): Promise<AccessKey[]>;
  createAccessKey(key: InsertAccessKey): Promise<AccessKey>;
  updateAccessKeyUsage(id: string): Promise<AccessKey | undefined>;
  revokeAccessKey(id: string): Promise<boolean>;
  
  // User Session methods
  getUserSession(id: string): Promise<UserSession | undefined>;
  getUserSessionByToken(sessionToken: string): Promise<UserSession | undefined>;
  getSessionsByAccessKey(accessKeyId: string): Promise<UserSession[]>;
  getActiveSessions(): Promise<UserSession[]>;
  createUserSession(session: InsertUserSession): Promise<UserSession>;
  updateSessionActivity(id: string): Promise<UserSession | undefined>;
  deleteUserSession(id: string): Promise<boolean>;
  deleteSessionsByAccessKey(accessKeyId: string): Promise<boolean>;
  cleanupExpiredSessions(): Promise<number>;
  
  // Audit Log methods
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  getAuditLogsByAccessKey(accessKeyId: string, limit?: number): Promise<AuditLog[]>;
  getAuditLogsByAction(action: string, limit?: number): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // P&L Tracking methods

  // Portfolio Snapshot methods
  getPortfolioSnapshot(id: string): Promise<PortfolioSnapshot | undefined>;
  getPortfolioSnapshots(accessKeyId: string, limit?: number): Promise<PortfolioSnapshot[]>;
  getPortfolioSnapshotsByTimeframe(accessKeyId: string, startDate: Date, endDate: Date): Promise<PortfolioSnapshot[]>;
  getPortfolioSnapshotsByWallet(walletId: string, limit?: number): Promise<PortfolioSnapshot[]>;
  createPortfolioSnapshot(snapshot: InsertPortfolioSnapshot): Promise<PortfolioSnapshot>;
  updatePortfolioSnapshot(id: string, updates: Partial<PortfolioSnapshot>): Promise<PortfolioSnapshot | undefined>;

  // Transaction P&L methods
  getTransactionPnL(id: string): Promise<TransactionPnL | undefined>;
  getTransactionPnLByWallet(walletId: string): Promise<TransactionPnL[]>;
  getTransactionPnLByTimeframe(accessKeyId: string, startDate: Date, endDate: Date): Promise<TransactionPnL[]>;
  getTransactionPnLByWalletAndToken(walletId: string, tokenAddress: string): Promise<TransactionPnL[]>;
  createTransactionPnL(pnl: InsertTransactionPnL): Promise<TransactionPnL>;
  updateTransactionPnL(id: string, updates: Partial<TransactionPnL>): Promise<TransactionPnL | undefined>;

  // Token Position methods
  getTokenPosition(walletId: string, tokenAddress: string): Promise<TokenPosition | undefined>;
  getTokenPositionsByWallet(walletId: string): Promise<TokenPosition[]>;
  getAllTokenPositionsByAccessKey(accessKeyId: string): Promise<TokenPosition[]>;
  getAllTokenPositions(): Promise<TokenPosition[]>;
  createTokenPosition(position: InsertTokenPosition): Promise<TokenPosition>;
  updateTokenPosition(id: string, updates: Partial<TokenPosition>): Promise<TokenPosition | undefined>;

  // Performance Metrics methods
  getPerformanceMetrics(id: string): Promise<PerformanceMetrics | undefined>;
  getPerformanceMetricsByAccessKey(accessKeyId: string, timeframe?: string): Promise<PerformanceMetrics[]>;
  getPerformanceMetricsByWallet(walletId: string, timeframe?: string): Promise<PerformanceMetrics[]>;
  upsertPerformanceMetrics(metrics: InsertPerformanceMetrics): Promise<PerformanceMetrics>;

  // P&L Alert methods
  getPnLAlert(id: string): Promise<PnLAlert | undefined>;
  getPnLAlertsByAccessKey(accessKeyId: string): Promise<PnLAlert[]>;
  getActivePnLAlerts(accessKeyId: string): Promise<PnLAlert[]>;
  createPnLAlert(alert: InsertPnLAlert): Promise<PnLAlert>;
  updatePnLAlert(id: string, updates: Partial<PnLAlert>): Promise<PnLAlert | undefined>;
  deletePnLAlert(id: string): Promise<boolean>;

  // Market Data Cache methods
  getMarketDataCache(tokenAddress: string): Promise<MarketDataCache | undefined>;
  getAllMarketDataCache(): Promise<MarketDataCache[]>;
  upsertMarketDataCache(data: InsertMarketDataCache): Promise<MarketDataCache>;

  // Helper methods for P&L calculations
  getUniqueTokenAddresses(): Promise<string[]>;
  getUniqueAccessKeysWithPositions(): Promise<string[]>;
  getBundleExecutionsByTimeframe(accessKeyId: string, startDate: Date, endDate: Date): Promise<BundleExecution[]>;

  // Wallet Pool Management methods
  getWalletPool(id: string, accessKeyId: string): Promise<WalletPool | undefined>;
  getWalletPools(accessKeyId: string): Promise<WalletPool[]>;
  getWalletPoolsByStrategy(strategy: string, accessKeyId: string): Promise<WalletPool[]>;
  createWalletPool(pool: InsertWalletPool, accessKeyId: string): Promise<WalletPool>;
  updateWalletPool(id: string, updates: Partial<WalletPool>, accessKeyId: string): Promise<WalletPool | undefined>;
  deleteWalletPool(id: string, accessKeyId: string): Promise<boolean>;

  // Wallet Pool Membership methods
  getWalletPoolMembership(poolId: string, walletId: string): Promise<WalletPoolMembership | undefined>;
  getWalletPoolMemberships(poolId: string): Promise<WalletPoolMembership[]>;
  getWalletPoolsByWallet(walletId: string): Promise<WalletPoolMembership[]>;
  addWalletToPool(poolId: string, walletId: string, accessKeyId: string): Promise<WalletPoolMembership>;
  removeWalletFromPool(poolId: string, walletId: string): Promise<boolean>;
  updatePoolMembership(poolId: string, walletId: string, updates: Partial<WalletPoolMembership>): Promise<WalletPoolMembership | undefined>;
  getActiveWalletsInPool(poolId: string): Promise<WalletPoolMembership[]>;

  // Bulk Operations methods
  getBulkOperation(id: string, accessKeyId: string): Promise<BulkOperation | undefined>;
  getBulkOperations(accessKeyId: string, limit?: number): Promise<BulkOperation[]>;
  getBulkOperationsByType(operationType: string, accessKeyId: string): Promise<BulkOperation[]>;
  getBulkOperationsByStatus(status: string, accessKeyId: string): Promise<BulkOperation[]>;
  createBulkOperation(operation: InsertBulkOperation, accessKeyId: string): Promise<BulkOperation>;
  updateBulkOperation(id: string, updates: Partial<BulkOperation>, accessKeyId: string): Promise<BulkOperation | undefined>;
  updateBulkOperationProgress(id: string, progress: number, processedItems: number, successfulItems: number, failedItems: number): Promise<BulkOperation | undefined>;
  completeBulkOperation(id: string, results: any): Promise<BulkOperation | undefined>;
  cancelBulkOperation(id: string): Promise<BulkOperation | undefined>;

  // Bulk Operation Progress methods
  getBulkOperationProgress(bulkOperationId: string): Promise<BulkOperationProgress[]>;
  createBulkOperationProgress(progress: InsertBulkOperationProgress): Promise<BulkOperationProgress>;
  updateBulkOperationProgress(id: string, updates: Partial<BulkOperationProgress>): Promise<BulkOperationProgress | undefined>;

  // Wallet Tags methods
  getWalletTag(walletId: string, tag: string, accessKeyId: string): Promise<WalletTag | undefined>;
  getWalletTags(walletId: string, accessKeyId: string): Promise<WalletTag[]>;
  getWalletsByTag(tag: string, accessKeyId: string): Promise<WalletTag[]>;
  createWalletTag(walletTag: InsertWalletTag, accessKeyId: string): Promise<WalletTag>;
  deleteWalletTag(walletId: string, tag: string, accessKeyId: string): Promise<boolean>;
  updateWalletTag(walletId: string, tag: string, updates: Partial<WalletTag>, accessKeyId: string): Promise<WalletTag | undefined>;
  getTagCategories(accessKeyId: string): Promise<string[]>;

  // Enhanced Wallet methods for bulk operations
  bulkCreateWallets(wallets: InsertWallet[], accessKeyId: string): Promise<Wallet[]>;
  bulkUpdateWallets(updates: { id: string; updates: Partial<Wallet> }[], accessKeyId: string): Promise<Wallet[]>;
  bulkDeleteWallets(walletIds: string[], accessKeyId: string): Promise<number>;
  getWalletsByFilter(filter: { tags?: string[]; status?: string[]; health?: string[]; pools?: string[] }, accessKeyId: string): Promise<Wallet[]>;
  
  // Advanced wallet operations for bulk management
  bulkFundWallets(operations: { walletId: string; amount: string; source: string }[], accessKeyId: string): Promise<{ success: number; failed: number; results: any[] }>;
  rotateWalletsInPool(poolId: string, count: number): Promise<WalletPoolMembership[]>;
  getPoolAnalytics(poolId: string): Promise<{ totalWallets: number; activeWallets: number; totalVolume: string; successRate: number; performance: number }>;

  // Launch Preset methods
  getLaunchPreset(id: string): Promise<LaunchPreset | undefined>;
  getLaunchPresets(): Promise<LaunchPreset[]>;
  getLaunchPresetsByCategory(category: string): Promise<LaunchPreset[]>;
  getDefaultLaunchPresets(): Promise<LaunchPreset[]>;
  getPublicLaunchPresets(): Promise<LaunchPreset[]>;
  createLaunchPreset(preset: InsertLaunchPreset): Promise<LaunchPreset>;
  updateLaunchPreset(id: string, updates: Partial<LaunchPreset>): Promise<LaunchPreset | undefined>;
  deleteLaunchPreset(id: string): Promise<boolean>;
  // Upsert methods for idempotent seeding
  upsertLaunchPreset(preset: InsertLaunchPreset): Promise<{ preset: LaunchPreset; created: boolean }>;
  createLaunchPresetWithFallback(preset: InsertLaunchPreset): Promise<LaunchPreset>;

  // User Preset methods
  getUserPreset(id: string, accessKeyId: string): Promise<UserPreset | undefined>;
  getUserPresets(accessKeyId: string): Promise<UserPreset[]>;
  getUserPresetsByBasePreset(basePresetId: string, accessKeyId: string): Promise<UserPreset[]>;
  createUserPreset(preset: InsertUserPreset, accessKeyId: string): Promise<UserPreset>;
  updateUserPreset(id: string, updates: Partial<UserPreset>, accessKeyId: string): Promise<UserPreset | undefined>;
  updateUserPresetUsage(id: string, accessKeyId: string): Promise<UserPreset | undefined>;
  deleteUserPreset(id: string, accessKeyId: string): Promise<boolean>;

  // Preset Analytics methods
  getPresetAnalytics(presetId: string): Promise<PresetAnalytics[]>;
  getUserPresetAnalytics(userPresetId: string): Promise<PresetAnalytics[]>;
  getPresetAnalyticsByUser(accessKeyId: string): Promise<PresetAnalytics[]>;
  createPresetAnalytics(analytics: InsertPresetAnalytics): Promise<PresetAnalytics>;
  getPresetUsageStats(presetId: string): Promise<{ totalUses: number; averageSuccessRate: number; averageExecutionTime: number }>;

  // Token methods
  getToken(id: string): Promise<Token | undefined>;
  getTokenByAddress(address: string): Promise<Token | undefined>;
  getTokens(): Promise<Token[]>;
  getTokensByDeployer(deployerWalletId: string): Promise<Token[]>;
  createToken(token: InsertToken): Promise<Token>;
  updateToken(id: string, updates: Partial<Token>): Promise<Token | undefined>;
  
  // Liquidity Pool methods
  getLiquidityPool(id: string): Promise<LiquidityPool | undefined>;
  getLiquidityPoolByPair(pairAddress: string): Promise<LiquidityPool | undefined>;
  getLiquidityPoolsByToken(tokenId: string): Promise<LiquidityPool[]>;
  createLiquidityPool(pool: InsertLiquidityPool): Promise<LiquidityPool>;
  updateLiquidityPool(id: string, updates: Partial<LiquidityPool>): Promise<LiquidityPool | undefined>;
  
  // Token Holder methods
  getTokenHolder(tokenId: string, holderAddress: string): Promise<TokenHolder | undefined>;
  getTokenHolders(tokenId: string): Promise<TokenHolder[]>;
  createTokenHolder(holder: InsertTokenHolder): Promise<TokenHolder>;
  updateTokenHolder(id: string, updates: Partial<TokenHolder>): Promise<TokenHolder | undefined>;
  upsertTokenHolder(holder: InsertTokenHolder): Promise<TokenHolder>;
  
  // Token Deployment methods
  getTokenDeployment(id: string): Promise<TokenDeployment | undefined>;
  getTokenDeploymentByTxHash(transactionHash: string): Promise<TokenDeployment | undefined>;
  getTokenDeploymentsByLaunchPlan(launchPlanId: string): Promise<TokenDeployment[]>;
  createTokenDeployment(deployment: InsertTokenDeployment): Promise<TokenDeployment>;
  updateTokenDeployment(id: string, updates: Partial<TokenDeployment>): Promise<TokenDeployment | undefined>;
}

// Database Storage Implementation using Drizzle ORM
export class DatabaseStorage implements IStorage {
  private db;

  constructor() {
    // Use the db connection from server/db.ts
    this.db = db;
    console.log('🗃️ Database connection initialized');
    
    // Initialize the master admin key
    this.initializeAdminKey();
  }

  private async initializeAdminKey() {
    try {
      // Master admin key: WLSFX-mnzWawH4glS0oRP0lg
      const adminKey = 'WLSFX-mnzWawH4glS0oRP0lg';
      const keyHash = await bcrypt.hash(adminKey, 12);
      
      // Check if master admin key already exists
      const existingKey = await this.db
        .select()
        .from(accessKeys)
        .where(eq(accessKeys.name, 'Master Admin Key'))
        .limit(1);

      if (existingKey.length === 0) {
        const masterAdminKey: InsertAccessKey = {
          name: 'Master Admin Key',
          keyHash: keyHash,
          role: 'admin',
          createdAt: new Date(),
          lastUsed: null,
          usageCount: 0,
          revokedAt: null,
          createdBy: null,
          metadata: JSON.stringify({
            keyPreview: 'WLSFX-mnz***********',
            description: 'Master administrative access key',
            autoGenerated: true
          })
        };
        
        await this.db.insert(accessKeys).values(masterAdminKey);
        console.log('🔑 Master admin key initialized successfully');
      } else {
        console.log('🔑 Master admin key already exists');
      }
    } catch (error) {
      console.error('❌ Error initializing master admin key:', error);
    }
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

  // Wallet methods (user-scoped)
  async getWallet(id: string, accessKeyId: string): Promise<Wallet | undefined> {
    try {
      const result = await this.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, id), eq(wallets.accessKeyId, accessKeyId)))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting wallet:", error);
      throw new Error(`Failed to retrieve wallet: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getWallets(accessKeyId: string): Promise<Wallet[]> {
    try {
      const result = await this.db
        .select()
        .from(wallets)
        .where(eq(wallets.accessKeyId, accessKeyId))
        .orderBy(desc(wallets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting wallets:", error);
      throw new Error(`Failed to retrieve wallets: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getWalletsByStatus(status: string, accessKeyId: string): Promise<Wallet[]> {
    try {
      const result = await this.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.status, status), eq(wallets.accessKeyId, accessKeyId)))
        .orderBy(desc(wallets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting wallets by status:", error);
      throw new Error(`Failed to retrieve wallets by status: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createWallet(insertWallet: InsertWallet, accessKeyId: string): Promise<Wallet> {
    try {
      const walletWithUser = { ...insertWallet, accessKeyId };
      const result = await this.db
        .insert(wallets)
        .values(walletWithUser)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating wallet:", error);
      throw error;
    }
  }

  async updateWallet(id: string, updates: Partial<Wallet>, accessKeyId: string): Promise<Wallet | undefined> {
    try {
      const result = await this.db
        .update(wallets)
        .set(updates)
        .where(and(eq(wallets.id, id), eq(wallets.accessKeyId, accessKeyId)))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating wallet:", error);
      throw new Error(`Failed to update wallet: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async deleteWallet(id: string, accessKeyId: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(wallets)
        .where(and(eq(wallets.id, id), eq(wallets.accessKeyId, accessKeyId)))
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
  async getWalletsByHealth(health: string, accessKeyId: string): Promise<Wallet[]> {
    try {
      const result = await this.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.health, health), eq(wallets.accessKeyId, accessKeyId)))
        .orderBy(desc(wallets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting wallets by health:", error);
      throw new Error(`Failed to retrieve wallets by health: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async updateWalletHeartbeat(id: string, accessKeyId: string): Promise<Wallet | undefined> {
    try {
      const result = await this.db
        .update(wallets)
        .set({ 
          lastHeartbeat: new Date(),
          connectionStatus: 'connected'
        })
        .where(and(eq(wallets.id, id), eq(wallets.accessKeyId, accessKeyId)))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating wallet heartbeat:", error);
      throw new Error(`Failed to update wallet heartbeat: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Admin methods (for admin access to all wallets)
  async getAllWallets(): Promise<Wallet[]> {
    try {
      const result = await this.db
        .select()
        .from(wallets)
        .orderBy(desc(wallets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting all wallets:", error);
      throw new Error(`Failed to retrieve all wallets: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getAllWalletsByStatus(status: string): Promise<Wallet[]> {
    try {
      const result = await this.db
        .select()
        .from(wallets)
        .where(eq(wallets.status, status))
        .orderBy(desc(wallets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting all wallets by status:", error);
      throw new Error(`Failed to retrieve all wallets by status: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getAllWalletsByHealth(health: string): Promise<Wallet[]> {
    try {
      const result = await this.db
        .select()
        .from(wallets)
        .where(eq(wallets.health, health))
        .orderBy(desc(wallets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting all wallets by health:", error);
      throw new Error(`Failed to retrieve all wallets by health: ${error instanceof Error ? error.message : 'Unknown database error'}`);
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
      // Deactivate all environments first
      await this.db
        .update(environmentConfig)
        .set({ 
          isActive: false,
          updatedAt: new Date()
        });

      // Activate the specified environment
      const result = await this.db
        .update(environmentConfig)
        .set({ 
          isActive: true,
          updatedAt: new Date()
        })
        .where(eq(environmentConfig.environment, environment))
        .returning();

      return result[0];
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
        walletId: walletId || null
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
        .orderBy(desc(networkHealthMetrics.measuredAt))
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
        .orderBy(desc(networkHealthMetrics.measuredAt))
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
          totalRequests: 0,
          failedRequests: 0,
          avgResponseTime: '0',
          successRate: '100',
          status: 'healthy'
        };
        return await this.createNetworkHealthMetrics(newMetric);
      }
      
      // Update existing metric
      const result = await this.db
        .update(networkHealthMetrics)
        .set({
          circuitBreakerStatus: status
        })
        .where(eq(networkHealthMetrics.id, latest.id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating circuit breaker:", error);
      throw new Error(`Failed to update circuit breaker: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Authentication & Access Key methods
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
  }

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
  }

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
  }

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
  }

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
  }

  async updateAccessKeyUsage(id: string): Promise<AccessKey | undefined> {
    try {
      const result = await this.db
        .update(accessKeys)
        .set({
          lastUsed: new Date(),
          usageCount: sql`${accessKeys.usageCount} + 1`
        })
        .where(eq(accessKeys.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating access key usage:", error);
      throw new Error(`Failed to update access key usage: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const now = new Date();
      const result = await this.db
        .delete(userSessions)
        .where(lte(userSessions.expiresAt, now))
        .returning();
      return result.length;
    } catch (error) {
      console.error("Error cleaning up expired sessions:", error);
      throw new Error(`Failed to cleanup expired sessions: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

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
  }

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
  }

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
  }

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

  // P&L Tracking Methods Implementation

  // Portfolio Snapshot methods
  async getPortfolioSnapshot(id: string): Promise<PortfolioSnapshot | undefined> {
    try {
      const result = await this.db
        .select()
        .from(portfolioSnapshots)
        .where(eq(portfolioSnapshots.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting portfolio snapshot:", error);
      throw new Error(`Failed to retrieve portfolio snapshot: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getPortfolioSnapshots(accessKeyId: string, limit: number = 50): Promise<PortfolioSnapshot[]> {
    try {
      const result = await this.db
        .select()
        .from(portfolioSnapshots)
        .where(eq(portfolioSnapshots.accessKeyId, accessKeyId))
        .orderBy(desc(portfolioSnapshots.createdAt))
        .limit(limit);
      return result;
    } catch (error) {
      console.error("Error getting portfolio snapshots:", error);
      throw new Error(`Failed to retrieve portfolio snapshots: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getPortfolioSnapshotsByTimeframe(accessKeyId: string, startDate: Date, endDate: Date): Promise<PortfolioSnapshot[]> {
    try {
      const result = await this.db
        .select()
        .from(portfolioSnapshots)
        .where(and(
          eq(portfolioSnapshots.accessKeyId, accessKeyId),
          gte(portfolioSnapshots.createdAt, startDate),
          lte(portfolioSnapshots.createdAt, endDate)
        ))
        .orderBy(portfolioSnapshots.createdAt);
      return result;
    } catch (error) {
      console.error("Error getting portfolio snapshots by timeframe:", error);
      throw new Error(`Failed to retrieve portfolio snapshots by timeframe: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getPortfolioSnapshotsByWallet(walletId: string, limit: number = 50): Promise<PortfolioSnapshot[]> {
    try {
      const result = await this.db
        .select()
        .from(portfolioSnapshots)
        .where(eq(portfolioSnapshots.walletId, walletId))
        .orderBy(desc(portfolioSnapshots.createdAt))
        .limit(limit);
      return result;
    } catch (error) {
      console.error("Error getting portfolio snapshots by wallet:", error);
      throw new Error(`Failed to retrieve portfolio snapshots by wallet: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createPortfolioSnapshot(insertSnapshot: InsertPortfolioSnapshot): Promise<PortfolioSnapshot> {
    try {
      const result = await this.db
        .insert(portfolioSnapshots)
        .values(insertSnapshot)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating portfolio snapshot:", error);
      throw error;
    }
  }

  async updatePortfolioSnapshot(id: string, updates: Partial<PortfolioSnapshot>): Promise<PortfolioSnapshot | undefined> {
    try {
      const result = await this.db
        .update(portfolioSnapshots)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(portfolioSnapshots.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating portfolio snapshot:", error);
      throw new Error(`Failed to update portfolio snapshot: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Transaction P&L methods
  async getTransactionPnL(id: string): Promise<TransactionPnL | undefined> {
    try {
      const result = await this.db
        .select()
        .from(transactionPnL)
        .where(eq(transactionPnL.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting transaction P&L:", error);
      throw new Error(`Failed to retrieve transaction P&L: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getTransactionPnLByWallet(walletId: string): Promise<TransactionPnL[]> {
    try {
      const result = await this.db
        .select()
        .from(transactionPnL)
        .where(eq(transactionPnL.walletId, walletId))
        .orderBy(desc(transactionPnL.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting transaction P&L by wallet:", error);
      throw new Error(`Failed to retrieve transaction P&L by wallet: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getTransactionPnLByTimeframe(accessKeyId: string, startDate: Date, endDate: Date): Promise<TransactionPnL[]> {
    try {
      // Get wallets for this access key first
      const wallets = await this.getWallets(accessKeyId);
      const walletIds = wallets.map(w => w.id);
      
      if (walletIds.length === 0) {
        return [];
      }

      const result = await this.db
        .select()
        .from(transactionPnL)
        .where(and(
          inArray(transactionPnL.walletId, walletIds),
          gte(transactionPnL.createdAt, startDate),
          lte(transactionPnL.createdAt, endDate)
        ))
        .orderBy(transactionPnL.createdAt);
      return result;
    } catch (error) {
      console.error("Error getting transaction P&L by timeframe:", error);
      throw new Error(`Failed to retrieve transaction P&L by timeframe: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getTransactionPnLByWalletAndToken(walletId: string, tokenAddress: string): Promise<TransactionPnL[]> {
    try {
      const result = await this.db
        .select()
        .from(transactionPnL)
        .where(and(
          eq(transactionPnL.walletId, walletId),
          eq(transactionPnL.tokenAddress, tokenAddress.toLowerCase())
        ))
        .orderBy(desc(transactionPnL.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting transaction P&L by wallet and token:", error);
      throw new Error(`Failed to retrieve transaction P&L by wallet and token: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createTransactionPnL(insertPnL: InsertTransactionPnL): Promise<TransactionPnL> {
    try {
      const result = await this.db
        .insert(transactionPnL)
        .values(insertPnL)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating transaction P&L:", error);
      throw error;
    }
  }

  async updateTransactionPnL(id: string, updates: Partial<TransactionPnL>): Promise<TransactionPnL | undefined> {
    try {
      const result = await this.db
        .update(transactionPnL)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(transactionPnL.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating transaction P&L:", error);
      throw new Error(`Failed to update transaction P&L: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Token Position methods
  async getTokenPosition(walletId: string, tokenAddress: string): Promise<TokenPosition | undefined> {
    try {
      const result = await this.db
        .select()
        .from(tokenPositions)
        .where(and(
          eq(tokenPositions.walletId, walletId),
          eq(tokenPositions.tokenAddress, tokenAddress.toLowerCase())
        ))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting token position:", error);
      throw new Error(`Failed to retrieve token position: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getTokenPositionsByWallet(walletId: string): Promise<TokenPosition[]> {
    try {
      const result = await this.db
        .select()
        .from(tokenPositions)
        .where(eq(tokenPositions.walletId, walletId))
        .orderBy(desc(tokenPositions.currentValue));
      return result;
    } catch (error) {
      console.error("Error getting token positions by wallet:", error);
      throw new Error(`Failed to retrieve token positions by wallet: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getAllTokenPositionsByAccessKey(accessKeyId: string): Promise<TokenPosition[]> {
    try {
      // Get wallets for this access key first
      const wallets = await this.getWallets(accessKeyId);
      const walletIds = wallets.map(w => w.id);
      
      if (walletIds.length === 0) {
        return [];
      }

      const result = await this.db
        .select()
        .from(tokenPositions)
        .where(inArray(tokenPositions.walletId, walletIds))
        .orderBy(desc(tokenPositions.currentValue));
      return result;
    } catch (error) {
      console.error("Error getting all token positions by access key:", error);
      throw new Error(`Failed to retrieve all token positions by access key: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getAllTokenPositions(): Promise<TokenPosition[]> {
    try {
      const result = await this.db
        .select()
        .from(tokenPositions)
        .orderBy(desc(tokenPositions.currentValue));
      return result;
    } catch (error) {
      console.error("Error getting all token positions:", error);
      throw new Error(`Failed to retrieve all token positions: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createTokenPosition(insertPosition: InsertTokenPosition): Promise<TokenPosition> {
    try {
      const result = await this.db
        .insert(tokenPositions)
        .values({
          ...insertPosition,
          tokenAddress: insertPosition.tokenAddress.toLowerCase()
        })
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating token position:", error);
      throw error;
    }
  }

  async updateTokenPosition(id: string, updates: Partial<TokenPosition>): Promise<TokenPosition | undefined> {
    try {
      const result = await this.db
        .update(tokenPositions)
        .set({
          ...updates,
          tokenAddress: updates.tokenAddress ? updates.tokenAddress.toLowerCase() : undefined,
          updatedAt: new Date()
        })
        .where(eq(tokenPositions.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating token position:", error);
      throw new Error(`Failed to update token position: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Performance Metrics methods
  async getPerformanceMetrics(id: string): Promise<PerformanceMetrics | undefined> {
    try {
      const result = await this.db
        .select()
        .from(performanceMetrics)
        .where(eq(performanceMetrics.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting performance metrics:", error);
      throw new Error(`Failed to retrieve performance metrics: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getPerformanceMetricsByAccessKey(accessKeyId: string, timeframe?: string): Promise<PerformanceMetrics[]> {
    try {
      let query = this.db
        .select()
        .from(performanceMetrics)
        .where(eq(performanceMetrics.accessKeyId, accessKeyId));
      
      if (timeframe) {
        query = query.where(eq(performanceMetrics.timeframe, timeframe));
      }
      
      const result = await query.orderBy(desc(performanceMetrics.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting performance metrics by access key:", error);
      throw new Error(`Failed to retrieve performance metrics by access key: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getPerformanceMetricsByWallet(walletId: string, timeframe?: string): Promise<PerformanceMetrics[]> {
    try {
      let query = this.db
        .select()
        .from(performanceMetrics)
        .where(eq(performanceMetrics.walletId, walletId));
      
      if (timeframe) {
        query = query.where(eq(performanceMetrics.timeframe, timeframe));
      }
      
      const result = await query.orderBy(desc(performanceMetrics.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting performance metrics by wallet:", error);
      throw new Error(`Failed to retrieve performance metrics by wallet: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async upsertPerformanceMetrics(insertMetrics: InsertPerformanceMetrics): Promise<PerformanceMetrics> {
    try {
      // Try to find existing metrics
      const conditions = [
        eq(performanceMetrics.accessKeyId, insertMetrics.accessKeyId),
        eq(performanceMetrics.timeframe, insertMetrics.timeframe)
      ];
      
      if (insertMetrics.walletId) {
        conditions.push(eq(performanceMetrics.walletId, insertMetrics.walletId));
      } else {
        conditions.push(isNull(performanceMetrics.walletId));
      }

      const existing = await this.db
        .select()
        .from(performanceMetrics)
        .where(and(...conditions))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        const result = await this.db
          .update(performanceMetrics)
          .set({
            ...insertMetrics,
            updatedAt: new Date()
          })
          .where(eq(performanceMetrics.id, existing[0].id))
          .returning();
        return result[0];
      } else {
        // Create new
        const result = await this.db
          .insert(performanceMetrics)
          .values(insertMetrics)
          .returning();
        return result[0];
      }
    } catch (error) {
      console.error("Error upserting performance metrics:", error);
      throw error;
    }
  }

  // P&L Alert methods
  async getPnLAlert(id: string): Promise<PnLAlert | undefined> {
    try {
      const result = await this.db
        .select()
        .from(pnlAlerts)
        .where(eq(pnlAlerts.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting P&L alert:", error);
      throw new Error(`Failed to retrieve P&L alert: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getPnLAlertsByAccessKey(accessKeyId: string): Promise<PnLAlert[]> {
    try {
      const result = await this.db
        .select()
        .from(pnlAlerts)
        .where(eq(pnlAlerts.accessKeyId, accessKeyId))
        .orderBy(desc(pnlAlerts.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting P&L alerts by access key:", error);
      throw new Error(`Failed to retrieve P&L alerts by access key: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getActivePnLAlerts(accessKeyId: string): Promise<PnLAlert[]> {
    try {
      const result = await this.db
        .select()
        .from(pnlAlerts)
        .where(and(
          eq(pnlAlerts.accessKeyId, accessKeyId),
          eq(pnlAlerts.isActive, true)
        ))
        .orderBy(desc(pnlAlerts.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting active P&L alerts:", error);
      throw new Error(`Failed to retrieve active P&L alerts: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createPnLAlert(insertAlert: InsertPnLAlert): Promise<PnLAlert> {
    try {
      const result = await this.db
        .insert(pnlAlerts)
        .values(insertAlert)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating P&L alert:", error);
      throw error;
    }
  }

  async updatePnLAlert(id: string, updates: Partial<PnLAlert>): Promise<PnLAlert | undefined> {
    try {
      const result = await this.db
        .update(pnlAlerts)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(pnlAlerts.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating P&L alert:", error);
      throw new Error(`Failed to update P&L alert: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async deletePnLAlert(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(pnlAlerts)
        .where(eq(pnlAlerts.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting P&L alert:", error);
      throw new Error(`Failed to delete P&L alert: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Market Data Cache methods
  async getMarketDataCache(tokenAddress: string): Promise<MarketDataCache | undefined> {
    try {
      const result = await this.db
        .select()
        .from(marketDataCache)
        .where(eq(marketDataCache.tokenAddress, tokenAddress.toLowerCase()))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting market data cache:", error);
      throw new Error(`Failed to retrieve market data cache: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getAllMarketDataCache(): Promise<MarketDataCache[]> {
    try {
      const result = await this.db
        .select()
        .from(marketDataCache)
        .orderBy(desc(marketDataCache.lastUpdated));
      return result;
    } catch (error) {
      console.error("Error getting all market data cache:", error);
      throw new Error(`Failed to retrieve all market data cache: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async upsertMarketDataCache(insertData: InsertMarketDataCache): Promise<MarketDataCache> {
    try {
      const tokenAddress = insertData.tokenAddress.toLowerCase();
      
      // Try to find existing cache entry
      const existing = await this.db
        .select()
        .from(marketDataCache)
        .where(eq(marketDataCache.tokenAddress, tokenAddress))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        const result = await this.db
          .update(marketDataCache)
          .set({
            ...insertData,
            tokenAddress,
            lastUpdated: new Date()
          })
          .where(eq(marketDataCache.tokenAddress, tokenAddress))
          .returning();
        return result[0];
      } else {
        // Create new
        const result = await this.db
          .insert(marketDataCache)
          .values({
            ...insertData,
            tokenAddress
          })
          .returning();
        return result[0];
      }
    } catch (error) {
      console.error("Error upserting market data cache:", error);
      throw error;
    }
  }

  // Helper methods for P&L calculations
  async getUniqueTokenAddresses(): Promise<string[]> {
    try {
      const result = await this.db
        .selectDistinct({ tokenAddress: tokenPositions.tokenAddress })
        .from(tokenPositions);
      return result.map(r => r.tokenAddress);
    } catch (error) {
      console.error("Error getting unique token addresses:", error);
      throw new Error(`Failed to retrieve unique token addresses: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getUniqueAccessKeysWithPositions(): Promise<string[]> {
    try {
      // Get wallets that have token positions, then get their access keys
      const result = await this.db
        .selectDistinct({ 
          accessKeyId: wallets.accessKeyId 
        })
        .from(wallets)
        .innerJoin(tokenPositions, eq(wallets.id, tokenPositions.walletId));
      return result.map(r => r.accessKeyId);
    } catch (error) {
      console.error("Error getting unique access keys with positions:", error);
      throw new Error(`Failed to retrieve unique access keys with positions: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getBundleExecutionsByTimeframe(accessKeyId: string, startDate: Date, endDate: Date): Promise<BundleExecution[]> {
    try {
      const result = await this.db
        .select()
        .from(bundleExecutions)
        .where(and(
          eq(bundleExecutions.accessKeyId, accessKeyId),
          gte(bundleExecutions.createdAt, startDate),
          lte(bundleExecutions.createdAt, endDate)
        ))
        .orderBy(bundleExecutions.createdAt);
      return result;
    } catch (error) {
      console.error("Error getting bundle executions by timeframe:", error);
      throw new Error(`Failed to retrieve bundle executions by timeframe: ${error instanceof Error ? error.message : 'Unknown database error'}`);
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
  private accessKeys: Map<string, AccessKey>;
  private userSessions: Map<string, UserSession>;
  private auditLogs: AuditLog[];
  private environmentConfigs: Map<string, EnvironmentConfig>;
  private activeEnvironment: string | null;

  constructor() {
    this.users = new Map();
    this.wallets = new Map();
    this.launchPlans = new Map();
    this.bundleExecutions = new Map();
    this.activities = [];
    this.systemMetrics = [];
    this.accessKeys = new Map();
    this.userSessions = new Map();
    this.auditLogs = [];
    this.environmentConfigs = new Map();
    this.activeEnvironment = null;
    
    // Initialize with a default environment to prevent 404s
    const defaultEnv: EnvironmentConfig = {
      id: randomUUID(),
      environment: 'development',
      chainId: 56,
      rpcUrl: 'https://bsc-dataseed.binance.org/',
      blockExplorer: 'https://bscscan.com',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      config: JSON.stringify({ name: 'BSC Mainnet' })
    };
    this.environmentConfigs.set('development', defaultEnv);
    this.activeEnvironment = 'development';
    
    // Initialize the master admin key
    this.initializeAdminKey();
  }

  private initializeAdminKey() {
    // Master admin key: WLSFX-mnzWawH4glS0oRP0lg
    const adminKey = 'WLSFX-mnzWawH4glS0oRP0lg';
    const keyHash = bcrypt.hashSync(adminKey, 12);
    
    const adminKeyId = randomUUID();
    const masterAdminKey: AccessKey = {
      id: adminKeyId,
      name: 'Master Admin Key',
      keyHash: keyHash,
      role: 'admin',
      createdAt: new Date(),
      lastUsed: null,
      usageCount: 0,
      revokedAt: null,
      createdBy: null,
      metadata: JSON.stringify({
        keyPreview: 'WLSFX-mnz***********',
        description: 'Master administrative access key',
        autoGenerated: true
      })
    };
    
    this.accessKeys.set(adminKeyId, masterAdminKey);
    console.log('🔑 Master admin key initialized successfully');
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
    return this.environmentConfigs.get(environment);
  }

  async getEnvironmentConfigs(): Promise<EnvironmentConfig[]> {
    return Array.from(this.environmentConfigs.values());
  }

  async getActiveEnvironment(): Promise<EnvironmentConfig | undefined> {
    if (!this.activeEnvironment) return undefined;
    return this.environmentConfigs.get(this.activeEnvironment);
  }

  async createEnvironmentConfig(config: InsertEnvironmentConfig): Promise<EnvironmentConfig> {
    const id = randomUUID();
    const envConfig: EnvironmentConfig = {
      ...config,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.environmentConfigs.set(config.environment, envConfig);
    return envConfig;
  }

  async updateEnvironmentConfig(environment: string, updates: Partial<EnvironmentConfig>): Promise<EnvironmentConfig | undefined> {
    const config = this.environmentConfigs.get(environment);
    if (!config) return undefined;
    
    const updatedConfig = { ...config, ...updates, updatedAt: new Date() };
    this.environmentConfigs.set(environment, updatedConfig);
    return updatedConfig;
  }

  async switchActiveEnvironment(environment: string): Promise<EnvironmentConfig | undefined> {
    const config = this.environmentConfigs.get(environment);
    if (!config) return undefined;
    
    // Set all environments to inactive
    for (const [key, env] of this.environmentConfigs.entries()) {
      env.isActive = key === environment;
      this.environmentConfigs.set(key, env);
    }
    
    this.activeEnvironment = environment;
    return config;
  }

  // Authentication & Access Key methods
  async getAccessKey(id: string): Promise<AccessKey | undefined> {
    return this.accessKeys.get(id);
  }

  async getAccessKeyByHash(keyHash: string): Promise<AccessKey | undefined> {
    return Array.from(this.accessKeys.values()).find(key => key.keyHash === keyHash);
  }

  async getActiveAccessKeys(): Promise<AccessKey[]> {
    return Array.from(this.accessKeys.values()).filter(key => !key.revokedAt);
  }

  async getAccessKeysByRole(role: string): Promise<AccessKey[]> {
    return Array.from(this.accessKeys.values()).filter(key => key.role === role && !key.revokedAt);
  }

  async createAccessKey(insertKey: InsertAccessKey): Promise<AccessKey> {
    const id = randomUUID();
    const accessKey: AccessKey = {
      ...insertKey,
      id,
      createdAt: new Date(),
      lastUsed: null,
      usageCount: 0,
      revokedAt: null,
      createdBy: null
    };
    this.accessKeys.set(id, accessKey);
    return accessKey;
  }

  async updateAccessKeyUsage(id: string): Promise<AccessKey | undefined> {
    const accessKey = this.accessKeys.get(id);
    if (!accessKey) return undefined;
    
    const updatedKey = {
      ...accessKey,
      usageCount: accessKey.usageCount + 1,
      lastUsed: new Date()
    };
    this.accessKeys.set(id, updatedKey);
    return updatedKey;
  }

  async revokeAccessKey(id: string): Promise<boolean> {
    const accessKey = this.accessKeys.get(id);
    if (!accessKey) return false;
    
    const revokedKey = {
      ...accessKey,
      revokedAt: new Date()
    };
    this.accessKeys.set(id, revokedKey);
    return true;
  }

  // User Session methods
  async getUserSession(id: string): Promise<UserSession | undefined> {
    return this.userSessions.get(id);
  }

  async getUserSessionByToken(sessionToken: string): Promise<UserSession | undefined> {
    return Array.from(this.userSessions.values()).find(session => session.sessionToken === sessionToken);
  }

  async getSessionsByAccessKey(accessKeyId: string): Promise<UserSession[]> {
    return Array.from(this.userSessions.values()).filter(session => session.accessKeyId === accessKeyId);
  }

  async getActiveSessions(): Promise<UserSession[]> {
    const now = new Date();
    return Array.from(this.userSessions.values()).filter(session => 
      session.expiresAt > now && !session.revokedAt
    );
  }

  async createUserSession(insertSession: InsertUserSession): Promise<UserSession> {
    const id = randomUUID();
    const session: UserSession = {
      ...insertSession,
      id,
      createdAt: new Date(),
      lastActivity: new Date(),
      revokedAt: null
    };
    this.userSessions.set(id, session);
    return session;
  }

  async updateSessionActivity(id: string): Promise<UserSession | undefined> {
    const session = this.userSessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = {
      ...session,
      lastActivity: new Date()
    };
    this.userSessions.set(id, updatedSession);
    return updatedSession;
  }

  async deleteUserSession(id: string): Promise<boolean> {
    return this.userSessions.delete(id);
  }

  async deleteSessionsByAccessKey(accessKeyId: string): Promise<boolean> {
    const sessions = Array.from(this.userSessions.entries());
    let deleted = false;
    for (const [id, session] of sessions) {
      if (session.accessKeyId === accessKeyId) {
        this.userSessions.delete(id);
        deleted = true;
      }
    }
    return deleted;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const sessions = Array.from(this.userSessions.entries());
    let cleanedCount = 0;
    
    for (const [id, session] of sessions) {
      if (session.expiresAt <= now) {
        this.userSessions.delete(id);
        cleanedCount++;
      }
    }
    return cleanedCount;
  }

  // Audit Log methods
  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    return this.auditLogs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async getAuditLogsByAccessKey(accessKeyId: string, limit: number = 50): Promise<AuditLog[]> {
    return this.auditLogs
      .filter(log => log.accessKeyId === accessKeyId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async getAuditLogsByAction(action: string, limit: number = 50): Promise<AuditLog[]> {
    return this.auditLogs
      .filter(log => log.action === action)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const auditLog: AuditLog = {
      ...insertLog,
      id,
      createdAt: new Date()
    };
    this.auditLogs.push(auditLog);
    return auditLog;
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
  // Wallet Pool Management methods
  async getWalletPool(id: string, accessKeyId: string): Promise<WalletPool | undefined> {
    try {
      const result = await this.db
        .select()
        .from(walletPools)
        .where(and(eq(walletPools.id, id), eq(walletPools.accessKeyId, accessKeyId)))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting wallet pool:", error);
      throw new Error(`Failed to retrieve wallet pool: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getWalletPools(accessKeyId: string): Promise<WalletPool[]> {
    try {
      const result = await this.db
        .select()
        .from(walletPools)
        .where(eq(walletPools.accessKeyId, accessKeyId))
        .orderBy(desc(walletPools.updatedAt));
      return result;
    } catch (error) {
      console.error("Error getting wallet pools:", error);
      throw new Error(`Failed to retrieve wallet pools: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createWalletPool(insertPool: InsertWalletPool, accessKeyId: string): Promise<WalletPool> {
    try {
      const poolWithUser = { ...insertPool, accessKeyId };
      const result = await this.db
        .insert(walletPools)
        .values(poolWithUser)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating wallet pool:", error);
      throw error;
    }
  }

  async updateWalletPool(id: string, updates: Partial<WalletPool>, accessKeyId: string): Promise<WalletPool | undefined> {
    try {
      const result = await this.db
        .update(walletPools)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(walletPools.id, id), eq(walletPools.accessKeyId, accessKeyId)))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating wallet pool:", error);
      throw new Error(`Failed to update wallet pool: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async deleteWalletPool(id: string, accessKeyId: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(walletPools)
        .where(and(eq(walletPools.id, id), eq(walletPools.accessKeyId, accessKeyId)))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting wallet pool:", error);
      throw new Error(`Failed to delete wallet pool: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Bulk Operations methods
  async createBulkOperation(insertOperation: InsertBulkOperation, accessKeyId: string): Promise<BulkOperation> {
    try {
      const operationWithUser = { ...insertOperation, accessKeyId };
      const result = await this.db
        .insert(bulkOperations)
        .values(operationWithUser)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating bulk operation:", error);
      throw error;
    }
  }

  async getBulkOperations(accessKeyId: string, limit: number = 50): Promise<BulkOperation[]> {
    try {
      const result = await this.db
        .select()
        .from(bulkOperations)
        .where(eq(bulkOperations.accessKeyId, accessKeyId))
        .orderBy(desc(bulkOperations.createdAt))
        .limit(limit);
      return result;
    } catch (error) {
      console.error("Error getting bulk operations:", error);
      throw new Error(`Failed to retrieve bulk operations: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async updateBulkOperationProgress(id: string, progress: number, processedItems: number, successfulItems: number, failedItems: number): Promise<BulkOperation | undefined> {
    try {
      const result = await this.db
        .update(bulkOperations)
        .set({
          progressPercentage: progress.toString(),
          processedItems,
          successfulItems,
          failedItems,
          status: progress >= 100 ? 'completed' : 'in_progress'
        })
        .where(eq(bulkOperations.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating bulk operation progress:", error);
      throw new Error(`Failed to update bulk operation progress: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Enhanced Wallet methods for bulk operations
  async bulkCreateWallets(wallets: InsertWallet[], accessKeyId: string): Promise<Wallet[]> {
    try {
      const walletsWithUser = wallets.map(wallet => ({ ...wallet, accessKeyId }));
      const result = await this.db
        .insert(wallets)
        .values(walletsWithUser)
        .returning();
      return result;
    } catch (error) {
      console.error("Error bulk creating wallets:", error);
      throw error;
    }
  }

  async getWalletsByFilter(filter: { tags?: string[]; status?: string[]; health?: string[]; pools?: string[] }, accessKeyId: string): Promise<Wallet[]> {
    try {
      let query = this.db
        .select()
        .from(wallets)
        .where(eq(wallets.accessKeyId, accessKeyId));

      if (filter.status && filter.status.length > 0) {
        query = query.where(inArray(wallets.status, filter.status));
      }

      if (filter.health && filter.health.length > 0) {
        query = query.where(inArray(wallets.health, filter.health));
      }

      const result = await query.orderBy(desc(wallets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting wallets by filter:", error);
      throw new Error(`Failed to retrieve wallets by filter: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Wallet Tags methods
  async getWalletTags(walletId: string, accessKeyId: string): Promise<WalletTag[]> {
    try {
      const result = await this.db
        .select()
        .from(walletTags)
        .where(and(eq(walletTags.walletId, walletId), eq(walletTags.accessKeyId, accessKeyId)))
        .orderBy(desc(walletTags.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting wallet tags:", error);
      throw new Error(`Failed to retrieve wallet tags: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createWalletTag(insertTag: InsertWalletTag, accessKeyId: string): Promise<WalletTag> {
    try {
      const tagWithUser = { ...insertTag, accessKeyId };
      const result = await this.db
        .insert(walletTags)
        .values(tagWithUser)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating wallet tag:", error);
      throw error;
    }
  }

  // Stub implementations for other methods (to be implemented as needed)
  async getWalletPoolsByStrategy(strategy: string, accessKeyId: string): Promise<WalletPool[]> { return []; }
  async getWalletPoolMembership(poolId: string, walletId: string): Promise<WalletPoolMembership | undefined> { return undefined; }
  async getWalletPoolMemberships(poolId: string): Promise<WalletPoolMembership[]> { return []; }
  async getWalletPoolsByWallet(walletId: string): Promise<WalletPoolMembership[]> { return []; }
  async addWalletToPool(poolId: string, walletId: string, accessKeyId: string): Promise<WalletPoolMembership> { throw new Error('Not implemented'); }
  async removeWalletFromPool(poolId: string, walletId: string): Promise<boolean> { return false; }
  async updatePoolMembership(poolId: string, walletId: string, updates: Partial<WalletPoolMembership>): Promise<WalletPoolMembership | undefined> { return undefined; }
  async getActiveWalletsInPool(poolId: string): Promise<WalletPoolMembership[]> { return []; }
  async getBulkOperation(id: string, accessKeyId: string): Promise<BulkOperation | undefined> { return undefined; }
  async getBulkOperationsByType(operationType: string, accessKeyId: string): Promise<BulkOperation[]> { return []; }
  async getBulkOperationsByStatus(status: string, accessKeyId: string): Promise<BulkOperation[]> { return []; }
  async updateBulkOperation(id: string, updates: Partial<BulkOperation>, accessKeyId: string): Promise<BulkOperation | undefined> { return undefined; }
  async completeBulkOperation(id: string, results: any): Promise<BulkOperation | undefined> { return undefined; }
  async cancelBulkOperation(id: string): Promise<BulkOperation | undefined> { return undefined; }
  async getBulkOperationProgress(bulkOperationId: string): Promise<BulkOperationProgress[]> { return []; }
  async createBulkOperationProgress(progress: InsertBulkOperationProgress): Promise<BulkOperationProgress> { throw new Error('Not implemented'); }
  async updateBulkOperationProgress(id: string, updates: Partial<BulkOperationProgress>): Promise<BulkOperationProgress | undefined> { return undefined; }
  async getWalletTag(walletId: string, tag: string, accessKeyId: string): Promise<WalletTag | undefined> { return undefined; }
  async getWalletsByTag(tag: string, accessKeyId: string): Promise<WalletTag[]> { return []; }
  async deleteWalletTag(walletId: string, tag: string, accessKeyId: string): Promise<boolean> { return false; }
  async updateWalletTag(walletId: string, tag: string, updates: Partial<WalletTag>, accessKeyId: string): Promise<WalletTag | undefined> { return undefined; }
  async getTagCategories(accessKeyId: string): Promise<string[]> { return []; }
  async bulkUpdateWallets(updates: { id: string; updates: Partial<Wallet> }[], accessKeyId: string): Promise<Wallet[]> { return []; }
  async bulkDeleteWallets(walletIds: string[], accessKeyId: string): Promise<number> { return 0; }
  async bulkFundWallets(operations: { walletId: string; amount: string; source: string }[], accessKeyId: string): Promise<{ success: number; failed: number; results: any[] }> { return { success: 0, failed: 0, results: [] }; }
  async rotateWalletsInPool(poolId: string, count: number): Promise<WalletPoolMembership[]> { return []; }
  async getPoolAnalytics(poolId: string): Promise<{ totalWallets: number; activeWallets: number; totalVolume: string; successRate: number; performance: number }> { return { totalWallets: 0, activeWallets: 0, totalVolume: '0', successRate: 0, performance: 0 }; }

  // Launch Preset methods implementation
  async getLaunchPreset(id: string): Promise<LaunchPreset | undefined> {
    try {
      const result = await this.db
        .select()
        .from(launchPresets)
        .where(eq(launchPresets.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting launch preset:", error);
      throw new Error(`Failed to retrieve launch preset: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getLaunchPresets(): Promise<LaunchPreset[]> {
    try {
      const result = await this.db
        .select()
        .from(launchPresets)
        .orderBy(desc(launchPresets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting launch presets:", error);
      throw new Error(`Failed to retrieve launch presets: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getLaunchPresetsByCategory(category: string): Promise<LaunchPreset[]> {
    try {
      const result = await this.db
        .select()
        .from(launchPresets)
        .where(eq(launchPresets.category, category))
        .orderBy(desc(launchPresets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting launch presets by category:", error);
      throw new Error(`Failed to retrieve launch presets by category: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getDefaultLaunchPresets(): Promise<LaunchPreset[]> {
    try {
      const result = await this.db
        .select()
        .from(launchPresets)
        .where(eq(launchPresets.isDefault, true))
        .orderBy(desc(launchPresets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting default launch presets:", error);
      throw new Error(`Failed to retrieve default launch presets: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getPublicLaunchPresets(): Promise<LaunchPreset[]> {
    try {
      const result = await this.db
        .select()
        .from(launchPresets)
        .where(eq(launchPresets.isPublic, true))
        .orderBy(desc(launchPresets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting public launch presets:", error);
      throw new Error(`Failed to retrieve public launch presets: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createLaunchPreset(insertPreset: InsertLaunchPreset): Promise<LaunchPreset> {
    try {
      const result = await this.db
        .insert(launchPresets)
        .values(insertPreset)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating launch preset:", error);
      throw error;
    }
  }

  async updateLaunchPreset(id: string, updates: Partial<LaunchPreset>): Promise<LaunchPreset | undefined> {
    try {
      const result = await this.db
        .update(launchPresets)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(launchPresets.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating launch preset:", error);
      throw new Error(`Failed to update launch preset: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async deleteLaunchPreset(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(launchPresets)
        .where(eq(launchPresets.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting launch preset:", error);
      throw new Error(`Failed to delete launch preset: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Upsert methods for idempotent seeding
  async upsertLaunchPreset(insertPreset: InsertLaunchPreset): Promise<{ preset: LaunchPreset; created: boolean }> {
    try {
      // Try to find existing preset with same name and category
      const existing = await this.db
        .select()
        .from(launchPresets)
        .where(
          and(
            eq(launchPresets.name, insertPreset.name),
            eq(launchPresets.category, insertPreset.category),
            eq(launchPresets.isDefault, insertPreset.isDefault || false)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Preset exists, update it if needed
        const updated = await this.db
          .update(launchPresets)
          .set({ ...insertPreset, updatedAt: new Date() })
          .where(eq(launchPresets.id, existing[0].id))
          .returning();
        return { preset: updated[0], created: false };
      } else {
        // Preset doesn't exist, create new one
        const result = await this.db
          .insert(launchPresets)
          .values(insertPreset)
          .returning();
        return { preset: result[0], created: true };
      }
    } catch (error) {
      console.error("Error upserting launch preset:", error);
      // If it's a unique constraint violation, try to retrieve existing
      if (error instanceof Error && error.message.includes('unique') || error.message.includes('duplicate')) {
        try {
          const existing = await this.db
            .select()
            .from(launchPresets)
            .where(
              and(
                eq(launchPresets.name, insertPreset.name),
                eq(launchPresets.category, insertPreset.category),
                eq(launchPresets.isDefault, insertPreset.isDefault || false)
              )
            )
            .limit(1);
          if (existing.length > 0) {
            return { preset: existing[0], created: false };
          }
        } catch (retriveError) {
          console.error("Error retrieving existing preset after conflict:", retriveError);
        }
      }
      throw error;
    }
  }

  async createLaunchPresetWithFallback(insertPreset: InsertLaunchPreset): Promise<LaunchPreset> {
    try {
      const result = await this.db
        .insert(launchPresets)
        .values(insertPreset)
        .returning();
      return result[0];
    } catch (error) {
      // If it's a unique constraint violation, that's okay - preset already exists
      if (error instanceof Error && (error.message.includes('unique') || error.message.includes('duplicate'))) {
        // Try to retrieve the existing preset
        const existing = await this.db
          .select()
          .from(launchPresets)
          .where(
            and(
              eq(launchPresets.name, insertPreset.name),
              eq(launchPresets.category, insertPreset.category),
              eq(launchPresets.isDefault, insertPreset.isDefault || false)
            )
          )
          .limit(1);
        if (existing.length > 0) {
          return existing[0];
        }
      }
      console.error("Error creating launch preset with fallback:", error);
      throw error;
    }
  }

  // User Preset methods implementation
  async getUserPreset(id: string, accessKeyId: string): Promise<UserPreset | undefined> {
    try {
      const result = await this.db
        .select()
        .from(userPresets)
        .where(and(eq(userPresets.id, id), eq(userPresets.accessKeyId, accessKeyId)))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting user preset:", error);
      throw new Error(`Failed to retrieve user preset: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getUserPresets(accessKeyId: string): Promise<UserPreset[]> {
    try {
      const result = await this.db
        .select()
        .from(userPresets)
        .where(eq(userPresets.accessKeyId, accessKeyId))
        .orderBy(desc(userPresets.updatedAt));
      return result;
    } catch (error) {
      console.error("Error getting user presets:", error);
      throw new Error(`Failed to retrieve user presets: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getUserPresetsByBasePreset(basePresetId: string, accessKeyId: string): Promise<UserPreset[]> {
    try {
      const result = await this.db
        .select()
        .from(userPresets)
        .where(and(eq(userPresets.basePresetId, basePresetId), eq(userPresets.accessKeyId, accessKeyId)))
        .orderBy(desc(userPresets.updatedAt));
      return result;
    } catch (error) {
      console.error("Error getting user presets by base preset:", error);
      throw new Error(`Failed to retrieve user presets by base preset: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createUserPreset(insertPreset: InsertUserPreset, accessKeyId: string): Promise<UserPreset> {
    try {
      const presetWithUser = { ...insertPreset, accessKeyId };
      const result = await this.db
        .insert(userPresets)
        .values(presetWithUser)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating user preset:", error);
      throw error;
    }
  }

  async updateUserPreset(id: string, updates: Partial<UserPreset>, accessKeyId: string): Promise<UserPreset | undefined> {
    try {
      const result = await this.db
        .update(userPresets)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(userPresets.id, id), eq(userPresets.accessKeyId, accessKeyId)))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating user preset:", error);
      throw new Error(`Failed to update user preset: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async updateUserPresetUsage(id: string, accessKeyId: string): Promise<UserPreset | undefined> {
    try {
      const result = await this.db
        .update(userPresets)
        .set({ 
          lastUsed: new Date(),
          useCount: sql`${userPresets.useCount} + 1`,
          updatedAt: new Date()
        })
        .where(and(eq(userPresets.id, id), eq(userPresets.accessKeyId, accessKeyId)))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating user preset usage:", error);
      throw new Error(`Failed to update user preset usage: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async deleteUserPreset(id: string, accessKeyId: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(userPresets)
        .where(and(eq(userPresets.id, id), eq(userPresets.accessKeyId, accessKeyId)))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting user preset:", error);
      throw new Error(`Failed to delete user preset: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // Preset Analytics methods implementation
  async getPresetAnalytics(presetId: string): Promise<PresetAnalytics[]> {
    try {
      const result = await this.db
        .select()
        .from(presetAnalytics)
        .where(eq(presetAnalytics.presetId, presetId))
        .orderBy(desc(presetAnalytics.timestamp));
      return result;
    } catch (error) {
      console.error("Error getting preset analytics:", error);
      throw new Error(`Failed to retrieve preset analytics: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getUserPresetAnalytics(userPresetId: string): Promise<PresetAnalytics[]> {
    try {
      const result = await this.db
        .select()
        .from(presetAnalytics)
        .where(eq(presetAnalytics.userPresetId, userPresetId))
        .orderBy(desc(presetAnalytics.timestamp));
      return result;
    } catch (error) {
      console.error("Error getting user preset analytics:", error);
      throw new Error(`Failed to retrieve user preset analytics: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async getPresetAnalyticsByUser(accessKeyId: string): Promise<PresetAnalytics[]> {
    try {
      const result = await this.db
        .select()
        .from(presetAnalytics)
        .where(eq(presetAnalytics.accessKeyId, accessKeyId))
        .orderBy(desc(presetAnalytics.timestamp));
      return result;
    } catch (error) {
      console.error("Error getting preset analytics by user:", error);
      throw new Error(`Failed to retrieve preset analytics by user: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createPresetAnalytics(insertAnalytics: InsertPresetAnalytics): Promise<PresetAnalytics> {
    try {
      const result = await this.db
        .insert(presetAnalytics)
        .values(insertAnalytics)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating preset analytics:", error);
      throw error;
    }
  }

  async getPresetUsageStats(presetId: string): Promise<{ totalUses: number; averageSuccessRate: number; averageExecutionTime: number }> {
    try {
      const result = await this.db
        .select({
          totalUses: sql<number>`count(*)`,
          averageSuccessRate: sql<number>`avg(${presetAnalytics.successRate})`,
          averageExecutionTime: sql<number>`avg(${presetAnalytics.executionTime})`
        })
        .from(presetAnalytics)
        .where(eq(presetAnalytics.presetId, presetId));
      
      const stats = result[0];
      return {
        totalUses: stats?.totalUses || 0,
        averageSuccessRate: stats?.averageSuccessRate || 0,
        averageExecutionTime: stats?.averageExecutionTime || 0
      };
    } catch (error) {
      console.error("Error getting preset usage stats:", error);
      throw new Error(`Failed to retrieve preset usage stats: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  // CRITICAL FIX: Re-implement preset methods to ensure runtime availability
  async getLaunchPresetsByCategory(category: string): Promise<LaunchPreset[]> {
    try {
      const result = await this.db
        .select()
        .from(launchPresets)
        .where(eq(launchPresets.category, category))
        .orderBy(desc(launchPresets.createdAt));
      return result;
    } catch (error) {
      console.error("Error getting launch presets by category:", error);
      throw new Error(`Failed to retrieve launch presets by category: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async createLaunchPreset(insertPreset: InsertLaunchPreset): Promise<LaunchPreset> {
    try {
      const result = await this.db
        .insert(launchPresets)
        .values(insertPreset)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating launch preset:", error);
      throw error;
    }
  }

  async getLaunchPresetById(id: string): Promise<LaunchPreset | undefined> {
    try {
      const result = await this.db
        .select()
        .from(launchPresets)
        .where(eq(launchPresets.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting launch preset by id:", error);
      throw new Error(`Failed to retrieve launch preset: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }
}

export const storage = new DatabaseStorage();

// Type alias for backwards compatibility
export type DbStorage = IStorage;