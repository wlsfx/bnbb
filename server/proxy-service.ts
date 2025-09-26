import { createProxyMiddleware, Options as ProxyOptions } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import { Request, Response, NextFunction } from 'express';
import axiosRetry from 'axios-retry';
import axios, { AxiosInstance } from 'axios';
import type { DbStorage } from './storage';

// Circuit breaker implementation
class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: Date | null = null;
  private status: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 60 seconds
    private successThreshold: number = 2
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.status === 'open') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime.getTime() > this.timeout) {
        this.status = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      if (this.status === 'half-open') {
        this.successThreshold--;
        if (this.successThreshold === 0) {
          this.reset();
        }
      }
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure() {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.failureCount >= this.threshold) {
      this.status = 'open';
      console.log('⚠️ Circuit breaker opened');
    }
  }

  private reset() {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.status = 'closed';
    console.log('✅ Circuit breaker closed');
  }

  getStatus() {
    return {
      status: this.status,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// Request batching implementation
class RequestBatcher {
  private batch: Map<string, Promise<any>> = new Map();
  private batchTimeout: NodeJS.Timeout | null = null;
  
  constructor(
    private batchSize: number = 10,
    private batchDelay: number = 100
  ) {}

  async add<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Check if request already exists
    if (this.batch.has(key)) {
      return this.batch.get(key) as Promise<T>;
    }

    const promise = fn();
    this.batch.set(key, promise);

    // Schedule batch processing
    if (this.batch.size >= this.batchSize) {
      this.processBatch();
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.processBatch(), this.batchDelay);
    }

    return promise;
  }

  private processBatch() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    // Clear batch for next round
    this.batch.clear();
  }
}

// Network health monitoring
class NetworkHealthMonitor {
  private metrics: Map<string, any> = new Map();
  private cache: NodeCache;
  
  constructor(cacheTtl: number = 5) {
    this.cache = new NodeCache({ stdTTL: cacheTtl });
  }

  recordRequest(endpoint: string, latency: number, success: boolean) {
    const key = `health:${endpoint}`;
    let metrics = this.cache.get<any>(key) || {
      totalRequests: 0,
      successfulRequests: 0,
      totalLatency: 0,
      avgLatency: 0,
      successRate: 100,
      lastUpdate: new Date(),
    };

    metrics.totalRequests++;
    if (success) {
      metrics.successfulRequests++;
    }
    metrics.totalLatency += latency;
    metrics.avgLatency = metrics.totalLatency / metrics.totalRequests;
    metrics.successRate = (metrics.successfulRequests / metrics.totalRequests) * 100;
    metrics.lastUpdate = new Date();

    this.cache.set(key, metrics);
  }

  getMetrics(endpoint: string) {
    return this.cache.get(`health:${endpoint}`) || null;
  }

  getAllMetrics() {
    const keys = this.cache.keys();
    const metrics: any = {};
    
    for (const key of keys) {
      if (key.startsWith('health:')) {
        const endpoint = key.replace('health:', '');
        metrics[endpoint] = this.cache.get(key);
      }
    }
    
    return metrics;
  }
}

// Proxy configuration service
export class ProxyService {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private requestBatcher: RequestBatcher;
  private healthMonitor: NetworkHealthMonitor;
  private proxyCache: NodeCache;
  private axiosInstance: AxiosInstance;
  
  constructor(private storage: DbStorage) {
    this.requestBatcher = new RequestBatcher();
    this.healthMonitor = new NetworkHealthMonitor();
    this.proxyCache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache
    
    // Configure axios with retry logic
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'BNB-Smart-Chain-Client/1.0',
      },
    });

    // Add retry logic
    axiosRetry(this.axiosInstance, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status ? error.response.status >= 500 : false);
      },
      onRetry: (retryCount, error, requestConfig) => {
        console.log(`⚠️ Request retry ${retryCount} for ${requestConfig.url}: ${error.message}`);
      },
    });

    // Add request/response interceptors for monitoring
    this.axiosInstance.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        const endTime = Date.now();
        const startTime = response.config.metadata?.startTime || endTime;
        const latency = endTime - startTime;
        
        this.healthMonitor.recordRequest(
          response.config.url || 'unknown',
          latency,
          true
        );
        
        return response;
      },
      (error) => {
        const endTime = Date.now();
        const startTime = error.config?.metadata?.startTime || endTime;
        const latency = endTime - startTime;
        
        this.healthMonitor.recordRequest(
          error.config?.url || 'unknown',
          latency,
          false
        );
        
        return Promise.reject(error);
      }
    );
  }

  // Create rate limiter for wallet operations
  createWalletRateLimiter(requestsPerSecond: number = 10) {
    return rateLimit({
      windowMs: 1000, // 1 second
      max: requestsPerSecond,
      message: 'Too many requests from this wallet',
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request) => {
        return req.headers['x-wallet-id'] as string || req.ip;
      },
      skip: (req: Request) => {
        // Skip rate limiting for health checks and monitoring endpoints
        return req.path === '/health' || req.path.startsWith('/api/metrics');
      },
    });
  }

  // Create global rate limiter
  createGlobalRateLimiter(requestsPerSecond: number = 100) {
    return rateLimit({
      windowMs: 1000, // 1 second
      max: requestsPerSecond,
      message: 'Global rate limit exceeded',
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  // Get proxy configuration from database
  async getActiveProxy(environment: string): Promise<any> {
    const cacheKey = `proxy:${environment}`;
    const cached = this.proxyCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const proxies = await this.storage.getHealthyProxies(environment);
      if (proxies.length > 0) {
        // Select proxy based on priority and current load
        const selectedProxy = proxies.reduce((prev, curr) => {
          if (curr.currentConnections < curr.maxConcurrentConnections) {
            return curr.priority > prev.priority ? curr : prev;
          }
          return prev;
        });

        this.proxyCache.set(cacheKey, selectedProxy);
        return selectedProxy;
      }
    } catch (error) {
      console.error('Failed to get proxy configuration:', error);
    }

    return null;
  }

  // Create proxy middleware for external API calls
  createProxyMiddleware(target: string, pathRewrite?: { [key: string]: string }) {
    const proxyOptions: ProxyOptions = {
      target,
      changeOrigin: true,
      pathRewrite,
      logLevel: 'warn',
      timeout: 30000,
      proxyTimeout: 30000,
      onProxyReq: (proxyReq, req, res) => {
        // Add custom headers for privacy
        proxyReq.setHeader('X-Forwarded-For', '');
        proxyReq.removeHeader('x-real-ip');
        
        // Add timing header
        proxyReq.setHeader('X-Request-Start', Date.now().toString());
      },
      onProxyRes: (proxyRes, req, res) => {
        // Record metrics
        const startTime = parseInt(proxyRes.req.getHeader('X-Request-Start') as string || '0');
        const latency = Date.now() - startTime;
        
        this.healthMonitor.recordRequest(
          target,
          latency,
          proxyRes.statusCode ? proxyRes.statusCode < 400 : false
        );

        // Add security headers
        proxyRes.headers['X-Content-Type-Options'] = 'nosniff';
        proxyRes.headers['X-Frame-Options'] = 'DENY';
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        
        // Get or create circuit breaker for this target
        const breaker = this.getCircuitBreaker(target);
        
        res.writeHead(502, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({
          error: 'Proxy error',
          message: 'Failed to connect to upstream service',
          circuitBreaker: breaker.getStatus(),
        }));
      },
    };

    return createProxyMiddleware(proxyOptions);
  }

  // Get or create circuit breaker for endpoint
  private getCircuitBreaker(endpoint: string): CircuitBreaker {
    if (!this.circuitBreakers.has(endpoint)) {
      this.circuitBreakers.set(endpoint, new CircuitBreaker());
    }
    return this.circuitBreakers.get(endpoint)!;
  }

  // Execute request with circuit breaker
  async executeWithCircuitBreaker<T>(
    endpoint: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(endpoint);
    return breaker.execute(fn);
  }

  // Batch requests
  async batchRequest<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.requestBatcher.add(key, fn);
  }

  // Get network health metrics
  getHealthMetrics() {
    return {
      endpoints: this.healthMonitor.getAllMetrics(),
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([endpoint, breaker]) => ({
        endpoint,
        ...breaker.getStatus(),
      })),
    };
  }

  // Rotate proxy
  async rotateProxy(
    environment: string,
    walletId?: string
  ): Promise<any> {
    try {
      const currentProxy = await this.getActiveProxy(environment);
      const newProxies = await this.storage.getHealthyProxies(environment);
      
      // Filter out current proxy and select next
      const availableProxies = newProxies.filter(p => p.id !== currentProxy?.id);
      if (availableProxies.length > 0) {
        const newProxy = availableProxies[0];
        
        // Log rotation
        if (currentProxy && newProxy) {
          await this.storage.rotateProxy(
            currentProxy.id,
            newProxy.id,
            'scheduled',
            walletId
          );
        }
        
        // Clear cache to force refresh
        this.proxyCache.del(`proxy:${environment}`);
        
        return newProxy;
      }
    } catch (error) {
      console.error('Failed to rotate proxy:', error);
    }
    
    return null;
  }

  // Middleware to add proxy headers
  proxyHeaderMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const environment = process.env.NODE_ENV || 'development';
      const proxy = await this.getActiveProxy(environment);
      
      if (proxy) {
        req.headers['X-Proxy-Id'] = proxy.id;
        req.headers['X-Proxy-Name'] = proxy.name;
      }
      
      next();
    };
  }

  // Get axios instance for making requests
  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }
}

// Export middleware factory functions
export function createProxyService(storage: DbStorage): ProxyService {
  return new ProxyService(storage);
}