import { EventEmitter } from 'events';
import axios from 'axios';
import type { DbStorage } from './storage';
import type { BSCClient } from './blockchain-client';
import type { MarketDataCache, InsertMarketDataCache } from '@shared/schema';

export interface TokenPrice {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;
  currentPrice: string;
  priceChange24h?: string;
  volume24h?: string;
  marketCap?: string;
  totalSupply?: string;
  circulatingSupply?: string;
  priceSource: string;
  timestamp: Date;
}

export interface PriceUpdate {
  tokenAddress: string;
  price: string;
  change24h?: string;
  volume24h?: string;
  timestamp: Date;
}

export interface HistoricalPrice {
  tokenAddress: string;
  price: string;
  timestamp: Date;
  blockNumber?: number;
}

export interface MarketDataConfig {
  updateInterval: number; // milliseconds
  maxCacheAge: number; // milliseconds
  enableRealTimeUpdates: boolean;
  priceApiTimeouts: {
    pancakeswap: number;
    dextools: number;
    coingecko: number;
  };
  fallbackSources: string[];
}

export class MarketDataService extends EventEmitter {
  private storage: DbStorage;
  private bscClient: BSCClient;
  private config: MarketDataConfig;
  private priceCache: Map<string, TokenPrice> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;
  private watchedTokens = new Set<string>();

  // PancakeSwap V3 Quoter Contract on BSC
  private readonly PANCAKESWAP_QUOTER = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997';
  private readonly PANCAKESWAP_FACTORY = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865';
  
  // Common token addresses on BSC
  private readonly WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
  private readonly USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
  private readonly BUSD_ADDRESS = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';

  constructor(storage: DbStorage, bscClient: BSCClient) {
    super();
    this.storage = storage;
    this.bscClient = bscClient;
    
    this.config = {
      updateInterval: 30000, // 30 seconds
      maxCacheAge: 300000, // 5 minutes
      enableRealTimeUpdates: true,
      priceApiTimeouts: {
        pancakeswap: 10000,
        dextools: 15000,
        coingecko: 20000,
      },
      fallbackSources: ['pancakeswap', 'dextools', 'coingecko'],
    };

    console.log('🔄 Market Data Service initialized');
  }

  /**
   * Start the market data service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Market Data Service already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting Market Data Service...');

    // Load watched tokens from database
    await this.loadWatchedTokens();

    // Start real-time price updates
    if (this.config.enableRealTimeUpdates) {
      this.startRealTimeUpdates();
    }

    // Load cached prices from database
    await this.loadCachedPrices();

    console.log('✅ Market Data Service started successfully');
    this.emit('started');
  }

  /**
   * Stop the market data service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log('🛑 Stopping Market Data Service...');

    // Clear all intervals
    for (const [tokenAddress, interval] of this.updateIntervals) {
      clearInterval(interval);
    }
    this.updateIntervals.clear();

    console.log('✅ Market Data Service stopped');
    this.emit('stopped');
  }

  /**
   * Add a token to the watch list for real-time price updates
   */
  async watchToken(tokenAddress: string, tokenSymbol?: string): Promise<void> {
    tokenAddress = tokenAddress.toLowerCase();
    
    if (this.watchedTokens.has(tokenAddress)) {
      return;
    }

    this.watchedTokens.add(tokenAddress);
    console.log(`👀 Now watching token: ${tokenSymbol || tokenAddress}`);

    // Start real-time updates for this token
    if (this.isRunning && this.config.enableRealTimeUpdates) {
      await this.startTokenUpdates(tokenAddress, tokenSymbol);
    }

    this.emit('tokenWatched', { tokenAddress, tokenSymbol });
  }

  /**
   * Remove a token from the watch list
   */
  async unwatchToken(tokenAddress: string): Promise<void> {
    tokenAddress = tokenAddress.toLowerCase();
    
    if (!this.watchedTokens.has(tokenAddress)) {
      return;
    }

    this.watchedTokens.delete(tokenAddress);
    
    // Stop updates for this token
    const interval = this.updateIntervals.get(tokenAddress);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(tokenAddress);
    }

    console.log(`🚫 Stopped watching token: ${tokenAddress}`);
    this.emit('tokenUnwatched', { tokenAddress });
  }

  /**
   * Get current price for a token with multiple fallback sources
   */
  async getTokenPrice(tokenAddress: string, forceRefresh = false): Promise<TokenPrice | null> {
    tokenAddress = tokenAddress.toLowerCase();

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cached = this.priceCache.get(tokenAddress);
      if (cached && this.isCacheValid(cached)) {
        return cached;
      }

      // Try database cache
      const dbCached = await this.storage.getMarketDataCache(tokenAddress);
      if (dbCached && this.isCacheValid({ ...dbCached, timestamp: dbCached.lastUpdated })) {
        const price: TokenPrice = {
          tokenAddress: dbCached.tokenAddress,
          tokenSymbol: dbCached.tokenSymbol,
          tokenName: dbCached.tokenName || undefined,
          currentPrice: dbCached.currentPrice,
          priceChange24h: dbCached.priceChange24h || undefined,
          volume24h: dbCached.volume24h || undefined,
          marketCap: dbCached.marketCap || undefined,
          totalSupply: dbCached.totalSupply || undefined,
          circulatingSupply: dbCached.circulatingSupply || undefined,
          priceSource: dbCached.priceSource,
          timestamp: dbCached.lastUpdated,
        };
        this.priceCache.set(tokenAddress, price);
        return price;
      }
    }

    // Fetch fresh price from external sources
    for (const source of this.config.fallbackSources) {
      try {
        const price = await this.fetchPriceFromSource(tokenAddress, source);
        if (price) {
          // Cache the result
          this.priceCache.set(tokenAddress, price);
          await this.savePriceToDatabase(price);
          
          this.emit('priceUpdate', {
            tokenAddress,
            price: price.currentPrice,
            change24h: price.priceChange24h,
            volume24h: price.volume24h,
            timestamp: price.timestamp,
          });

          return price;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch price from ${source} for ${tokenAddress}:`, error);
        continue;
      }
    }

    console.error(`❌ Failed to fetch price for token ${tokenAddress} from all sources`);
    return null;
  }

  /**
   * Get historical prices for a token within a time range
   */
  async getHistoricalPrices(
    tokenAddress: string,
    startTime: Date,
    endTime: Date,
    interval: '1h' | '4h' | '1d' = '1h'
  ): Promise<HistoricalPrice[]> {
    // This is a simplified implementation
    // In production, you would integrate with services like CoinGecko, DexTools, or TheGraph
    
    try {
      // For now, return mock historical data based on current price
      const currentPrice = await this.getTokenPrice(tokenAddress);
      if (!currentPrice) {
        return [];
      }

      const prices: HistoricalPrice[] = [];
      const basePrice = parseFloat(currentPrice.currentPrice);
      const timeRange = endTime.getTime() - startTime.getTime();
      const intervalMs = this.getIntervalMs(interval);
      const points = Math.min(Math.floor(timeRange / intervalMs), 100); // Limit to 100 points

      for (let i = 0; i < points; i++) {
        const timestamp = new Date(startTime.getTime() + (i * intervalMs));
        // Generate realistic price variation (±5%)
        const variation = (Math.random() - 0.5) * 0.1; // ±5%
        const price = basePrice * (1 + variation);

        prices.push({
          tokenAddress,
          price: price.toString(),
          timestamp,
        });
      }

      return prices;
    } catch (error) {
      console.error(`❌ Failed to get historical prices for ${tokenAddress}:`, error);
      return [];
    }
  }

  /**
   * Get prices for multiple tokens at once
   */
  async getMultipleTokenPrices(tokenAddresses: string[]): Promise<Map<string, TokenPrice | null>> {
    const results = new Map<string, TokenPrice | null>();
    
    // Process in parallel for better performance
    const promises = tokenAddresses.map(async (address) => {
      const price = await this.getTokenPrice(address);
      return { address: address.toLowerCase(), price };
    });

    const responses = await Promise.allSettled(promises);
    
    responses.forEach((result, index) => {
      const address = tokenAddresses[index].toLowerCase();
      if (result.status === 'fulfilled') {
        results.set(address, result.value.price);
      } else {
        results.set(address, null);
        console.error(`❌ Failed to get price for ${address}:`, result.reason);
      }
    });

    return results;
  }

  /**
   * Calculate USD value for a token amount
   */
  async calculateUSDValue(tokenAddress: string, tokenAmount: string): Promise<string | null> {
    const price = await this.getTokenPrice(tokenAddress);
    if (!price) {
      return null;
    }

    try {
      const amount = parseFloat(tokenAmount);
      const priceValue = parseFloat(price.currentPrice);
      const usdValue = amount * priceValue;
      
      return usdValue.toString();
    } catch (error) {
      console.error(`❌ Failed to calculate USD value:`, error);
      return null;
    }
  }

  // Private methods

  private async loadWatchedTokens(): Promise<void> {
    try {
      // Load unique token addresses from token positions and transaction P&L
      const tokens = await this.storage.getUniqueTokenAddresses();
      
      for (const tokenAddress of tokens) {
        this.watchedTokens.add(tokenAddress.toLowerCase());
      }

      console.log(`📋 Loaded ${this.watchedTokens.size} tokens to watch`);
    } catch (error) {
      console.error('❌ Failed to load watched tokens:', error);
    }
  }

  private async loadCachedPrices(): Promise<void> {
    try {
      const cachedPrices = await this.storage.getAllMarketDataCache();
      
      for (const cached of cachedPrices) {
        if (this.isCacheValid({ ...cached, timestamp: cached.lastUpdated })) {
          const price: TokenPrice = {
            tokenAddress: cached.tokenAddress,
            tokenSymbol: cached.tokenSymbol,
            tokenName: cached.tokenName || undefined,
            currentPrice: cached.currentPrice,
            priceChange24h: cached.priceChange24h || undefined,
            volume24h: cached.volume24h || undefined,
            marketCap: cached.marketCap || undefined,
            totalSupply: cached.totalSupply || undefined,
            circulatingSupply: cached.circulatingSupply || undefined,
            priceSource: cached.priceSource,
            timestamp: cached.lastUpdated,
          };
          this.priceCache.set(cached.tokenAddress, price);
        }
      }

      console.log(`💾 Loaded ${this.priceCache.size} cached prices`);
    } catch (error) {
      console.error('❌ Failed to load cached prices:', error);
    }
  }

  private startRealTimeUpdates(): void {
    // Start updates for all watched tokens
    for (const tokenAddress of this.watchedTokens) {
      this.startTokenUpdates(tokenAddress);
    }
  }

  private async startTokenUpdates(tokenAddress: string, tokenSymbol?: string): Promise<void> {
    // Clear existing interval if any
    const existingInterval = this.updateIntervals.get(tokenAddress);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Start new interval
    const interval = setInterval(async () => {
      try {
        await this.getTokenPrice(tokenAddress, true); // Force refresh
      } catch (error) {
        console.error(`❌ Error updating price for ${tokenSymbol || tokenAddress}:`, error);
      }
    }, this.config.updateInterval);

    this.updateIntervals.set(tokenAddress, interval);
  }

  private async fetchPriceFromSource(tokenAddress: string, source: string): Promise<TokenPrice | null> {
    switch (source) {
      case 'pancakeswap':
        return this.fetchPriceFromPancakeSwap(tokenAddress);
      case 'dextools':
        return this.fetchPriceFromDexTools(tokenAddress);
      case 'coingecko':
        return this.fetchPriceFromCoinGecko(tokenAddress);
      default:
        throw new Error(`Unknown price source: ${source}`);
    }
  }

  private async fetchPriceFromPancakeSwap(tokenAddress: string): Promise<TokenPrice | null> {
    try {
      // This is a simplified implementation
      // In production, you would use the PancakeSwap SDK or subgraph
      
      // Mock price calculation based on WBNB pair
      const mockPrice = Math.random() * 1000; // Random price for demo
      
      return {
        tokenAddress,
        tokenSymbol: 'UNKNOWN',
        currentPrice: mockPrice.toString(),
        priceSource: 'pancakeswap',
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('❌ PancakeSwap price fetch failed:', error);
      return null;
    }
  }

  private async fetchPriceFromDexTools(tokenAddress: string): Promise<TokenPrice | null> {
    try {
      // Mock implementation - in production use DexTools API
      const mockPrice = Math.random() * 1000;
      
      return {
        tokenAddress,
        tokenSymbol: 'UNKNOWN',
        currentPrice: mockPrice.toString(),
        priceChange24h: ((Math.random() - 0.5) * 20).toString(), // ±10%
        volume24h: (Math.random() * 1000000).toString(),
        priceSource: 'dextools',
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('❌ DexTools price fetch failed:', error);
      return null;
    }
  }

  private async fetchPriceFromCoinGecko(tokenAddress: string): Promise<TokenPrice | null> {
    try {
      // Mock implementation - in production use CoinGecko API
      const mockPrice = Math.random() * 1000;
      
      return {
        tokenAddress,
        tokenSymbol: 'UNKNOWN',
        currentPrice: mockPrice.toString(),
        priceChange24h: ((Math.random() - 0.5) * 20).toString(),
        volume24h: (Math.random() * 1000000).toString(),
        marketCap: (Math.random() * 100000000).toString(),
        priceSource: 'coingecko',
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('❌ CoinGecko price fetch failed:', error);
      return null;
    }
  }

  private async savePriceToDatabase(price: TokenPrice): Promise<void> {
    try {
      const cacheData: InsertMarketDataCache = {
        tokenAddress: price.tokenAddress,
        tokenSymbol: price.tokenSymbol,
        tokenName: price.tokenName,
        currentPrice: price.currentPrice,
        priceChange24h: price.priceChange24h,
        volume24h: price.volume24h,
        marketCap: price.marketCap,
        totalSupply: price.totalSupply,
        circulatingSupply: price.circulatingSupply,
        priceSource: price.priceSource,
      };

      await this.storage.upsertMarketDataCache(cacheData);
    } catch (error) {
      console.error('❌ Failed to save price to database:', error);
    }
  }

  private isCacheValid(price: { timestamp: Date }): boolean {
    const age = Date.now() - price.timestamp.getTime();
    return age < this.config.maxCacheAge;
  }

  private getIntervalMs(interval: string): number {
    switch (interval) {
      case '1h': return 60 * 60 * 1000;
      case '4h': return 4 * 60 * 60 * 1000;
      case '1d': return 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }

  // Public getters
  get isServiceRunning(): boolean {
    return this.isRunning;
  }

  get watchedTokenCount(): number {
    return this.watchedTokens.size;
  }

  get cachedPriceCount(): number {
    return this.priceCache.size;
  }

  getWatchedTokens(): string[] {
    return Array.from(this.watchedTokens);
  }
}