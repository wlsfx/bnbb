import { EventEmitter } from 'events';
import type { DbStorage } from './storage';
import type { MarketDataService } from './market-data-service';
import type { PnLService } from './pnl-service';
import type { 
  TokenPosition, 
  PortfolioSnapshot, 
  PerformanceMetrics,
  InsertPerformanceMetrics 
} from '@shared/schema';

export interface PortfolioOverview {
  totalValue: string;
  totalPnL: string;
  realizedPnL: string;
  unrealizedPnL: string;
  totalROI: string;
  dayChange: string;
  dayChangePercent: string;
  totalPositions: number;
  activeWallets: number;
  topPerformingToken: string;
  worstPerformingToken: string;
  lastUpdated: Date;
}

export interface WalletPerformance {
  walletId: string;
  walletLabel?: string;
  totalValue: string;
  totalPnL: string;
  roi: string;
  dayChange: string;
  positionCount: number;
  winRate: string;
  bestPosition: string;
  worstPosition: string;
  riskScore: number;
  allocationPercentage: string;
}

export interface TokenExposure {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;
  totalQuantity: string;
  totalValue: string;
  totalCost: string;
  totalPnL: string;
  roi: string;
  exposurePercentage: string;
  walletCount: number;
  averagePrice: string;
  currentPrice: string;
  priceChange24h: string;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
}

export interface PositionAnalysis {
  tokenAddress: string;
  tokenSymbol: string;
  analysis: {
    concentration: number;      // How concentrated is this position (0-100)
    correlation: number;        // Correlation with portfolio (-1 to 1)
    volatility: number;         // Price volatility score (0-100)
    liquidity: number;          // Liquidity score (0-100)
    momentum: number;           // Price momentum score (-100 to 100)
    riskScore: number;          // Overall risk score (0-100)
  };
  recommendation: 'hold' | 'reduce' | 'increase' | 'close';
  reasoning: string;
}

export interface PortfolioRisk {
  overallRiskScore: number;    // 0-100 (100 = highest risk)
  diversificationScore: number; // 0-100 (100 = well diversified)
  concentrationRisk: number;   // 0-100 (100 = highly concentrated)
  volatilityScore: number;     // 0-100 (100 = very volatile)
  liquidityScore: number;      // 0-100 (100 = very liquid)
  maxDrawdown: string;         // Maximum observed drawdown
  sharpeRatio: string;         // Risk-adjusted return metric
  recommendations: string[];   // Risk management recommendations
}

export interface PerformanceComparison {
  period: '1h' | '24h' | '7d' | '30d' | 'all_time';
  portfolioReturn: string;
  benchmarkReturn: string;     // vs BNB or market index
  alpha: string;               // Excess return vs benchmark
  beta: string;                // Portfolio sensitivity to market
  outperformanceRatio: string; // % of time outperforming benchmark
  maxDrawdown: string;
  bestPeriod: string;
  worstPeriod: string;
}

export class PortfolioTracker extends EventEmitter {
  private storage: DbStorage;
  private marketDataService: MarketDataService;
  private pnlService: PnLService;
  private isRunning = false;
  private updateInterval = 60000; // 1 minute
  private refreshTimer?: NodeJS.Timeout;
  
  // Cache for frequent calculations
  private portfolioCache = new Map<string, PortfolioOverview>();
  private exposureCache = new Map<string, TokenExposure[]>();
  private riskCache = new Map<string, PortfolioRisk>();

  constructor(storage: DbStorage, marketDataService: MarketDataService, pnlService: PnLService) {
    super();
    this.storage = storage;
    this.marketDataService = marketDataService;
    this.pnlService = pnlService;

    console.log('📈 Portfolio Tracker initialized');
  }

  /**
   * Start the portfolio tracker service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Portfolio Tracker already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting Portfolio Tracker...');

    // Set up real-time monitoring
    this.setupRealTimeMonitoring();

    // Initial cache warm-up
    await this.warmUpCaches();

    console.log('✅ Portfolio Tracker started successfully');
    this.emit('started');
  }

  /**
   * Stop the portfolio tracker service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log('🛑 Stopping Portfolio Tracker...');

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    console.log('✅ Portfolio Tracker stopped');
    this.emit('stopped');
  }

  /**
   * Get comprehensive portfolio overview for an access key
   */
  async getPortfolioOverview(accessKeyId: string, forceRefresh = false): Promise<PortfolioOverview> {
    try {
      // Check cache first
      if (!forceRefresh && this.portfolioCache.has(accessKeyId)) {
        const cached = this.portfolioCache.get(accessKeyId)!;
        const cacheAge = Date.now() - cached.lastUpdated.getTime();
        if (cacheAge < this.updateInterval) {
          return cached;
        }
      }

      const wallets = await this.storage.getWallets(accessKeyId);
      const positions = await this.storage.getAllTokenPositionsByAccessKey(accessKeyId);
      
      let totalValue = 0;
      let totalPnL = 0;
      let realizedPnL = 0;
      let unrealizedPnL = 0;
      let dayChangeValue = 0;

      // Calculate portfolio totals
      for (const position of positions) {
        totalValue += parseFloat(position.currentValue);
        totalPnL += parseFloat(position.totalPnL);
        realizedPnL += parseFloat(position.realizedPnL);
        unrealizedPnL += parseFloat(position.unrealizedPnL);
        
        // Calculate day change (simplified - in reality you'd use historical snapshots)
        const dayChange = parseFloat(position.priceChange24h || '0') * parseFloat(position.currentBalance);
        dayChangeValue += dayChange;
      }

      const totalROI = totalValue > 0 ? ((totalPnL / (totalValue - totalPnL)) * 100) : 0;
      const dayChangePercent = totalValue > 0 ? ((dayChangeValue / totalValue) * 100) : 0;

      // Find top and worst performing tokens
      const sortedByPnL = positions.sort((a, b) => parseFloat(b.totalPnL) - parseFloat(a.totalPnL));
      const topPerformingToken = sortedByPnL[0]?.tokenSymbol || 'N/A';
      const worstPerformingToken = sortedByPnL[sortedByPnL.length - 1]?.tokenSymbol || 'N/A';

      const overview: PortfolioOverview = {
        totalValue: totalValue.toFixed(8),
        totalPnL: totalPnL.toFixed(8),
        realizedPnL: realizedPnL.toFixed(8),
        unrealizedPnL: unrealizedPnL.toFixed(8),
        totalROI: totalROI.toFixed(4),
        dayChange: dayChangeValue.toFixed(8),
        dayChangePercent: dayChangePercent.toFixed(2),
        totalPositions: positions.length,
        activeWallets: wallets.length,
        topPerformingToken,
        worstPerformingToken,
        lastUpdated: new Date(),
      };

      // Cache the result
      this.portfolioCache.set(accessKeyId, overview);

      return overview;
    } catch (error) {
      console.error('❌ Failed to get portfolio overview:', error);
      throw error;
    }
  }

  /**
   * Get performance comparison between wallets
   */
  async getWalletPerformanceComparison(accessKeyId: string): Promise<WalletPerformance[]> {
    try {
      const wallets = await this.storage.getWallets(accessKeyId);
      const walletPerformances: WalletPerformance[] = [];

      let totalPortfolioValue = 0;

      // First pass: calculate total portfolio value
      for (const wallet of wallets) {
        const positions = await this.storage.getTokenPositionsByWallet(wallet.id);
        const walletValue = positions.reduce((sum, pos) => sum + parseFloat(pos.currentValue), 0);
        totalPortfolioValue += walletValue;
      }

      // Second pass: calculate individual wallet performance
      for (const wallet of wallets) {
        const positions = await this.storage.getTokenPositionsByWallet(wallet.id);
        const pnlData = await this.pnlService.calculateWalletPnL(wallet.id);

        const walletValue = positions.reduce((sum, pos) => sum + parseFloat(pos.currentValue), 0);
        const dayChange = positions.reduce((sum, pos) => {
          const change = parseFloat(pos.priceChange24h || '0') * parseFloat(pos.currentBalance);
          return sum + change;
        }, 0);

        // Find best and worst positions
        const sortedPositions = positions.sort((a, b) => parseFloat(b.totalPnL) - parseFloat(a.totalPnL));
        const bestPosition = sortedPositions[0]?.tokenSymbol || 'N/A';
        const worstPosition = sortedPositions[sortedPositions.length - 1]?.tokenSymbol || 'N/A';

        // Calculate risk score (simplified)
        const riskScore = this.calculateWalletRiskScore(positions);
        const allocationPercentage = totalPortfolioValue > 0 ? (walletValue / totalPortfolioValue) * 100 : 0;

        walletPerformances.push({
          walletId: wallet.id,
          walletLabel: wallet.label,
          totalValue: walletValue.toFixed(8),
          totalPnL: pnlData.netPnL,
          roi: pnlData.roi,
          dayChange: dayChange.toFixed(8),
          positionCount: positions.length,
          winRate: pnlData.winRate,
          bestPosition,
          worstPosition,
          riskScore,
          allocationPercentage: allocationPercentage.toFixed(2),
        });
      }

      return walletPerformances.sort((a, b) => parseFloat(b.totalValue) - parseFloat(a.totalValue));
    } catch (error) {
      console.error('❌ Failed to get wallet performance comparison:', error);
      throw error;
    }
  }

  /**
   * Get token exposure analysis across all wallets
   */
  async getTokenExposureAnalysis(accessKeyId: string): Promise<TokenExposure[]> {
    try {
      // Check cache first
      if (this.exposureCache.has(accessKeyId)) {
        return this.exposureCache.get(accessKeyId)!;
      }

      const positions = await this.storage.getAllTokenPositionsByAccessKey(accessKeyId);
      const exposureMap = new Map<string, TokenExposure>();

      // Aggregate positions by token
      for (const position of positions) {
        const existing = exposureMap.get(position.tokenAddress);
        
        if (existing) {
          // Aggregate existing exposure
          const newQuantity = parseFloat(existing.totalQuantity) + parseFloat(position.currentBalance);
          const newValue = parseFloat(existing.totalValue) + parseFloat(position.currentValue);
          const newCost = parseFloat(existing.totalCost) + parseFloat(position.totalCost);
          const newPnL = parseFloat(existing.totalPnL) + parseFloat(position.totalPnL);
          
          existing.totalQuantity = newQuantity.toFixed(8);
          existing.totalValue = newValue.toFixed(8);
          existing.totalCost = newCost.toFixed(8);
          existing.totalPnL = newPnL.toFixed(8);
          existing.roi = newCost > 0 ? ((newPnL / newCost) * 100).toFixed(4) : '0';
          existing.walletCount += 1;
          
          // Weighted average price
          const totalQuantity = newQuantity;
          if (totalQuantity > 0) {
            existing.averagePrice = (newCost / totalQuantity).toFixed(8);
          }
        } else {
          // Create new exposure entry
          const exposure: TokenExposure = {
            tokenAddress: position.tokenAddress,
            tokenSymbol: position.tokenSymbol,
            tokenName: position.tokenName,
            totalQuantity: position.currentBalance,
            totalValue: position.currentValue,
            totalCost: position.totalCost,
            totalPnL: position.totalPnL,
            roi: position.roi,
            exposurePercentage: '0', // Will be calculated later
            walletCount: 1,
            averagePrice: position.averageCostBasis,
            currentPrice: position.currentPrice || '0',
            priceChange24h: position.priceChange24h || '0',
            riskLevel: this.assessTokenRiskLevel(position),
          };
          
          exposureMap.set(position.tokenAddress, exposure);
        }
      }

      // Calculate exposure percentages
      const totalPortfolioValue = Array.from(exposureMap.values())
        .reduce((sum, exp) => sum + parseFloat(exp.totalValue), 0);

      const exposures = Array.from(exposureMap.values()).map(exposure => {
        exposure.exposurePercentage = totalPortfolioValue > 0 ? 
          ((parseFloat(exposure.totalValue) / totalPortfolioValue) * 100).toFixed(2) : '0';
        return exposure;
      });

      // Sort by total value descending
      exposures.sort((a, b) => parseFloat(b.totalValue) - parseFloat(a.totalValue));

      // Cache the result
      this.exposureCache.set(accessKeyId, exposures);

      return exposures;
    } catch (error) {
      console.error('❌ Failed to get token exposure analysis:', error);
      throw error;
    }
  }

  /**
   * Get portfolio risk analysis
   */
  async getPortfolioRiskAnalysis(accessKeyId: string): Promise<PortfolioRisk> {
    try {
      // Check cache first
      if (this.riskCache.has(accessKeyId)) {
        return this.riskCache.get(accessKeyId)!;
      }

      const exposures = await this.getTokenExposureAnalysis(accessKeyId);
      const snapshots = await this.storage.getPortfolioSnapshots(accessKeyId, 30); // Last 30 snapshots

      // Calculate concentration risk (Herfindahl-Hirschman Index)
      const concentrationRisk = this.calculateConcentrationRisk(exposures);
      
      // Calculate diversification score
      const diversificationScore = Math.max(0, 100 - concentrationRisk);
      
      // Calculate volatility score from portfolio snapshots
      const volatilityScore = this.calculateVolatilityScore(snapshots);
      
      // Calculate liquidity score
      const liquidityScore = this.calculateLiquidityScore(exposures);
      
      // Calculate maximum drawdown
      const maxDrawdown = this.calculateMaxDrawdown(snapshots);
      
      // Calculate Sharpe ratio
      const sharpeRatio = this.calculateSharpeRatio(snapshots);
      
      // Overall risk score (weighted average)
      const overallRiskScore = (
        concentrationRisk * 0.3 +
        volatilityScore * 0.3 +
        (100 - liquidityScore) * 0.2 +
        (parseFloat(maxDrawdown) * 2) * 0.2 // Convert drawdown to 0-100 scale
      );

      // Generate recommendations
      const recommendations = this.generateRiskRecommendations(
        concentrationRisk,
        diversificationScore,
        volatilityScore,
        liquidityScore,
        parseFloat(maxDrawdown)
      );

      const portfolioRisk: PortfolioRisk = {
        overallRiskScore: Math.min(100, Math.max(0, overallRiskScore)),
        diversificationScore,
        concentrationRisk,
        volatilityScore,
        liquidityScore,
        maxDrawdown: maxDrawdown.toFixed(4),
        sharpeRatio: sharpeRatio.toFixed(4),
        recommendations,
      };

      // Cache the result
      this.riskCache.set(accessKeyId, portfolioRisk);

      return portfolioRisk;
    } catch (error) {
      console.error('❌ Failed to get portfolio risk analysis:', error);
      throw error;
    }
  }

  /**
   * Calculate performance metrics and save to database
   */
  async calculateAndSavePerformanceMetrics(accessKeyId: string, timeframes: string[] = ['1h', '24h', '7d', '30d', 'all_time']): Promise<void> {
    try {
      for (const timeframe of timeframes) {
        const startTime = this.getTimeframeStartDate(timeframe);
        const endTime = new Date();

        // Get portfolio data for the timeframe
        const snapshots = await this.storage.getPortfolioSnapshotsByTimeframe(accessKeyId, startTime, endTime);
        const transactions = await this.storage.getTransactionPnLByTimeframe(accessKeyId, startTime, endTime);

        if (snapshots.length === 0) {
          continue; // Skip if no data for this timeframe
        }

        // Calculate performance metrics
        const totalPnL = snapshots[snapshots.length - 1]?.totalPnL || '0';
        const realizedPnL = transactions.reduce((sum, tx) => sum + parseFloat(tx.realizedPnL), 0);
        const unrealizedPnL = parseFloat(totalPnL) - realizedPnL;
        
        const totalVolume = transactions.reduce((sum, tx) => sum + parseFloat(tx.costBasis), 0);
        const totalFees = transactions.reduce((sum, tx) => sum + parseFloat(tx.fees) + parseFloat(tx.gasFees), 0);
        
        const winningTrades = transactions.filter(tx => parseFloat(tx.realizedPnL) > 0).length;
        const losingTrades = transactions.filter(tx => parseFloat(tx.realizedPnL) < 0).length;
        const totalTrades = transactions.length;
        
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        const avgWin = winningTrades > 0 ? 
          transactions.filter(tx => parseFloat(tx.realizedPnL) > 0)
            .reduce((sum, tx) => sum + parseFloat(tx.realizedPnL), 0) / winningTrades : 0;
        const avgLoss = losingTrades > 0 ? 
          transactions.filter(tx => parseFloat(tx.realizedPnL) < 0)
            .reduce((sum, tx) => sum + parseFloat(tx.realizedPnL), 0) / losingTrades : 0;

        const maxDrawdown = this.calculateMaxDrawdown(snapshots);
        const sharpeRatio = this.calculateSharpeRatio(snapshots);
        const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

        const totalROI = totalVolume > 0 ? (parseFloat(totalPnL) / totalVolume) * 100 : 0;

        // Calculate additional metrics
        const bestTrade = transactions.length > 0 ? 
          Math.max(...transactions.map(tx => parseFloat(tx.realizedPnL))) : 0;
        const worstTrade = transactions.length > 0 ? 
          Math.min(...transactions.map(tx => parseFloat(tx.realizedPnL))) : 0;

        const performanceMetrics: InsertPerformanceMetrics = {
          accessKeyId,
          walletId: null, // Portfolio-level metrics
          timeframe,
          totalPnL: totalPnL,
          realizedPnL: realizedPnL.toFixed(8),
          unrealizedPnL: unrealizedPnL.toFixed(8),
          totalROI: totalROI.toFixed(4),
          winRate: winRate.toFixed(2),
          avgWin: avgWin.toFixed(8),
          avgLoss: avgLoss.toFixed(8),
          maxDrawdown: maxDrawdown.toFixed(4),
          sharpeRatio: sharpeRatio.toFixed(4),
          profitFactor: profitFactor.toFixed(4),
          totalTrades,
          winningTrades,
          losingTrades,
          totalVolume: totalVolume.toFixed(8),
          totalFees: totalFees.toFixed(8),
          bestTrade: bestTrade.toFixed(8),
          worstTrade: worstTrade.toFixed(8),
          consecutiveWins: this.calculateConsecutiveWins(transactions),
          consecutiveLosses: this.calculateConsecutiveLosses(transactions),
          periodStartAt: startTime,
          periodEndAt: endTime,
        };

        await this.storage.upsertPerformanceMetrics(performanceMetrics);
      }

      this.emit('performanceMetricsUpdated', { accessKeyId });
    } catch (error) {
      console.error('❌ Failed to calculate and save performance metrics:', error);
    }
  }

  // Private helper methods

  private setupRealTimeMonitoring(): void {
    this.refreshTimer = setInterval(() => {
      this.refreshCaches();
    }, this.updateInterval);

    // Listen to P&L service updates
    this.pnlService.on('pnlUpdate', (data) => {
      this.invalidateCache(data.walletId);
    });
  }

  private async warmUpCaches(): Promise<void> {
    try {
      // Get all unique access keys with positions
      const accessKeys = await this.storage.getUniqueAccessKeysWithPositions();
      
      for (const accessKeyId of accessKeys) {
        await this.getPortfolioOverview(accessKeyId);
        await this.getTokenExposureAnalysis(accessKeyId);
      }

      console.log(`🔥 Warmed up caches for ${accessKeys.length} portfolios`);
    } catch (error) {
      console.error('❌ Failed to warm up caches:', error);
    }
  }

  private async refreshCaches(): Promise<void> {
    // Clear caches to force refresh
    this.portfolioCache.clear();
    this.exposureCache.clear();
    this.riskCache.clear();
    
    // Warm up again
    await this.warmUpCaches();
  }

  private invalidateCache(walletId: string): void {
    // Find and remove cache entries related to this wallet
    // This is a simplified approach - in production you'd track wallet->accessKey mapping
    this.portfolioCache.clear();
    this.exposureCache.clear();
    this.riskCache.clear();
  }

  private calculateWalletRiskScore(positions: TokenPosition[]): number {
    // Simplified risk score calculation
    let riskScore = 0;
    
    // Concentration risk
    const totalValue = positions.reduce((sum, pos) => sum + parseFloat(pos.currentValue), 0);
    const maxPosition = Math.max(...positions.map(pos => parseFloat(pos.currentValue)));
    const concentration = totalValue > 0 ? (maxPosition / totalValue) * 100 : 0;
    riskScore += concentration * 0.5;
    
    // Volatility risk (simplified)
    const avgVolatility = positions.reduce((sum, pos) => {
      const change = Math.abs(parseFloat(pos.priceChange24h || '0'));
      return sum + change;
    }, 0) / positions.length;
    riskScore += avgVolatility * 2;
    
    return Math.min(100, Math.max(0, riskScore));
  }

  private assessTokenRiskLevel(position: TokenPosition): 'low' | 'medium' | 'high' | 'extreme' {
    const priceChange = Math.abs(parseFloat(position.priceChange24h || '0'));
    
    if (priceChange < 5) return 'low';
    if (priceChange < 15) return 'medium';
    if (priceChange < 30) return 'high';
    return 'extreme';
  }

  private calculateConcentrationRisk(exposures: TokenExposure[]): number {
    // Herfindahl-Hirschman Index calculation
    const totalValue = exposures.reduce((sum, exp) => sum + parseFloat(exp.totalValue), 0);
    
    if (totalValue === 0) return 0;
    
    const hhi = exposures.reduce((sum, exp) => {
      const marketShare = parseFloat(exp.totalValue) / totalValue;
      return sum + (marketShare * marketShare);
    }, 0);
    
    // Convert to 0-100 scale (1.0 = 100% concentrated)
    return hhi * 100;
  }

  private calculateVolatilityScore(snapshots: PortfolioSnapshot[]): number {
    if (snapshots.length < 2) return 50; // Default medium volatility
    
    const returns = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = parseFloat(snapshots[i - 1].totalValue);
      const currentValue = parseFloat(snapshots[i].totalValue);
      
      if (prevValue > 0) {
        const returnRate = (currentValue - prevValue) / prevValue;
        returns.push(returnRate);
      }
    }
    
    if (returns.length === 0) return 50;
    
    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to 0-100 scale (higher = more volatile)
    return Math.min(100, stdDev * 1000); // Scale factor
  }

  private calculateLiquidityScore(exposures: TokenExposure[]): number {
    // Simplified liquidity score - in reality you'd check DEX liquidity
    const totalValue = exposures.reduce((sum, exp) => sum + parseFloat(exp.totalValue), 0);
    
    if (totalValue === 0) return 100; // No positions = perfectly liquid
    
    // Assume major tokens (high value) are more liquid
    const liquidityScore = exposures.reduce((score, exp) => {
      const value = parseFloat(exp.totalValue);
      const weight = value / totalValue;
      
      // Higher value positions assumed to be more liquid
      const tokenLiquidity = Math.min(100, Math.log10(value + 1) * 20);
      return score + (tokenLiquidity * weight);
    }, 0);
    
    return Math.min(100, Math.max(0, liquidityScore));
  }

  private calculateMaxDrawdown(snapshots: PortfolioSnapshot[]): number {
    if (snapshots.length < 2) return 0;
    
    let maxDrawdown = 0;
    let peak = parseFloat(snapshots[0].totalValue);
    
    for (const snapshot of snapshots) {
      const value = parseFloat(snapshot.totalValue);
      
      if (value > peak) {
        peak = value;
      } else {
        const drawdown = (peak - value) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }
    
    return maxDrawdown * 100; // Convert to percentage
  }

  private calculateSharpeRatio(snapshots: PortfolioSnapshot[]): number {
    if (snapshots.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = parseFloat(snapshots[i - 1].totalValue);
      const currentValue = parseFloat(snapshots[i].totalValue);
      
      if (prevValue > 0) {
        const returnRate = (currentValue - prevValue) / prevValue;
        returns.push(returnRate);
      }
    }
    
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Assume risk-free rate of 3% annually (simplified)
    const riskFreeRate = 0.03 / 365; // Daily risk-free rate
    
    return stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0;
  }

  private generateRiskRecommendations(
    concentrationRisk: number,
    diversificationScore: number,
    volatilityScore: number,
    liquidityScore: number,
    maxDrawdown: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (concentrationRisk > 70) {
      recommendations.push('High concentration risk detected. Consider diversifying your portfolio across more tokens.');
    }
    
    if (diversificationScore < 30) {
      recommendations.push('Low diversification. Consider adding positions in different token categories or market caps.');
    }
    
    if (volatilityScore > 80) {
      recommendations.push('High volatility detected. Consider reducing position sizes or adding stable assets to reduce risk.');
    }
    
    if (liquidityScore < 50) {
      recommendations.push('Low liquidity positions detected. Consider adding more liquid tokens to improve exit flexibility.');
    }
    
    if (maxDrawdown > 50) {
      recommendations.push('Large drawdown detected. Consider implementing stop-loss strategies or position sizing rules.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Portfolio risk levels appear manageable. Continue monitoring market conditions.');
    }
    
    return recommendations;
  }

  private calculateConsecutiveWins(transactions: any[]): number {
    let maxConsecutive = 0;
    let current = 0;
    
    const sortedTx = transactions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    for (const tx of sortedTx) {
      if (parseFloat(tx.realizedPnL) > 0) {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 0;
      }
    }
    
    return maxConsecutive;
  }

  private calculateConsecutiveLosses(transactions: any[]): number {
    let maxConsecutive = 0;
    let current = 0;
    
    const sortedTx = transactions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    for (const tx of sortedTx) {
      if (parseFloat(tx.realizedPnL) < 0) {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 0;
      }
    }
    
    return maxConsecutive;
  }

  private getTimeframeStartDate(timeframe: string): Date {
    const now = new Date();
    
    switch (timeframe) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'all_time':
        return new Date(0); // Unix epoch
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  // Public getters
  get isServiceRunning(): boolean {
    return this.isRunning;
  }

  get cacheSize(): number {
    return this.portfolioCache.size;
  }
}