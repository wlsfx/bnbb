export interface WalletGenerationConfig {
  count: number;
  initialBalance: string;
  labelPrefix: string;
  quantityPreset?: 'custom' | 'small' | 'medium' | 'large' | 'enterprise';
  nameTemplate: string;
  groupTag: string;
  batchSize: number;
  priority: 'low' | 'normal' | 'high';
  stealthConfig?: {
    enabled: boolean;
    delayMin: number;
    delayMax: number;
    randomizeOrder: boolean;
  };
}

export interface FundingConfig {
  source: 'main_wallet' | 'exchange' | 'bridge';
  method: 'random' | 'batch';
  totalAmount: string;
  intervalMin?: number;
  intervalMax?: number;
}

export interface AdvancedBulkFunding {
  sourceWallet: string;
  targetStrategy: 'all' | 'selected' | 'pools' | 'filtered';
  targetWallets?: string[];
  targetPools?: string[];
  fundingStrategy: 'even' | 'weighted' | 'random' | 'custom' | 'smart';
  totalAmount: string;
  customAmounts?: { [walletId: string]: string };
  maxGasPrice?: string;
  batchSize: number;
  delayBetweenBatches: number;
}

export interface WalletPool {
  id: string;
  name: string;
  description: string;
  tags: string[];
  wallets: string[];
  strategy: 'active' | 'reserve' | 'cooling' | 'retired';
  rotationEnabled: boolean;
  maxActiveWallets: number;
  autoManagement: {
    enabled: boolean;
    cooldownPeriod: number;
    healthThreshold: number;
  };
  analytics: {
    totalVolume: string;
    successRate: number;
    lastUsed: Date;
    performance: number;
  };
}

export interface BulkOperation {
  id: string;
  type: 'generation' | 'funding' | 'transfer' | 'delete' | 'update';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  processedItems: number;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  results?: any;
}

export interface SystemStatus {
  backendConnected: boolean;
  networkConnected: boolean;
  latency: number;
  gasPrice: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  description: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  amount?: string;
  walletId?: string;
  transactionHash?: string;
}

export interface SystemMetricsData {
  latency: number;
  gasPrice: string;
  successRate: string;
  taxCollected: string;
  cpuUsage: number;
  memoryUsage: number;
}
