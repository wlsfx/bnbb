import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Access keys table for authentication
export const accessKeys = pgTable("access_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyHash: text("key_hash").notNull().unique(), // bcrypt hash of the access key
  name: text("name").notNull(), // Descriptive name for the key
  role: text("role").notNull().default("user"), // user or admin
  lastUsed: timestamp("last_used"),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  createdBy: varchar("created_by"), // Self-reference will be added after table definition
  metadata: text("metadata"), // JSON string for additional metadata
});

// User sessions table for session management
export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessKeyId: varchar("access_key_id").notNull().references(() => accessKeys.id),
  sessionToken: text("session_token").notNull().unique(), // Unique session token
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Audit log for key operations
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessKeyId: varchar("access_key_id").references(() => accessKeys.id),
  action: text("action").notNull(), // login, logout, key_created, key_revoked, access_denied
  details: text("details"), // JSON string with additional details
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessKeyId: varchar("access_key_id").notNull().references(() => accessKeys.id),
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

// BEP-20 Token table
export const tokens = pgTable("tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  address: text("address").notNull().unique(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  decimals: integer("decimals").notNull().default(18),
  totalSupply: decimal("total_supply", { precision: 36, scale: 0 }).notNull(),
  deployerWalletId: varchar("deployer_wallet_id").references(() => wallets.id),
  deploymentTxHash: text("deployment_tx_hash").notNull(),
  contractAbi: text("contract_abi").notNull(), // JSON string of contract ABI
  contractBytecode: text("contract_bytecode"), // Bytecode if needed for verification
  status: text("status").notNull().default("deployed"), // deployed, verified, active, paused
  chainId: integer("chain_id").notNull().default(97), // BSC testnet by default
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Liquidity pool information
export const liquidityPools = pgTable("liquidity_pools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().references(() => tokens.id),
  pairAddress: text("pair_address").notNull().unique(),
  routerAddress: text("router_address").notNull(), // PancakeSwap router
  factoryAddress: text("factory_address").notNull(), // PancakeSwap factory
  token0: text("token0").notNull(), // First token in pair (usually WBNB)
  token1: text("token1").notNull(), // Second token in pair (our token)
  reserve0: decimal("reserve0", { precision: 36, scale: 18 }),
  reserve1: decimal("reserve1", { precision: 36, scale: 18 }),
  lpTokenSupply: decimal("lp_token_supply", { precision: 36, scale: 18 }),
  creationTxHash: text("creation_tx_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Token holders tracking
export const tokenHolders = pgTable("token_holders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().references(() => tokens.id),
  holderAddress: text("holder_address").notNull(),
  balance: decimal("balance", { precision: 36, scale: 18 }).notNull(),
  percentage: decimal("percentage", { precision: 5, scale: 2 }), // Percentage of total supply
  firstTxHash: text("first_tx_hash"),
  lastTxHash: text("last_tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  unq: unique().on(table.tokenId, table.holderAddress),
}));

// Token deployment transactions tracking
export const tokenDeployments = pgTable("token_deployments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  launchPlanId: varchar("launch_plan_id").references(() => launchPlans.id),
  tokenId: varchar("token_id").references(() => tokens.id),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id),
  transactionHash: text("transaction_hash").notNull().unique(),
  gasUsed: decimal("gas_used", { precision: 18, scale: 0 }),
  gasPrice: decimal("gas_price", { precision: 18, scale: 0 }),
  status: text("status").notNull().default("pending"), // pending, confirmed, failed
  errorMessage: text("error_message"),
  blockNumber: integer("block_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
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
  tokenId: varchar("token_id").references(() => tokens.id), // Reference to deployed token
  liquidityPoolId: varchar("liquidity_pool_id").references(() => liquidityPools.id), // Reference to liquidity pool
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
  maxGasPrice: decimal("max_gas_price", { precision: 20, scale: 9 }).notNull(),
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

// P&L Tracking Tables

// Portfolio snapshots - Historical portfolio values for P&L tracking
export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessKeyId: varchar("access_key_id").notNull().references(() => accessKeys.id),
  walletId: varchar("wallet_id").references(() => wallets.id), // null for aggregated portfolio
  totalValue: decimal("total_value", { precision: 18, scale: 8 }).notNull(),
  realizedPnL: decimal("realized_pnl", { precision: 18, scale: 8 }).notNull().default("0"),
  unrealizedPnL: decimal("unrealized_pnl", { precision: 18, scale: 8 }).notNull().default("0"),
  totalPnL: decimal("total_pnl", { precision: 18, scale: 8 }).notNull().default("0"),
  totalFees: decimal("total_fees", { precision: 18, scale: 8 }).notNull().default("0"),
  totalGasUsed: decimal("total_gas_used", { precision: 18, scale: 8 }).notNull().default("0"),
  positionCount: integer("position_count").notNull().default(0),
  roi: decimal("roi", { precision: 10, scale: 4 }).notNull().default("0"), // Return on investment %
  snapshotType: text("snapshot_type").notNull().default("hourly"), // hourly, daily, weekly, monthly, real_time
  blockNumber: integer("block_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transaction P&L - P&L calculations per transaction
export const transactionPnL = pgTable("transaction_pnl", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull().references(() => bundleTransactions.id),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id),
  tokenAddress: text("token_address"),
  tokenSymbol: text("token_symbol"),
  transactionType: text("transaction_type").notNull(), // buy, sell, launch, funding, fee_payment
  costBasis: decimal("cost_basis", { precision: 18, scale: 8 }).notNull().default("0"),
  realizedPnL: decimal("realized_pnl", { precision: 18, scale: 8 }).notNull().default("0"),
  unrealizedPnL: decimal("unrealized_pnl", { precision: 18, scale: 8 }).notNull().default("0"),
  fees: decimal("fees", { precision: 18, scale: 8 }).notNull().default("0"),
  gasFees: decimal("gas_fees", { precision: 18, scale: 8 }).notNull().default("0"),
  mevLoss: decimal("mev_loss", { precision: 18, scale: 8 }).notNull().default("0"),
  slippageLoss: decimal("slippage_loss", { precision: 18, scale: 8 }).notNull().default("0"),
  priceAtTransaction: decimal("price_at_transaction", { precision: 18, scale: 8 }),
  currentPrice: decimal("current_price", { precision: 18, scale: 8 }),
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull().default("0"),
  accountingMethod: text("accounting_method").notNull().default("FIFO"), // FIFO, LIFO
  isRealized: boolean("is_realized").notNull().default(false),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Token positions - Current positions per token per wallet
export const tokenPositions = pgTable("token_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id),
  tokenAddress: text("token_address").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenName: text("token_name"),
  currentBalance: decimal("current_balance", { precision: 18, scale: 8 }).notNull().default("0"),
  averageCostBasis: decimal("average_cost_basis", { precision: 18, scale: 8 }).notNull().default("0"),
  totalCost: decimal("total_cost", { precision: 18, scale: 8 }).notNull().default("0"),
  currentValue: decimal("current_value", { precision: 18, scale: 8 }).notNull().default("0"),
  unrealizedPnL: decimal("unrealized_pnl", { precision: 18, scale: 8 }).notNull().default("0"),
  realizedPnL: decimal("realized_pnl", { precision: 18, scale: 8 }).notNull().default("0"),
  totalPnL: decimal("total_pnl", { precision: 18, scale: 8 }).notNull().default("0"),
  roi: decimal("roi", { precision: 10, scale: 4 }).notNull().default("0"),
  currentPrice: decimal("current_price", { precision: 18, scale: 8 }),
  priceChange24h: decimal("price_change_24h", { precision: 10, scale: 4 }),
  firstPurchaseAt: timestamp("first_purchase_at"),
  lastTransactionAt: timestamp("last_transaction_at"),
  transactionCount: integer("transaction_count").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Performance metrics - Aggregated performance data
export const performanceMetrics = pgTable("performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessKeyId: varchar("access_key_id").notNull().references(() => accessKeys.id),
  walletId: varchar("wallet_id").references(() => wallets.id), // null for aggregated metrics
  timeframe: text("timeframe").notNull(), // 1h, 24h, 7d, 30d, all_time
  totalPnL: decimal("total_pnl", { precision: 18, scale: 8 }).notNull().default("0"),
  realizedPnL: decimal("realized_pnl", { precision: 18, scale: 8 }).notNull().default("0"),
  unrealizedPnL: decimal("unrealized_pnl", { precision: 18, scale: 8 }).notNull().default("0"),
  totalROI: decimal("total_roi", { precision: 10, scale: 4 }).notNull().default("0"),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  avgWin: decimal("avg_win", { precision: 18, scale: 8 }).notNull().default("0"),
  avgLoss: decimal("avg_loss", { precision: 18, scale: 8 }).notNull().default("0"),
  maxDrawdown: decimal("max_drawdown", { precision: 10, scale: 4 }).notNull().default("0"),
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 4 }),
  profitFactor: decimal("profit_factor", { precision: 10, scale: 4 }),
  totalTrades: integer("total_trades").notNull().default(0),
  winningTrades: integer("winning_trades").notNull().default(0),
  losingTrades: integer("losing_trades").notNull().default(0),
  totalVolume: decimal("total_volume", { precision: 18, scale: 8 }).notNull().default("0"),
  totalFees: decimal("total_fees", { precision: 18, scale: 8 }).notNull().default("0"),
  avgHoldTime: integer("avg_hold_time"), // in seconds
  bestTrade: decimal("best_trade", { precision: 18, scale: 8 }),
  worstTrade: decimal("worst_trade", { precision: 18, scale: 8 }),
  consecutiveWins: integer("consecutive_wins").notNull().default(0),
  consecutiveLosses: integer("consecutive_losses").notNull().default(0),
  marketTimingScore: decimal("market_timing_score", { precision: 5, scale: 2 }),
  bundleExecutionROI: decimal("bundle_execution_roi", { precision: 10, scale: 4 }),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  periodStartAt: timestamp("period_start_at").notNull(),
  periodEndAt: timestamp("period_end_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Wallet Pool Management System
// Wallet pools for organizing and managing large wallet sets
export const walletPools = pgTable("wallet_pools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessKeyId: varchar("access_key_id").notNull().references(() => accessKeys.id),
  name: text("name").notNull(),
  description: text("description"),
  tags: text("tags").array(), // Multiple tags for organization and filtering
  strategy: text("strategy").notNull().default("active"), // active, reserve, cooling, retired
  rotationEnabled: boolean("rotation_enabled").notNull().default(false),
  maxActiveWallets: integer("max_active_wallets").notNull().default(100),
  autoManagement: boolean("auto_management").notNull().default(false),
  cooldownPeriod: integer("cooldown_period").notNull().default(24), // Hours before wallet reuse
  healthThreshold: integer("health_threshold").notNull().default(80), // Minimum health score for active use
  totalVolume: decimal("total_volume", { precision: 18, scale: 8 }).notNull().default("0"),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  performance: integer("performance").notNull().default(100), // Performance score 0-100
  lastUsed: timestamp("last_used"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Wallet pool memberships - many-to-many relationship
export const walletPoolMemberships = pgTable("wallet_pool_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poolId: varchar("pool_id").notNull().references(() => walletPools.id, { onDelete: "cascade" }),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0), // Order within pool
  isActive: boolean("is_active").notNull().default(true), // Active in this pool
  lastUsed: timestamp("last_used"),
  usageCount: integer("usage_count").notNull().default(0),
  performanceScore: integer("performance_score").notNull().default(100),
  cooldownUntil: timestamp("cooldown_until"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// Bulk operations tracking
export const bulkOperations = pgTable("bulk_operations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessKeyId: varchar("access_key_id").notNull().references(() => accessKeys.id),
  operationType: text("operation_type").notNull(), // generation, funding, selection, update, delete
  operationConfig: text("operation_config").notNull(), // JSON configuration
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, failed, cancelled
  totalItems: integer("total_items").notNull().default(0),
  processedItems: integer("processed_items").notNull().default(0),
  successfulItems: integer("successful_items").notNull().default(0),
  failedItems: integer("failed_items").notNull().default(0),
  progressPercentage: decimal("progress_percentage", { precision: 5, scale: 2 }).notNull().default("0"),
  batchSize: integer("batch_size").notNull().default(10),
  currentBatch: integer("current_batch").notNull().default(0),
  estimatedCompletion: timestamp("estimated_completion"),
  errorDetails: text("error_details"), // JSON array of errors
  results: text("results"), // JSON results data
  priority: text("priority").notNull().default("normal"), // low, normal, high
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Wallet tags for enhanced organization and filtering
export const walletTags = pgTable("wallet_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessKeyId: varchar("access_key_id").notNull().references(() => accessKeys.id),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
  value: text("value"), // Optional tag value for key-value pairs
  category: text("category").notNull().default("general"), // general, performance, status, custom
  isSystemTag: boolean("is_system_tag").notNull().default(false), // System vs user tags
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bulk operation progress tracking for real-time updates
export const bulkOperationProgress = pgTable("bulk_operation_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bulkOperationId: varchar("bulk_operation_id").notNull().references(() => bulkOperations.id, { onDelete: "cascade" }),
  batchNumber: integer("batch_number").notNull(),
  batchStatus: text("batch_status").notNull().default("pending"), // pending, processing, completed, failed
  itemsInBatch: integer("items_in_batch").notNull().default(0),
  successfulInBatch: integer("successful_in_batch").notNull().default(0),
  failedInBatch: integer("failed_in_batch").notNull().default(0),
  batchResults: text("batch_results"), // JSON batch-specific results
  batchErrors: text("batch_errors"), // JSON batch-specific errors
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// P&L Alerts - Alert configurations for P&L changes
export const pnlAlerts = pgTable("pnl_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessKeyId: varchar("access_key_id").notNull().references(() => accessKeys.id),
  walletId: varchar("wallet_id").references(() => wallets.id), // null for portfolio-wide alerts
  tokenAddress: text("token_address"), // null for general alerts
  alertType: text("alert_type").notNull(), // profit_threshold, loss_threshold, roi_target, drawdown_limit
  metric: text("metric").notNull(), // total_pnl, realized_pnl, unrealized_pnl, roi, drawdown
  threshold: decimal("threshold", { precision: 18, scale: 8 }).notNull(),
  condition: text("condition").notNull(), // greater_than, less_than, equal_to
  isActive: boolean("is_active").notNull().default(true),
  notificationChannels: text("notification_channels").array().notNull().default(sql`ARRAY['websocket']`), // websocket, email, sms
  lastTriggered: timestamp("last_triggered"),
  triggerCount: integer("trigger_count").notNull().default(0),
  description: text("description"),
  metadata: text("metadata"), // JSON string for additional config
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Market data cache for price feeds
export const marketDataCache = pgTable("market_data_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenAddress: text("token_address").notNull().unique(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenName: text("token_name"),
  currentPrice: decimal("current_price", { precision: 18, scale: 8 }).notNull(),
  priceChange24h: decimal("price_change_24h", { precision: 10, scale: 4 }),
  volume24h: decimal("volume_24h", { precision: 18, scale: 8 }),
  marketCap: decimal("market_cap", { precision: 18, scale: 8 }),
  totalSupply: decimal("total_supply", { precision: 18, scale: 8 }),
  circulatingSupply: decimal("circulating_supply", { precision: 18, scale: 8 }),
  priceSource: text("price_source").notNull().default("pancakeswap"), // pancakeswap, dextools, coingecko
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertAccessKeySchema = createInsertSchema(accessKeys).omit({
  id: true,
  createdAt: true,
  lastUsed: true,
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
  lastActivity: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
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

// P&L tracking insert schemas
export const insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionPnLSchema = createInsertSchema(transactionPnL).omit({
  id: true,
  calculatedAt: true,
  createdAt: true,
});

export const insertTokenPositionSchema = createInsertSchema(tokenPositions).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});

export const insertPerformanceMetricsSchema = createInsertSchema(performanceMetrics).omit({
  id: true,
  calculatedAt: true,
  createdAt: true,
});

export const insertPnLAlertSchema = createInsertSchema(pnlAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarketDataCacheSchema = createInsertSchema(marketDataCache).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertAccessKey = z.infer<typeof insertAccessKeySchema>;
export type AccessKey = typeof accessKeys.$inferSelect;

export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

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

// P&L tracking types
export type InsertPortfolioSnapshot = z.infer<typeof insertPortfolioSnapshotSchema>;
export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;

export type InsertTransactionPnL = z.infer<typeof insertTransactionPnLSchema>;
export type TransactionPnL = typeof transactionPnL.$inferSelect;

export type InsertTokenPosition = z.infer<typeof insertTokenPositionSchema>;
export type TokenPosition = typeof tokenPositions.$inferSelect;

export type InsertPerformanceMetrics = z.infer<typeof insertPerformanceMetricsSchema>;
export type PerformanceMetrics = typeof performanceMetrics.$inferSelect;

export type InsertPnLAlert = z.infer<typeof insertPnLAlertSchema>;
export type PnLAlert = typeof pnlAlerts.$inferSelect;

export type InsertMarketDataCache = z.infer<typeof insertMarketDataCacheSchema>;
export type MarketDataCache = typeof marketDataCache.$inferSelect;

// Token-related insert schemas
export const insertTokenSchema = createInsertSchema(tokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLiquidityPoolSchema = createInsertSchema(liquidityPools).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTokenHolderSchema = createInsertSchema(tokenHolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTokenDeploymentSchema = createInsertSchema(tokenDeployments).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// Token types
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type Token = typeof tokens.$inferSelect;

export type InsertLiquidityPool = z.infer<typeof insertLiquidityPoolSchema>;
export type LiquidityPool = typeof liquidityPools.$inferSelect;

export type InsertTokenHolder = z.infer<typeof insertTokenHolderSchema>;
export type TokenHolder = typeof tokenHolders.$inferSelect;

export type InsertTokenDeployment = z.infer<typeof insertTokenDeploymentSchema>;
export type TokenDeployment = typeof tokenDeployments.$inferSelect;

// Wallet Pool Management types
export const insertWalletPoolSchema = createInsertSchema(walletPools).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWalletPoolMembershipSchema = createInsertSchema(walletPoolMemberships).omit({
  id: true,
  addedAt: true,
});

export const insertBulkOperationSchema = createInsertSchema(bulkOperations).omit({
  id: true,
  createdAt: true,
});

export const insertWalletTagSchema = createInsertSchema(walletTags).omit({
  id: true,
  createdAt: true,
});

export const insertBulkOperationProgressSchema = createInsertSchema(bulkOperationProgress).omit({
  id: true,
  createdAt: true,
});

export type InsertWalletPool = z.infer<typeof insertWalletPoolSchema>;
export type WalletPool = typeof walletPools.$inferSelect;

export type InsertWalletPoolMembership = z.infer<typeof insertWalletPoolMembershipSchema>;
export type WalletPoolMembership = typeof walletPoolMemberships.$inferSelect;

export type InsertBulkOperation = z.infer<typeof insertBulkOperationSchema>;
export type BulkOperation = typeof bulkOperations.$inferSelect;

export type InsertWalletTag = z.infer<typeof insertWalletTagSchema>;
export type WalletTag = typeof walletTags.$inferSelect;

export type InsertBulkOperationProgress = z.infer<typeof insertBulkOperationProgressSchema>;
export type BulkOperationProgress = typeof bulkOperationProgress.$inferSelect;

// Launch preset definitions
export const launchPresets = pgTable("launch_presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // 'fair', 'stealth', 'private', 'liquidity', 'flash', 'conservative'
  configuration: text("configuration").notNull(), // JSON string - complete launch configuration
  isDefault: boolean("is_default").notNull().default(false),
  createdBy: varchar("created_by").references(() => accessKeys.id),
  isPublic: boolean("is_public").notNull().default(true),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueDefaultPreset: unique().on(table.name, table.category, table.isDefault),
}));

// User's saved preset configurations
export const userPresets = pgTable("user_presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessKeyId: varchar("access_key_id").notNull().references(() => accessKeys.id),
  basePresetId: varchar("base_preset_id").references(() => launchPresets.id), // Reference to base preset if customized
  name: text("name").notNull(),
  description: text("description").notNull(),
  configuration: text("configuration").notNull(), // JSON string
  lastUsed: timestamp("last_used"),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserPreset: unique().on(table.accessKeyId, table.name),
}));

// Launch preset usage analytics
export const presetAnalytics = pgTable("preset_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  presetId: varchar("preset_id").references(() => launchPresets.id),
  userPresetId: varchar("user_preset_id").references(() => userPresets.id),
  accessKeyId: varchar("access_key_id").notNull().references(() => accessKeys.id),
  executionId: varchar("execution_id").references(() => bundleExecutions.id), // Link to bundle execution
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  executionTime: integer("execution_time"), // in seconds
  gasUsed: decimal("gas_used", { precision: 18, scale: 0 }),
  totalValue: decimal("total_value", { precision: 18, scale: 8 }),
  notes: text("notes"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Preset categories for organization and filtering
export const PRESET_CATEGORIES = {
  FAIR: 'fair',
  STEALTH: 'stealth', 
  PRIVATE: 'private',
  LIQUIDITY: 'liquidity',
  FLASH: 'flash',
  CONSERVATIVE: 'conservative',
} as const;

// Insert schemas for preset tables
export const insertLaunchPresetSchema = createInsertSchema(launchPresets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserPresetSchema = createInsertSchema(userPresets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUsed: true,
  useCount: true,
});

export const insertPresetAnalyticsSchema = createInsertSchema(presetAnalytics).omit({
  id: true,
  timestamp: true,
});

// Type exports for preset tables
export type InsertLaunchPreset = z.infer<typeof insertLaunchPresetSchema>;
export type LaunchPreset = typeof launchPresets.$inferSelect;

export type InsertUserPreset = z.infer<typeof insertUserPresetSchema>;
export type UserPreset = typeof userPresets.$inferSelect;

export type InsertPresetAnalytics = z.infer<typeof insertPresetAnalyticsSchema>;
export type PresetAnalytics = typeof presetAnalytics.$inferSelect;
