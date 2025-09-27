import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { DbStorage } from './storage';
import type { BSCClient } from './blockchain-client';
import type { StealthPatterns } from './stealth-patterns';
import type { BundleJobQueue } from './job-queue';
import type { ProxyService } from './proxy-service';
import type { 
  BundleExecution, 
  LaunchPlan, 
  Wallet, 
  BundleTransaction,
  BundleAnalytics,
  BUNDLE_STATUS 
} from '@shared/schema';

export interface BundleExecutionConfig {
  launchPlanId: string;
  selectedWalletIds?: string[]; // If empty, use all idle wallets
  executionMode: 'parallel' | 'sequential';
  transactionType: 'transfer' | 'token_creation' | 'liquidity_addition' | 'swap';
  parameters: {
    tokenAddress?: string;
    amount?: string;
    recipient?: string;
    gasLimit?: number;
    gasPrice?: string;
    slippage?: number;
  };
  stealthConfig?: {
    enableDelays?: boolean;
    enableGasVariance?: boolean;
    enableWalletShuffling?: boolean;
    enableProxyRotation?: boolean;
    customDelayRange?: { min: number; max: number };
  };
}

export interface ExecutionResult {
  bundleExecutionId: string;
  status: 'success' | 'partial' | 'failed';
  summary: {
    total: number;
    completed: number;
    failed: number;
    progressPercentage: number;
  };
  analytics: {
    executionTime: number;
    averageGasPrice: string;
    totalGasUsed: string;
    successRate: number;
    stealthScore: number;
  };
  transactions: BundleTransaction[];
  errors?: string[];
}

export interface BundleMonitor {
  bundleExecutionId: string;
  startTime: number;
  lastUpdate: number;
  progressCallback?: (progress: BundleProgress) => void;
  completionCallback?: (result: ExecutionResult) => void;
  errorCallback?: (error: Error) => void;
}

export interface BundleProgress {
  bundleExecutionId: string;
  status: string;
  progressPercentage: number;
  completedTransactions: number;
  failedTransactions: number;
  totalTransactions: number;
  currentPhase: string;
  estimatedTimeRemaining?: number;
  recentActivity: Array<{
    timestamp: number;
    description: string;
    transactionHash?: string;
    walletAddress?: string;
  }>;
}

export class BundleExecutor extends EventEmitter {
  private storage: DbStorage;
  private bscClient: BSCClient;
  private stealthPatterns: StealthPatterns;
  private jobQueue: BundleJobQueue;
  private proxyService: ProxyService;
  private activeExecutions: Map<string, BundleMonitor> = new Map();
  private executionHistory: Map<string, ExecutionResult> = new Map();

  constructor(
    storage: DbStorage,
    bscClient: BSCClient,
    stealthPatterns: StealthPatterns,
    jobQueue: BundleJobQueue,
    proxyService: ProxyService
  ) {
    super();
    
    this.storage = storage;
    this.bscClient = bscClient;
    this.stealthPatterns = stealthPatterns;
    this.jobQueue = jobQueue;
    this.proxyService = proxyService;

    this.setupEventHandlers();
    console.log('🎯 Bundle Executor initialized');
  }

  private setupEventHandlers(): void {
    // Listen to job queue events
    this.jobQueue.on('jobCompleted', (data) => {
      this.handleJobCompleted(data);
    });

    this.jobQueue.on('jobFailed', (data) => {
      this.handleJobFailed(data);
    });

    this.jobQueue.on('bundleProgress', (data) => {
      this.handleBundleProgress(data);
    });

    this.jobQueue.on('bundleCompleted', (data) => {
      this.handleBundleCompleted(data);
    });

    // Listen to blockchain events
    this.bscClient.on('transactionUpdate', (data) => {
      this.handleTransactionUpdate(data);
    });

    console.log('📡 Event handlers configured');
  }

  /**
   * Execute a bundle with comprehensive stealth patterns and monitoring
   */
  async executeBundle(config: BundleExecutionConfig): Promise<string> {
    console.log(`🚀 Starting bundle execution for launch plan: ${config.launchPlanId}`);

    try {
      // Phase 1: Validation and Preparation
      const launchPlan = await this.validateAndPrepareBunde(config);
      
      // Phase 2: Wallet Selection and Validation
      const selectedWallets = await this.selectAndValidateWallets(config);
      
      // Phase 3: Create Bundle Execution Record
      const bundleExecution = await this.createBundleExecution(launchPlan, selectedWallets, config);
      
      // Phase 4: Generate Stealth Execution Plan
      const executionPlan = await this.generateStealthExecutionPlan(selectedWallets, config);
      
      // Phase 5: Initialize Monitoring
      this.initializeMonitoring(bundleExecution.id);
      
      // Phase 6: Execute Bundle with Job Queue
      await this.executeWithJobQueue(bundleExecution.id, executionPlan, config);
      
      // Phase 7: Start Real-time Analytics
      await this.startRealTimeAnalytics(bundleExecution.id);

      console.log(`✅ Bundle execution ${bundleExecution.id} started successfully`);
      return bundleExecution.id;

    } catch (error) {
      console.error('❌ Bundle execution failed during setup:', error);
      throw new Error(`Bundle execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateAndPrepareBunde(config: BundleExecutionConfig): Promise<LaunchPlan> {
    // Validate launch plan exists
    const launchPlan = await this.storage.getLaunchPlan(config.launchPlanId);
    if (!launchPlan) {
      throw new Error(`Launch plan ${config.launchPlanId} not found`);
    }

    // Validate launch plan status
    if (launchPlan.status !== 'ready') {
      throw new Error(`Launch plan ${config.launchPlanId} is not ready for execution`);
    }

    // Validate transaction parameters
    this.validateTransactionParameters(config);

    // Check blockchain health
    const healthCheck = await this.bscClient.healthCheck();
    if (!healthCheck.healthy) {
      throw new Error(`Blockchain client unhealthy: ${healthCheck.error}`);
    }

    console.log('✅ Bundle validation completed');
    return launchPlan;
  }

  private validateTransactionParameters(config: BundleExecutionConfig): void {
    const { transactionType, parameters } = config;

    switch (transactionType) {
      case 'transfer':
        if (!parameters.recipient || !parameters.amount) {
          throw new Error('Transfer requires recipient and amount parameters');
        }
        break;
      case 'token_creation':
        if (!parameters.tokenAddress) {
          throw new Error('Token creation requires tokenAddress parameter');
        }
        break;
      case 'liquidity_addition':
        if (!parameters.tokenAddress || !parameters.amount) {
          throw new Error('Liquidity addition requires tokenAddress and amount parameters');
        }
        break;
      case 'swap':
        if (!parameters.tokenAddress || !parameters.amount) {
          throw new Error('Swap requires tokenAddress and amount parameters');
        }
        break;
      default:
        throw new Error(`Invalid transaction type: ${transactionType}`);
    }
  }

  private async selectAndValidateWallets(config: BundleExecutionConfig): Promise<Wallet[]> {
    let wallets: Wallet[];

    if (config.selectedWalletIds && config.selectedWalletIds.length > 0) {
      // Use specified wallets
      wallets = await Promise.all(
        config.selectedWalletIds.map(id => this.storage.getWallet(id))
      );
      wallets = wallets.filter(Boolean) as Wallet[];
    } else {
      // Use all idle wallets
      wallets = await this.storage.getWalletsByStatus('idle');
    }

    if (wallets.length === 0) {
      throw new Error('No wallets available for execution');
    }

    // Validate wallet health and balances
    const validWallets: Wallet[] = [];
    for (const wallet of wallets) {
      try {
        // Check wallet health
        if (wallet.health === 'critical' || wallet.health === 'offline') {
          console.warn(`⚠️ Skipping unhealthy wallet: ${wallet.address}`);
          continue;
        }

        // Check balance
        const balance = await this.bscClient.getBalance(wallet.address);
        const balanceNum = parseFloat(balance);
        
        if (balanceNum < 0.001) { // Minimum 0.001 BNB for gas
          console.warn(`⚠️ Skipping wallet with insufficient balance: ${wallet.address}`);
          continue;
        }

        validWallets.push(wallet);
      } catch (error) {
        console.error(`❌ Error validating wallet ${wallet.address}:`, error);
      }
    }

    if (validWallets.length === 0) {
      throw new Error('No valid wallets available for execution');
    }

    console.log(`✅ Selected ${validWallets.length} valid wallets for execution`);
    return validWallets;
  }

  private async createBundleExecution(
    launchPlan: LaunchPlan,
    wallets: Wallet[],
    config: BundleExecutionConfig
  ): Promise<BundleExecution> {
    const bundleExecution = await this.storage.createBundleExecution({
      launchPlanId: launchPlan.id,
      status: 'pending',
      totalWallets: wallets.length,
      completedWallets: 0,
      failedWallets: 0,
      progressPercentage: '0.00',
    });

    // Create activity record
    await this.storage.createActivity({
      type: 'bundle_execution',
      description: `Bundle execution started: ${wallets.length} wallets, ${config.executionMode} mode`,
      status: 'pending',
    });

    console.log(`📋 Bundle execution ${bundleExecution.id} created`);
    return bundleExecution;
  }

  private async generateStealthExecutionPlan(wallets: Wallet[], config: BundleExecutionConfig) {
    // Apply custom stealth configuration if provided
    if (config.stealthConfig) {
      const currentConfig = this.stealthPatterns.getConfig();
      this.stealthPatterns.updateConfig({
        ...currentConfig,
        delayRange: config.stealthConfig.customDelayRange || currentConfig.delayRange,
        walletShuffling: {
          ...currentConfig.walletShuffling,
          enabled: config.stealthConfig.enableWalletShuffling ?? currentConfig.walletShuffling.enabled,
        },
        proxyRotation: {
          ...currentConfig.proxyRotation,
          enabled: config.stealthConfig.enableProxyRotation ?? currentConfig.proxyRotation.enabled,
        },
      });
    }

    const executionPlan = await this.stealthPatterns.generateExecutionPlan(wallets);
    
    // Generate stealth analytics
    const analytics = this.stealthPatterns.generateStealthAnalytics(executionPlan);
    console.log(`🕵️ Stealth level: ${analytics.estimatedStealthLevel}%`);
    
    return executionPlan;
  }

  private initializeMonitoring(bundleExecutionId: string): void {
    const monitor: BundleMonitor = {
      bundleExecutionId,
      startTime: Date.now(),
      lastUpdate: Date.now(),
    };

    this.activeExecutions.set(bundleExecutionId, monitor);
    console.log(`👁️ Monitoring initialized for bundle ${bundleExecutionId}`);
  }

  private async executeWithJobQueue(
    bundleExecutionId: string,
    executionPlan: any,
    config: BundleExecutionConfig
  ): Promise<void> {
    // Update execution plan with transaction-specific options
    for (const walletPlan of executionPlan.wallets) {
      walletPlan.transactionOptions = this.buildTransactionOptions(config);
    }

    // Execute bundle using job queue
    await this.jobQueue.executeBundleWithStealth(
      bundleExecutionId,
      executionPlan,
      config.executionMode
    );

    // Update bundle status
    await this.storage.updateBundleExecution(bundleExecutionId, {
      status: 'executing',
      startedAt: new Date(),
    });
  }

  private buildTransactionOptions(config: BundleExecutionConfig) {
    const { transactionType, parameters } = config;

    return {
      type: transactionType,
      to: parameters.recipient || parameters.tokenAddress,
      value: parameters.amount || '0',
      gasLimit: parameters.gasLimit,
      gasPrice: parameters.gasPrice,
      data: this.buildTransactionData(transactionType, parameters),
    };
  }

  private buildTransactionData(transactionType: string, parameters: any): string | undefined {
    // Build transaction data based on type
    switch (transactionType) {
      case 'transfer':
        return undefined; // Simple transfer doesn't need data
      case 'token_creation':
        // Would include token creation contract call data
        return '0x'; // Placeholder
      case 'liquidity_addition':
        // Would include DEX liquidity addition call data
        return '0x'; // Placeholder
      case 'swap':
        // Would include DEX swap call data
        return '0x'; // Placeholder
      default:
        return undefined;
    }
  }

  private async startRealTimeAnalytics(bundleExecutionId: string): Promise<void> {
    // Start periodic analytics updates
    const analyticsInterval = setInterval(async () => {
      try {
        await this.updateBundleAnalytics(bundleExecutionId);
      } catch (error) {
        console.error('Analytics update failed:', error);
      }
    }, 10000); // Update every 10 seconds

    // Store interval for cleanup
    const monitor = this.activeExecutions.get(bundleExecutionId);
    if (monitor) {
      (monitor as any).analyticsInterval = analyticsInterval;
    }
  }

  private async updateBundleAnalytics(bundleExecutionId: string): Promise<void> {
    try {
      const bundleTransactions = await this.storage.getBundleTransactionsByBundleId(bundleExecutionId);
      
      if (bundleTransactions.length === 0) return;

      const completed = bundleTransactions.filter(tx => tx.status === 'confirmed');
      const failed = bundleTransactions.filter(tx => tx.status === 'failed');

      // Calculate analytics
      const totalGasUsed = completed.reduce((sum, tx) => sum + (tx.gasUsed || 0), 0);
      const avgGasPrice = completed.length > 0 
        ? completed.reduce((sum, tx) => sum + parseFloat(tx.gasPrice || '0'), 0) / completed.length
        : 0;
      const successRate = bundleTransactions.length > 0 
        ? (completed.length / bundleTransactions.length) * 100 
        : 0;

      // Update or create analytics record
      await this.storage.aggregateBundleAnalytics(bundleExecutionId, 'real_time');

    } catch (error) {
      console.error('Failed to update bundle analytics:', error);
    }
  }

  // Event Handlers
  private async handleJobCompleted(data: any): Promise<void> {
    const { job, result } = data;
    console.log(`✅ Job completed for wallet ${job.wallet.address}`);

    // Update real-time progress
    await this.updateRealTimeProgress(job.bundleExecutionId);
    
    // Broadcast WebSocket update
    const webSocketService = (global as any).webSocketService;
    if (webSocketService) {
      webSocketService.broadcastBundleExecutionUpdate({
        bundleExecutionId: job.bundleExecutionId,
        status: 'transaction_completed',
        walletAddress: job.wallet.address,
        transactionHash: result.transactionResult?.hash,
        progress: await this.getBundleProgress(job.bundleExecutionId),
      });
    }
    
    this.emit('transactionCompleted', {
      bundleExecutionId: job.bundleExecutionId,
      walletAddress: job.wallet.address,
      transactionHash: result.transactionResult?.hash,
    });
  }

  private async handleJobFailed(data: any): Promise<void> {
    const { job, error } = data;
    console.error(`❌ Job failed for wallet ${job.wallet.address}: ${error}`);

    // Update real-time progress
    await this.updateRealTimeProgress(job.bundleExecutionId);
    
    // Broadcast WebSocket error
    const webSocketService = (global as any).webSocketService;
    if (webSocketService) {
      webSocketService.broadcastBundleExecutionUpdate({
        bundleExecutionId: job.bundleExecutionId,
        status: 'transaction_failed',
        walletAddress: job.wallet.address,
        error,
        progress: await this.getBundleProgress(job.bundleExecutionId),
      });
    }
    
    this.emit('transactionFailed', {
      bundleExecutionId: job.bundleExecutionId,
      walletAddress: job.wallet.address,
      error,
    });
  }

  private async handleBundleProgress(data: any): Promise<void> {
    const { bundleExecutionId, completed, failed, total, progressPercentage } = data;
    
    const monitor = this.activeExecutions.get(bundleExecutionId);
    if (monitor) {
      monitor.lastUpdate = Date.now();
      
      if (monitor.progressCallback) {
        const progress: BundleProgress = {
          bundleExecutionId,
          status: 'executing',
          progressPercentage,
          completedTransactions: completed,
          failedTransactions: failed,
          totalTransactions: total,
          currentPhase: 'transaction_execution',
          recentActivity: [], // Would be populated with recent transaction updates
        };
        
        monitor.progressCallback(progress);
      }
    }

    this.emit('bundleProgress', data);
  }

  private async handleBundleCompleted(data: any): Promise<void> {
    const { bundleExecutionId, status, completed, failed, total } = data;
    
    console.log(`🏁 Bundle ${bundleExecutionId} completed: ${completed}/${total} successful`);

    // Generate final execution result
    const result = await this.generateExecutionResult(bundleExecutionId, status, completed, failed, total);
    
    // Store in history
    this.executionHistory.set(bundleExecutionId, result);
    
    // Cleanup monitoring
    const monitor = this.activeExecutions.get(bundleExecutionId);
    if (monitor) {
      if ((monitor as any).analyticsInterval) {
        clearInterval((monitor as any).analyticsInterval);
      }
      
      if (monitor.completionCallback) {
        monitor.completionCallback(result);
      }
      
      this.activeExecutions.delete(bundleExecutionId);
    }

    this.emit('bundleCompleted', result);
  }

  private async handleTransactionUpdate(data: any): Promise<void> {
    const { hash, receipt, confirmations, status } = data;
    
    // Find the bundle transaction and update it
    // This would be implemented to update specific transaction records
    
    this.emit('transactionUpdate', data);
  }

  private async updateRealTimeProgress(bundleExecutionId: string): Promise<void> {
    try {
      const bundleTransactions = await this.storage.getBundleTransactionsByBundleId(bundleExecutionId);
      const completed = bundleTransactions.filter(tx => tx.status === 'confirmed').length;
      const failed = bundleTransactions.filter(tx => tx.status === 'failed').length;
      const total = bundleTransactions.length;
      const progressPercentage = total > 0 ? ((completed + failed) / total) * 100 : 0;

      await this.storage.updateBundleExecution(bundleExecutionId, {
        completedWallets: completed,
        failedWallets: failed,
        progressPercentage: progressPercentage.toFixed(2),
      });

    } catch (error) {
      console.error('Failed to update real-time progress:', error);
    }
  }

  private async generateExecutionResult(
    bundleExecutionId: string,
    status: string,
    completed: number,
    failed: number,
    total: number
  ): Promise<ExecutionResult> {
    const monitor = this.activeExecutions.get(bundleExecutionId);
    const executionTime = monitor ? Date.now() - monitor.startTime : 0;
    
    const bundleTransactions = await this.storage.getBundleTransactionsByBundleId(bundleExecutionId);
    
    // Calculate analytics
    const completedTxs = bundleTransactions.filter(tx => tx.status === 'confirmed');
    const totalGasUsed = completedTxs.reduce((sum, tx) => sum + (tx.gasUsed || 0), 0);
    const avgGasPrice = completedTxs.length > 0 
      ? completedTxs.reduce((sum, tx) => sum + parseFloat(tx.gasPrice || '0'), 0) / completedTxs.length
      : 0;

    return {
      bundleExecutionId,
      status: failed === 0 ? 'success' : failed < total ? 'partial' : 'failed',
      summary: {
        total,
        completed,
        failed,
        progressPercentage: ((completed + failed) / total) * 100,
      },
      analytics: {
        executionTime,
        averageGasPrice: avgGasPrice.toString(),
        totalGasUsed: totalGasUsed.toString(),
        successRate: (completed / total) * 100,
        stealthScore: 85, // Would be calculated based on actual stealth metrics
      },
      transactions: bundleTransactions,
    };
  }

  // Public Control Methods
  async pauseBundle(bundleExecutionId: string): Promise<void> {
    await this.jobQueue.pauseBundle(bundleExecutionId);
    this.emit('bundlePaused', { bundleExecutionId });
  }

  async resumeBundle(bundleExecutionId: string): Promise<void> {
    await this.jobQueue.resumeBundle(bundleExecutionId);
    this.emit('bundleResumed', { bundleExecutionId });
  }

  async cancelBundle(bundleExecutionId: string): Promise<void> {
    await this.jobQueue.cancelBundle(bundleExecutionId);
    this.emit('bundleCancelled', { bundleExecutionId });
  }

  // Status and Monitoring Methods
  async getBundleProgress(bundleExecutionId: string): Promise<BundleProgress | null> {
    const monitor = this.activeExecutions.get(bundleExecutionId);
    if (!monitor) return null;

    const bundleExecution = await this.storage.getBundleExecution(bundleExecutionId);
    if (!bundleExecution) return null;

    const bundleTransactions = await this.storage.getBundleTransactionsByBundleId(bundleExecutionId);
    
    return {
      bundleExecutionId,
      status: bundleExecution.status,
      progressPercentage: parseFloat(bundleExecution.progressPercentage),
      completedTransactions: bundleExecution.completedWallets,
      failedTransactions: bundleExecution.failedWallets,
      totalTransactions: bundleExecution.totalWallets,
      currentPhase: this.getCurrentPhase(bundleExecution.status),
      estimatedTimeRemaining: this.estimateTimeRemaining(monitor, bundleExecution),
      recentActivity: await this.getRecentActivity(bundleExecutionId),
    };
  }

  private getCurrentPhase(status: string): string {
    switch (status) {
      case 'pending': return 'preparation';
      case 'executing': return 'transaction_execution';
      case 'completed': return 'completed';
      case 'failed': return 'failed';
      default: return 'unknown';
    }
  }

  private estimateTimeRemaining(monitor: BundleMonitor, bundleExecution: BundleExecution): number | undefined {
    const elapsed = Date.now() - monitor.startTime;
    const progress = parseFloat(bundleExecution.progressPercentage) / 100;
    
    if (progress > 0.1) { // Only estimate after 10% progress
      const estimatedTotal = elapsed / progress;
      return Math.max(0, estimatedTotal - elapsed);
    }
    
    return undefined;
  }

  private async getRecentActivity(bundleExecutionId: string): Promise<BundleProgress['recentActivity']> {
    // Get recent transaction events
    const bundleTransactions = await this.storage.getBundleTransactionsByBundleId(bundleExecutionId);
    const recentActivity: BundleProgress['recentActivity'] = [];
    
    // Sort by most recent and take last 10
    const sortedTransactions = bundleTransactions
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10);

    for (const tx of sortedTransactions) {
      recentActivity.push({
        timestamp: new Date(tx.updatedAt).getTime(),
        description: `Transaction ${tx.status}`,
        transactionHash: tx.transactionHash || undefined,
        walletAddress: tx.fromAddress,
      });
    }

    return recentActivity;
  }

  async getExecutionHistory(): Promise<ExecutionResult[]> {
    return Array.from(this.executionHistory.values());
  }

  async getActiveExecutions(): Promise<string[]> {
    return Array.from(this.activeExecutions.keys());
  }

  async cleanup(): Promise<void> {
    // Clean up all active monitoring
    for (const [bundleId, monitor] of this.activeExecutions) {
      if ((monitor as any).analyticsInterval) {
        clearInterval((monitor as any).analyticsInterval);
      }
    }
    
    this.activeExecutions.clear();
    this.executionHistory.clear();
    
    console.log('🧹 Bundle Executor cleaned up');
  }
}

// Factory function
export function createBundleExecutor(
  storage: DbStorage,
  bscClient: BSCClient,
  stealthPatterns: StealthPatterns,
  jobQueue: BundleJobQueue,
  proxyService: ProxyService
): BundleExecutor {
  return new BundleExecutor(storage, bscClient, stealthPatterns, jobQueue, proxyService);
}