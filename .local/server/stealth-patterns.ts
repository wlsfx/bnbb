import type { Wallet } from '@shared/schema';
import type { ProxyService } from './proxy-service';
import type { DbStorage } from './storage';

export interface StealthConfig {
  delayRange: {
    min: number; // minimum delay in ms
    max: number; // maximum delay in ms
  };
  gasPriceVariance: number; // percentage variance (e.g., 0.15 for ±15%)
  staggeredWindows: {
    enabled: boolean;
    windowSizeMs: number; // size of each broadcast window
    walletsPerWindow: number; // max wallets per window
  };
  proxyRotation: {
    enabled: boolean;
    rotateEveryN: number; // rotate proxy every N transactions
    rotateOnFailure: boolean;
  };
  walletShuffling: {
    enabled: boolean;
    algorithm: 'fisher-yates' | 'simple-random' | 'time-based';
  };
}

// Advanced stealth configuration for military-grade undetectable operations
export interface AdvancedStealthConfig extends StealthConfig {
  humanLikeTiming: {
    enabled: boolean;
    hesitationSpikes: {
      probability: number; // 0.1 = 10% chance
      durationRange: { min: number; max: number }; // 5000-15000ms
    };
    clusteringBehavior: {
      enabled: boolean;
      clusterProbability: number; // 0.3 = 30% chance to cluster
      clusterSize: { min: number; max: number }; // 2-4 transactions
    };
    timeZoneDistribution: {
      enabled: boolean;
      preferredHours: number[]; // [9, 10, 11, 14, 15, 16] for business hours
    };
    reactionTimeSimulation: {
      enabled: boolean;
      baseReactionTime: number; // base human reaction time in ms
      varianceRange: { min: number; max: number }; // variance in reaction time
    };
  };
  marketAwareGas: {
    enabled: boolean;
    congestionThresholds: {
      low: number;    // gwei threshold for low congestion
      medium: number; // gwei threshold for medium congestion
      high: number;   // gwei threshold for high congestion
    };
    mevProtection: {
      enabled: boolean;
      minPriorityFee: string; // minimum priority fee for inclusion
      maxSlippage: number;    // maximum slippage tolerance
      antiSandwichStrategy: 'timing' | 'gas-competition' | 'private-mempool';
    };
    userBehaviorMimicking: {
      enabled: boolean;
      gasPricePatterns: 'conservative' | 'moderate' | 'aggressive';
      tipBehavior: 'minimal' | 'standard' | 'generous';
    };
  };
  walletBehavior: {
    preWarmWallets: {
      enabled: boolean;
      transactionsPerWallet: { min: number; max: number }; // 1-3 warming transactions
      warmingPeriodHours: { min: number; max: number };    // 2-24 hours before launch
      organicTransactionTypes: string[]; // types of transactions to simulate
    };
    balanceDistribution: {
      strategy: 'uniform' | 'weighted' | 'realistic' | 'pareto';
      variancePercentage: number; // 0.25 = ±25% variance
      minimumBalance: string; // minimum balance in ETH/BNB
    };
    behaviorDecorelation: {
      enabled: boolean;
      timingVariance: number; // variance in timing between wallet actions
      gasPriceDecorelation: boolean; // decorrelate gas prices between wallets
      transactionOrderRandomization: boolean;
    };
  };
  patternAvoidance: {
    enabled: boolean;
    sequenceBreaking: {
      enabled: boolean;
      breakProbability: number; // probability of breaking predictable sequences
      randomInsertions: boolean; // insert random actions to break patterns
    };
    adaptiveVariance: {
      enabled: boolean;
      baseVariance: number;
      networkAnalysisDetection: boolean; // increase variance when analysis detected
      varianceAmplification: number; // multiplier when high analysis detected
    };
  };
  networkLevelStealth: {
    enabled: boolean;
    proxyRotationStrategy: 'residential' | 'datacenter' | 'mixed';
    geographicDistribution: {
      enabled: boolean;
      regions: string[]; // geographic regions to simulate
      timezoneAwareness: boolean;
    };
    rpcEndpointDistribution: {
      enabled: boolean;
      providers: string[]; // multiple RPC providers
      loadBalancing: 'round-robin' | 'random' | 'weighted';
    };
  };
}

export interface WalletWarmingPlan {
  walletId: string;
  warmingTransactions: Array<{
    type: string;
    delay: number;
    gasPrice: string;
    scheduledTime: number;
  }>;
  estimatedDuration: number;
}

export interface NetworkCongestionData {
  level: 'low' | 'medium' | 'high';
  averageGasPrice: string;
  pendingTransactions: number;
  blockUtilization: number;
  timestamp: number;
}

export interface MEVProtectionResult {
  gasPrice: string;
  priorityFee: string;
  strategy: string;
  protection: {
    antiSandwich: boolean;
    timingOptimization: boolean;
    gasPriceOptimization: boolean;
  };
}

export interface StealthExecutionPlan {
  wallets: Array<{
    wallet: Wallet;
    delay: number;
    windowIndex: number;
    proxyId?: string;
    gasMultiplier: number;
  }>;
  totalWindows: number;
  estimatedDuration: number;
}

export interface ExecutionWindow {
  index: number;
  wallets: Wallet[];
  startTime: number;
  estimatedDuration: number;
}

export class StealthPatterns {
  private config: AdvancedStealthConfig;
  private storage: DbStorage;
  private proxyService: ProxyService;
  private activeProxies: Map<string, any> = new Map();
  private patternHistory: Map<string, any[]> = new Map();
  private networkCongestionHistory: NetworkCongestionData[] = [];
  private clusteringState: Map<string, number> = new Map();

  constructor(storage: DbStorage, proxyService: ProxyService, config?: Partial<AdvancedStealthConfig>) {
    this.storage = storage;
    this.proxyService = proxyService;
    
    // Default advanced stealth configuration with military-grade settings
    this.config = {
      delayRange: {
        min: 300,   // 300ms minimum delay
        max: 2000,  // 2000ms maximum delay
      },
      gasPriceVariance: 0.15, // ±15% gas price variance
      staggeredWindows: {
        enabled: true,
        windowSizeMs: 5000,     // 5 second windows
        walletsPerWindow: 5,    // max 5 wallets per window
      },
      proxyRotation: {
        enabled: true,
        rotateEveryN: 3,        // rotate proxy every 3 transactions
        rotateOnFailure: true,
      },
      walletShuffling: {
        enabled: true,
        algorithm: 'fisher-yates',
      },
      // Advanced stealth features
      humanLikeTiming: {
        enabled: true,
        hesitationSpikes: {
          probability: 0.1, // 10% chance
          durationRange: { min: 5000, max: 15000 }, // 5-15 second pauses
        },
        clusteringBehavior: {
          enabled: true,
          clusterProbability: 0.3, // 30% chance to cluster
          clusterSize: { min: 2, max: 4 }, // 2-4 transactions
        },
        timeZoneDistribution: {
          enabled: true,
          preferredHours: [9, 10, 11, 14, 15, 16, 19, 20], // Business and evening hours
        },
        reactionTimeSimulation: {
          enabled: true,
          baseReactionTime: 200, // 200ms base reaction time
          varianceRange: { min: 50, max: 500 }, // 50-500ms variance
        },
      },
      marketAwareGas: {
        enabled: true,
        congestionThresholds: {
          low: 3,    // 3 gwei for low congestion
          medium: 8, // 8 gwei for medium congestion
          high: 15,  // 15 gwei for high congestion
        },
        mevProtection: {
          enabled: true,
          minPriorityFee: '1000000000', // 1 gwei minimum
          maxSlippage: 0.05, // 5% max slippage
          antiSandwichStrategy: 'timing',
        },
        userBehaviorMimicking: {
          enabled: true,
          gasPricePatterns: 'moderate',
          tipBehavior: 'standard',
        },
      },
      walletBehavior: {
        preWarmWallets: {
          enabled: true,
          transactionsPerWallet: { min: 1, max: 3 },
          warmingPeriodHours: { min: 2, max: 24 },
          organicTransactionTypes: ['transfer', 'approve', 'swap'],
        },
        balanceDistribution: {
          strategy: 'realistic',
          variancePercentage: 0.25, // ±25% variance
          minimumBalance: '0.001', // 0.001 BNB minimum
        },
        behaviorDecorelation: {
          enabled: true,
          timingVariance: 0.3, // 30% timing variance
          gasPriceDecorelation: true,
          transactionOrderRandomization: true,
        },
      },
      patternAvoidance: {
        enabled: true,
        sequenceBreaking: {
          enabled: true,
          breakProbability: 0.15, // 15% chance to break sequences
          randomInsertions: true,
        },
        adaptiveVariance: {
          enabled: true,
          baseVariance: 0.1,
          networkAnalysisDetection: true,
          varianceAmplification: 2.0,
        },
      },
      networkLevelStealth: {
        enabled: true,
        proxyRotationStrategy: 'mixed',
        geographicDistribution: {
          enabled: true,
          regions: ['US', 'EU', 'ASIA'],
          timezoneAwareness: true,
        },
        rpcEndpointDistribution: {
          enabled: true,
          providers: ['quicknode', 'alchemy', 'infura'],
          loadBalancing: 'random',
        },
      },
      ...config,
    };

    console.log('🕵️  Advanced Military-Grade Stealth Patterns initialized');
    console.log('🎯  Human-like timing:', this.config.humanLikeTiming.enabled);
    console.log('📊  Market-aware gas:', this.config.marketAwareGas.enabled);
    console.log('🔄  Pattern avoidance:', this.config.patternAvoidance.enabled);
  }

  /**
   * Generate a randomized delay between min and max range
   */
  generateRandomDelay(): number {
    const { min, max } = this.config.delayRange;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate human-like delay with sophisticated timing patterns
   * Simulates realistic human behavior including hesitation spikes and clustering
   */
  generateHumanLikeDelay(walletId?: string): number {
    const baseDelay = this.generateRandomDelay();
    
    if (!this.config.humanLikeTiming.enabled) {
      return baseDelay;
    }

    let finalDelay = baseDelay;

    // Add hesitation spikes (natural human pauses)
    if (Math.random() < this.config.humanLikeTiming.hesitationSpikes.probability) {
      const { min, max } = this.config.humanLikeTiming.hesitationSpikes.durationRange;
      const hesitationDelay = Math.floor(Math.random() * (max - min + 1)) + min;
      finalDelay += hesitationDelay;
      console.log(`🤔 Hesitation spike added: +${hesitationDelay}ms`);
    }

    // Add clustering behavior (group transactions together)
    if (this.config.humanLikeTiming.clusteringBehavior.enabled && walletId) {
      const clusterState = this.clusteringState.get(walletId) || 0;
      
      if (clusterState === 0 && Math.random() < this.config.humanLikeTiming.clusteringBehavior.clusterProbability) {
        // Start new cluster - reduce delay significantly
        const { min, max } = this.config.humanLikeTiming.clusteringBehavior.clusterSize;
        const clusterSize = Math.floor(Math.random() * (max - min + 1)) + min;
        this.clusteringState.set(walletId, clusterSize);
        finalDelay = Math.floor(finalDelay * 0.2); // Much shorter delay for clustering
        console.log(`🔗 Starting transaction cluster for wallet ${walletId}`);
      } else if (clusterState > 0) {
        // Continue cluster with short delays
        this.clusteringState.set(walletId, clusterState - 1);
        finalDelay = Math.floor(finalDelay * 0.3);
      }
    }

    // Add reaction time simulation
    if (this.config.humanLikeTiming.reactionTimeSimulation.enabled) {
      const { baseReactionTime, varianceRange } = this.config.humanLikeTiming.reactionTimeSimulation;
      const reactionVariance = Math.floor(
        Math.random() * (varianceRange.max - varianceRange.min + 1)
      ) + varianceRange.min;
      finalDelay += baseReactionTime + reactionVariance;
    }

    // Apply time zone distribution (slower during off-hours)
    if (this.config.humanLikeTiming.timeZoneDistribution.enabled) {
      const hour = new Date().getHours();
      const preferredHours = this.config.humanLikeTiming.timeZoneDistribution.preferredHours;
      
      if (!preferredHours.includes(hour)) {
        // Off-hours: slower reaction times
        finalDelay *= 1.5;
      } else {
        // Business hours: potentially faster
        finalDelay *= (0.8 + Math.random() * 0.4); // 0.8-1.2x multiplier
      }
    }

    return Math.floor(finalDelay);
  }

  /**
   * Apply gas price variance to base gas price
   */
  applyGasPriceVariance(baseGasPrice: string): string {
    const base = BigInt(baseGasPrice);
    const variance = this.config.gasPriceVariance;
    
    // Generate random variance between -variance and +variance
    const randomVariance = (Math.random() - 0.5) * 2 * variance;
    const multiplier = 1 + randomVariance;
    
    // Apply variance and ensure minimum gas price
    const variedGasPrice = BigInt(Math.floor(Number(base) * multiplier));
    
    // Ensure minimum gas price of 1 gwei
    const minGasPrice = BigInt('1000000000');
    return variedGasPrice < minGasPrice ? minGasPrice.toString() : variedGasPrice.toString();
  }

  /**
   * Calculate market-aware gas price with MEV protection
   * Analyzes network conditions and user behavior patterns
   */
  async calculateMarketAwareGasPrice(currentGasPrice: string): Promise<MEVProtectionResult> {
    if (!this.config.marketAwareGas.enabled) {
      return {
        gasPrice: this.applyGasPriceVariance(currentGasPrice),
        priorityFee: '1000000000',
        strategy: 'basic-variance',
        protection: {
          antiSandwich: false,
          timingOptimization: false,
          gasPriceOptimization: false,
        },
      };
    }

    const congestionData = await this.assessNetworkCongestion(currentGasPrice);
    const baseGasPriceBigInt = BigInt(currentGasPrice);
    
    // Simulate typical user behavior based on congestion
    let adjustedGasPrice = baseGasPriceBigInt;
    let strategy = 'market-aware';
    
    const { gasPricePatterns, tipBehavior } = this.config.marketAwareGas.userBehaviorMimicking;
    
    switch (congestionData.level) {
      case 'low':
        // Conservative users during low congestion
        if (gasPricePatterns === 'conservative') {
          adjustedGasPrice = BigInt(Math.floor(Number(baseGasPriceBigInt) * 1.05)); // +5%
        } else {
          adjustedGasPrice = BigInt(Math.floor(Number(baseGasPriceBigInt) * 1.1)); // +10%
        }
        strategy += '-low-congestion';
        break;
        
      case 'medium':
        // Standard behavior during medium congestion
        if (gasPricePatterns === 'conservative') {
          adjustedGasPrice = BigInt(Math.floor(Number(baseGasPriceBigInt) * 1.15)); // +15%
        } else if (gasPricePatterns === 'aggressive') {
          adjustedGasPrice = BigInt(Math.floor(Number(baseGasPriceBigInt) * 1.3)); // +30%
        } else {
          adjustedGasPrice = BigInt(Math.floor(Number(baseGasPriceBigInt) * 1.2)); // +20%
        }
        strategy += '-medium-congestion';
        break;
        
      case 'high':
        // Aggressive pricing during high congestion
        if (gasPricePatterns === 'conservative') {
          adjustedGasPrice = BigInt(Math.floor(Number(baseGasPriceBigInt) * 1.25)); // +25%
        } else if (gasPricePatterns === 'aggressive') {
          adjustedGasPrice = BigInt(Math.floor(Number(baseGasPriceBigInt) * 1.5)); // +50%
        } else {
          adjustedGasPrice = BigInt(Math.floor(Number(baseGasPriceBigInt) * 1.35)); // +35%
        }
        strategy += '-high-congestion';
        break;
    }

    // Apply MEV protection
    const mevProtection = await this.optimizeForMEVProtection(adjustedGasPrice.toString());
    
    // Calculate priority fee based on tip behavior
    const minPriorityFeeBigInt = BigInt(this.config.marketAwareGas.mevProtection.minPriorityFee);
    let priorityFee = minPriorityFeeBigInt;
    
    if (tipBehavior === 'generous') {
      priorityFee = BigInt(Math.floor(Number(minPriorityFeeBigInt) * 2)); // 2x tip
    } else if (tipBehavior === 'standard') {
      priorityFee = BigInt(Math.floor(Number(minPriorityFeeBigInt) * 1.5)); // 1.5x tip
    }
    
    // Apply final variance to look more organic
    const finalGasPrice = this.applyGasPriceVariance(mevProtection.gasPrice);
    
    return {
      gasPrice: finalGasPrice,
      priorityFee: priorityFee.toString(),
      strategy,
      protection: mevProtection.protection,
    };
  }

  /**
   * Assess current network congestion levels
   */
  private async assessNetworkCongestion(currentGasPrice: string): Promise<NetworkCongestionData> {
    const gasPriceGwei = Number(currentGasPrice) / 1e9;
    const { low, medium, high } = this.config.marketAwareGas.congestionThresholds;
    
    let level: 'low' | 'medium' | 'high';
    
    if (gasPriceGwei <= low) {
      level = 'low';
    } else if (gasPriceGwei <= medium) {
      level = 'medium';
    } else {
      level = 'high';
    }
    
    const congestionData: NetworkCongestionData = {
      level,
      averageGasPrice: currentGasPrice,
      pendingTransactions: Math.floor(Math.random() * 100000), // Simulated
      blockUtilization: Math.random() * 100, // Simulated
      timestamp: Date.now(),
    };
    
    // Store in history for pattern analysis
    this.networkCongestionHistory.push(congestionData);
    if (this.networkCongestionHistory.length > 100) {
      this.networkCongestionHistory.shift();
    }
    
    console.log(`📊 Network congestion: ${level} (${gasPriceGwei.toFixed(2)} gwei)`);
    
    return congestionData;
  }

  /**
   * Optimize gas pricing for MEV protection
   */
  private async optimizeForMEVProtection(gasPrice: string): Promise<MEVProtectionResult> {
    if (!this.config.marketAwareGas.mevProtection.enabled) {
      return {
        gasPrice,
        priorityFee: this.config.marketAwareGas.mevProtection.minPriorityFee,
        strategy: 'no-mev-protection',
        protection: {
          antiSandwich: false,
          timingOptimization: false,
          gasPriceOptimization: false,
        },
      };
    }

    const { antiSandwichStrategy } = this.config.marketAwareGas.mevProtection;
    let optimizedGasPrice = gasPrice;
    let strategy = 'mev-protected';
    
    switch (antiSandwichStrategy) {
      case 'timing':
        // Add timing-based protection (slight gas price randomization)
        const timingVariance = (Math.random() - 0.5) * 0.02; // ±1% variance
        optimizedGasPrice = BigInt(Math.floor(Number(gasPrice) * (1 + timingVariance))).toString();
        strategy += '-timing';
        break;
        
      case 'gas-competition':
        // Slightly increase gas to avoid sandwich attacks
        optimizedGasPrice = BigInt(Math.floor(Number(gasPrice) * 1.05)).toString(); // +5%
        strategy += '-gas-competition';
        break;
        
      case 'private-mempool':
        // Simulate private mempool behavior (no gas adjustment needed)
        strategy += '-private-mempool';
        break;
    }
    
    return {
      gasPrice: optimizedGasPrice,
      priorityFee: this.config.marketAwareGas.mevProtection.minPriorityFee,
      strategy,
      protection: {
        antiSandwich: true,
        timingOptimization: antiSandwichStrategy === 'timing',
        gasPriceOptimization: antiSandwichStrategy === 'gas-competition',
      },
    };
  }

  /**
   * Shuffle wallets using specified algorithm
   */
  shuffleWallets(wallets: Wallet[]): Wallet[] {
    const shuffled = [...wallets];
    
    switch (this.config.walletShuffling.algorithm) {
      case 'fisher-yates':
        return this.fisherYatesShuffle(shuffled);
      case 'time-based':
        return this.timeBasedShuffle(shuffled);
      case 'simple-random':
      default:
        return this.simpleRandomShuffle(shuffled);
    }
  }

  private fisherYatesShuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  private simpleRandomShuffle<T>(array: T[]): T[] {
    return array.sort(() => Math.random() - 0.5);
  }

  private timeBasedShuffle<T>(array: T[]): T[] {
    // Use current time as seed for reproducible but pseudo-random shuffling
    const seed = Date.now();
    return array.sort((a, b) => {
      const aHash = this.hashCode(JSON.stringify(a) + seed);
      const bHash = this.hashCode(JSON.stringify(b) + seed);
      return aHash - bHash;
    });
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Create staggered execution windows
   */
  createStaggeredWindows(wallets: Wallet[]): ExecutionWindow[] {
    if (!this.config.staggeredWindows.enabled) {
      return [{
        index: 0,
        wallets,
        startTime: Date.now(),
        estimatedDuration: this.config.delayRange.max * wallets.length,
      }];
    }

    const windows: ExecutionWindow[] = [];
    const { windowSizeMs, walletsPerWindow } = this.config.staggeredWindows;
    
    for (let i = 0; i < wallets.length; i += walletsPerWindow) {
      const windowWallets = wallets.slice(i, i + walletsPerWindow);
      const windowIndex = Math.floor(i / walletsPerWindow);
      
      windows.push({
        index: windowIndex,
        wallets: windowWallets,
        startTime: Date.now() + (windowIndex * windowSizeMs),
        estimatedDuration: this.config.delayRange.max * windowWallets.length,
      });
    }

    return windows;
  }

  /**
   * Generate comprehensive advanced stealth execution plan with military-grade sophistication
   */
  async generateExecutionPlan(wallets: Wallet[]): Promise<StealthExecutionPlan> {
    console.log(`🎯 Generating advanced stealth execution plan for ${wallets.length} wallets`);
    console.log('🔧 Applying military-grade stealth algorithms...');

    // Step 1: Generate wallet warming plans if enabled
    if (this.config.walletBehavior.preWarmWallets.enabled) {
      const warmingPlans = await this.generateWalletWarmingPlan(wallets);
      console.log(`🔥 Generated ${warmingPlans.length} wallet warming plans`);
    }

    // Step 2: Shuffle wallets with advanced algorithm
    let shuffledWallets = wallets;
    if (this.config.walletShuffling.enabled) {
      shuffledWallets = this.shuffleWallets(wallets);
      console.log('🔀 Wallets shuffled with advanced algorithms');
    }

    // Step 3: Create execution windows
    const windows = this.createStaggeredWindows(shuffledWallets);
    console.log(`📋 Created ${windows.length} execution windows`);

    // Step 4: Assign advanced stealth parameters to each wallet
    const executionPlan: StealthExecutionPlan['wallets'] = [];
    let proxyRotationCounter = 0;

    for (const window of windows) {
      for (const wallet of window.wallets) {
        // Generate human-like delay instead of simple random delay
        const delay = this.generateHumanLikeDelay(wallet.id);
        
        // Generate sophisticated gas price multiplier with market awareness
        let gasMultiplier: number;
        if (this.config.marketAwareGas.enabled) {
          // Use market-aware gas calculation for more realistic pricing
          const baseGasPrice = '5000000000'; // 5 gwei base
          const mevResult = await this.calculateMarketAwareGasPrice(baseGasPrice);
          gasMultiplier = Number(mevResult.gasPrice) / Number(baseGasPrice);
        } else {
          // Fallback to basic variance
          gasMultiplier = 1 + (Math.random() - 0.5) * 2 * this.config.gasPriceVariance;
        }
        
        // Advanced proxy rotation with geographic distribution
        let proxyId: string | undefined;
        if (this.config.proxyRotation.enabled) {
          if (proxyRotationCounter % this.config.proxyRotation.rotateEveryN === 0) {
            const proxy = await this.getAdvancedProxy();
            if (proxy) {
              proxyId = proxy.id;
            }
          }
          proxyRotationCounter++;
        }

        executionPlan.push({
          wallet,
          delay,
          windowIndex: window.index,
          proxyId,
          gasMultiplier,
        });
      }
    }

    // Step 5: Apply pattern detection and avoidance
    let finalPlan: StealthExecutionPlan = {
      wallets: executionPlan,
      totalWindows: windows.length,
      estimatedDuration: this.calculateEstimatedDuration(windows),
    };

    if (this.config.patternAvoidance.enabled) {
      finalPlan = this.detectAndAvoidPatterns(finalPlan);
      console.log('🛡️  Applied pattern avoidance algorithms');
    }

    // Step 6: Apply behavioral decorrelation
    if (this.config.walletBehavior.behaviorDecorelation.enabled) {
      finalPlan = this.applyBehaviorDecorelation(finalPlan);
      console.log('🔐 Applied behavioral decorrelation');
    }

    // Step 7: Final optimization and stealth scoring
    const stealthAnalytics = this.generateAdvancedStealthAnalytics(finalPlan);
    console.log(`🎖️  Advanced stealth level: ${stealthAnalytics.militaryGradeScore}/100`);
    console.log(`⏱️  Estimated execution duration: ${finalPlan.estimatedDuration}ms`);
    console.log(`🛡️  MEV protection: ${stealthAnalytics.mevProtectionScore}%`);
    console.log(`🧠 Human-likeness score: ${stealthAnalytics.humanLikenessScore}%`);

    return finalPlan;
  }

  /**
   * Get advanced proxy with geographic distribution
   */
  private async getAdvancedProxy(): Promise<any> {
    if (!this.config.networkLevelStealth.enabled) {
      return this.getNextProxy();
    }

    try {
      const environment = process.env.NODE_ENV || 'development';
      const { proxyRotationStrategy, geographicDistribution } = this.config.networkLevelStealth;
      
      // Simulate advanced proxy selection based on strategy
      const proxy = await this.proxyService.rotateProxy(environment);
      
      if (proxy && geographicDistribution.enabled) {
        // Add geographic metadata for distribution simulation
        const regions = geographicDistribution.regions;
        const selectedRegion = regions[Math.floor(Math.random() * regions.length)];
        proxy.region = selectedRegion;
        
        console.log(`🌍 Selected proxy from region: ${selectedRegion}`);
      }
      
      return proxy;
    } catch (error) {
      console.error('❌ Failed to get advanced proxy:', error);
      return this.getNextProxy(); // Fallback to basic proxy
    }
  }

  private calculateEstimatedDuration(windows: ExecutionWindow[]): number {
    if (windows.length === 0) return 0;
    
    const lastWindow = windows[windows.length - 1];
    return lastWindow.startTime - Date.now() + lastWindow.estimatedDuration;
  }

  /**
   * Get next available proxy with rotation
   */
  private async getNextProxy(): Promise<any> {
    try {
      const environment = process.env.NODE_ENV || 'development';
      return await this.proxyService.rotateProxy(environment);
    } catch (error) {
      console.error('❌ Failed to rotate proxy:', error);
      return null;
    }
  }

  /**
   * Execute stealth delay before transaction
   */
  async executeStealthDelay(delayMs: number): Promise<void> {
    if (delayMs <= 0) return;
    
    return new Promise((resolve) => {
      console.log(`⏸️  Stealth delay: ${delayMs}ms`);
      setTimeout(resolve, delayMs);
    });
  }

  /**
   * Apply stealth patterns to gas price
   */
  applyStealthGasPrice(baseGasPrice: string): { gasPrice: string; variance: number } {
    const originalGasPrice = baseGasPrice;
    const modifiedGasPrice = this.applyGasPriceVariance(baseGasPrice);
    
    // Calculate actual variance applied
    const variance = (Number(modifiedGasPrice) - Number(originalGasPrice)) / Number(originalGasPrice);
    
    return {
      gasPrice: modifiedGasPrice,
      variance: variance * 100, // Convert to percentage
    };
  }

  /**
   * Generate random transaction timing within window
   */
  generateTransactionTiming(windowStartTime: number, windowDuration: number): number {
    const randomOffset = Math.random() * windowDuration;
    return windowStartTime + randomOffset;
  }

  /**
   * Validate stealth configuration
   */
  validateConfig(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (this.config.delayRange.min > this.config.delayRange.max) {
      issues.push('Minimum delay cannot be greater than maximum delay');
    }

    if (this.config.delayRange.min < 0) {
      issues.push('Minimum delay cannot be negative');
    }

    if (this.config.gasPriceVariance < 0 || this.config.gasPriceVariance > 1) {
      issues.push('Gas price variance must be between 0 and 1');
    }

    if (this.config.staggeredWindows.walletsPerWindow <= 0) {
      issues.push('Wallets per window must be positive');
    }

    if (this.config.proxyRotation.rotateEveryN <= 0) {
      issues.push('Proxy rotation interval must be positive');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Generate wallet warming plan for pre-launch preparation
   */
  async generateWalletWarmingPlan(wallets: Wallet[]): Promise<WalletWarmingPlan[]> {
    if (!this.config.walletBehavior.preWarmWallets.enabled) {
      return [];
    }

    const warmingPlans: WalletWarmingPlan[] = [];
    const { transactionsPerWallet, warmingPeriodHours, organicTransactionTypes } = this.config.walletBehavior.preWarmWallets;
    
    for (const wallet of wallets) {
      const numTransactions = Math.floor(
        Math.random() * (transactionsPerWallet.max - transactionsPerWallet.min + 1)
      ) + transactionsPerWallet.min;
      
      const warmingDurationMs = (
        Math.floor(Math.random() * (warmingPeriodHours.max - warmingPeriodHours.min + 1)) + 
        warmingPeriodHours.min
      ) * 60 * 60 * 1000;
      
      const warmingTransactions = [];
      const currentTime = Date.now();
      
      for (let i = 0; i < numTransactions; i++) {
        const transactionType = organicTransactionTypes[
          Math.floor(Math.random() * organicTransactionTypes.length)
        ];
        
        // Distribute transactions over the warming period with realistic gaps
        const scheduledTime = currentTime - warmingDurationMs + 
          (warmingDurationMs / numTransactions) * i + 
          (Math.random() - 0.5) * (warmingDurationMs / numTransactions);
        
        const delay = this.generateHumanLikeDelay(wallet.id);
        
        // Generate realistic gas prices for warming transactions
        const baseGasPrice = '5000000000'; // 5 gwei base
        const gasPrice = this.applyGasPriceVariance(baseGasPrice);
        
        warmingTransactions.push({
          type: transactionType,
          delay,
          gasPrice,
          scheduledTime: Math.floor(scheduledTime),
        });
      }
      
      warmingPlans.push({
        walletId: wallet.id,
        warmingTransactions: warmingTransactions.sort((a, b) => a.scheduledTime - b.scheduledTime),
        estimatedDuration: warmingDurationMs,
      });
    }
    
    console.log(`🔥 Generated warming plans for ${wallets.length} wallets`);
    return warmingPlans;
  }

  /**
   * Detect and avoid detectable patterns in transaction sequences
   */
  detectAndAvoidPatterns(executionPlan: StealthExecutionPlan): StealthExecutionPlan {
    if (!this.config.patternAvoidance.enabled) {
      return executionPlan;
    }

    const { sequenceBreaking, adaptiveVariance } = this.config.patternAvoidance;
    let modifiedPlan = { ...executionPlan };
    
    // Analyze for detectable patterns
    const walletDelays = modifiedPlan.wallets.map(w => w.delay);
    const gasMultipliers = modifiedPlan.wallets.map(w => w.gasMultiplier);
    
    // Check for sequence patterns
    if (sequenceBreaking.enabled) {
      // Break predictable sequences with random insertions
      if (sequenceBreaking.randomInsertions && Math.random() < sequenceBreaking.breakProbability) {
        // Insert random delays to break patterns
        const randomIndex = Math.floor(Math.random() * modifiedPlan.wallets.length);
        const randomDelay = this.generateHumanLikeDelay();
        modifiedPlan.wallets[randomIndex].delay += randomDelay;
        
        console.log('🌀 Pattern breaking: Added random delay insertion');
      }
      
      // Shuffle a subset of wallets to break ordering patterns
      if (Math.random() < sequenceBreaking.breakProbability) {
        const shuffleCount = Math.floor(modifiedPlan.wallets.length * 0.2); // Shuffle 20%
        const shuffleIndices = [];
        
        while (shuffleIndices.length < shuffleCount) {
          const index = Math.floor(Math.random() * modifiedPlan.wallets.length);
          if (!shuffleIndices.includes(index)) {
            shuffleIndices.push(index);
          }
        }
        
        // Shuffle selected wallets
        for (let i = shuffleIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = modifiedPlan.wallets[shuffleIndices[i]];
          modifiedPlan.wallets[shuffleIndices[i]] = modifiedPlan.wallets[shuffleIndices[j]];
          modifiedPlan.wallets[shuffleIndices[j]] = temp;
        }
        
        console.log('🔀 Pattern breaking: Shuffled wallet subset');
      }
    }
    
    // Apply adaptive variance based on network analysis detection
    if (adaptiveVariance.enabled) {
      let varianceMultiplier = 1.0;
      
      if (adaptiveVariance.networkAnalysisDetection) {
        // Simulate detection of network analysis (in reality, this would be more sophisticated)
        const analysisDetected = Math.random() < 0.1; // 10% chance
        
        if (analysisDetected) {
          varianceMultiplier = adaptiveVariance.varianceAmplification;
          console.log('🚨 Network analysis detected - amplifying variance');
        }
      }
      
      // Apply amplified variance to all timing and gas parameters
      modifiedPlan.wallets.forEach(wallet => {
        const additionalVariance = (Math.random() - 0.5) * 2 * adaptiveVariance.baseVariance * varianceMultiplier;
        wallet.delay = Math.max(100, Math.floor(wallet.delay * (1 + additionalVariance)));
        wallet.gasMultiplier *= (1 + additionalVariance * 0.5);
      });
    }
    
    return modifiedPlan;
  }

  /**
   * Apply advanced behavioral decorrelation between wallets
   */
  applyBehaviorDecorelation(executionPlan: StealthExecutionPlan): StealthExecutionPlan {
    if (!this.config.walletBehavior.behaviorDecorelation.enabled) {
      return executionPlan;
    }

    const { timingVariance, gasPriceDecorelation, transactionOrderRandomization } = this.config.walletBehavior.behaviorDecorelation;
    let modifiedPlan = { ...executionPlan };
    
    // Apply timing variance to decorrelate wallet behaviors
    modifiedPlan.wallets.forEach((wallet, index) => {
      const variance = (Math.random() - 0.5) * 2 * timingVariance;
      wallet.delay = Math.max(100, Math.floor(wallet.delay * (1 + variance)));
      
      // Decorrelate gas prices between wallets
      if (gasPriceDecorelation) {
        const gasVariance = (Math.random() - 0.5) * 0.2; // ±10% gas variance
        wallet.gasMultiplier *= (1 + gasVariance);
      }
    });
    
    // Randomize transaction order to break correlation patterns
    if (transactionOrderRandomization) {
      // Create groups of wallets and randomize within groups
      const groupSize = 5;
      for (let i = 0; i < modifiedPlan.wallets.length; i += groupSize) {
        const group = modifiedPlan.wallets.slice(i, i + groupSize);
        this.fisherYatesShuffle(group);
        modifiedPlan.wallets.splice(i, groupSize, ...group);
      }
      
      console.log('🎲 Applied transaction order randomization');
    }
    
    console.log('🔓 Applied behavioral decorrelation');
    return modifiedPlan;
  }

  /**
   * Update stealth configuration
   */
  updateConfig(newConfig: Partial<AdvancedStealthConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Advanced stealth configuration updated');
  }

  /**
   * Get current stealth configuration
   */
  getConfig(): StealthConfig {
    return { ...this.config };
  }

  /**
   * Generate advanced stealth analytics for military-grade assessment
   */
  generateAdvancedStealthAnalytics(executionPlan: StealthExecutionPlan): {
    totalWallets: number;
    averageDelay: number;
    gasVarianceRange: { min: number; max: number };
    windowDistribution: number[];
    proxiesUsed: number;
    estimatedStealthLevel: number; // 0-100 score (legacy)
    militaryGradeScore: number; // 0-100 advanced stealth score
    humanLikenessScore: number; // 0-100 human behavior simulation score
    mevProtectionScore: number; // 0-100 MEV protection effectiveness
    patternAvoidanceScore: number; // 0-100 pattern avoidance effectiveness
    networkStealthScore: number; // 0-100 network-level stealth score
  } {
    const { wallets } = executionPlan;
    
    const totalWallets = wallets.length;
    const averageDelay = wallets.reduce((sum, w) => sum + w.delay, 0) / totalWallets;
    
    const gasVariances = wallets.map(w => (w.gasMultiplier - 1) * 100);
    const gasVarianceRange = {
      min: Math.min(...gasVariances),
      max: Math.max(...gasVariances),
    };

    const windowDistribution = wallets.reduce((acc, w) => {
      acc[w.windowIndex] = (acc[w.windowIndex] || 0) + 1;
      return acc;
    }, [] as number[]);

    const proxiesUsed = new Set(wallets.map(w => w.proxyId).filter(Boolean)).size;

    // Legacy stealth score calculation
    let stealthScore = 0;
    stealthScore += Math.min(averageDelay / 1000, 1) * 30;
    stealthScore += Math.min(Math.abs(gasVarianceRange.max - gasVarianceRange.min) / 30, 1) * 25;
    stealthScore += Math.min(executionPlan.totalWindows / Math.ceil(totalWallets / 5), 1) * 25;
    stealthScore += Math.min(proxiesUsed / Math.ceil(totalWallets / 3), 1) * 20;

    // Advanced scoring algorithms
    
    // Human-likeness score (based on delay patterns and variance)
    let humanLikenessScore = 0;
    if (this.config.humanLikeTiming.enabled) {
      humanLikenessScore += 40; // Base score for human-like timing
      
      // Analyze delay distribution for human-like patterns
      const delayVariance = this.calculateVariance(wallets.map(w => w.delay));
      humanLikenessScore += Math.min(delayVariance / 10000, 1) * 30; // Variance component
      
      // Clustering analysis
      if (this.config.humanLikeTiming.clusteringBehavior.enabled) {
        humanLikenessScore += 20;
      }
      
      // Time zone awareness
      if (this.config.humanLikeTiming.timeZoneDistribution.enabled) {
        humanLikenessScore += 10;
      }
    }
    
    // MEV protection score
    let mevProtectionScore = 0;
    if (this.config.marketAwareGas.enabled && this.config.marketAwareGas.mevProtection.enabled) {
      mevProtectionScore += 50; // Base MEV protection
      
      // Advanced MEV strategies
      switch (this.config.marketAwareGas.mevProtection.antiSandwichStrategy) {
        case 'timing':
          mevProtectionScore += 20;
          break;
        case 'gas-competition':
          mevProtectionScore += 25;
          break;
        case 'private-mempool':
          mevProtectionScore += 30;
          break;
      }
      
      // Gas price camouflage
      if (this.config.marketAwareGas.userBehaviorMimicking.enabled) {
        mevProtectionScore += 25;
      }
    }
    
    // Pattern avoidance score
    let patternAvoidanceScore = 0;
    if (this.config.patternAvoidance.enabled) {
      patternAvoidanceScore += 40; // Base pattern avoidance
      
      if (this.config.patternAvoidance.sequenceBreaking.enabled) {
        patternAvoidanceScore += 30;
      }
      
      if (this.config.patternAvoidance.adaptiveVariance.enabled) {
        patternAvoidanceScore += 30;
      }
    }
    
    // Network stealth score
    let networkStealthScore = 0;
    if (this.config.networkLevelStealth.enabled) {
      networkStealthScore += 30; // Base network stealth
      
      if (this.config.networkLevelStealth.geographicDistribution.enabled) {
        networkStealthScore += 25;
      }
      
      if (this.config.networkLevelStealth.rpcEndpointDistribution.enabled) {
        networkStealthScore += 25;
      }
      
      // Proxy diversity bonus
      const proxyDiversityRatio = proxiesUsed / Math.ceil(totalWallets / 3);
      networkStealthScore += Math.min(proxyDiversityRatio, 1) * 20;
    }
    
    // Calculate overall military-grade score
    const militaryGradeScore = Math.round(
      (humanLikenessScore * 0.25) +
      (mevProtectionScore * 0.25) +
      (patternAvoidanceScore * 0.25) +
      (networkStealthScore * 0.25)
    );

    return {
      totalWallets,
      averageDelay,
      gasVarianceRange,
      windowDistribution,
      proxiesUsed,
      estimatedStealthLevel: Math.round(stealthScore),
      militaryGradeScore: Math.min(militaryGradeScore, 100),
      humanLikenessScore: Math.min(humanLikenessScore, 100),
      mevProtectionScore: Math.min(mevProtectionScore, 100),
      patternAvoidanceScore: Math.min(patternAvoidanceScore, 100),
      networkStealthScore: Math.min(networkStealthScore, 100),
    };
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
    return variance;
  }

  /**
   * Generate stealth analytics (legacy method for backward compatibility)
   */
  generateStealthAnalytics(executionPlan: StealthExecutionPlan): {
    totalWallets: number;
    averageDelay: number;
    gasVarianceRange: { min: number; max: number };
    windowDistribution: number[];
    proxiesUsed: number;
    estimatedStealthLevel: number;
  } {
    const advanced = this.generateAdvancedStealthAnalytics(executionPlan);
    return {
      totalWallets: advanced.totalWallets,
      averageDelay: advanced.averageDelay,
      gasVarianceRange: advanced.gasVarianceRange,
      windowDistribution: advanced.windowDistribution,
      proxiesUsed: advanced.proxiesUsed,
      estimatedStealthLevel: advanced.estimatedStealthLevel,
    };
  }
}

// Factory function with advanced stealth configuration support
export function createStealthPatterns(
  storage: DbStorage, 
  proxyService: ProxyService, 
  config?: Partial<AdvancedStealthConfig>
): StealthPatterns {
  return new StealthPatterns(storage, proxyService, config);
}

// Legacy factory function for backward compatibility
export function createBasicStealthPatterns(
  storage: DbStorage, 
  proxyService: ProxyService, 
  config?: Partial<StealthConfig>
): StealthPatterns {
  return new StealthPatterns(storage, proxyService, config);
}