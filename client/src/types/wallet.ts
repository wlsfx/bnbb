export interface WalletGenerationConfig {
  count: number;
  initialBalance: string;
  labelPrefix: string;
}

export interface FundingConfig {
  source: 'main_wallet' | 'exchange' | 'bridge';
  method: 'random' | 'batch';
  totalAmount: string;
  intervalMin?: number;
  intervalMax?: number;
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
