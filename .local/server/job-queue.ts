import Bull, { Queue, Job, JobOptions } from 'bull';
import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { DbStorage } from './storage';
import type { BSCClient, TransactionOptions, TransactionResult } from './blockchain-client';
import type { StealthPatterns, StealthExecutionPlan } from './stealth-patterns';
import type { Wallet, BundleExecution, BundleTransaction, TRANSACTION_STATUS } from '@shared/schema';

export interface TransactionJob {
  id: string;
  bundleExecutionId: string;
  walletId: string;
  wallet: Wallet;
  transactionOptions: TransactionOptions;
  stealthConfig: {
    delay: number;
    gasMultiplier: number;
    windowIndex: number;
    proxyId?: string;
  };
  metadata: {
    attempt: number;
    maxRetries: number;
    priority: number;
    createdAt: number;
  };
}

export interface JobResult {
  success: boolean;
  transactionResult?: TransactionResult;
  bundleTransactionId?: string;
  error?: string;
  retryable?: boolean;
}

export interface QueueConfig {
  concurrency: {
    parallel: number;    // max parallel jobs
    sequential: number;  // sequential processing rate
  };
  retries: {
    maxAttempts: number;
    backoffMultiplier: number;
    maxDelay: number;
  };
  timeouts: {
    jobTimeout: number;
    stallInterval: number;
    maxStalledCount: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  useInMemoryFallback: boolean;
  enableRedis: boolean;
}

// Interface for queue implementations
export interface IJobQueue {
  add(name: string, data: TransactionJob, options?: any): Promise<void>;
  process(name: string, concurrency: number, processor: (job: any) => Promise<any>): void;
  on(event: string, handler: (...args: any[]) => void): void;
  close(): Promise<void>;
  isReady(): boolean;
}

// In-memory job implementation
class InMemoryJob {
  public id: string;
  public data: TransactionJob;
  public attempts: number = 0;
  public maxAttempts: number;
  public createdAt: number;
  public startedAt?: number;
  public completedAt?: number;
  public failedAt?: number;
  public error?: Error;
  public result?: any;
  public status: 'waiting' | 'active' | 'completed' | 'failed' | 'stalled' = 'waiting';
  private progressValue: number = 0;

  constructor(data: TransactionJob, options: any = {}) {
    this.id = randomUUID();
    this.data = data;
    this.maxAttempts = options.attempts || 3;
    this.createdAt = Date.now();
  }

  async progress(progress: number): Promise<void> {
    this.progressValue = progress;
  }

  getProgress(): number {
    return this.progressValue;
  }
}

// In-memory queue implementation
class InMemoryQueue extends EventEmitter implements IJobQueue {
  private jobs: Map<string, InMemoryJob> = new Map();
  private processors: Map<string, { concurrency: number; processor: Function }> = new Map();
  private activeJobs: Set<string> = new Set();
  private waitingJobs: InMemoryJob[] = [];
  private processingInterval?: NodeJS.Timeout;
  private isProcessing: boolean = false;
  private maxConcurrency: number = 10;

  constructor() {
    super();
    this.startProcessing();
  }

  async add(name: string, data: TransactionJob, options: any = {}): Promise<void> {
    const job = new InMemoryJob(data, options);
    this.jobs.set(job.id, job);
    this.waitingJobs.push(job);
    this.emit('waiting', job.id);
    console.log(`📥 In-memory job ${job.id} added to queue (${name})`);
  }

  process(name: string, concurrency: number, processor: (job: InMemoryJob) => Promise<any>): void {
    this.processors.set(name, { concurrency, processor });
    this.maxConcurrency = Math.max(this.maxConcurrency, concurrency);
  }

  private startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processingInterval = setInterval(async () => {
      await this.processWaitingJobs();
    }, 100);
  }

  private async processWaitingJobs(): Promise<void> {
    if (this.activeJobs.size >= this.maxConcurrency || this.waitingJobs.length === 0) {
      return;
    }

    const job = this.waitingJobs.shift();
    if (!job) return;

    // Find a processor that can handle this job
    for (const [name, { concurrency, processor }] of this.processors) {
      if (this.getActiveJobsForProcessor(name) < concurrency) {
        await this.executeJob(job, processor);
        break;
      }
    }
  }

  private getActiveJobsForProcessor(processorName: string): number {
    // In a real implementation, we'd track which processor is handling which job
    // For simplicity, we'll use a proportion of active jobs
    return Math.floor(this.activeJobs.size / this.processors.size);
  }

  private async executeJob(job: InMemoryJob, processor: Function): Promise<void> {
    job.status = 'active';
    job.startedAt = Date.now();
    this.activeJobs.add(job.id);
    this.emit('active', job);

    try {
      const result = await processor(job);
      job.status = 'completed';
      job.completedAt = Date.now();
      job.result = result;
      this.emit('completed', job, result);
      console.log(`✅ In-memory job ${job.id} completed successfully`);
    } catch (error) {
      job.attempts++;
      job.error = error as Error;
      
      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed';
        job.failedAt = Date.now();
        this.emit('failed', job, error);
        console.error(`❌ In-memory job ${job.id} failed after ${job.attempts} attempts:`, error);
      } else {
        job.status = 'waiting';
        this.waitingJobs.push(job);
        console.log(`🔄 In-memory job ${job.id} retrying (attempt ${job.attempts + 1}/${job.maxAttempts})`);
      }
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  async close(): Promise<void> {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    // Wait for active jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const start = Date.now();
    
    while (this.activeJobs.size > 0 && (Date.now() - start) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.activeJobs.size > 0) {
      console.warn(`⚠️ ${this.activeJobs.size} in-memory jobs still active during shutdown`);
    }
  }

  isReady(): boolean {
    return true; // In-memory queue is always ready
  }

  getStats() {
    return {
      waiting: this.waitingJobs.length,
      active: this.activeJobs.size,
      completed: Array.from(this.jobs.values()).filter(j => j.status === 'completed').length,
      failed: Array.from(this.jobs.values()).filter(j => j.status === 'failed').length,
    };
  }
}

// Redis-based queue wrapper
class RedisQueue extends EventEmitter implements IJobQueue {
  private queue: Queue<TransactionJob>;
  private ready: boolean = false;

  constructor(queueName: string, redisConfig: any, options: any = {}) {
    super();
    
    this.queue = new Bull(queueName, {
      redis: redisConfig,
      defaultJobOptions: options,
    });

    this.queue.on('ready', () => {
      this.ready = true;
      console.log('✅ Redis queue ready');
    });

    this.queue.on('error', (error) => {
      this.ready = false;
      this.emit('error', error);
    });

    // Forward events
    ['completed', 'failed', 'stalled', 'progress', 'waiting', 'active'].forEach(event => {
      this.queue.on(event as any, (...args: any[]) => {
        this.emit(event, ...args);
      });
    });
  }

  async add(name: string, data: TransactionJob, options: any = {}): Promise<void> {
    await this.queue.add(name, data, options);
  }

  process(name: string, concurrency: number, processor: (job: any) => Promise<any>): void {
    this.queue.process(name, concurrency, processor);
  }

  async close(): Promise<void> {
    await this.queue.close();
  }

  isReady(): boolean {
    return this.ready;
  }

  getQueue(): Queue<TransactionJob> {
    return this.queue;
  }
}

export class BundleJobQueue extends EventEmitter {
  private queue: IJobQueue;
  private redis?: Redis;
  private storage: DbStorage;
  private bscClient: BSCClient;
  private stealthPatterns: StealthPatterns;
  private config: QueueConfig;
  private isProcessing: boolean = false;
  private activeJobs: Map<string, any> = new Map();
  private executionMode: 'parallel' | 'sequential' = 'parallel';
  private usingInMemoryFallback: boolean = false;
  private redisConnectionAttempts: number = 0;
  private maxRedisRetries: number = 3;

  constructor(
    storage: DbStorage,
    bscClient: BSCClient,
    stealthPatterns: StealthPatterns,
    config?: Partial<QueueConfig>
  ) {
    super();
    this.storage = storage;
    this.bscClient = bscClient;
    this.stealthPatterns = stealthPatterns;

    // Default configuration with feature flags
    this.config = {
      concurrency: {
        parallel: 5,
        sequential: 1,
      },
      retries: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        maxDelay: 30000, // 30 seconds
      },
      timeouts: {
        jobTimeout: 120000,   // 2 minutes
        stallInterval: 30000,  // 30 seconds
        maxStalledCount: 1,
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
      },
      enableRedis: false, // Temporarily disabled to prevent error floods
      useInMemoryFallback: true, // Force fallback to in-memory queue
      ...config,
    };

    // Initialize queue with fallback logic
    this.initializeQueueWithFallback();

    console.log('🚀 Bundle Job Queue initialized with fallback support');
  }

  private async initializeQueueWithFallback(): Promise<void> {
    if (this.config.enableRedis && !this.usingInMemoryFallback) {
      try {
        await this.initializeRedisQueue();
        console.log('✅ Redis queue initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize Redis queue:', error);
        if (this.config.useInMemoryFallback) {
          console.log('🔄 Falling back to in-memory queue...');
          this.initializeInMemoryQueue();
        } else {
          throw error;
        }
      }
    } else {
      console.log('📋 Initializing in-memory queue (Redis disabled)');
      this.initializeInMemoryQueue();
    }
  }

  private async initializeRedisQueue(): Promise<void> {
    // Circuit breaker: disable Redis if too many failed attempts
    if (this.redisConnectionAttempts >= this.maxRedisRetries) {
      throw new Error('Redis circuit breaker: too many failed connection attempts');
    }

    this.redis = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: this.maxRedisRetries,
      lazyConnect: true,
      connectTimeout: 5000, // 5 second connection timeout
      commandTimeout: 5000, // 5 second command timeout
      enableAutoPipelining: false, // Disable auto pipelining to reduce connection attempts
    });

    // Add error handler before connecting to prevent unhandled errors
    this.redis.on('error', (error) => {
      console.warn('Redis connection error during initialization:', error.message);
      // Don't throw here, let the ping test handle the failure
    });

    // Test Redis connection with timeout
    try {
      await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis ping timeout')), 3000))
      ]);
    } catch (error) {
      // Ensure Redis connection is closed on failure
      try {
        await this.redis.quit();
      } catch (closeError) {
        // Ignore close errors
      }
      throw error;
    }

    this.queue = new RedisQueue('bundle-execution', this.config.redis, {
      removeOnComplete: 50,
      removeOnFail: 100,
      attempts: this.config.retries.maxAttempts,
      backoff: {
        type: 'exponential',
        settings: {
          delay: 2000,
        },
      },
    });

    this.setupRedisEventHandlers();
  }

  private initializeInMemoryQueue(): void {
    this.usingInMemoryFallback = true;
    this.queue = new InMemoryQueue();
    console.log('📋 In-memory job queue initialized');
  }

  private setupRedisEventHandlers(): void {
    if (!this.redis) return;

    this.redis.on('connect', () => {
      console.log('✅ Redis connected for job queue');
      this.redisConnectionAttempts = 0;
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis connection error:', error);
      this.redisConnectionAttempts++;
      
      if (this.redisConnectionAttempts >= this.maxRedisRetries && this.config.useInMemoryFallback) {
        console.log('🔄 Redis connection failed, switching to in-memory fallback');
        this.switchToInMemoryFallback();
      }
    });

    this.redis.on('close', () => {
      console.warn('⚠️ Redis connection closed');
    });
  }

  private async switchToInMemoryFallback(): Promise<void> {
    try {
      // Close Redis connection
      if (this.redis) {
        await this.redis.quit();
        this.redis = undefined;
      }
      
      // Close Redis queue
      if (this.queue && 'close' in this.queue) {
        await this.queue.close();
      }
      
      // Switch to in-memory queue
      this.initializeInMemoryQueue();
      this.setupEventHandlers();
      
      console.log('✅ Successfully switched to in-memory queue fallback');
    } catch (error) {
      console.error('❌ Error during fallback switch:', error);
      throw error;
    }
  }

  private initializeJobProcessing(): void {
    // Set up job processing
    this.setupJobProcessors();
    this.setupEventHandlers();

    console.log('📋 Job queue processors initialized');
  }

  private setupJobProcessors(): void {
    // Parallel processor
    this.queue.process('parallel-transaction', this.config.concurrency.parallel, async (job) => {
      return this.processTransactionJob(job);
    });

    // Sequential processor  
    this.queue.process('sequential-transaction', this.config.concurrency.sequential, async (job) => {
      return this.processTransactionJob(job);
    });

    // Bundle coordinator processor
    this.queue.process('bundle-coordinator', 1, async (job) => {
      return this.processBundleCoordination(job);
    });
    
    console.log(`📋 Job processors configured (Redis: ${!this.usingInMemoryFallback}, InMemory: ${this.usingInMemoryFallback})`);
  }

  private setupEventHandlers(): void {
    this.queue.on('completed', (job: Job<TransactionJob>, result: JobResult) => {
      console.log(`✅ Transaction job ${job.id} completed successfully`);
      this.activeJobs.delete(job.id!.toString());
      this.emit('jobCompleted', { job: job.data, result });
    });

    this.queue.on('failed', (job: Job<TransactionJob>, error: Error) => {
      console.error(`❌ Transaction job ${job.id} failed:`, error.message);
      this.activeJobs.delete(job.id!.toString());
      this.emit('jobFailed', { job: job.data, error: error.message });
    });

    this.queue.on('stalled', (job: Job<TransactionJob>) => {
      console.warn(`⚠️ Transaction job ${job.id} stalled`);
      this.emit('jobStalled', { job: job.data });
    });

    this.queue.on('progress', (job: Job<TransactionJob>, progress: number) => {
      this.emit('jobProgress', { job: job.data, progress });
    });

    this.queue.on('waiting', (jobId: string) => {
      console.log(`⏳ Job ${jobId} is waiting`);
    });

    this.queue.on('active', (job: Job<TransactionJob>) => {
      console.log(`🔄 Job ${job.id} started processing`);
      this.activeJobs.set(job.id!.toString(), job);
    });
  }

  private async processTransactionJob(job: Job<TransactionJob>): Promise<JobResult> {
    const { id, bundleExecutionId, wallet, transactionOptions, stealthConfig, metadata } = job.data;

    try {
      console.log(`🔄 Processing transaction job ${id} for wallet ${wallet.address}`);

      // Update job progress
      await job.progress(10);

      // Apply stealth delay
      if (stealthConfig.delay > 0) {
        console.log(`⏸️ Applying stealth delay: ${stealthConfig.delay}ms`);
        await this.stealthPatterns.executeStealthDelay(stealthConfig.delay);
      }

      await job.progress(30);

      // Create bundle transaction record
      const bundleTransaction = await this.storage.createBundleTransaction({
        bundleExecutionId,
        walletId: wallet.id,
        status: 'pending',
        transactionType: transactionOptions.type || 'transfer',
        fromAddress: wallet.address,
        toAddress: transactionOptions.to,
        value: transactionOptions.value || '0',
        gasPrice: transactionOptions.gasPrice,
        gasLimit: transactionOptions.gasLimit,
        nonce: transactionOptions.nonce,
      });

      await job.progress(50);

      // Create transaction event for status tracking
      await this.storage.createTransactionEvent({
        bundleTransactionId: bundleTransaction.id,
        status: 'pending',
        eventType: 'status_change',
        description: 'Transaction job started',
        retryCount: metadata.attempt - 1,
      });

      // Apply stealth gas price variance
      let finalGasPrice = transactionOptions.gasPrice;
      if (finalGasPrice) {
        const stealthGas = this.stealthPatterns.applyStealthGasPrice(finalGasPrice);
        finalGasPrice = stealthGas.gasPrice;
        console.log(`⛽ Applied gas variance: ${stealthGas.variance.toFixed(2)}%`);
      }

      const finalOptions = {
        ...transactionOptions,
        gasPrice: finalGasPrice,
      };

      await job.progress(70);

      // Record broadcasting status
      await this.storage.updateBundleTransactionStatus(
        bundleTransaction.id,
        'broadcasting',
        undefined
      );

      await this.storage.createTransactionEvent({
        bundleTransactionId: bundleTransaction.id,
        status: 'broadcasting',
        eventType: 'status_change',
        description: 'Transaction broadcasting started',
      });

      // Execute transaction on blockchain
      console.log(`📡 Broadcasting transaction for wallet ${wallet.address}`);
      const transactionResult = await this.bscClient.signAndBroadcastTransaction(
        wallet.privateKey,
        finalOptions
      );

      await job.progress(90);

      // Update transaction with hash and details
      await this.storage.updateBundleTransaction(bundleTransaction.id, {
        transactionHash: transactionResult.hash,
        gasPrice: transactionResult.gasPrice,
        gasLimit: transactionResult.gasLimit,
        nonce: transactionResult.nonce,
        status: 'confirmed',
        updatedAt: new Date(),
      });

      // Record success event
      await this.storage.createTransactionEvent({
        bundleTransactionId: bundleTransaction.id,
        status: 'confirmed',
        eventType: 'confirmation',
        description: `Transaction confirmed: ${transactionResult.hash}`,
      });

      await job.progress(100);

      console.log(`✅ Transaction job ${id} completed: ${transactionResult.hash}`);

      return {
        success: true,
        transactionResult,
        bundleTransactionId: bundleTransaction.id,
      };

    } catch (error) {
      console.error(`❌ Transaction job ${id} failed:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const retryable = this.isRetryableError(error);

      // Update transaction status
      if (job.data.bundleExecutionId) {
        try {
          const bundleTransactions = await this.storage.getBundleTransactionsByBundleId(bundleExecutionId);
          const failedTransaction = bundleTransactions.find(tx => tx.walletId === wallet.id);
          
          if (failedTransaction) {
            await this.storage.updateBundleTransactionStatus(
              failedTransaction.id,
              'failed',
              errorMessage
            );

            await this.storage.createTransactionEvent({
              bundleTransactionId: failedTransaction.id,
              status: 'failed',
              eventType: 'error',
              description: 'Transaction failed',
              errorMessage,
              retryCount: metadata.attempt,
            });
          }
        } catch (updateError) {
          console.error('Failed to update transaction status:', updateError);
        }
      }

      return {
        success: false,
        error: errorMessage,
        retryable,
      };
    }
  }

  private async processBundleCoordination(job: Job): Promise<void> {
    // Handle bundle-level coordination tasks
    const { bundleExecutionId, action } = job.data;

    switch (action) {
      case 'monitor_progress':
        await this.updateBundleProgress(bundleExecutionId);
        break;
      case 'check_completion':
        await this.checkBundleCompletion(bundleExecutionId);
        break;
      case 'cleanup':
        await this.cleanupBundle(bundleExecutionId);
        break;
    }
  }

  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message?.toLowerCase() || '';
    
    // Network-related errors are typically retryable
    const retryablePatterns = [
      'network',
      'timeout',
      'connection',
      'temporary',
      'nonce',
      'gas',
      'insufficient funds',
    ];

    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  async executeBundleWithStealth(
    bundleExecutionId: string,
    executionPlan: StealthExecutionPlan,
    mode: 'parallel' | 'sequential' = 'parallel'
  ): Promise<void> {
    console.log(`🚀 Executing bundle ${bundleExecutionId} in ${mode} mode`);

    this.executionMode = mode;
    this.isProcessing = true;

    // Update bundle status
    await this.storage.updateBundleExecution(bundleExecutionId, {
      status: 'executing',
      startedAt: new Date(),
    });

    const jobs: Promise<Job<TransactionJob>>[] = [];

    for (const walletPlan of executionPlan.wallets) {
      const jobData: TransactionJob = {
        id: `${bundleExecutionId}-${walletPlan.wallet.id}`,
        bundleExecutionId,
        walletId: walletPlan.wallet.id,
        wallet: walletPlan.wallet,
        transactionOptions: {
          type: 'transfer', // Default type, can be customized
          to: '0x0000000000000000000000000000000000000000', // Placeholder
          value: '0.001', // Default small amount
        },
        stealthConfig: {
          delay: walletPlan.delay,
          gasMultiplier: walletPlan.gasMultiplier,
          windowIndex: walletPlan.windowIndex,
          proxyId: walletPlan.proxyId,
        },
        metadata: {
          attempt: 1,
          maxRetries: this.config.retries.maxAttempts,
          priority: walletPlan.windowIndex, // Higher window index = lower priority
          createdAt: Date.now(),
        },
      };

      const jobOptions: JobOptions = {
        delay: mode === 'sequential' ? walletPlan.windowIndex * 1000 : 0,
        priority: -walletPlan.windowIndex, // Bull uses negative for higher priority
        jobId: jobData.id,
      };

      const jobType = mode === 'parallel' ? 'parallel-transaction' : 'sequential-transaction';
      jobs.push(this.queue.add(jobType, jobData, jobOptions));
    }

    // Add coordination jobs
    jobs.push(
      this.queue.add('bundle-coordinator', {
        bundleExecutionId,
        action: 'monitor_progress',
      }, { delay: 5000, repeat: { every: 5000 } })
    );

    await Promise.all(jobs);

    console.log(`📋 Queued ${executionPlan.wallets.length} transaction jobs for bundle ${bundleExecutionId}`);
  }

  private async updateBundleProgress(bundleExecutionId: string): Promise<void> {
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

      this.emit('bundleProgress', {
        bundleExecutionId,
        completed,
        failed,
        total,
        progressPercentage,
      });

    } catch (error) {
      console.error('Failed to update bundle progress:', error);
    }
  }

  private async checkBundleCompletion(bundleExecutionId: string): Promise<void> {
    try {
      const bundleTransactions = await this.storage.getBundleTransactionsByBundleId(bundleExecutionId);
      const pending = bundleTransactions.filter(tx => 
        tx.status === 'pending' || tx.status === 'broadcasting'
      ).length;

      if (pending === 0) {
        // Bundle is complete
        const completed = bundleTransactions.filter(tx => tx.status === 'confirmed').length;
        const failed = bundleTransactions.filter(tx => tx.status === 'failed').length;
        const total = bundleTransactions.length;

        const finalStatus = failed === 0 ? 'completed' : 'failed';

        await this.storage.updateBundleExecution(bundleExecutionId, {
          status: finalStatus,
          completedAt: new Date(),
          completedWallets: completed,
          failedWallets: failed,
          progressPercentage: '100.00',
        });

        this.emit('bundleCompleted', {
          bundleExecutionId,
          status: finalStatus,
          completed,
          failed,
          total,
        });

        this.isProcessing = false;
        console.log(`🏁 Bundle ${bundleExecutionId} completed with status: ${finalStatus}`);
      }
    } catch (error) {
      console.error('Failed to check bundle completion:', error);
    }
  }

  private async cleanupBundle(bundleExecutionId: string): Promise<void> {
    // Remove monitoring jobs for completed bundle
    const jobs = await this.queue.getJobs(['waiting', 'delayed'], 0, -1);
    for (const job of jobs) {
      if (job.data.bundleExecutionId === bundleExecutionId) {
        await job.remove();
      }
    }
  }

  async pauseBundle(bundleExecutionId: string): Promise<void> {
    console.log(`⏸️ Pausing bundle ${bundleExecutionId}`);
    
    const jobs = await this.queue.getJobs(['waiting', 'delayed'], 0, -1);
    for (const job of jobs) {
      if (job.data.bundleExecutionId === bundleExecutionId) {
        await job.pause();
      }
    }

    await this.storage.updateBundleExecution(bundleExecutionId, {
      status: 'paused',
    });
  }

  async resumeBundle(bundleExecutionId: string): Promise<void> {
    console.log(`▶️ Resuming bundle ${bundleExecutionId}`);
    
    const jobs = await this.queue.getJobs(['paused'], 0, -1);
    for (const job of jobs) {
      if (job.data.bundleExecutionId === bundleExecutionId) {
        await job.resume();
      }
    }

    await this.storage.updateBundleExecution(bundleExecutionId, {
      status: 'executing',
    });
  }

  async cancelBundle(bundleExecutionId: string): Promise<void> {
    console.log(`❌ Cancelling bundle ${bundleExecutionId}`);
    
    const jobs = await this.queue.getJobs(['waiting', 'delayed', 'active', 'paused'], 0, -1);
    for (const job of jobs) {
      if (job.data.bundleExecutionId === bundleExecutionId) {
        await job.remove();
      }
    }

    await this.storage.updateBundleExecution(bundleExecutionId, {
      status: 'failed',
      failureReason: 'Cancelled by user',
      completedAt: new Date(),
    });
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    return {
      waiting: await this.queue.getWaiting().then(jobs => jobs.length),
      active: await this.queue.getActive().then(jobs => jobs.length),
      completed: await this.queue.getCompleted().then(jobs => jobs.length),
      failed: await this.queue.getFailed().then(jobs => jobs.length),
      delayed: await this.queue.getDelayed().then(jobs => jobs.length),
      paused: await this.queue.getPaused().then(jobs => jobs.length),
    };
  }

  async cleanup(): Promise<void> {
    this.isProcessing = false;
    await this.queue.close();
    await this.redis.disconnect();
    console.log('🧹 Job queue cleaned up');
  }
}

// Factory function
export function createBundleJobQueue(
  storage: DbStorage,
  bscClient: BSCClient,
  stealthPatterns: StealthPatterns,
  config?: Partial<QueueConfig>
): BundleJobQueue {
  return new BundleJobQueue(storage, bscClient, stealthPatterns, config);
}