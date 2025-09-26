import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  address: text("address").notNull().unique(),
  privateKey: text("private_key").notNull(),
  publicKey: text("public_key").notNull(),
  balance: decimal("balance", { precision: 18, scale: 8 }).notNull().default("0"),
  status: text("status").notNull().default("idle"), // idle, active, funding, error
  label: text("label"),
  lastActivity: timestamp("last_activity"),
  // Enhanced wallet status/heartbeat fields
  health: text("health").notNull().default("good"), // good, warning, critical, offline
  connectionStatus: text("connection_status").notNull().default("connected"), // connected, disconnected, syncing
  lastHeartbeat: timestamp("last_heartbeat"),
  gasEstimate: decimal("gas_estimate", { precision: 18, scale: 8 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const launchPlans = pgTable("launch_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenName: text("token_name").notNull(),
  totalSupply: decimal("total_supply", { precision: 18, scale: 0 }).notNull(),
  initialLiquidity: decimal("initial_liquidity", { precision: 18, scale: 8 }).notNull(),
  status: text("status").notNull().default("draft"), // draft, ready, executing, completed, failed
  walletCount: integer("wallet_count").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Status constants for consistency across backends
export const BUNDLE_STATUS = {
  PENDING: 'pending',
  BROADCASTING: 'broadcasting',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
} as const;

export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  BROADCASTING: 'broadcasting',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  RETRYING: 'retrying',
} as const;

export const bundleExecutions = pgTable("bundle_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  launchPlanId: varchar("launch_plan_id").notNull().references(() => launchPlans.id),
  status: text("status").notNull().default(BUNDLE_STATUS.PENDING),
  totalWallets: integer("total_wallets").notNull(),
  completedWallets: integer("completed_wallets").notNull().default(0),
  failedWallets: integer("failed_wallets").notNull().default(0),
  progressPercentage: decimal("progress_percentage", { precision: 5, scale: 2 }).notNull().default("0"),
  failureReason: text("failure_reason"),
  quicknodeSubscriptionId: text("quicknode_subscription_id"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bundle transactions - per-transaction metadata with wallet linkage
export const bundleTransactions = pgTable("bundle_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bundleExecutionId: varchar("bundle_execution_id").notNull().references(() => bundleExecutions.id),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id),
  transactionHash: text("transaction_hash"),
  status: text("status").notNull().default(TRANSACTION_STATUS.PENDING),
  transactionType: text("transaction_type").notNull(), // transfer, token_creation, liquidity_addition, swap
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address"),
  value: decimal("value", { precision: 18, scale: 8 }),
  gasPrice: decimal("gas_price", { precision: 18, scale: 9 }),
  gasLimit: integer("gas_limit"),
  gasUsed: integer("gas_used"),
  nonce: integer("nonce"),
  blockNumber: integer("block_number"),
  quicknodeRequestId: text("quicknode_request_id"),
  quicknodeResponseData: text("quicknode_response_data"), // JSON string
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Transaction events - status timeline with detailed tracking
export const transactionEvents = pgTable("transaction_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bundleTransactionId: varchar("bundle_transaction_id").notNull().references(() => bundleTransactions.id),
  status: text("status").notNull(), // pending, broadcasting, confirmed, failed, retrying
  eventType: text("event_type").notNull(), // status_change, error, retry, confirmation
  description: text("description"),
  errorMessage: text("error_message"),
  errorCode: text("error_code"),
  retryCount: integer("retry_count").notNull().default(0),
  retryReason: text("retry_reason"),
  confirmations: integer("confirmations"),
  blockHash: text("block_hash"),
  payload: text("payload"), // JSON string for additional event data
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Bundle analytics - aggregated KPIs
export const bundleAnalytics = pgTable("bundle_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bundleExecutionId: varchar("bundle_execution_id").references(() => bundleExecutions.id),
  launchPlanId: varchar("launch_plan_id").references(() => launchPlans.id),
  timeframe: text("timeframe").notNull(), // hourly, daily, weekly, monthly, all_time
  totalTransactions: integer("total_transactions").notNull().default(0),
  successfulTransactions: integer("successful_transactions").notNull().default(0),
  failedTransactions: integer("failed_transactions").notNull().default(0),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  avgConfirmationTime: integer("avg_confirmation_time"), // in seconds
  minConfirmationTime: integer("min_confirmation_time"),
  maxConfirmationTime: integer("max_confirmation_time"),
  totalGasUsed: decimal("total_gas_used", { precision: 18, scale: 0 }),
  avgGasPrice: decimal("avg_gas_price", { precision: 18, scale: 9 }),
  totalValue: decimal("total_value", { precision: 18, scale: 8 }),
  totalFees: decimal("total_fees", { precision: 18, scale: 8 }),
  walletsInvolved: integer("wallets_involved").notNull().default(0),
  periodStartAt: timestamp("period_start_at").notNull(),
  periodEndAt: timestamp("period_end_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // transfer, wallet_generated, bundle_execution, etc.
  description: text("description").notNull(),
  walletId: varchar("wallet_id").references(() => wallets.id),
  amount: decimal("amount", { precision: 18, scale: 8 }),
  status: text("status").notNull(), // pending, confirmed, failed
  transactionHash: text("transaction_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const systemMetrics = pgTable("system_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  latency: integer("latency").notNull(), // in milliseconds
  gasPrice: decimal("gas_price", { precision: 10, scale: 2 }).notNull(),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).notNull(),
  taxCollected: decimal("tax_collected", { precision: 18, scale: 8 }).notNull().default("0"),
  cpuUsage: integer("cpu_usage").notNull(),
  memoryUsage: integer("memory_usage").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Stealth funding snapshots
export const stealthFundingSnapshots = pgTable("stealth_funding_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id),
  grossAmount: decimal("gross_amount", { precision: 18, scale: 8 }).notNull(),
  netAmount: decimal("net_amount", { precision: 18, scale: 8 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 18, scale: 8 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default("5.00"), // 5% default
  status: text("status").notNull().default("pending"), // pending, confirmed, failed
  transactionHash: text("transaction_hash"),
  blockNumber: integer("block_number"),
  gasUsed: decimal("gas_used", { precision: 18, scale: 0 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Proxy configuration for stealth operations
export const proxyConfig = pgTable("proxy_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull(),
  port: integer("port").notNull(),
  protocol: text("protocol").notNull().default("http"), // http, https, socks5
  username: text("username"),
  passwordHash: text("password_hash"), // Never store plain text passwords
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0), // Higher priority = preferred
  environment: text("environment").notNull(), // mainnet, testnet, development
  rotationInterval: integer("rotation_interval"), // in seconds, null means no rotation
  lastRotated: timestamp("last_rotated"),
  healthStatus: text("health_status").notNull().default("unknown"), // healthy, degraded, failed, unknown
  lastHealthCheck: timestamp("last_health_check"),
  requestCount: integer("request_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  avgLatency: decimal("avg_latency", { precision: 10, scale: 3 }), // in milliseconds
  maxConcurrentConnections: integer("max_concurrent_connections").notNull().default(10),
  currentConnections: integer("current_connections").notNull().default(0),
  tags: text("tags").array(), // For filtering and grouping
  metadata: text("metadata"), // JSON string for additional config
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Proxy rotation log for tracking and analytics
export const proxyRotationLog = pgTable("proxy_rotation_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromProxyId: varchar("from_proxy_id").references(() => proxyConfig.id),
  toProxyId: varchar("to_proxy_id").references(() => proxyConfig.id),
  reason: text("reason").notNull(), // scheduled, failure, manual, load_balancing
  walletId: varchar("wallet_id").references(() => wallets.id),
  sessionId: varchar("session_id"),
  requestsServed: integer("requests_served").notNull().default(0),
  bytesTransferred: decimal("bytes_transferred", { precision: 18, scale: 0 }),
  rotatedAt: timestamp("rotated_at").defaultNow().notNull(),
});

// Network configuration for request optimization
export const networkConfig = pgTable("network_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  environment: text("environment").notNull().unique(), // mainnet, testnet, development
  requestTimeout: integer("request_timeout").notNull().default(30000), // in milliseconds
  connectionTimeout: integer("connection_timeout").notNull().default(10000),
  keepAliveTimeout: integer("keep_alive_timeout").notNull().default(60000),
  maxRetries: integer("max_retries").notNull().default(3),
  retryDelay: integer("retry_delay").notNull().default(1000), // base delay in ms
  retryMultiplier: decimal("retry_multiplier", { precision: 3, scale: 2 }).notNull().default("2.00"),
  maxRetryDelay: integer("max_retry_delay").notNull().default(30000),
  circuitBreakerThreshold: integer("circuit_breaker_threshold").notNull().default(5), // failures before opening
  circuitBreakerTimeout: integer("circuit_breaker_timeout").notNull().default(60000), // cooldown in ms
  rateLimitPerWallet: integer("rate_limit_per_wallet").notNull().default(10), // requests per second
  rateLimitGlobal: integer("rate_limit_global").notNull().default(100),
  batchSize: integer("batch_size").notNull().default(10), // max requests per batch
  batchDelay: integer("batch_delay").notNull().default(100), // delay between batches in ms
  requestPoolSize: integer("request_pool_size").notNull().default(20),
  compressionEnabled: boolean("compression_enabled").notNull().default(true),
  cacheDuration: integer("cache_duration").notNull().default(5000), // in milliseconds
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Network health metrics
export const networkHealthMetrics = pgTable("network_health_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  environment: text("environment").notNull(),
  endpoint: text("endpoint").notNull(), // quicknode, proxy, api
  status: text("status").notNull(), // healthy, degraded, failed
  latency: decimal("latency", { precision: 10, scale: 3 }), // in milliseconds
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).notNull(),
  totalRequests: integer("total_requests").notNull().default(0),
  failedRequests: integer("failed_requests").notNull().default(0),
  avgResponseTime: decimal("avg_response_time", { precision: 10, scale: 3 }),
  p95ResponseTime: decimal("p95_response_time", { precision: 10, scale: 3 }),
  p99ResponseTime: decimal("p99_response_time", { precision: 10, scale: 3 }),
  errorTypes: text("error_types"), // JSON array of error types and counts
  activeConnections: integer("active_connections").notNull().default(0),
  queuedRequests: integer("queued_requests").notNull().default(0),
  circuitBreakerStatus: text("circuit_breaker_status").notNull().default("closed"), // closed, open, half-open
  lastIncident: timestamp("last_incident"),
  measuredAt: timestamp("measured_at").defaultNow().notNull(),
});

// Environment configuration
export const environmentConfig = pgTable("environment_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  environment: text("environment").notNull().unique(), // mainnet, testnet
  isActive: boolean("is_active").notNull().default(false),
  networkId: integer("network_id").notNull(),
  chainId: integer("chain_id").notNull(),
  rpcUrl: text("rpc_url").notNull(),
  wsUrl: text("ws_url"),
  explorerUrl: text("explorer_url"),
  nativeCurrency: text("native_currency").notNull().default("BNB"),
  gasLimitMultiplier: decimal("gas_limit_multiplier", { precision: 3, scale: 2 }).notNull().default("1.20"),
  maxGasPrice: decimal("max_gas_price", { precision: 18, scale: 9 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Launch session tracking
export const launchSessions = pgTable("launch_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  launchPlanId: varchar("launch_plan_id").notNull().references(() => launchPlans.id),
  environment: text("environment").notNull().references(() => environmentConfig.environment),
  status: text("status").notNull().default("preparing"), // preparing, active, paused, completed, failed, cancelled
  phase: text("phase").notNull().default("wallet_generation"), // wallet_generation, funding, token_creation, liquidity_addition, finalization
  totalWallets: integer("total_wallets").notNull(),
  walletsGenerated: integer("wallets_generated").notNull().default(0),
  walletsFunded: integer("wallets_funded").notNull().default(0),
  tokensDistributed: integer("tokens_distributed").notNull().default(0),
  liquidityAdded: boolean("liquidity_added").notNull().default(false),
  totalFundingAmount: decimal("total_funding_amount", { precision: 18, scale: 8 }).notNull().default("0"),
  totalTaxCollected: decimal("total_tax_collected", { precision: 18, scale: 8 }).notNull().default("0"),
  progressPercentage: decimal("progress_percentage", { precision: 5, scale: 2 }).notNull().default("0"),
  estimatedCompletionTime: timestamp("estimated_completion_time"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
  createdAt: true,
});

export const insertLaunchPlanSchema = createInsertSchema(launchPlans).omit({
  id: true,
  createdAt: true,
});

export const insertBundleExecutionSchema = createInsertSchema(bundleExecutions).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertBundleTransactionSchema = createInsertSchema(bundleTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionEventSchema = createInsertSchema(transactionEvents).omit({
  id: true,
  timestamp: true,
});

export const insertBundleAnalyticsSchema = createInsertSchema(bundleAnalytics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertSystemMetricsSchema = createInsertSchema(systemMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertStealthFundingSnapshotSchema = createInsertSchema(stealthFundingSnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertEnvironmentConfigSchema = createInsertSchema(environmentConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLaunchSessionSchema = createInsertSchema(launchSessions).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertProxyConfigSchema = createInsertSchema(proxyConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRotated: true,
  lastHealthCheck: true,
});

export const insertProxyRotationLogSchema = createInsertSchema(proxyRotationLog).omit({
  id: true,
  rotatedAt: true,
});

export const insertNetworkConfigSchema = createInsertSchema(networkConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNetworkHealthMetricsSchema = createInsertSchema(networkHealthMetrics).omit({
  id: true,
  measuredAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof wallets.$inferSelect;

export type InsertLaunchPlan = z.infer<typeof insertLaunchPlanSchema>;
export type LaunchPlan = typeof launchPlans.$inferSelect;

export type InsertBundleExecution = z.infer<typeof insertBundleExecutionSchema>;
export type BundleExecution = typeof bundleExecutions.$inferSelect;

export type InsertBundleTransaction = z.infer<typeof insertBundleTransactionSchema>;
export type BundleTransaction = typeof bundleTransactions.$inferSelect;

export type InsertTransactionEvent = z.infer<typeof insertTransactionEventSchema>;
export type TransactionEvent = typeof transactionEvents.$inferSelect;

export type InsertBundleAnalytics = z.infer<typeof insertBundleAnalyticsSchema>;
export type BundleAnalytics = typeof bundleAnalytics.$inferSelect;

export type BundleStatusType = typeof BUNDLE_STATUS[keyof typeof BUNDLE_STATUS];
export type TransactionStatusType = typeof TRANSACTION_STATUS[keyof typeof TRANSACTION_STATUS];

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

export type InsertSystemMetrics = z.infer<typeof insertSystemMetricsSchema>;
export type SystemMetrics = typeof systemMetrics.$inferSelect;

export type InsertStealthFundingSnapshot = z.infer<typeof insertStealthFundingSnapshotSchema>;
export type StealthFundingSnapshot = typeof stealthFundingSnapshots.$inferSelect;

export type InsertEnvironmentConfig = z.infer<typeof insertEnvironmentConfigSchema>;
export type EnvironmentConfig = typeof environmentConfig.$inferSelect;

export type InsertLaunchSession = z.infer<typeof insertLaunchSessionSchema>;
export type LaunchSession = typeof launchSessions.$inferSelect;

export type InsertProxyConfig = z.infer<typeof insertProxyConfigSchema>;
export type ProxyConfig = typeof proxyConfig.$inferSelect;

export type InsertProxyRotationLog = z.infer<typeof insertProxyRotationLogSchema>;
export type ProxyRotationLog = typeof proxyRotationLog.$inferSelect;

export type InsertNetworkConfig = z.infer<typeof insertNetworkConfigSchema>;
export type NetworkConfig = typeof networkConfig.$inferSelect;

export type InsertNetworkHealthMetrics = z.infer<typeof insertNetworkHealthMetricsSchema>;
export type NetworkHealthMetrics = typeof networkHealthMetrics.$inferSelect;
