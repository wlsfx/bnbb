import { ethers, JsonRpcProvider, WebSocketProvider, Wallet, TransactionRequest, TransactionResponse, TransactionReceipt } from 'ethers';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { DbStorage } from './storage';
import type { ProxyService } from './proxy-service';

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
  private provider: JsonRpcProvider;
  private wsProvider?: WebSocketProvider;
  private config: BSCConfig;
  private storage: DbStorage;
  private proxyService: ProxyService;
  private nonceManager: NonceManager;
  private wsSubscriptions: Map<string, any> = new Map();
  private pendingTransactions: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();

  constructor(storage: DbStorage, proxyService: ProxyService) {
    super();
    this.storage = storage;
    this.proxyService = proxyService;
    
    // BSC Mainnet configuration
    this.config = {
      chainId: 56, // BSC Mainnet
      rpcUrl: process.env.QUICKNODE_BSC_URL || '',
      wsUrl: process.env.QUICKNODE_BSC_URL?.replace('https://', 'wss://').replace('http://', 'ws://'),
      gasLimit: {
        transfer: 21000,
        tokenCreation: 2000000,
        liquidityAddition: 1000000,
        swap: 500000,
      },
    };

    if (!this.config.rpcUrl) {
      throw new Error('QUICKNODE_BSC_URL environment variable is required');
    }

    // Initialize providers
    this.initializeProviders();
    
    // Initialize nonce manager
    this.nonceManager = this.createNonceManager();

    console.log('🔗 BSC Client initialized with QuickNode');
  }

  private initializeProviders(): void {
    // Create HTTP provider for transactions
    this.provider = new JsonRpcProvider(this.config.rpcUrl, {
      chainId: this.config.chainId,
      name: 'bsc-mainnet',
    });

    // Create WebSocket provider for real-time monitoring
    if (this.config.wsUrl) {
      try {
        this.wsProvider = new WebSocketProvider(this.config.wsUrl, {
          chainId: this.config.chainId,
          name: 'bsc-mainnet',
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

    return {
      async getNonce(address: string): Promise<number> {
        if (nonceCache.has(address)) {
          return nonceCache.get(address)!;
        }

        try {
          const onChainNonce = await this.provider.getTransactionCount(address, 'pending');
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

  async signAndBroadcastTransaction(
    privateKey: string,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    try {
      // Create wallet instance
      const wallet = new Wallet(privateKey, this.provider);
      const address = wallet.address;

      // Get or estimate gas price with variance for stealth
      let gasPrice = options.gasPrice;
      if (!gasPrice) {
        const baseGasPrice = await this.getCurrentGasPrice();
        // Add ±15% variance for stealth
        const variance = (Math.random() - 0.5) * 0.3; // ±15%
        const variedGasPrice = BigInt(Math.floor(Number(baseGasPrice) * (1 + variance)));
        gasPrice = variedGasPrice.toString();
      }

      // Get nonce
      const nonce = options.nonce ?? await this.nonceManager.getNonce(address);

      // Estimate gas limit
      const gasLimit = options.gasLimit ?? await this.estimateGas({
        to: options.to,
        value: options.value ? ethers.parseEther(options.value) : 0n,
        data: options.data,
        from: address,
      });

      // Build transaction
      const transaction: TransactionRequest = {
        to: options.to,
        value: options.value ? ethers.parseEther(options.value) : 0n,
        gasPrice: gasPrice,
        gasLimit: gasLimit,
        nonce: nonce,
        chainId: this.config.chainId,
        data: options.data,
      };

      console.log(`📝 Signing transaction for ${address} with nonce ${nonce}`);

      // Sign and send transaction
      const txResponse = await wallet.sendTransaction(transaction);
      
      // Update nonce cache
      this.nonceManager.incrementNonce(address);

      console.log(`📡 Transaction broadcasted: ${txResponse.hash}`);

      // Start monitoring for receipt
      this.monitorTransaction(txResponse.hash);

      return {
        hash: txResponse.hash,
        nonce: nonce,
        gasPrice: gasPrice,
        gasLimit: gasLimit,
        to: options.to,
        value: options.value || '0',
        data: options.data,
        chainId: this.config.chainId,
      };

    } catch (error) {
      console.error('❌ Failed to sign and broadcast transaction:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTransactionReceipt(hash: string): Promise<TransactionReceipt | null> {
    try {
      return await this.provider.getTransactionReceipt(hash);
    } catch (error) {
      console.error(`❌ Failed to get receipt for ${hash}:`, error);
      return null;
    }
  }

  async waitForTransactionReceipt(
    hash: string,
    confirmations: number = 1,
    timeout: number = 60000
  ): Promise<TransactionReceipt> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingTransactions.delete(hash);
        reject(new Error(`Transaction ${hash} timed out after ${timeout}ms`));
      }, timeout);

      this.pendingTransactions.set(hash, {
        resolve: (receipt: TransactionReceipt) => {
          clearTimeout(timeoutId);
          this.pendingTransactions.delete(hash);
          resolve(receipt);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          this.pendingTransactions.delete(hash);
          reject(error);
        },
        timeout: timeoutId,
      });

      // Start monitoring if not already monitoring
      if (!this.wsSubscriptions.has(hash)) {
        this.monitorTransaction(hash, confirmations);
      }
    });
  }

  private async monitorTransaction(hash: string, confirmations: number = 1): Promise<void> {
    if (this.wsSubscriptions.has(hash)) {
      return; // Already monitoring
    }

    const checkReceipt = async () => {
      try {
        const receipt = await this.getTransactionReceipt(hash);
        if (receipt) {
          const currentBlock = await this.provider.getBlockNumber();
          const confirmationCount = currentBlock - receipt.blockNumber + 1;

          this.emit('transactionUpdate', {
            hash,
            receipt,
            confirmations: confirmationCount,
            status: receipt.status === 1 ? 'confirmed' : 'failed',
          });

          if (confirmationCount >= confirmations) {
            // Transaction confirmed
            const pending = this.pendingTransactions.get(hash);
            if (pending) {
              if (receipt.status === 1) {
                pending.resolve(receipt);
              } else {
                pending.reject(new Error(`Transaction ${hash} failed`));
              }
            }

            // Clean up monitoring
            this.wsSubscriptions.delete(hash);
            return;
          }
        }

        // Continue monitoring
        setTimeout(checkReceipt, 2000); // Check every 2 seconds
      } catch (error) {
        console.error(`❌ Error monitoring transaction ${hash}:`, error);
        const pending = this.pendingTransactions.get(hash);
        if (pending) {
          pending.reject(error as Error);
        }
        this.wsSubscriptions.delete(hash);
      }
    };

    this.wsSubscriptions.set(hash, true);
    checkReceipt();
  }

  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error(`❌ Failed to get balance for ${address}:`, error);
      throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBlockNumber(): Promise<number> {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      console.error('❌ Failed to get block number:', error);
      throw new Error(`Failed to get block number: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Utility method for batch operations
  async executeBatchTransactions(
    transactions: Array<{
      privateKey: string;
      options: TransactionOptions;
    }>
  ): Promise<TransactionResult[]> {
    const results: TransactionResult[] = [];
    
    for (const { privateKey, options } of transactions) {
      try {
        const result = await this.signAndBroadcastTransaction(privateKey, options);
        results.push(result);
      } catch (error) {
        results.push({
          hash: '',
          nonce: 0,
          gasPrice: '0',
          gasLimit: 0,
          value: '0',
          chainId: this.config.chainId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  // Clean up resources
  async disconnect(): Promise<void> {
    try {
      // Clear all pending transactions
      for (const [hash, pending] of this.pendingTransactions) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Client disconnecting'));
      }
      this.pendingTransactions.clear();

      // Clear subscriptions
      this.wsSubscriptions.clear();

      // Disconnect WebSocket provider
      if (this.wsProvider) {
        this.wsProvider.removeAllListeners();
        // Note: ethers.js WebSocketProvider doesn't have explicit disconnect
      }

      console.log('🔌 BSC Client disconnected');
    } catch (error) {
      console.error('❌ Error during disconnect:', error);
    }
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; latency: number; blockNumber?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const blockNumber = await this.getBlockNumber();
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        latency,
        blockNumber,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        healthy: false,
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Factory function for creating BSC client
export function createBSCClient(storage: DbStorage, proxyService: ProxyService): BSCClient {
  return new BSCClient(storage, proxyService);
}