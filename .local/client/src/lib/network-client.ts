import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';

// Request deduplication cache
const requestCache = new Map<string, Promise<any>>();
const CACHE_TTL = 5000; // 5 seconds

// Request batching
interface BatchedRequest {
  key: string;
  config: AxiosRequestConfig;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

class RequestBatcher {
  private batch: BatchedRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private batchSize = 10;
  private batchDelay = 100; // ms

  constructor(private axiosInstance: AxiosInstance) {}

  add(key: string, config: AxiosRequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      this.batch.push({ key, config, resolve, reject });

      if (this.batch.length >= this.batchSize) {
        this.processBatch();
      } else if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => this.processBatch(), this.batchDelay);
      }
    });
  }

  private async processBatch() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const currentBatch = [...this.batch];
    this.batch = [];

    // Process requests in parallel
    const promises = currentBatch.map(async (req) => {
      try {
        const response = await this.axiosInstance.request(req.config);
        req.resolve(response);
      } catch (error) {
        req.reject(error);
      }
    });

    await Promise.allSettled(promises);
  }
}

// Network health tracking
interface NetworkMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  successRate: number;
  lastError?: string;
  circuitBreakerStatus: 'closed' | 'open' | 'half-open';
}

class NetworkHealthMonitor {
  private metrics: NetworkMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
    successRate: 100,
    circuitBreakerStatus: 'closed',
  };

  private latencies: number[] = [];
  private maxLatencySamples = 100;
  private listeners: Set<(metrics: NetworkMetrics) => void> = new Set();

  recordRequest(latency: number, success: boolean, error?: string) {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
      if (error) {
        this.metrics.lastError = error;
      }
    }

    // Update latency tracking
    this.latencies.push(latency);
    if (this.latencies.length > this.maxLatencySamples) {
      this.latencies.shift();
    }

    // Calculate metrics
    this.metrics.averageLatency = 
      this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
    
    this.metrics.successRate = 
      (this.metrics.successfulRequests / this.metrics.totalRequests) * 100;

    // Update circuit breaker status based on failure rate
    const recentFailureRate = this.getRecentFailureRate();
    if (recentFailureRate > 50) {
      this.metrics.circuitBreakerStatus = 'open';
    } else if (recentFailureRate > 25) {
      this.metrics.circuitBreakerStatus = 'half-open';
    } else {
      this.metrics.circuitBreakerStatus = 'closed';
    }

    // Notify listeners
    this.notifyListeners();
  }

  private getRecentFailureRate(): number {
    const recentRequests = Math.min(10, this.metrics.totalRequests);
    if (recentRequests === 0) return 0;
    
    const recentFailures = Math.min(
      this.metrics.failedRequests,
      recentRequests * (this.metrics.failedRequests / this.metrics.totalRequests)
    );
    
    return (recentFailures / recentRequests) * 100;
  }

  getMetrics(): NetworkMetrics {
    return { ...this.metrics };
  }

  subscribe(listener: (metrics: NetworkMetrics) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const metrics = this.getMetrics();
    this.listeners.forEach(listener => listener(metrics));
  }

  reset() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      successRate: 100,
      circuitBreakerStatus: 'closed',
    };
    this.latencies = [];
    this.notifyListeners();
  }
}

// Circuit breaker implementation
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private status: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly threshold = 5;
  private readonly timeout = 60000; // 60 seconds
  private readonly halfOpenRequests = 3;
  private halfOpenRequestCount = 0;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.status === 'open') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.timeout) {
        this.status = 'half-open';
        this.halfOpenRequestCount = 0;
      } else {
        throw new Error('Circuit breaker is open - service unavailable');
      }
    }

    if (this.status === 'half-open' && this.halfOpenRequestCount >= this.halfOpenRequests) {
      throw new Error('Circuit breaker is half-open - waiting for test requests');
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordSuccess() {
    if (this.status === 'half-open') {
      this.halfOpenRequestCount++;
      if (this.halfOpenRequestCount >= this.halfOpenRequests) {
        this.reset();
      }
    } else {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  private recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.status = 'open';
      console.warn('Circuit breaker opened due to excessive failures');
    }
  }

  private reset() {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.status = 'closed';
    this.halfOpenRequestCount = 0;
    console.info('Circuit breaker reset to closed');
  }

  getStatus() {
    return this.status;
  }
}

// Enhanced network client with all optimizations
export class NetworkClient {
  private axiosInstance: AxiosInstance;
  private batcher: RequestBatcher;
  private healthMonitor: NetworkHealthMonitor;
  private circuitBreaker: CircuitBreaker;

  constructor(baseURL?: string) {
    this.axiosInstance = axios.create({
      baseURL: baseURL || '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add retry logic with exponential backoff
    axiosRetry(this.axiosInstance, {
      retries: 3,
      retryDelay: (retryCount) => {
        return Math.min(1000 * Math.pow(2, retryCount), 10000);
      },
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status ? error.response.status >= 500 : false);
      },
      onRetry: (retryCount, error) => {
        console.log(`Retry attempt ${retryCount} for request: ${error.config?.url}`);
      },
    });

    // Initialize components
    this.batcher = new RequestBatcher(this.axiosInstance);
    this.healthMonitor = new NetworkHealthMonitor();
    this.circuitBreaker = new CircuitBreaker();

    // Add request/response interceptors
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add timing metadata
        (config as any).metadata = { startTime: Date.now() };
        
        // Add wallet ID if available
        const walletId = localStorage.getItem('activeWalletId');
        if (walletId) {
          config.headers['X-Wallet-Id'] = walletId;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const endTime = Date.now();
        const startTime = (response.config as any).metadata?.startTime || endTime;
        const latency = endTime - startTime;

        // Record metrics
        this.healthMonitor.recordRequest(latency, true);

        return response;
      },
      (error) => {
        const endTime = Date.now();
        const startTime = (error.config as any)?.metadata?.startTime || endTime;
        const latency = endTime - startTime;

        // Record metrics
        this.healthMonitor.recordRequest(
          latency,
          false,
          error.message || 'Unknown error'
        );

        return Promise.reject(error);
      }
    );
  }

  // Make request with deduplication
  async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const cacheKey = this.getCacheKey(config);
    
    // Check if request is already in flight
    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey);
    }

    // Create request promise with circuit breaker
    const requestPromise = this.circuitBreaker.execute(() =>
      this.axiosInstance.request<T>(config)
    );

    // Cache the promise
    requestCache.set(cacheKey, requestPromise);

    // Clear cache after TTL
    setTimeout(() => {
      requestCache.delete(cacheKey);
    }, CACHE_TTL);

    try {
      return await requestPromise;
    } catch (error) {
      requestCache.delete(cacheKey);
      throw error;
    }
  }

  // Batch multiple requests
  async batchRequest<T = any>(key: string, config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.batcher.add(key, config);
  }

  // Convenience methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request({ ...config, method: 'GET', url });
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request({ ...config, method: 'POST', url, data });
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request({ ...config, method: 'PUT', url, data });
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request({ ...config, method: 'DELETE', url });
  }

  // Get network health metrics
  getHealthMetrics(): NetworkMetrics {
    return this.healthMonitor.getMetrics();
  }

  // Subscribe to health updates
  subscribeToHealthUpdates(callback: (metrics: NetworkMetrics) => void): () => void {
    return this.healthMonitor.subscribe(callback);
  }

  // Get circuit breaker status
  getCircuitBreakerStatus(): 'closed' | 'open' | 'half-open' {
    return this.circuitBreaker.getStatus();
  }

  // Reset metrics
  resetMetrics() {
    this.healthMonitor.reset();
  }

  private getCacheKey(config: AxiosRequestConfig): string {
    const { method = 'GET', url, params, data } = config;
    return JSON.stringify({ method, url, params, data });
  }
}

// Export singleton instance
export const networkClient = new NetworkClient();

// Export types
export type { NetworkMetrics };