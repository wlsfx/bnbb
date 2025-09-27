import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '../hooks/useWebSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Fuel,
  DollarSign,
  Activity,
  Users,
  Wallet,
  Zap,
  Target,
  BarChart3,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { BundleAnalytics, SystemMetrics, Wallet as WalletType } from '@shared/schema';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';

interface AnalyticsData {
  timeframe: string;
  summary: {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    successRate: string;
    avgConfirmationTime: number;
    totalGasUsed: string;
    totalValue: string;
    totalFees: string;
  };
  analytics: BundleAnalytics[];
}

interface WalletMetrics {
  totalWallets: number;
  activeWallets: number;
  idleWallets: number;
  totalBalance: string;
  avgBalance: string;
  healthyWallets: number;
  degradedWallets: number;
}

export default function Analytics() {
  const [timeframe, setTimeframe] = useState('daily');
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Initialize WebSocket connection
  const websocket = useWebSocket({
    enabled: true,
    fallbackToPolling: true,
  });
  
  // Subscribe to WebSocket analytics updates
  useEffect(() => {
    if (websocket.isConnected) {
      websocket.subscribe('bundle_analytics');
    }
  }, [websocket.isConnected, websocket]);

  // Fetch bundle analytics - now without polling, relies on WebSocket updates
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useQuery<AnalyticsData>({
    queryKey: ['/api/bundles/analytics', timeframe, refreshKey],
    // No refetchInterval - data comes from WebSocket
  });

  // Fetch system metrics - now without polling, relies on WebSocket updates
  const { data: systemMetrics, isLoading: systemLoading, error: systemError } = useQuery<SystemMetrics>({
    queryKey: ['/api/system-metrics', refreshKey],
    // No refetchInterval - data comes from WebSocket
  });

  // Fetch wallet statistics - now without polling, relies on WebSocket updates
  const { data: walletStats, isLoading: walletStatsLoading, error: walletStatsError } = useQuery<WalletMetrics>({
    queryKey: ['/api/stats', refreshKey],
    // No refetchInterval - data comes from WebSocket
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Connection status indicator
  const ConnectionStatus = () => {
    if (websocket.isConnected) {
      return (
        <Badge variant="default" className="text-green-600 bg-green-100 dark:bg-green-900" data-testid="analytics-connection-connected">
          <Wifi className="w-3 h-3 mr-1" />
          Real-time Connected
        </Badge>
      );
    } else if (websocket.isConnecting) {
      return (
        <Badge variant="secondary" className="text-yellow-600 bg-yellow-100 dark:bg-yellow-900" data-testid="analytics-connection-connecting">
          <AlertCircle className="w-3 h-3 mr-1" />
          Connecting...
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" className="text-red-600 bg-red-100 dark:bg-red-900" data-testid="analytics-connection-disconnected">
          <WifiOff className="w-3 h-3 mr-1" />
          {websocket.shouldUseFallback ? 'Using Fallback' : 'Disconnected'}
        </Badge>
      );
    }
  };

  // Prepare chart data - only if data is available
  const successRateData = analyticsData ? [
    { name: 'Successful', value: analyticsData.summary.successfulTransactions, color: '#10b981' },
    { name: 'Failed', value: analyticsData.summary.failedTransactions, color: '#ef4444' },
  ] : [];

  const timeSeriesData = analyticsData?.analytics.map(a => ({
    date: new Date(a.periodStartAt).toLocaleDateString(),
    successful: a.successfulTransactions,
    failed: a.failedTransactions,
    successRate: parseFloat(a.successRate.toString()),
    avgConfirmationTime: a.avgConfirmationTime || 0,
  })) || [];

  const gasData = analyticsData?.analytics.filter(a => a.totalGasUsed).map(a => ({
    date: new Date(a.periodStartAt).toLocaleDateString(),
    gasUsed: parseFloat(a.totalGasUsed?.toString() || '0'),
    avgGasPrice: parseFloat(a.avgGasPrice?.toString() || '0'),
    totalFees: parseFloat(a.totalFees?.toString() || '0'),
  })) || [];

  const walletHealthData = walletStats ? [
    { name: 'Healthy', value: walletStats.healthyWallets, color: '#10b981' },
    { name: 'Degraded', value: walletStats.degradedWallets, color: '#f59e0b' },
  ] : [];

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toString();
  };

  const getSuccessRateTrend = () => {
    if (!analyticsData?.analytics || analyticsData.analytics.length < 2) return null;
    const recent = parseFloat(analyticsData.analytics[0].successRate.toString());
    const previous = parseFloat(analyticsData.analytics[1].successRate.toString());
    const diff = recent - previous;
    
    if (diff > 0) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (diff < 0) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return null;
  };

  const isLoading = analyticsLoading || systemLoading || walletStatsLoading;
  const hasError = analyticsError || systemError || walletStatsError;

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Error Alert */}
        {hasError && (
          <Alert variant="destructive" data-testid="analytics-error">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load analytics data. {analyticsError?.message || systemError?.message || walletStatsError?.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Comprehensive performance metrics and real-time system insights
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <ConnectionStatus />
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-[180px]" data-testid="select-timeframe">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="all_time">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleRefresh} variant="outline" size="sm" data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="kpi-total-transactions">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : analyticsError ? (
                <div className="text-2xl font-bold text-muted-foreground">--</div>
              ) : (
                <div className="text-2xl font-bold">{formatNumber(analyticsData?.summary.totalTransactions || 0)}</div>
              )}
              <div className="flex items-center gap-2 mt-1">
                {analyticsError ? (
                  <span className="text-xs text-muted-foreground">Error loading data</span>
                ) : (
                  <>
                    <Badge variant="default" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {analyticsData?.summary.successfulTransactions || 0}
                    </Badge>
                    <Badge variant="destructive" className="text-xs">
                      <XCircle className="h-3 w-3 mr-1" />
                      {analyticsData?.summary.failedTransactions || 0}
                    </Badge>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="kpi-success-rate">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-20" /> : analyticsError ? (
                <div className="text-2xl font-bold text-muted-foreground">--</div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{analyticsData?.summary.successRate || '0'}%</span>
                  {getSuccessRateTrend()}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {analyticsError ? "Error loading data" : `${analyticsData?.summary.successfulTransactions || 0} successful`}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-wallet-performance">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Wallet Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-20" /> : walletStatsError ? (
                <div className="text-2xl font-bold text-muted-foreground">--</div>
              ) : (
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  <span className="text-2xl font-bold">{walletStats?.totalWallets || 0}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {walletStatsError ? "Error loading data" : `${walletStats?.activeWallets || 0} active • ${walletStats?.healthyWallets || 0} healthy`}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="kpi-system-health">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-20" /> : systemError ? (
                <div className="text-2xl font-bold text-muted-foreground">--</div>
              ) : (
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold">{systemMetrics?.latency || 0}ms</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {systemError ? "Error loading data" : `${systemMetrics?.successRate || '0'}% success rate`}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="performance" data-testid="tab-performance">
              <BarChart3 className="w-4 h-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="transactions" data-testid="tab-transactions">
              <Activity className="w-4 h-4 mr-2" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="wallets" data-testid="tab-wallets">
              <Wallet className="w-4 h-4 mr-2" />
              Wallets
            </TabsTrigger>
            <TabsTrigger value="system" data-testid="tab-system">
              <Zap className="w-4 h-4 mr-2" />
              System
            </TabsTrigger>
          </TabsList>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Success Rate Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : analyticsError ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>Failed to load chart data</AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={timeSeriesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Area 
                          type="monotone" 
                          dataKey="successRate" 
                          stroke="#10b981" 
                          fill="#10b981" 
                          fillOpacity={0.6}
                          name="Success Rate (%)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Confirmation Time</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : analyticsError ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>Failed to load chart data</AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={timeSeriesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="avgConfirmationTime" 
                          stroke="#3b82f6" 
                          name="Avg Confirmation (s)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card data-testid="summary-confirmation-time">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg Confirmation Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {analyticsError ? "--" : `${analyticsData?.summary.avgConfirmationTime || 0}s`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Per transaction</p>
                </CardContent>
              </Card>

              <Card data-testid="summary-gas-fees">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Gas Fees
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Fuel className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {analyticsError ? "--" : parseFloat(analyticsData?.summary.totalFees || '0').toFixed(4)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analyticsError ? "Error loading data" : `Gas: ${formatNumber(parseFloat(analyticsData?.summary.totalGasUsed || '0'))}`}
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="summary-total-value">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Value
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {analyticsError ? "--" : parseFloat(analyticsData?.summary.totalValue || '0').toFixed(4)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">BNB transferred</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Transaction Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : analyticsError ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>Failed to load chart data</AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={successRateData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {successRateData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Transaction Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : analyticsError ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>Failed to load chart data</AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={timeSeriesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="successful" fill="#10b981" name="Successful" />
                        <Bar dataKey="failed" fill="#ef4444" name="Failed" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Wallets Tab */}
          <TabsContent value="wallets" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Wallet Health Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : walletStatsError ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>Failed to load wallet data</AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={walletHealthData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {walletHealthData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Wallet Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {walletStatsError ? (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>Failed to load wallet statistics</AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Wallets</span>
                        <span className="font-medium">{walletStats?.totalWallets || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Active Wallets</span>
                        <Badge variant="default">{walletStats?.activeWallets || 0}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Idle Wallets</span>
                        <Badge variant="secondary">{walletStats?.idleWallets || 0}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Balance</span>
                        <span className="font-medium">{walletStats?.totalBalance || '0'} BNB</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Average Balance</span>
                        <span className="font-medium">{walletStats?.avgBalance || '0'} BNB</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Health Status</span>
                        </div>
                        <Progress 
                          value={walletStats ? (walletStats.healthyWallets / walletStats.totalWallets) * 100 : 0} 
                          className="h-2"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{walletStats?.healthyWallets || 0} healthy</span>
                          <span>{walletStats?.degradedWallets || 0} degraded</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card data-testid="system-latency">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    System Latency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-orange-500" />
                    <span className="text-2xl font-bold">
                      {systemError ? "--" : `${systemMetrics?.latency || 0}ms`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Response time</p>
                </CardContent>
              </Card>

              <Card data-testid="system-gas-price">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Gas Price
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Fuel className="h-5 w-5 text-yellow-500" />
                    <span className="text-2xl font-bold">
                      {systemError ? "--" : `${systemMetrics?.gasPrice || '0'}`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Gwei</p>
                </CardContent>
              </Card>

              <Card data-testid="system-tax-collected">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tax Collected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <span className="text-2xl font-bold">
                      {systemError ? "--" : `${parseFloat(systemMetrics?.taxCollected?.toString() || '0').toFixed(4)}`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">BNB total</p>
                </CardContent>
              </Card>
            </div>

            {systemError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Failed to load system metrics</AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}