import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  BarChart3, 
  PieChart, 
  AlertTriangle,
  Wallet,
  Calendar,
  Activity,
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PnLSummary {
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalValue: number;
  totalInvested: number;
  totalFees: number;
  roi: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
  lastUpdated: string;
}

interface TokenPosition {
  id: string;
  walletId: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  quantity: string;
  averageBuyPrice: string;
  currentPrice: string;
  currentValue: string;
  unrealizedPnL: string;
  realizedPnL: string;
  totalPnL: string;
  roi: number;
  lastUpdated: string;
}

interface PerformanceMetrics {
  id: string;
  timeframe: string;
  totalPnL: string;
  totalVolume: string;
  winRate: number;
  sharpeRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  averageWin: string;
  averageLoss: string;
  profitFactor: number;
}

interface TransactionPnL {
  id: string;
  transactionHash: string;
  walletId: string;
  tokenAddress: string;
  tokenSymbol: string;
  transactionType: string;
  quantity: string;
  price: string;
  fees: string;
  realizedPnL: string;
  roi: number;
  createdAt: string;
}

export default function PnLDashboard() {
  const [selectedTimeframe, setSelectedTimeframe] = useState("30d");
  const [selectedWallet, setSelectedWallet] = useState<string>("all");
  const [showPrivateData, setShowPrivateData] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch P&L summary data
  const { data: pnlSummary, isLoading: pnlLoading, refetch: refetchPnL } = useQuery({
    queryKey: ["pnl-summary"],
    queryFn: async (): Promise<PnLSummary> => {
      const response = await fetch("/api/pnl/summary");
      if (!response.ok) throw new Error("Failed to fetch P&L summary");
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30 seconds
  });

  // Fetch token positions
  const { data: positions, isLoading: positionsLoading } = useQuery({
    queryKey: ["token-positions", selectedWallet],
    queryFn: async (): Promise<TokenPosition[]> => {
      const url = selectedWallet === "all" 
        ? "/api/pnl/positions"
        : `/api/pnl/positions/wallet/${selectedWallet}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch positions");
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Fetch performance metrics
  const { data: performance, isLoading: performanceLoading } = useQuery({
    queryKey: ["performance-metrics", selectedTimeframe],
    queryFn: async (): Promise<PerformanceMetrics[]> => {
      const response = await fetch(`/api/pnl/performance?timeframe=${selectedTimeframe}`);
      if (!response.ok) throw new Error("Failed to fetch performance metrics");
      return response.json();
    },
    refetchInterval: autoRefresh ? 60000 : false, // Refresh every minute
  });

  // Fetch recent transactions
  const { data: recentTransactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["recent-transactions"],
    queryFn: async (): Promise<TransactionPnL[]> => {
      const response = await fetch("/api/pnl/transactions?limit=10");
      if (!response.ok) throw new Error("Failed to fetch recent transactions");
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Fetch wallets for filter
  const { data: wallets } = useQuery({
    queryKey: ["wallets"],
    queryFn: async () => {
      const response = await fetch("/api/wallets");
      if (!response.ok) throw new Error("Failed to fetch wallets");
      return response.json();
    },
  });

  const formatCurrency = (value: number) => {
    if (!showPrivateData) return "***";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 100);
  };

  const getPnLColor = (value: number) => {
    if (value > 0) return "text-green-600 dark:text-green-400";
    if (value < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getBadgeVariant = (value: number) => {
    if (value > 0) return "default";
    if (value < 0) return "destructive";
    return "secondary";
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6" data-testid="pnl-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100" data-testid="dashboard-title">
            P&L Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time profit & loss tracking and analytics
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPrivateData(!showPrivateData)}
            data-testid="toggle-privacy"
          >
            {showPrivateData ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {showPrivateData ? "Hide" : "Show"} Values
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            data-testid="toggle-auto-refresh"
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchPnL()}
            data-testid="manual-refresh"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="timeframe-select">
            <SelectValue placeholder="Select timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedWallet} onValueChange={setSelectedWallet}>
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="wallet-select">
            <SelectValue placeholder="Select wallet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Wallets</SelectItem>
            {wallets?.map((wallet: any) => (
              <SelectItem key={wallet.id} value={wallet.id}>
                {wallet.label || `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* P&L Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="total-pnl-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {pnlLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${getPnLColor(pnlSummary?.totalPnL || 0)}`}>
                  {formatCurrency(pnlSummary?.totalPnL || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  ROI: {formatPercentage(pnlSummary?.roi || 0)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="realized-pnl-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Realized P&L</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {pnlLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${getPnLColor(pnlSummary?.realizedPnL || 0)}`}>
                  {formatCurrency(pnlSummary?.realizedPnL || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {pnlSummary?.totalTrades || 0} trades
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="unrealized-pnl-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unrealized P&L</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {pnlLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${getPnLColor(pnlSummary?.unrealizedPnL || 0)}`}>
                  {formatCurrency(pnlSummary?.unrealizedPnL || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Current positions
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="win-rate-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {pnlLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatPercentage(pnlSummary?.winRate || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pnlSummary?.profitableTrades || 0} / {pnlSummary?.totalTrades || 0} profitable
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="positions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="positions" data-testid="tab-positions">Positions</TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">Transactions</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Positions Tab */}
        <TabsContent value="positions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Token Positions
              </CardTitle>
              <CardDescription>
                Current token holdings and their P&L performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {positionsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : positions && positions.length > 0 ? (
                <div className="space-y-4">
                  {positions.map((position) => (
                    <div
                      key={position.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                      data-testid={`position-${position.tokenSymbol}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {position.tokenSymbol.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{position.tokenSymbol}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {position.tokenName}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-medium">
                          {showPrivateData ? parseFloat(position.quantity).toFixed(2) : "***"} {position.tokenSymbol}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {formatCurrency(parseFloat(position.currentValue))}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <Badge variant={getBadgeVariant(parseFloat(position.totalPnL))}>
                          {formatCurrency(parseFloat(position.totalPnL))}
                        </Badge>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {formatPercentage(position.roi)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  No positions found for the selected criteria
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Transactions
              </CardTitle>
              <CardDescription>
                Latest trading activity and P&L impact
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentTransactions && recentTransactions.length > 0 ? (
                <div className="space-y-4">
                  {recentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`transaction-${tx.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={tx.transactionType === 'buy' ? 'default' : 'secondary'}>
                          {tx.transactionType.toUpperCase()}
                        </Badge>
                        <div>
                          <div className="font-medium">{tx.tokenSymbol}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-medium">
                          {showPrivateData ? parseFloat(tx.quantity).toFixed(2) : "***"} {tx.tokenSymbol}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          @ {formatCurrency(parseFloat(tx.price))}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`font-medium ${getPnLColor(parseFloat(tx.realizedPnL))}`}>
                          {formatCurrency(parseFloat(tx.realizedPnL))}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {formatPercentage(tx.roi)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  No recent transactions found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Analytics
              </CardTitle>
              <CardDescription>
                Advanced metrics and risk analysis for {selectedTimeframe}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {performanceLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : performance && performance.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {performance.map((metric) => (
                    <div key={metric.id} className="space-y-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {metric.sharpeRatio.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Sharpe Ratio</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {metric.calmarRatio.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Calmar Ratio</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {formatPercentage(metric.maxDrawdown)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Max Drawdown</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {metric.profitFactor.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Profit Factor</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  No performance data available for the selected timeframe
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                P&L Alerts
              </CardTitle>
              <CardDescription>
                Configure and manage profit/loss alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                P&L alert configuration coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}