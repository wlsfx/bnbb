import { z } from 'zod';
import type { IStorage } from './storage';
import { 
  type LaunchPreset, 
  type InsertLaunchPreset, 
  type UserPreset,
  type InsertUserPreset,
  PRESET_CATEGORIES,
  launchPresets
} from '@shared/schema';
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc } from "drizzle-orm";

// Preset configuration interface - comprehensive launch configuration
export interface LaunchPresetConfig {
  // Basic launch parameters
  tokenConfig: {
    name: string;
    symbol: string;
    totalSupply: string;
    decimals: number;
  };
  
  // Wallet allocation strategy
  allocationStrategy: {
    type: 'equal' | 'weighted' | 'custom';
    amounts?: { [walletId: string]: string };
    weights?: { [walletId: string]: number };
    baseAmount?: string; // Base amount per wallet for equal allocation
  };
  
  // Timing and execution
  executionTiming: {
    mode: 'simultaneous' | 'staggered' | 'sequential';
    delayRange?: { min: number; max: number };
    batchSize?: number;
    randomizeOrder?: boolean;
  };
  
  // Stealth configuration
  stealthConfig: {
    preset: 'none' | 'basic' | 'advanced' | 'military';
    humanLikeTiming: boolean;
    mevProtection: boolean;
    walletWarming: boolean;
    patternAvoidance: boolean;
    proxyRotation?: boolean;
    timingVariance?: number; // 0-1 for how much to vary timing
  };
  
  // Gas and transaction settings
  gasConfig: {
    strategy: 'conservative' | 'standard' | 'aggressive';
    maxGasPrice?: string;
    priorityFee?: string;
    gasLimitMultiplier?: number;
    dynamicPricing?: boolean;
  };
  
  // Monitoring and alerts
  monitoring: {
    realTimeUpdates: boolean;
    successThreshold: number; // 0-100 percentage
    alertOnFailure: boolean;
    analyticsEnabled: boolean;
    progressNotifications?: boolean;
  };

  // Advanced settings
  advanced?: {
    slippageTolerance?: number;
    deadlineMinutes?: number;
    retryAttempts?: number;
    failureHandling?: 'stop' | 'continue' | 'pause';
  };
}

// Configuration validation schema
const launchPresetConfigSchema = z.object({
  tokenConfig: z.object({
    name: z.string().min(1, "Token name is required"),
    symbol: z.string().min(1, "Token symbol is required").max(10, "Symbol too long"),
    totalSupply: z.string().min(1, "Total supply is required"),
    decimals: z.number().min(0).max(18),
  }),
  allocationStrategy: z.object({
    type: z.enum(['equal', 'weighted', 'custom']),
    amounts: z.record(z.string()).optional(),
    weights: z.record(z.number()).optional(),
    baseAmount: z.string().optional(),
  }),
  executionTiming: z.object({
    mode: z.enum(['simultaneous', 'staggered', 'sequential']),
    delayRange: z.object({
      min: z.number().min(0),
      max: z.number().min(0),
    }).optional(),
    batchSize: z.number().min(1).optional(),
    randomizeOrder: z.boolean().optional(),
  }),
  stealthConfig: z.object({
    preset: z.enum(['none', 'basic', 'advanced', 'military']),
    humanLikeTiming: z.boolean(),
    mevProtection: z.boolean(),
    walletWarming: z.boolean(),
    patternAvoidance: z.boolean(),
    proxyRotation: z.boolean().optional(),
    timingVariance: z.number().min(0).max(1).optional(),
  }),
  gasConfig: z.object({
    strategy: z.enum(['conservative', 'standard', 'aggressive']),
    maxGasPrice: z.string().optional(),
    priorityFee: z.string().optional(),
    gasLimitMultiplier: z.number().min(1).optional(),
    dynamicPricing: z.boolean().optional(),
  }),
  monitoring: z.object({
    realTimeUpdates: z.boolean(),
    successThreshold: z.number().min(0).max(100),
    alertOnFailure: z.boolean(),
    analyticsEnabled: z.boolean(),
    progressNotifications: z.boolean().optional(),
  }),
  advanced: z.object({
    slippageTolerance: z.number().min(0).max(1).optional(),
    deadlineMinutes: z.number().min(1).optional(),
    retryAttempts: z.number().min(0).optional(),
    failureHandling: z.enum(['stop', 'continue', 'pause']).optional(),
  }).optional(),
});

export class PresetManager {
  private storage: IStorage;
  private db: any; // Direct database access to bypass broken storage

  constructor(storage: IStorage) {
    this.storage = storage;
    // CRITICAL WORKAROUND: Direct DB access due to storage class runtime issues
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required for preset manager");
    }
    const sql = neon(process.env.DATABASE_URL);
    this.db = drizzle(sql);
  }

  /**
   * Initialize default presets - seeds the database with the 6 default presets using upsert operations
   */
  async initializeDefaultPresets(): Promise<void> {
    console.log('🔧 Initializing default launch presets...');
    
    try {
      const defaultPresets = this.getDefaultPresets();
      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;
      
      for (const preset of defaultPresets) {
        try {
          // CRITICAL WORKAROUND: Direct DB access due to storage class runtime issues
          const existingPresets = await this.db
            .select()
            .from(launchPresets)
            .where(eq(launchPresets.category, preset.category));
            
          const alreadyExists = existingPresets.some(p => 
            p.name === preset.name && 
            p.isDefault === (preset.isDefault || false)
          );
          
          if (!alreadyExists) {
            // Create new preset using direct DB access
            await this.db
              .insert(launchPresets)
              .values(preset)
              .returning();
            console.log(`✅ Created default preset: ${preset.name}`);
            successCount++;
          } else {
            console.log(`⏭️  Default preset already exists: ${preset.name}`);
            skipCount++;
          }
        } catch (error) {
          // Handle unique constraint violations gracefully
          if (error instanceof Error && error.message.includes('unique constraint')) {
            console.log(`⏭️  Preset already exists (constraint): ${preset.name}`);
            skipCount++;
          } else {
            console.error(`❌ Failed to seed preset ${preset.name}:`, error);
            errorCount++;
          }
          // Continue with other presets even if one fails
        }
      }
      
      console.log(`🎯 Default preset initialization complete: ${successCount} created, ${skipCount} skipped, ${errorCount} failed`);
      
      if (errorCount > 0) {
        console.warn(`⚠️  ${errorCount} presets failed to initialize. System may have reduced functionality.`);
      }
    } catch (error) {
      console.error('❌ Fatal error during preset initialization:', error);
      console.log('🔄 System will continue without default presets...');
    }
  }

  /**
   * Get all default preset configurations
   */
  private getDefaultPresets(): InsertLaunchPreset[] {
    return [
      this.createFairLaunchPreset(),
      this.createStealthLaunchPreset(),
      this.createPrivateSalePreset(),
      this.createLiquidityLaunchPreset(),
      this.createFlashLaunchPreset(),
      this.createConservativeLaunchPreset(),
    ];
  }

  /**
   * Fair Launch Preset - Transparent and equal distribution
   */
  private createFairLaunchPreset(): InsertLaunchPreset {
    const config: LaunchPresetConfig = {
      tokenConfig: {
        name: "Fair Launch Token",
        symbol: "FAIR",
        totalSupply: "1000000",
        decimals: 18,
      },
      allocationStrategy: {
        type: 'equal',
        baseAmount: "0.1", // 0.1 BNB per wallet
      },
      executionTiming: {
        mode: 'simultaneous',
        randomizeOrder: false,
      },
      stealthConfig: {
        preset: 'none',
        humanLikeTiming: false,
        mevProtection: false,
        walletWarming: false,
        patternAvoidance: false,
      },
      gasConfig: {
        strategy: 'standard',
        dynamicPricing: true,
        gasLimitMultiplier: 1.2,
      },
      monitoring: {
        realTimeUpdates: true,
        successThreshold: 95,
        alertOnFailure: true,
        analyticsEnabled: true,
        progressNotifications: true,
      },
      advanced: {
        slippageTolerance: 0.05,
        deadlineMinutes: 10,
        retryAttempts: 2,
        failureHandling: 'continue',
      },
    };

    return {
      name: "🎯 Fair Launch",
      description: "Transparent launch with equal allocation to all wallets. Perfect for community-focused projects with maximum transparency.",
      category: PRESET_CATEGORIES.FAIR,
      configuration: JSON.stringify(config),
      isDefault: true,
      isPublic: true,
      tags: ['transparent', 'equal', 'community', 'fair', 'simultaneous'],
    };
  }

  /**
   * Stealth Launch Preset - Maximum anonymity and stealth
   */
  private createStealthLaunchPreset(): InsertLaunchPreset {
    const config: LaunchPresetConfig = {
      tokenConfig: {
        name: "Stealth Token",
        symbol: "STEALTH",
        totalSupply: "500000",
        decimals: 18,
      },
      allocationStrategy: {
        type: 'weighted',
        weights: {}, // Will be calculated dynamically
      },
      executionTiming: {
        mode: 'staggered',
        delayRange: { min: 5000, max: 30000 }, // 5-30 seconds
        batchSize: 3,
        randomizeOrder: true,
      },
      stealthConfig: {
        preset: 'military',
        humanLikeTiming: true,
        mevProtection: true,
        walletWarming: true,
        patternAvoidance: true,
        proxyRotation: true,
        timingVariance: 0.4,
      },
      gasConfig: {
        strategy: 'aggressive',
        dynamicPricing: true,
        gasLimitMultiplier: 1.5,
      },
      monitoring: {
        realTimeUpdates: true,
        successThreshold: 85,
        alertOnFailure: true,
        analyticsEnabled: true,
        progressNotifications: false, // Silent operation
      },
      advanced: {
        slippageTolerance: 0.1,
        deadlineMinutes: 15,
        retryAttempts: 3,
        failureHandling: 'pause',
      },
    };

    return {
      name: "👤 Stealth Launch",
      description: "Maximum stealth with human-like timing, MEV protection, and wallet warming. Designed for complete anonymity.",
      category: PRESET_CATEGORIES.STEALTH,
      configuration: JSON.stringify(config),
      isDefault: true,
      isPublic: true,
      tags: ['stealth', 'anonymous', 'mev-protection', 'human-timing', 'advanced'],
    };
  }

  /**
   * Private Sale Preset - VIP allocation and tiered access
   */
  private createPrivateSalePreset(): InsertLaunchPreset {
    const config: LaunchPresetConfig = {
      tokenConfig: {
        name: "Private Sale Token",
        symbol: "PRIV",
        totalSupply: "2000000",
        decimals: 18,
      },
      allocationStrategy: {
        type: 'weighted',
        weights: {}, // VIP tiers will be set dynamically
      },
      executionTiming: {
        mode: 'sequential',
        delayRange: { min: 2000, max: 8000 }, // 2-8 seconds between tiers
        batchSize: 5,
        randomizeOrder: false, // Maintain tier priority
      },
      stealthConfig: {
        preset: 'advanced',
        humanLikeTiming: true,
        mevProtection: true,
        walletWarming: true,
        patternAvoidance: true,
        timingVariance: 0.2,
      },
      gasConfig: {
        strategy: 'aggressive',
        dynamicPricing: true,
        gasLimitMultiplier: 1.3,
      },
      monitoring: {
        realTimeUpdates: true,
        successThreshold: 90,
        alertOnFailure: true,
        analyticsEnabled: true,
        progressNotifications: true,
      },
      advanced: {
        slippageTolerance: 0.08,
        deadlineMinutes: 12,
        retryAttempts: 3,
        failureHandling: 'continue',
      },
    };

    return {
      name: "🏢 Private Sale",
      description: "Tiered allocation system with VIP priority execution. Perfect for private sales with different allocation tiers.",
      category: PRESET_CATEGORIES.PRIVATE,
      configuration: JSON.stringify(config),
      isDefault: true,
      isPublic: true,
      tags: ['private', 'vip', 'tiered', 'weighted', 'priority'],
    };
  }

  /**
   * Liquidity Launch Preset - AMM liquidity provision
   */
  private createLiquidityLaunchPreset(): InsertLaunchPreset {
    const config: LaunchPresetConfig = {
      tokenConfig: {
        name: "Liquidity Token",
        symbol: "LIQ",
        totalSupply: "10000000",
        decimals: 18,
      },
      allocationStrategy: {
        type: 'custom',
        amounts: {}, // Custom amounts for liquidity provision
      },
      executionTiming: {
        mode: 'staggered',
        delayRange: { min: 1000, max: 5000 }, // Fast execution for liquidity
        batchSize: 8,
        randomizeOrder: false,
      },
      stealthConfig: {
        preset: 'basic',
        humanLikeTiming: false, // Speed is priority
        mevProtection: true,
        walletWarming: false,
        patternAvoidance: true,
      },
      gasConfig: {
        strategy: 'aggressive',
        dynamicPricing: true,
        gasLimitMultiplier: 1.4, // Higher gas for AMM interactions
      },
      monitoring: {
        realTimeUpdates: true,
        successThreshold: 95,
        alertOnFailure: true,
        analyticsEnabled: true,
        progressNotifications: true,
      },
      advanced: {
        slippageTolerance: 0.15, // Higher tolerance for AMM
        deadlineMinutes: 8,
        retryAttempts: 4,
        failureHandling: 'stop', // Critical for liquidity provision
      },
    };

    return {
      name: "💧 Liquidity Launch",
      description: "Optimized for automated liquidity provision and AMM interactions. Fast execution with higher gas limits.",
      category: PRESET_CATEGORIES.LIQUIDITY,
      configuration: JSON.stringify(config),
      isDefault: true,
      isPublic: true,
      tags: ['liquidity', 'amm', 'fast', 'defi', 'provision'],
    };
  }

  /**
   * Flash Launch Preset - Maximum speed execution
   */
  private createFlashLaunchPreset(): InsertLaunchPreset {
    const config: LaunchPresetConfig = {
      tokenConfig: {
        name: "Flash Token",
        symbol: "FLASH",
        totalSupply: "100000",
        decimals: 18,
      },
      allocationStrategy: {
        type: 'equal',
        baseAmount: "0.05", // Smaller amounts for speed
      },
      executionTiming: {
        mode: 'simultaneous', // Maximum speed
        randomizeOrder: false,
      },
      stealthConfig: {
        preset: 'none', // Speed over stealth
        humanLikeTiming: false,
        mevProtection: false,
        walletWarming: false,
        patternAvoidance: false,
      },
      gasConfig: {
        strategy: 'aggressive',
        dynamicPricing: false, // Fixed high gas
        gasLimitMultiplier: 2.0, // Maximum gas
      },
      monitoring: {
        realTimeUpdates: true,
        successThreshold: 80, // Lower threshold for speed
        alertOnFailure: false, // No interruptions
        analyticsEnabled: true,
        progressNotifications: true,
      },
      advanced: {
        slippageTolerance: 0.2, // High tolerance for speed
        deadlineMinutes: 5,
        retryAttempts: 1, // Minimal retries
        failureHandling: 'continue',
      },
    };

    return {
      name: "⚡ Flash Launch",
      description: "Maximum speed execution with parallel processing. Sacrifices stealth for ultimate performance.",
      category: PRESET_CATEGORIES.FLASH,
      configuration: JSON.stringify(config),
      isDefault: true,
      isPublic: true,
      tags: ['fast', 'parallel', 'speed', 'aggressive', 'high-gas'],
    };
  }

  /**
   * Conservative Launch Preset - Low risk, high security
   */
  private createConservativeLaunchPreset(): InsertLaunchPreset {
    const config: LaunchPresetConfig = {
      tokenConfig: {
        name: "Conservative Token",
        symbol: "SAFE",
        totalSupply: "5000000",
        decimals: 18,
      },
      allocationStrategy: {
        type: 'equal',
        baseAmount: "0.02", // Small, safe amounts
      },
      executionTiming: {
        mode: 'sequential',
        delayRange: { min: 10000, max: 60000 }, // Long delays for safety
        batchSize: 2,
        randomizeOrder: false,
      },
      stealthConfig: {
        preset: 'advanced',
        humanLikeTiming: true,
        mevProtection: true,
        walletWarming: true,
        patternAvoidance: true,
        timingVariance: 0.3,
      },
      gasConfig: {
        strategy: 'conservative',
        dynamicPricing: true,
        gasLimitMultiplier: 1.1, // Minimal gas buffer
      },
      monitoring: {
        realTimeUpdates: true,
        successThreshold: 98, // Very high success requirement
        alertOnFailure: true,
        analyticsEnabled: true,
        progressNotifications: true,
      },
      advanced: {
        slippageTolerance: 0.03, // Very low slippage
        deadlineMinutes: 30, // Extended deadline
        retryAttempts: 5, // Multiple retries
        failureHandling: 'stop', // Stop on any failure
      },
    };

    return {
      name: "🛡️ Conservative Launch",
      description: "Maximum security with extended timing windows and enhanced monitoring. Perfect for risk-averse launches.",
      category: PRESET_CATEGORIES.CONSERVATIVE,
      configuration: JSON.stringify(config),
      isDefault: true,
      isPublic: true,
      tags: ['safe', 'conservative', 'low-risk', 'secure', 'monitored'],
    };
  }

  /**
   * Validate a preset configuration
   */
  validateConfiguration(config: unknown): { isValid: boolean; errors?: string[]; validatedConfig?: LaunchPresetConfig } {
    try {
      const validatedConfig = launchPresetConfigSchema.parse(config);
      
      // Additional business logic validation
      const errors = this.performBusinessLogicValidation(validatedConfig);
      
      return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        validatedConfig: validatedConfig,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }
      
      return {
        isValid: false,
        errors: ['Unknown validation error'],
      };
    }
  }

  /**
   * Perform additional business logic validation
   */
  private performBusinessLogicValidation(config: LaunchPresetConfig): string[] {
    const errors: string[] = [];

    // Validate allocation strategy consistency
    if (config.allocationStrategy.type === 'weighted' && !config.allocationStrategy.weights) {
      errors.push('Weighted allocation requires weights to be specified');
    }

    if (config.allocationStrategy.type === 'custom' && !config.allocationStrategy.amounts) {
      errors.push('Custom allocation requires amounts to be specified');
    }

    // Validate execution timing
    if (config.executionTiming.mode === 'staggered' && !config.executionTiming.delayRange) {
      errors.push('Staggered execution requires delay range to be specified');
    }

    if (config.executionTiming.delayRange) {
      const { min, max } = config.executionTiming.delayRange;
      if (min >= max) {
        errors.push('Delay range minimum must be less than maximum');
      }
    }

    // Validate gas configuration
    if (config.gasConfig.maxGasPrice && config.gasConfig.priorityFee) {
      const maxGas = BigInt(config.gasConfig.maxGasPrice);
      const priority = BigInt(config.gasConfig.priorityFee);
      
      if (priority >= maxGas) {
        errors.push('Priority fee must be less than max gas price');
      }
    }

    // Validate monitoring thresholds
    if (config.monitoring.successThreshold < 0 || config.monitoring.successThreshold > 100) {
      errors.push('Success threshold must be between 0 and 100');
    }

    return errors;
  }

  /**
   * Merge preset configuration with user customizations
   */
  mergeConfigurations(baseConfig: LaunchPresetConfig, customizations: Partial<LaunchPresetConfig>): LaunchPresetConfig {
    // Deep merge configurations
    const merged = this.deepMerge(baseConfig, customizations);
    
    // Validate the merged configuration
    const validation = this.validateConfiguration(merged);
    
    if (!validation.isValid) {
      throw new Error(`Invalid merged configuration: ${validation.errors?.join(', ')}`);
    }
    
    return validation.validatedConfig!;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Get preset configuration by ID
   */
  async getPresetConfiguration(presetId: string): Promise<LaunchPresetConfig | null> {
    try {
      const preset = await this.storage.getLaunchPreset(presetId);
      
      if (!preset) {
        return null;
      }
      
      return JSON.parse(preset.configuration) as LaunchPresetConfig;
    } catch (error) {
      console.error('Error getting preset configuration:', error);
      return null;
    }
  }

  /**
   * Apply preset to launch plan parameters
   */
  async applyPresetToLaunchPlan(presetId: string, launchPlanId: string, customizations?: Partial<LaunchPresetConfig>) {
    const presetConfig = await this.getPresetConfiguration(presetId);
    
    if (!presetConfig) {
      throw new Error('Preset not found');
    }
    
    // Apply customizations if provided
    const finalConfig = customizations 
      ? this.mergeConfigurations(presetConfig, customizations)
      : presetConfig;
    
    // Update launch plan with preset configuration
    const launchPlan = await this.storage.getLaunchPlan(launchPlanId);
    
    if (!launchPlan) {
      throw new Error('Launch plan not found');
    }
    
    // Update launch plan with token configuration from preset
    const updatedLaunchPlan = await this.storage.updateLaunchPlan(launchPlanId, {
      tokenName: finalConfig.tokenConfig.name,
      tokenSymbol: finalConfig.tokenConfig.symbol,
      totalSupply: finalConfig.tokenConfig.totalSupply,
      // Add other relevant fields as needed
    });
    
    return {
      launchPlan: updatedLaunchPlan,
      appliedConfig: finalConfig,
    };
  }
}