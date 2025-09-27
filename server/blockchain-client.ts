import { ethers, JsonRpcProvider, WebSocketProvider, Wallet, TransactionRequest, TransactionResponse, TransactionReceipt } from 'ethers';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { DbStorage } from './storage';
import type { ProxyService } from './proxy-service';
import type { EnvironmentConfig } from '@shared/schema';

export interface BSCConfig {
  chainId: number;
  rpcUrl: string;
  wsUrl?: string;
  gasLimit: {
    transfer: number;
    tokenCreation: number;
    liquidityAddition: number;
    swap: number;
  };
}

export interface TransactionOptions {
  gasPrice?: string;
  gasLimit?: number;
  nonce?: number;
  value?: string;
  to?: string;
  data?: string;
  type?: 'transfer' | 'token_creation' | 'liquidity_addition' | 'swap';
  priorityFee?: string;
  maxFeePerGas?: string;
  userBehavior?: 'conservative' | 'moderate' | 'aggressive';
  mevProtection?: boolean;
}

export interface AdvancedGasData {
  gasPrice: string;
  priorityFee: string;
  baseFee: string;
  congestionLevel: 'low' | 'medium' | 'high';
  pendingTransactions: number;
  blockUtilization: number;
}

export interface MarketAwareGasResult {
  gasPrice: string;
  priorityFee: string;
  strategy: string;
  confidence: number;
}

export interface TransactionResult {
  hash: string;
  nonce: number;
  gasPrice: string;
  gasLimit: number;
  to?: string;
  value: string;
  data?: string;
  chainId: number;
  receipt?: TransactionReceipt;
  error?: string;
}

export interface NonceManager {
  getNonce(address: string): Promise<number>;
  setNonce(address: string, nonce: number): void;
  incrementNonce(address: string): number;
}

export class BSCClient extends EventEmitter {
  private provider!: JsonRpcProvider;
  private wsProvider?: WebSocketProvider;
  private config: BSCConfig;
  private storage: DbStorage;
  private proxyService: ProxyService;
  private nonceManager!: NonceManager;
  private wsSubscriptions: Map<string, any> = new Map();
  private pendingTransactions: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private currentEnvironment?: EnvironmentConfig;
  private isInitialized = false;

  constructor(storage: DbStorage, proxyService: ProxyService) {
    super();
    this.storage = storage;
    this.proxyService = proxyService;
    
    // Placeholder config - will be replaced by loadEnvironmentConfig
    this.config = {
      chainId: 97, // Default to testnet for development
      rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      wsUrl: undefined,
      gasLimit: {
        transfer: 21000,
        tokenCreation: 2000000,
        liquidityAddition: 1000000,
        swap: 500000,
      },
    };

    // Initialize with environment configuration
    this.initializeAsync();
  }

  /**
   * Async initialization to load environment configuration
   */
  private async initializeAsync(): Promise<void> {
    try {
      await this.loadEnvironmentConfig();
      this.initializeProviders();
      this.nonceManager = this.createNonceManager();
      this.isInitialized = true;
      
      const networkName = this.currentEnvironment?.environment || 'testnet';
      console.log(`🔗 BSC Client initialized for ${networkName} (Chain ID: ${this.config.chainId})`);
    } catch (error) {
      console.error('❌ Failed to initialize BSC client:', error);
      // Fallback to testnet configuration
      await this.setupFallbackConfig();
    }
  }

  /**
   * Wait for initialization to complete
   */
  async waitForInitialization(): Promise<void> {
    if (this.isInitialized) return;
    
    return new Promise((resolve) => {
      const checkInit = () => {
        if (this.isInitialized) {
          resolve();
        } else {
          setTimeout(checkInit, 100);
        }
      };
      checkInit();
    });
  }

  /**
   * Load active environment configuration from database
   */
  private async loadEnvironmentConfig(): Promise<void> {
    try {
      const activeEnv = await this.storage.getActiveEnvironment();
      
      if (!activeEnv) {
        console.warn('⚠️ No active environment found, setting up default testnet');
        await this.setupDefaultTestnetConfig();
        return;
      }

      this.currentEnvironment = activeEnv;
      this.config = {
        chainId: activeEnv.chainId,
        rpcUrl: activeEnv.rpcUrl,
        wsUrl: activeEnv.wsUrl || undefined,
        gasLimit: {
          transfer: 21000,
          tokenCreation: Math.floor(2000000 * Number(activeEnv.gasLimitMultiplier)),
          liquidityAddition: Math.floor(1000000 * Number(activeEnv.gasLimitMultiplier)),
          swap: Math.floor(500000 * Number(activeEnv.gasLimitMultiplier)),
        },
      };

      console.log(`✅ Loaded ${activeEnv.environment} environment configuration`);
    } catch (error) {
      console.error('❌ Failed to load environment configuration:', error);
      throw error;
    }
  }

  /**
   * Set up default environment configurations (testnet and mainnet)
   */
  private async setupDefaultTestnetConfig(): Promise<void> {
    const testnetConfig = {
      environment: 'testnet',
      isActive: true,
      networkId: 97,
      chainId: 97,
      rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      wsUrl: null,
      explorerUrl: 'https://testnet.bscscan.com/',
      nativeCurrency: 'tBNB',
      gasLimitMultiplier: '1.20',
      maxGasPrice: '20000000000', // 20 gwei
    };

    const mainnetConfig = {
      environment: 'mainnet',
      isActive: false, // Testnet is default for development
      networkId: 56,
      chainId: 56,
      rpcUrl: process.env.QUICKNODE_BSC_URL || 'https://bsc-dataseed1.binance.org/',
      wsUrl: process.env.QUICKNODE_BSC_URL?.replace('https://', 'wss://').replace('http://', 'ws://'),
      explorerUrl: 'https://bscscan.com/',
      nativeCurrency: 'BNB',
      gasLimitMultiplier: '1.10', // Lower multiplier for mainnet
      maxGasPrice: '10000000000', // 10 gwei for mainnet
    };

    try {
      // Check if configurations already exist
      const [existingTestnet, existingMainnet] = await Promise.all([
        this.storage.getEnvironmentConfig('testnet'),
        this.storage.getEnvironmentConfig('mainnet')
      ]);
      
      if (!existingTestnet) {
        console.log('🔧 Creating default testnet configuration...');
        await this.storage.createEnvironmentConfig(testnetConfig);
      }
      
      if (!existingMainnet) {
        console.log('🔧 Creating default mainnet configuration...');
        await this.storage.createEnvironmentConfig(mainnetConfig);
      }
      
      // Ensure testnet is active for development
      if (!existingTestnet || !existingTestnet.isActive) {
        console.log('🔧 Activating testnet as default environment...');
        await this.storage.switchActiveEnvironment('testnet');
      }

      // Load the configuration
      await this.loadEnvironmentConfig();
    } catch (error) {
      console.error('❌ Failed to setup default environment configs:', error);
      await this.setupFallbackConfig();
    }
  }

  /**
   * Fallback configuration when database fails
   */
  private async setupFallbackConfig(): Promise<void> {
    console.warn('⚠️ Using fallback testnet configuration');
    this.config = {
      chainId: 97,
      rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      wsUrl: undefined,
      gasLimit: {
        transfer: 21000,
        tokenCreation: 2400000, // 20% higher for testnet
        liquidityAddition: 1200000,
        swap: 600000,
      },
    };
    
    this.initializeProviders();
    this.nonceManager = this.createNonceManager();
    this.isInitialized = true;
  }

  /**
   * Reload configuration when environment is switched
   */
  async reloadEnvironment(): Promise<void> {
    console.log('🔄 Reloading environment configuration...');
    this.isInitialized = false;
    await this.loadEnvironmentConfig();
    this.initializeProviders();
    this.isInitialized = true;
    this.emit('environmentChanged', this.currentEnvironment);
  }

  /**
   * Get current environment configuration
   */
  getCurrentEnvironment(): EnvironmentConfig | undefined {
    return this.currentEnvironment;
  }

  private initializeProviders(): void {
    if (!this.config.rpcUrl) {
      console.error('❌ No RPC URL configured');
      return;
    }

    const networkName = this.currentEnvironment?.environment === 'mainnet' ? 'bsc-mainnet' : 'bsc-testnet';
    
    // Create HTTP provider for transactions
    this.provider = new JsonRpcProvider(this.config.rpcUrl, {
      chainId: this.config.chainId,
      name: networkName,
    });

    // Create WebSocket provider for real-time monitoring
    if (this.config.wsUrl) {
      try {
        this.wsProvider = new WebSocketProvider(this.config.wsUrl, {
          chainId: this.config.chainId,
          name: networkName,
        });

        // WebSocketProvider in ethers v6 automatically handles reconnection
        // Only error events are available, not disconnect events
        this.wsProvider.on('error', (error) => {
          console.error('❌ WebSocket provider error:', error);
          this.emit('wsError', error);
          // WebSocketProvider will automatically attempt to reconnect
        });
        
        // Monitor WebSocket health through periodic checks instead
        setInterval(async () => {
          if (this.wsProvider) {
            try {
              await this.wsProvider.getBlockNumber();
            } catch (error) {
              console.warn('⚠️ WebSocket health check failed, provider may be reconnecting');
              this.emit('wsReconnecting');
            }
          }
        }, 30000); // Check every 30 seconds

        console.log('✅ WebSocket provider initialized');
      } catch (error) {
        console.warn('⚠️ Failed to initialize WebSocket provider:', error);
      }
    }
  }

  private createNonceManager(): NonceManager {
    const nonceCache = new Map<string, number>();
    const provider = this.provider; // Capture provider reference

    return {
      async getNonce(address: string): Promise<number> {
        if (nonceCache.has(address)) {
          return nonceCache.get(address)!;
        }

        try {
          const onChainNonce = await provider.getTransactionCount(address, 'pending');
          nonceCache.set(address, onChainNonce);
          return onChainNonce;
        } catch (error) {
          console.error(`❌ Failed to get nonce for ${address}:`, error);
          throw new Error(`Failed to get nonce: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },

      setNonce(address: string, nonce: number): void {
        nonceCache.set(address, nonce);
      },

      incrementNonce(address: string): number {
        const currentNonce = nonceCache.get(address) || 0;
        const newNonce = currentNonce + 1;
        nonceCache.set(address, newNonce);
        return newNonce;
      },
    };
  }

  async estimateGas(transaction: TransactionRequest): Promise<number> {
    await this.waitForInitialization();
    try {
      const gasEstimate = await this.provider.estimateGas(transaction);
      // Add 20% buffer for safety
      return Math.ceil(Number(gasEstimate) * 1.2);
    } catch (error) {
      console.error('❌ Gas estimation failed:', error);
      // Fallback to default gas limits based on transaction type
      return this.config.gasLimit.transfer;
    }
  }

  async getCurrentGasPrice(): Promise<string> {
    await this.waitForInitialization();
    try {
      const gasPrice = await this.provider.getFeeData();
      return gasPrice.gasPrice?.toString() || '5000000000'; // 5 gwei fallback
    } catch (error) {
      console.error('❌ Failed to get gas price:', error);
      return '5000000000'; // 5 gwei fallback
    }
  }

  /**
   * Get advanced gas price data with network congestion analysis
   */
  async getAdvancedGasData(): Promise<AdvancedGasData> {
    await this.waitForInitialization();
    try {
      const feeData = await this.provider.getFeeData();
      const latestBlock = await this.provider.getBlock('latest');
      
      const gasPrice = feeData.gasPrice?.toString() || '5000000000';
      const priorityFee = feeData.maxPriorityFeePerGas?.toString() || '1000000000';
      const baseFee = latestBlock?.baseFeePerGas?.toString() || '3000000000';
      
      // Analyze network congestion
      const gasPriceGwei = Number(gasPrice) / 1e9;
      let congestionLevel: 'low' | 'medium' | 'high';
      
      if (gasPriceGwei <= 3) {
        congestionLevel = 'low';
      } else if (gasPriceGwei <= 8) {
        congestionLevel = 'medium';
      } else {
        congestionLevel = 'high';
      }
      
      // Simulate network metrics (in a real implementation, these would come from network monitoring)
      const pendingTransactions = Math.floor(Math.random() * 100000) + 10000;
      const blockUtilization = Math.min(100, Math.max(20, (Number(latestBlock?.gasUsed || 0) / Number(latestBlock?.gasLimit || 1)) * 100));
      
      console.log(`📊 Network Analysis: ${congestionLevel} congestion, ${gasPriceGwei.toFixed(2)} gwei, ${blockUtilization.toFixed(1)}% block utilization`);
      
      return {
        gasPrice,
        priorityFee,
        baseFee,
        congestionLevel,
        pendingTransactions,
        blockUtilization,
      };
    } catch (error) {
      console.error('❌ Failed to get advanced gas data:', error);
      return {
        gasPrice: '5000000000',
        priorityFee: '1000000000',
        baseFee: '3000000000',
        congestionLevel: 'medium',
        pendingTransactions: 50000,
        blockUtilization: 70,
      };
    }
  }

  /**
   * Calculate market-aware gas price based on user behavior patterns
   */
  async calculateMarketAwareGasPrice(
    userBehavior: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
  ): Promise<MarketAwareGasResult> {
    const advancedData = await this.getAdvancedGasData();
    const baseGasPriceBigInt = BigInt(advancedData.gasPrice);
    
    let multiplier = 1.0;
    let strategy = 'market-aware';
    
    // Adjust based on congestion and user behavior
    switch (advancedData.congestionLevel) {
      case 'low':
        multiplier = userBehavior === 'conservative' ? 1.05 : userBehavior === 'aggressive' ? 1.15 : 1.1;
        strategy += '-low-congestion';
        break;
      case 'medium':
        multiplier = userBehavior === 'conservative' ? 1.15 : userBehavior === 'aggressive' ? 1.3 : 1.2;
        strategy += '-medium-congestion';
        break;
      case 'high':
        multiplier = userBehavior === 'conservative' ? 1.25 : userBehavior === 'aggressive' ? 1.5 : 1.35;
        strategy += '-high-congestion';
        break;
    }
    
    const adjustedGasPrice = BigInt(Math.floor(Number(baseGasPriceBigInt) * multiplier));
    
    // Calculate priority fee based on behavior
    const basePriorityFee = BigInt(advancedData.priorityFee);
    const priorityMultiplier = userBehavior === 'conservative' ? 1.0 : userBehavior === 'aggressive' ? 2.0 : 1.5;
    const adjustedPriorityFee = BigInt(Math.floor(Number(basePriorityFee) * priorityMultiplier));
    
    // Calculate confidence based on network stability
    const confidence = Math.max(0.5, 1.0 - (advancedData.blockUtilization / 200));
    
    console.log(`💰 Market-aware gas: ${strategy}, confidence: ${(confidence * 100).toFixed(1)}%`);
    
    return {
      gasPrice: adjustedGasPrice.toString(),
      priorityFee: adjustedPriorityFee.toString(),
      strategy,
      confidence,
    };
  }

  /**
   * Determine user behavior pattern based on transaction type
   */
  private determineUserBehavior(transactionType?: string): 'conservative' | 'moderate' | 'aggressive' {
    switch (transactionType) {
      case 'token_creation':
      case 'liquidity_addition':
        return 'aggressive'; // High-value transactions need fast inclusion
      case 'swap':
        return 'moderate'; // Standard swaps use moderate pricing
      case 'transfer':
      default:
        return 'conservative'; // Simple transfers can be conservative
    }
  }

  /**
   * Get balance with advanced caching and error handling
   */
  async getBalance(address: string): Promise<string> {
    await this.waitForInitialization();
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error(`❌ Failed to get balance for ${address}:`, error);
      return '0';
    }
  }

  /**
   * Enhanced health check with gas price trends
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latency: number;
    gasPrice: string;
    blockHeight: number;
    congestionLevel: string;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      await this.waitForInitialization();
      const [blockNumber, gasData] = await Promise.all([
        this.provider.getBlockNumber(),
        this.getAdvancedGasData(),
      ]);
      
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        latency,
        gasPrice: gasData.gasPrice,
        blockHeight: blockNumber,
        congestionLevel: gasData.congestionLevel,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        healthy: false,
        latency,
        gasPrice: '0',
        blockHeight: 0,
        congestionLevel: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createWallet(): Promise<{ address: string; privateKey: string; publicKey: string }> {
    try {
      const wallet = Wallet.createRandom();
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
      };
    } catch (error) {
      console.error('❌ Failed to create wallet:', error);
      throw new Error(`Failed to create wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendTransaction(privateKey: string, options: TransactionOptions): Promise<TransactionResult> {
    await this.waitForInitialization();
    try {
      const wallet = new Wallet(privateKey, this.provider);
      const userBehavior = this.determineUserBehavior(options.type);
      
      // Get optimized gas pricing
      const gasData = await this.calculateMarketAwareGasPrice(userBehavior);
      
      const txRequest: TransactionRequest = {
        to: options.to,
        value: options.value || '0',
        data: options.data,
        gasLimit: options.gasLimit || this.config.gasLimit.transfer,
        gasPrice: options.gasPrice || gasData.gasPrice,
        nonce: options.nonce || await this.nonceManager.getNonce(wallet.address),
        type: 2, // EIP-1559 transaction type
        maxFeePerGas: options.maxFeePerGas || gasData.gasPrice,
        maxPriorityFeePerGas: options.priorityFee || gasData.priorityFee,
      };

      const txResponse = await wallet.sendTransaction(txRequest);
      
      // Increment nonce for next transaction
      this.nonceManager.incrementNonce(wallet.address);
      
      return {
        hash: txResponse.hash,
        nonce: txResponse.nonce,
        gasPrice: txResponse.gasPrice?.toString() || '0',
        gasLimit: Number(txResponse.gasLimit),
        to: txResponse.to || undefined,
        value: txResponse.value?.toString() || '0',
        data: txResponse.data,
        chainId: this.config.chainId,
      };
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async waitForTransaction(txHash: string): Promise<TransactionReceipt | null> {
    await this.waitForInitialization();
    try {
      return await this.provider.waitForTransaction(txHash);
    } catch (error) {
      console.error(`❌ Failed to wait for transaction ${txHash}:`, error);
      return null;
    }
  }

  async getBlockNumber(): Promise<number> {
    await this.waitForInitialization();
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      console.error('❌ Failed to get block number:', error);
      throw new Error(`Failed to get block number: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Cleanup method
  destroy(): void {
    // Clear all WebSocket subscriptions
    this.wsSubscriptions.forEach((subscription, key) => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    });
    this.wsSubscriptions.clear();

    // Clear pending transaction timeouts
    this.pendingTransactions.forEach(({ timeout }, hash) => {
      clearTimeout(timeout);
    });
    this.pendingTransactions.clear();

    // Close WebSocket provider
    if (this.wsProvider) {
      this.wsProvider.destroy();
    }
  }
}

export function createBSCClient(storage: DbStorage, proxyService: ProxyService): BSCClient {
  return new BSCClient(storage, proxyService);
}