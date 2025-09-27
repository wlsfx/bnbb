import { JsonRpcProvider } from 'ethers';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { EventEmitter } from 'events';

export interface RPCEndpoint {
  url: string;
  priority: number;
  healthy: boolean;
  latency: number;
  failureCount: number;
  lastCheck: Date;
  proxyUrl?: string;
}

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailure?: Date;
  successCount: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialFactor: number;
}

export interface RPCConfig {
  endpoints: RPCEndpoint[];
  retryConfig: RetryConfig;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  healthCheckInterval: number;
  proxyRotationInterval?: number;
}

export class ResilientRPCProvider extends EventEmitter {
  private endpoints: RPCEndpoint[];
  private currentEndpointIndex: number = 0;
  private providers: Map<string, JsonRpcProvider> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private config: RPCConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private proxyRotationTimer?: NodeJS.Timeout;
  private requestIdempotencyCache: Map<string, any> = new Map();

  constructor(config: RPCConfig) {
    super();
    this.config = {
      ...config,
      retryConfig: {
        maxRetries: config.retryConfig?.maxRetries || 3,
        baseDelay: config.retryConfig?.baseDelay || 1000,
        maxDelay: config.retryConfig?.maxDelay || 30000,
        exponentialFactor: config.retryConfig?.exponentialFactor || 2,
      }
    };
    
    this.endpoints = config.endpoints;
    this.initializeProviders();
    this.startHealthChecks();
    
    if (config.proxyRotationInterval) {
      this.startProxyRotation();
    }
    
    console.log('🛡️ Resilient RPC Provider initialized with', this.endpoints.length, 'endpoints');
  }

  private initializeProviders(): void {
    for (const endpoint of this.endpoints) {
      const provider = this.createProvider(endpoint);
      this.providers.set(endpoint.url, provider);
      
      // Initialize circuit breaker for each endpoint
      this.circuitBreakers.set(endpoint.url, {
        status: 'closed',
        failureCount: 0,
        successCount: 0,
      });
    }
  }

  private createProvider(endpoint: RPCEndpoint): JsonRpcProvider {
    const connectionOptions: any = {
      timeout: 30000,
      headers: {
        'User-Agent': this.getRandomUserAgent(),
      },
    };

    // Add proxy support if configured
    if (endpoint.proxyUrl) {
      if (endpoint.proxyUrl.startsWith('socks')) {
        connectionOptions.agent = new SocksProxyAgent(endpoint.proxyUrl);
      } else {
        connectionOptions.agent = new HttpsProxyAgent(endpoint.proxyUrl);
      }
      console.log('🔄 Using proxy for endpoint:', endpoint.url.substring(0, 30) + '...');
    }

    return new JsonRpcProvider(endpoint.url, undefined, connectionOptions);
  }

  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  private async checkEndpointHealth(endpoint: RPCEndpoint): Promise<boolean> {
    try {
      const provider = this.providers.get(endpoint.url);
      if (!provider) return false;

      const startTime = Date.now();
      await provider.getBlockNumber();
      const latency = Date.now() - startTime;

      endpoint.latency = latency;
      endpoint.healthy = true;
      endpoint.failureCount = 0;
      endpoint.lastCheck = new Date();

      // Update circuit breaker
      const breaker = this.circuitBreakers.get(endpoint.url);
      if (breaker) {
        breaker.successCount++;
        if (breaker.status === 'half-open' && breaker.successCount >= 3) {
          breaker.status = 'closed';
          breaker.failureCount = 0;
          console.log('✅ Circuit breaker closed for:', endpoint.url.substring(0, 30) + '...');
        }
      }

      return true;
    } catch (error) {
      endpoint.healthy = false;
      endpoint.failureCount++;
      endpoint.lastCheck = new Date();

      // Update circuit breaker
      const breaker = this.circuitBreakers.get(endpoint.url);
      if (breaker) {
        breaker.failureCount++;
        breaker.lastFailure = new Date();
        
        if (breaker.failureCount >= this.config.circuitBreakerThreshold) {
          breaker.status = 'open';
          console.log('⚠️ Circuit breaker opened for:', endpoint.url.substring(0, 30) + '...');
          
          // Schedule half-open state
          setTimeout(() => {
            breaker.status = 'half-open';
            console.log('🔄 Circuit breaker half-open for:', endpoint.url.substring(0, 30) + '...');
          }, this.config.circuitBreakerTimeout);
        }
      }

      return false;
    }
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      for (const endpoint of this.endpoints) {
        await this.checkEndpointHealth(endpoint);
      }
      
      // Sort endpoints by health and latency
      this.endpoints.sort((a, b) => {
        if (a.healthy !== b.healthy) {
          return a.healthy ? -1 : 1;
        }
        return a.latency - b.latency;
      });
      
      this.emit('healthUpdate', this.getHealthStatus());
    }, this.config.healthCheckInterval || 60000);
  }

  private startProxyRotation(): void {
    if (!this.config.proxyRotationInterval) return;

    this.proxyRotationTimer = setInterval(() => {
      for (const endpoint of this.endpoints) {
        if (endpoint.proxyUrl) {
          // Recreate provider with same proxy to get new connection
          const provider = this.createProvider(endpoint);
          this.providers.set(endpoint.url, provider);
          console.log('🔄 Rotated proxy connection for:', endpoint.url.substring(0, 30) + '...');
        }
      }
    }, this.config.proxyRotationInterval);
  }

  private async executeWithRetry<T>(
    operation: (provider: JsonRpcProvider) => Promise<T>,
    idempotencyKey?: string
  ): Promise<T> {
    // Check idempotency cache
    if (idempotencyKey && this.requestIdempotencyCache.has(idempotencyKey)) {
      console.log('📦 Returning cached result for idempotent request:', idempotencyKey);
      return this.requestIdempotencyCache.get(idempotencyKey);
    }

    let lastError: Error | undefined;
    let delay = this.config.retryConfig.baseDelay;

    for (let attempt = 0; attempt <= this.config.retryConfig.maxRetries; attempt++) {
      // Try each healthy endpoint
      for (const endpoint of this.endpoints) {
        if (!endpoint.healthy) continue;

        const breaker = this.circuitBreakers.get(endpoint.url);
        if (breaker && breaker.status === 'open') continue;

        const provider = this.providers.get(endpoint.url);
        if (!provider) continue;

        try {
          const result = await operation(provider);
          
          // Cache successful idempotent requests
          if (idempotencyKey) {
            this.requestIdempotencyCache.set(idempotencyKey, result);
            
            // Clear cache after 5 minutes
            setTimeout(() => {
              this.requestIdempotencyCache.delete(idempotencyKey);
            }, 5 * 60 * 1000);
          }

          // Update endpoint health
          endpoint.failureCount = 0;
          if (breaker) {
            breaker.successCount++;
          }

          return result;
        } catch (error) {
          lastError = error as Error;
          endpoint.failureCount++;
          
          console.warn(`⚠️ RPC request failed on ${endpoint.url.substring(0, 30)}...:`, error);
          
          if (breaker) {
            breaker.failureCount++;
            breaker.lastFailure = new Date();
            
            if (breaker.failureCount >= this.config.circuitBreakerThreshold) {
              breaker.status = 'open';
              setTimeout(() => {
                breaker.status = 'half-open';
              }, this.config.circuitBreakerTimeout);
            }
          }
        }
      }

      // Exponential backoff
      if (attempt < this.config.retryConfig.maxRetries) {
        console.log(`⏳ Retrying after ${delay}ms (attempt ${attempt + 1}/${this.config.retryConfig.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * this.config.retryConfig.exponentialFactor, this.config.retryConfig.maxDelay);
      }
    }

    throw new Error(`All RPC endpoints failed after ${this.config.retryConfig.maxRetries} retries: ${lastError?.message}`);
  }

  async getBlockNumber(): Promise<number> {
    return this.executeWithRetry(async (provider) => {
      const blockNumber = await provider.getBlockNumber();
      return blockNumber;
    });
  }

  async getGasPrice(): Promise<bigint> {
    return this.executeWithRetry(async (provider) => {
      const feeData = await provider.getFeeData();
      return feeData.gasPrice || BigInt(5000000000); // 5 gwei fallback
    });
  }

  async sendTransaction(signedTx: string, idempotencyKey?: string): Promise<any> {
    return this.executeWithRetry(async (provider) => {
      const response = await provider.broadcastTransaction(signedTx);
      return response;
    }, idempotencyKey);
  }

  async call(transaction: any, idempotencyKey?: string): Promise<string> {
    return this.executeWithRetry(async (provider) => {
      const result = await provider.call(transaction);
      return result;
    }, idempotencyKey);
  }

  async estimateGas(transaction: any): Promise<bigint> {
    return this.executeWithRetry(async (provider) => {
      const gasEstimate = await provider.estimateGas(transaction);
      return gasEstimate;
    });
  }

  getHealthStatus(): {
    healthy: number;
    total: number;
    endpoints: Array<{
      url: string;
      healthy: boolean;
      latency: number;
      circuitBreaker: string;
    }>;
  } {
    const healthy = this.endpoints.filter(e => e.healthy).length;
    
    return {
      healthy,
      total: this.endpoints.length,
      endpoints: this.endpoints.map(e => ({
        url: e.url,
        healthy: e.healthy,
        latency: e.latency,
        circuitBreaker: this.circuitBreakers.get(e.url)?.status || 'unknown',
      })),
    };
  }

  async getCurrentProvider(): Promise<JsonRpcProvider | null> {
    const healthyEndpoint = this.endpoints.find(e => e.healthy);
    if (!healthyEndpoint) return null;
    
    return this.providers.get(healthyEndpoint.url) || null;
  }

  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.proxyRotationTimer) {
      clearInterval(this.proxyRotationTimer);
    }
    this.removeAllListeners();
  }
}

// Factory function to create resilient provider with default BSC configuration
export function createResilientBSCProvider(
  additionalEndpoints?: string[],
  proxyUrls?: string[]
): ResilientRPCProvider {
  // Default BSC RPC endpoints
  const defaultEndpoints = [
    process.env.QUICKNODE_BSC_URL || 'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://bsc-dataseed3.binance.org',
    'https://bsc-dataseed4.binance.org',
    'https://bsc-mainnet.core.chainstack.com',
    'https://bsc-rpc.publicnode.com',
    ...(additionalEndpoints || []),
  ];

  const endpoints: RPCEndpoint[] = defaultEndpoints.map((url, index) => ({
    url,
    priority: index === 0 ? 1 : 2, // Primary endpoint has higher priority
    healthy: true,
    latency: 0,
    failureCount: 0,
    lastCheck: new Date(),
    proxyUrl: proxyUrls?.[index % proxyUrls.length], // Distribute proxies across endpoints
  }));

  return new ResilientRPCProvider({
    endpoints,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      exponentialFactor: 2,
    },
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000,
    healthCheckInterval: 30000,
    proxyRotationInterval: proxyUrls ? 300000 : undefined, // 5 minutes if proxies are configured
  });
}