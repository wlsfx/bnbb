import { EventEmitter } from 'events';
import type { DbStorage } from './storage';
import type { MarketDataService } from './market-data-service';
import type { 
  BundleTransaction, 
  TransactionPnL, 
  TokenPosition, 
  InsertTransactionPnL, 
  InsertTokenPosition,
  InsertPortfolioSnapshot
} from '@shared/schema';

export interface PnLCalculation {
  realizedPnL: string;        // Completed trades P&L
  unrealizedPnL: string;      // Open positions P&L
  totalFees: string;          // Gas + trading fees
  netPnL: string;            // Total P&L after fees
  roi: string;               // Return on investment %
  winRate: string;           // Successful trades %
  totalTrades: number;       // Total number of trades
  winningTrades: number;     // Number of profitable trades
  totalVolume: string;       // Total trading volume
}

export interface PositionUpdate {
  tokenAddress: string;
  walletId: string;
  quantityChange: string;
  priceAtTransaction: string;
  transactionType: 'buy' | 'sell' | 'launch' | 'funding' | 'fee_payment';
  transactionId: string;
  timestamp: Date;
  gasUsed?: string;
  fees?: string;
}

export interface AccountingConfig {
  method: 'FIFO' | 'LIFO';  // First In First Out or Last In First Out
  includeFees: boolean;      // Whether to include fees in cost basis
  feeAllocation: 'proportional' | 'separate'; // How to allocate fees
}

export interface PnLServiceConfig {
  accounting: AccountingConfig;
  realTimeUpdates: boolean;
  snapshotInterval: number; // milliseconds
  alertThresholds: {
    profitThreshold: string;
    lossThreshold: string;
    roiThreshold: string;
  };
}

interface TransactionLot {
  id: string;
  quantity: string;
  price: string;
  timestamp: Date;
  transactionId: string;
  remainingQuantity: string;
  totalCost: string;
  fees: string;
}

export class PnLService extends EventEmitter {
  private storage: DbStorage;
  private marketDataService: MarketDataService;
  private config: PnLServiceConfig;
  private positionLots: Map<string, TransactionLot[]> = new Map(); // key: walletId:tokenAddress
  private isInitialized = false;

  constructor(storage: DbStorage, marketDataService: MarketDataService) {
    super();
    this.storage = storage;
    this.marketDataService = marketDataService;
    
    this.config = {
      accounting: {
        method: 'FIFO',
        includeFees: true,
        feeAllocation: 'proportional',
      },
      realTimeUpdates: true,
      snapshotInterval: 300000, // 5 minutes
      alertThresholds: {
        profitThreshold: '1000', // $1000 profit threshold
        lossThreshold: '-500',   // $500 loss threshold
        roiThreshold: '10',      // 10% ROI threshold
      },
    };

    console.log('📊 P&L Service initialized');
  }

  /**
   * Initialize the P&L service and load existing positions
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🚀 Initializing P&L Service...');

    try {
      // Load existing token positions and reconstruct lots
      await this.loadExistingPositions();
      
      // Set up real-time monitoring if enabled
      if (this.config.realTimeUpdates) {
        this.setupRealTimeMonitoring();
      }

      this.isInitialized = true;
      console.log('✅ P&L Service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('❌ Failed to initialize P&L Service:', error);
      throw error;
    }
  }

  /**
   * Process a new transaction and update P&L calculations
   */
  async processTransaction(transaction: BundleTransaction): Promise<TransactionPnL | null> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const positionUpdate: PositionUpdate = {
        tokenAddress: this.extractTokenAddress(transaction),
        walletId: transaction.walletId,
        quantityChange: transaction.value || '0',
        priceAtTransaction: await this.getTransactionPrice(transaction),
        transactionType: this.categorizeTransaction(transaction),
        transactionId: transaction.id,
        timestamp: transaction.createdAt,
        gasUsed: transaction.gasUsed?.toString(),
        fees: this.calculateTotalFees(transaction),
      };

      // Calculate P&L for this transaction
      const pnlCalculation = await this.calculateTransactionPnL(positionUpdate);
      
      // Update token position
      await this.updateTokenPosition(positionUpdate, pnlCalculation);
      
      // Save transaction P&L to database
      const transactionPnL = await this.saveTransactionPnL(pnlCalculation, positionUpdate);
      
      // Emit real-time update
      this.emit('pnlUpdate', {
        walletId: positionUpdate.walletId,
        tokenAddress: positionUpdate.tokenAddress,
        transactionPnL: pnlCalculation,
        totalPnL: await this.calculateWalletPnL(positionUpdate.walletId),
      });

      return transactionPnL;
    } catch (error) {
      console.error('❌ Failed to process transaction P&L:', error);
      return null;
    }
  }

  /**
   * Calculate P&L for a specific wallet
   */
  async calculateWalletPnL(walletId: string): Promise<PnLCalculation> {
    try {
      const positions = await this.storage.getTokenPositionsByWallet(walletId);
      const transactionPnLs = await this.storage.getTransactionPnLByWallet(walletId);

      let totalRealizedPnL = 0;
      let totalUnrealizedPnL = 0;
      let totalFees = 0;
      let totalVolume = 0;
      let winningTrades = 0;
      let totalTrades = transactionPnLs.length;

      // Calculate realized P&L from transactions
      for (const txPnL of transactionPnLs) {
        totalRealizedPnL += parseFloat(txPnL.realizedPnL);
        totalFees += parseFloat(txPnL.fees) + parseFloat(txPnL.gasFees);
        totalVolume += parseFloat(txPnL.costBasis);
        
        if (parseFloat(txPnL.realizedPnL) > 0) {
          winningTrades++;
        }
      }

      // Calculate unrealized P&L from current positions
      for (const position of positions) {
        totalUnrealizedPnL += parseFloat(position.unrealizedPnL);
      }

      const netPnL = totalRealizedPnL + totalUnrealizedPnL - totalFees;
      const roi = totalVolume > 0 ? (netPnL / totalVolume) * 100 : 0;
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

      return {
        realizedPnL: totalRealizedPnL.toFixed(8),
        unrealizedPnL: totalUnrealizedPnL.toFixed(8),
        totalFees: totalFees.toFixed(8),
        netPnL: netPnL.toFixed(8),
        roi: roi.toFixed(4),
        winRate: winRate.toFixed(2),
        totalTrades,
        winningTrades,
        totalVolume: totalVolume.toFixed(8),
      };
    } catch (error) {
      console.error('❌ Failed to calculate wallet P&L:', error);
      throw error;
    }
  }

  /**
   * Calculate portfolio P&L across multiple wallets
   */
  async calculatePortfolioPnL(accessKeyId: string): Promise<PnLCalculation> {
    try {
      const wallets = await this.storage.getWallets(accessKeyId);
      
      let aggregatedPnL: PnLCalculation = {
        realizedPnL: '0',
        unrealizedPnL: '0',
        totalFees: '0',
        netPnL: '0',
        roi: '0',
        winRate: '0',
        totalTrades: 0,
        winningTrades: 0,
        totalVolume: '0',
      };

      for (const wallet of wallets) {
        const walletPnL = await this.calculateWalletPnL(wallet.id);
        
        aggregatedPnL.realizedPnL = (parseFloat(aggregatedPnL.realizedPnL) + parseFloat(walletPnL.realizedPnL)).toFixed(8);
        aggregatedPnL.unrealizedPnL = (parseFloat(aggregatedPnL.unrealizedPnL) + parseFloat(walletPnL.unrealizedPnL)).toFixed(8);
        aggregatedPnL.totalFees = (parseFloat(aggregatedPnL.totalFees) + parseFloat(walletPnL.totalFees)).toFixed(8);
        aggregatedPnL.totalVolume = (parseFloat(aggregatedPnL.totalVolume) + parseFloat(walletPnL.totalVolume)).toFixed(8);
        aggregatedPnL.totalTrades += walletPnL.totalTrades;
        aggregatedPnL.winningTrades += walletPnL.winningTrades;
      }

      // Calculate aggregated metrics
      const netPnL = parseFloat(aggregatedPnL.realizedPnL) + parseFloat(aggregatedPnL.unrealizedPnL) - parseFloat(aggregatedPnL.totalFees);
      aggregatedPnL.netPnL = netPnL.toFixed(8);
      
      const totalVolume = parseFloat(aggregatedPnL.totalVolume);
      aggregatedPnL.roi = totalVolume > 0 ? ((netPnL / totalVolume) * 100).toFixed(4) : '0';
      
      aggregatedPnL.winRate = aggregatedPnL.totalTrades > 0 ? 
        ((aggregatedPnL.winningTrades / aggregatedPnL.totalTrades) * 100).toFixed(2) : '0';

      return aggregatedPnL;
    } catch (error) {
      console.error('❌ Failed to calculate portfolio P&L:', error);
      throw error;
    }
  }

  /**
   * Create a portfolio snapshot for historical tracking
   */
  async createPortfolioSnapshot(accessKeyId: string, walletId?: string): Promise<void> {
    try {
      const pnlData = walletId ? 
        await this.calculateWalletPnL(walletId) : 
        await this.calculatePortfolioPnL(accessKeyId);

      const positions = walletId ? 
        await this.storage.getTokenPositionsByWallet(walletId) :
        await this.storage.getAllTokenPositionsByAccessKey(accessKeyId);

      const totalValue = positions.reduce((sum, pos) => sum + parseFloat(pos.currentValue), 0);

      const snapshot: InsertPortfolioSnapshot = {
        accessKeyId,
        walletId: walletId || null,
        totalValue: totalValue.toFixed(8),
        realizedPnL: pnlData.realizedPnL,
        unrealizedPnL: pnlData.unrealizedPnL,
        totalPnL: pnlData.netPnL,
        totalFees: pnlData.totalFees,
        totalGasUsed: '0', // Will be calculated separately
        positionCount: positions.length,
        roi: pnlData.roi,
        snapshotType: 'real_time',
      };

      await this.storage.createPortfolioSnapshot(snapshot);
      
      this.emit('snapshotCreated', { accessKeyId, walletId, snapshot });
    } catch (error) {
      console.error('❌ Failed to create portfolio snapshot:', error);
    }
  }

  /**
   * Update token prices and recalculate unrealized P&L
   */
  async updateUnrealizedPnL(): Promise<void> {
    try {
      const allPositions = await this.storage.getAllTokenPositions();
      
      for (const position of allPositions) {
        const currentPrice = await this.marketDataService.getTokenPrice(position.tokenAddress);
        
        if (currentPrice) {
          const currentValue = parseFloat(position.currentBalance) * parseFloat(currentPrice.currentPrice);
          const unrealizedPnL = currentValue - parseFloat(position.totalCost);
          const roi = parseFloat(position.totalCost) > 0 ? (unrealizedPnL / parseFloat(position.totalCost)) * 100 : 0;

          await this.storage.updateTokenPosition(position.id, {
            currentPrice: currentPrice.currentPrice,
            currentValue: currentValue.toFixed(8),
            unrealizedPnL: unrealizedPnL.toFixed(8),
            roi: roi.toFixed(4),
            priceChange24h: currentPrice.priceChange24h,
          });
        }
      }

      this.emit('unrealizedPnLUpdated');
    } catch (error) {
      console.error('❌ Failed to update unrealized P&L:', error);
    }
  }

  // Private methods

  private async calculateTransactionPnL(positionUpdate: PositionUpdate): Promise<TransactionPnL> {
    const positionKey = `${positionUpdate.walletId}:${positionUpdate.tokenAddress}`;
    const lots = this.positionLots.get(positionKey) || [];
    
    const quantity = parseFloat(positionUpdate.quantityChange);
    const price = parseFloat(positionUpdate.priceAtTransaction);
    const fees = parseFloat(positionUpdate.fees || '0');
    
    let realizedPnL = 0;
    let costBasis = 0;

    if (positionUpdate.transactionType === 'buy' || positionUpdate.transactionType === 'launch') {
      // Adding to position
      costBasis = quantity * price + fees;
      
      const newLot: TransactionLot = {
        id: positionUpdate.transactionId,
        quantity: quantity.toString(),
        price: price.toString(),
        timestamp: positionUpdate.timestamp,
        transactionId: positionUpdate.transactionId,
        remainingQuantity: quantity.toString(),
        totalCost: costBasis.toString(),
        fees: fees.toString(),
      };
      
      lots.push(newLot);
      this.positionLots.set(positionKey, lots);
      
    } else if (positionUpdate.transactionType === 'sell') {
      // Reducing position - calculate realized P&L
      let remainingToSell = quantity;
      const sellPrice = price;
      
      // Apply FIFO or LIFO
      const lotsToProcess = this.config.accounting.method === 'FIFO' ? 
        lots.slice().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) :
        lots.slice().sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      for (const lot of lotsToProcess) {
        if (remainingToSell <= 0) break;
        
        const availableQuantity = parseFloat(lot.remainingQuantity);
        const sellQuantity = Math.min(remainingToSell, availableQuantity);
        
        const lotCostBasis = (parseFloat(lot.totalCost) / parseFloat(lot.quantity)) * sellQuantity;
        const sellValue = sellQuantity * sellPrice;
        const lotRealizedPnL = sellValue - lotCostBasis;
        
        realizedPnL += lotRealizedPnL;
        costBasis += lotCostBasis;
        
        // Update lot remaining quantity
        lot.remainingQuantity = (availableQuantity - sellQuantity).toString();
        remainingToSell -= sellQuantity;
      }
      
      // Remove empty lots
      const updatedLots = lots.filter(lot => parseFloat(lot.remainingQuantity) > 0);
      this.positionLots.set(positionKey, updatedLots);
      
      // Subtract fees from realized P&L
      realizedPnL -= fees;
    }

    // Get current price for unrealized P&L calculation
    const currentPrice = await this.marketDataService.getTokenPrice(positionUpdate.tokenAddress);
    const currentPriceValue = currentPrice ? parseFloat(currentPrice.currentPrice) : price;
    
    const unrealizedPnL = positionUpdate.transactionType === 'sell' ? 0 : 
      (quantity * currentPriceValue) - costBasis;

    return {
      transactionId: positionUpdate.transactionId,
      walletId: positionUpdate.walletId,
      tokenAddress: positionUpdate.tokenAddress,
      tokenSymbol: 'UNKNOWN', // Will be updated from market data
      transactionType: positionUpdate.transactionType,
      costBasis: costBasis.toFixed(8),
      realizedPnL: realizedPnL.toFixed(8),
      unrealizedPnL: unrealizedPnL.toFixed(8),
      fees: fees.toFixed(8),
      gasFees: (parseFloat(positionUpdate.gasUsed || '0') * 0.000000005).toFixed(8), // Estimate
      mevLoss: '0',
      slippageLoss: '0',
      priceAtTransaction: price.toFixed(8),
      currentPrice: currentPriceValue.toFixed(8),
      quantity: quantity.toFixed(8),
      accountingMethod: this.config.accounting.method,
      isRealized: positionUpdate.transactionType === 'sell',
    } as TransactionPnL;
  }

  private async updateTokenPosition(positionUpdate: PositionUpdate, pnlCalculation: TransactionPnL): Promise<void> {
    try {
      const existingPosition = await this.storage.getTokenPosition(
        positionUpdate.walletId, 
        positionUpdate.tokenAddress
      );

      const quantity = parseFloat(positionUpdate.quantityChange);
      const isAdd = positionUpdate.transactionType === 'buy' || positionUpdate.transactionType === 'launch';
      
      if (existingPosition) {
        // Update existing position
        const newBalance = isAdd ? 
          parseFloat(existingPosition.currentBalance) + quantity :
          parseFloat(existingPosition.currentBalance) - quantity;
        
        const newTotalCost = isAdd ?
          parseFloat(existingPosition.totalCost) + parseFloat(pnlCalculation.costBasis) :
          parseFloat(existingPosition.totalCost); // Cost basis doesn't change on sell
        
        const newAverageCostBasis = newBalance > 0 ? newTotalCost / newBalance : 0;
        const newCurrentValue = newBalance * parseFloat(pnlCalculation.currentPrice);
        const newUnrealizedPnL = newCurrentValue - newTotalCost;
        const newRealizedPnL = parseFloat(existingPosition.realizedPnL) + parseFloat(pnlCalculation.realizedPnL);
        const newTotalPnL = newRealizedPnL + newUnrealizedPnL;
        const newROI = newTotalCost > 0 ? (newTotalPnL / newTotalCost) * 100 : 0;

        await this.storage.updateTokenPosition(existingPosition.id, {
          currentBalance: newBalance.toFixed(8),
          averageCostBasis: newAverageCostBasis.toFixed(8),
          totalCost: newTotalCost.toFixed(8),
          currentValue: newCurrentValue.toFixed(8),
          unrealizedPnL: newUnrealizedPnL.toFixed(8),
          realizedPnL: newRealizedPnL.toFixed(8),
          totalPnL: newTotalPnL.toFixed(8),
          roi: newROI.toFixed(4),
          currentPrice: pnlCalculation.currentPrice,
          lastTransactionAt: positionUpdate.timestamp,
          transactionCount: existingPosition.transactionCount + 1,
        });
      } else {
        // Create new position
        const newPosition: InsertTokenPosition = {
          walletId: positionUpdate.walletId,
          tokenAddress: positionUpdate.tokenAddress,
          tokenSymbol: pnlCalculation.tokenSymbol,
          currentBalance: quantity.toFixed(8),
          averageCostBasis: parseFloat(pnlCalculation.priceAtTransaction).toFixed(8),
          totalCost: pnlCalculation.costBasis,
          currentValue: (quantity * parseFloat(pnlCalculation.currentPrice)).toFixed(8),
          unrealizedPnL: pnlCalculation.unrealizedPnL,
          realizedPnL: pnlCalculation.realizedPnL,
          totalPnL: (parseFloat(pnlCalculation.realizedPnL) + parseFloat(pnlCalculation.unrealizedPnL)).toFixed(8),
          roi: parseFloat(pnlCalculation.costBasis) > 0 ? 
            (((parseFloat(pnlCalculation.realizedPnL) + parseFloat(pnlCalculation.unrealizedPnL)) / parseFloat(pnlCalculation.costBasis)) * 100).toFixed(4) : '0',
          currentPrice: pnlCalculation.currentPrice,
          firstPurchaseAt: positionUpdate.timestamp,
          lastTransactionAt: positionUpdate.timestamp,
          transactionCount: 1,
        };

        await this.storage.createTokenPosition(newPosition);
      }
    } catch (error) {
      console.error('❌ Failed to update token position:', error);
      throw error;
    }
  }

  private async saveTransactionPnL(pnlCalculation: TransactionPnL, positionUpdate: PositionUpdate): Promise<TransactionPnL> {
    try {
      const transactionPnLData: InsertTransactionPnL = {
        transactionId: pnlCalculation.transactionId,
        walletId: pnlCalculation.walletId,
        tokenAddress: pnlCalculation.tokenAddress,
        tokenSymbol: pnlCalculation.tokenSymbol,
        transactionType: pnlCalculation.transactionType,
        costBasis: pnlCalculation.costBasis,
        realizedPnL: pnlCalculation.realizedPnL,
        unrealizedPnL: pnlCalculation.unrealizedPnL,
        fees: pnlCalculation.fees,
        gasFees: pnlCalculation.gasFees,
        mevLoss: pnlCalculation.mevLoss,
        slippageLoss: pnlCalculation.slippageLoss,
        priceAtTransaction: pnlCalculation.priceAtTransaction,
        currentPrice: pnlCalculation.currentPrice,
        quantity: pnlCalculation.quantity,
        accountingMethod: pnlCalculation.accountingMethod,
        isRealized: pnlCalculation.isRealized,
      };

      return await this.storage.createTransactionPnL(transactionPnLData);
    } catch (error) {
      console.error('❌ Failed to save transaction P&L:', error);
      throw error;
    }
  }

  private async loadExistingPositions(): Promise<void> {
    try {
      const positions = await this.storage.getAllTokenPositions();
      
      for (const position of positions) {
        // Load transaction history to reconstruct lots
        const transactions = await this.storage.getTransactionPnLByWalletAndToken(
          position.walletId, 
          position.tokenAddress
        );

        const positionKey = `${position.walletId}:${position.tokenAddress}`;
        const lots: TransactionLot[] = [];

        // Reconstruct lots from transaction history
        for (const tx of transactions.filter(t => t.transactionType === 'buy' || t.transactionType === 'launch')) {
          lots.push({
            id: tx.transactionId,
            quantity: tx.quantity,
            price: tx.priceAtTransaction,
            timestamp: tx.createdAt,
            transactionId: tx.transactionId,
            remainingQuantity: tx.quantity, // Will be adjusted
            totalCost: tx.costBasis,
            fees: tx.fees,
          });
        }

        this.positionLots.set(positionKey, lots);
      }

      console.log(`📥 Loaded ${positions.length} existing token positions`);
    } catch (error) {
      console.error('❌ Failed to load existing positions:', error);
    }
  }

  private setupRealTimeMonitoring(): void {
    // Set up automatic snapshots
    setInterval(() => {
      this.createPeriodicSnapshots();
    }, this.config.snapshotInterval);

    // Set up unrealized P&L updates
    setInterval(() => {
      this.updateUnrealizedPnL();
    }, 60000); // Update every minute
  }

  private async createPeriodicSnapshots(): Promise<void> {
    try {
      // Get all unique access keys that have positions
      const accessKeys = await this.storage.getUniqueAccessKeysWithPositions();
      
      for (const accessKeyId of accessKeys) {
        await this.createPortfolioSnapshot(accessKeyId);
      }
    } catch (error) {
      console.error('❌ Failed to create periodic snapshots:', error);
    }
  }

  private extractTokenAddress(transaction: BundleTransaction): string {
    // Extract token address from transaction
    // This would depend on your transaction structure
    return transaction.toAddress || this.WBNB_ADDRESS;
  }

  private async getTransactionPrice(transaction: BundleTransaction): Promise<string> {
    // Calculate the effective price from the transaction
    const value = parseFloat(transaction.value || '0');
    // This is simplified - in reality you'd need to parse the transaction data
    return '1.0'; // Placeholder
  }

  private categorizeTransaction(transaction: BundleTransaction): 'buy' | 'sell' | 'launch' | 'funding' | 'fee_payment' {
    switch (transaction.transactionType) {
      case 'token_creation': return 'launch';
      case 'transfer': return parseFloat(transaction.value || '0') > 0 ? 'buy' : 'sell';
      case 'swap': return 'buy'; // Simplified
      default: return 'funding';
    }
  }

  private calculateTotalFees(transaction: BundleTransaction): string {
    const gasUsed = parseFloat(transaction.gasUsed?.toString() || '0');
    const gasPrice = parseFloat(transaction.gasPrice || '0');
    const gasFee = gasUsed * gasPrice / 1e18; // Convert from wei to ETH/BNB
    return gasFee.toFixed(8);
  }

  private readonly WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

  // Public getters
  get accountingMethod(): string {
    return this.config.accounting.method;
  }

  get isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}