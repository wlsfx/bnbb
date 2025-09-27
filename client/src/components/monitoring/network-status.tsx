import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Globe, 
  RefreshCw, 
  Server, 
  Shield, 
  Wifi, 
  WifiOff,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart
} from 'lucide-react';
import { networkClient, type NetworkMetrics } from '@/lib/network-client';
import { cn } from '@/lib/utils';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ProxyInfo {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'failed';
  latency: number;
  requestCount: number;
  failureRate: number;
  lastRotated?: string;
}

interface NetworkHealth {
  quicknode: {
    status: 'connected' | 'disconnected' | 'degraded';
    latency: number;
    blockNumber: number;
    gasPrice: string;
  };
  proxy: ProxyInfo | null;
  circuitBreaker: {
    status: 'closed' | 'open' | 'half-open';
    failureCount: number;
  };
}

export function NetworkStatus() {
  const [metrics, setMetrics] = useState<NetworkMetrics | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<Array<{ time: string; latency: number }>>([]);
  const [isRotatingProxy, setIsRotatingProxy] = useState(false);

  // Subscribe to network metrics updates
  useEffect(() => {
    const unsubscribe = networkClient.subscribeToHealthUpdates((newMetrics) => {
      setMetrics(newMetrics);
      
      // Update latency history
      setLatencyHistory(prev => {
        const newHistory = [...prev, {
          time: new Date().toLocaleTimeString(),
          latency: newMetrics.averageLatency,
        }].slice(-20); // Keep last 20 data points
        return newHistory;
      });
    });

    return unsubscribe;
  }, []);

  // Fetch network status from backend
  const { data: networkStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['/api/network/status'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Transform network status data to match the health interface
  const networkHealth = networkStatus ? {
    quicknode: {
      status: 'connected' as const,
      latency: networkStatus.latency || 0,
      blockNumber: networkStatus.blockNumber || 0,
      gasPrice: networkStatus.gasPrice || '0',
    },
    proxy: null, // Default proxy info
    circuitBreaker: {
      status: 'closed' as const,
      failureCount: 0,
    },
  } : null;

  // Rotate proxy mutation
  const rotateProxyMutation = useMutation({
    mutationFn: async () => {
      setIsRotatingProxy(true);
      const response = await networkClient.post('/network/rotate-proxy', {
        environment: 'mainnet',
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/network/status'] });
      setIsRotatingProxy(false);
    },
    onError: () => {
      setIsRotatingProxy(false);
    },
  });

  // Determine overall health status
  const getOverallStatus = () => {
    if (!metrics) return 'unknown';
    if (metrics.circuitBreakerStatus === 'open') return 'critical';
    if (metrics.successRate < 50) return 'critical';
    if (metrics.successRate < 90) return 'warning';
    if (metrics.averageLatency > 1000) return 'warning';
    return 'healthy';
  };

  const overallStatus = getOverallStatus();

  return (
    <Card className="w-full" data-testid="network-status-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Network Status</CardTitle>
            <CardDescription>
              Real-time network health and connectivity monitoring
            </CardDescription>
          </div>
          <Badge
            variant={
              overallStatus === 'healthy' ? 'default' :
              overallStatus === 'warning' ? 'secondary' :
              'destructive'
            }
            className="flex items-center gap-1"
            data-testid="status-overall-health"
          >
            {overallStatus === 'healthy' && <CheckCircle2 className="h-3 w-3" />}
            {overallStatus === 'warning' && <AlertCircle className="h-3 w-3" />}
            {overallStatus === 'critical' && <WifiOff className="h-3 w-3" />}
            {overallStatus.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* BNB Smart Chain Status */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">BSC Network</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <Badge 
                    variant={networkHealth?.quicknode?.status === 'connected' ? 'default' : 'destructive'}
                    className="text-xs"
                    data-testid="status-bsc-connection"
                  >
                    {networkHealth?.quicknode?.status || 'Unknown'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Latency</span>
                  <span className="text-xs font-medium" data-testid="text-bsc-latency">
                    {networkHealth?.quicknode?.latency || '--'} ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Block</span>
                  <span className="text-xs font-medium" data-testid="text-block-number">
                    #{networkHealth?.quicknode?.blockNumber || '--'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Proxy Status */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Proxy</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Active</span>
                  <Badge 
                    variant={networkHealth?.proxy ? 'default' : 'secondary'}
                    className="text-xs"
                    data-testid="status-proxy-active"
                  >
                    {networkHealth?.proxy?.name || 'None'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Health</span>
                  <span 
                    className={cn(
                      "text-xs font-medium",
                      networkHealth?.proxy?.status === 'healthy' && "text-green-600",
                      networkHealth?.proxy?.status === 'degraded' && "text-yellow-600",
                      networkHealth?.proxy?.status === 'failed' && "text-red-600"
                    )}
                    data-testid="text-proxy-health"
                  >
                    {networkHealth?.proxy?.status || 'N/A'}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => rotateProxyMutation.mutate()}
                  disabled={isRotatingProxy}
                  data-testid="button-rotate-proxy"
                >
                  {isRotatingProxy ? (
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Rotate
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Circuit Breaker */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Circuit Breaker</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <Badge 
                    variant={
                      metrics?.circuitBreakerStatus === 'closed' ? 'default' :
                      metrics?.circuitBreakerStatus === 'half-open' ? 'secondary' :
                      'destructive'
                    }
                    className="text-xs"
                    data-testid="status-circuit-breaker"
                  >
                    {metrics?.circuitBreakerStatus || 'Unknown'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Failures</span>
                  <span className="text-xs font-medium" data-testid="text-failure-count">
                    {networkHealth?.circuitBreaker?.failureCount || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Protection</span>
                  <span 
                    className={cn(
                      "text-xs font-medium",
                      metrics?.circuitBreakerStatus === 'open' ? "text-red-600" : "text-green-600"
                    )}
                  >
                    {metrics?.circuitBreakerStatus === 'open' ? 'Active' : 'Normal'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <Tabs defaultValue="metrics" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="latency">Latency Trend</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-4">
            {/* Success Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Success Rate</span>
                <span className="text-sm text-muted-foreground" data-testid="text-success-rate">
                  {metrics ? `${metrics.successRate.toFixed(1)}%` : '--'}
                </span>
              </div>
              <Progress 
                value={metrics?.successRate || 0} 
                className={cn(
                  "h-2",
                  metrics && metrics.successRate < 90 && "bg-yellow-100",
                  metrics && metrics.successRate < 50 && "bg-red-100"
                )}
              />
            </div>

            {/* Request Statistics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Requests</p>
                <p className="text-sm font-medium" data-testid="text-total-requests">
                  {metrics?.totalRequests || 0}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Successful</p>
                <p className="text-sm font-medium text-green-600" data-testid="text-successful-requests">
                  {metrics?.successfulRequests || 0}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-sm font-medium text-red-600" data-testid="text-failed-requests">
                  {metrics?.failedRequests || 0}
                </p>
              </div>
            </div>

            {/* Average Latency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Average Latency</span>
                <span 
                  className={cn(
                    "text-sm",
                    metrics && metrics.averageLatency > 1000 && "text-yellow-600",
                    metrics && metrics.averageLatency > 2000 && "text-red-600"
                  )}
                  data-testid="text-avg-latency"
                >
                  {metrics ? `${metrics.averageLatency.toFixed(0)} ms` : '--'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {metrics && metrics.averageLatency < 500 && (
                  <Badge variant="default" className="text-xs">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    Excellent
                  </Badge>
                )}
                {metrics && metrics.averageLatency >= 500 && metrics.averageLatency < 1000 && (
                  <Badge variant="secondary" className="text-xs">
                    <Activity className="h-3 w-3 mr-1" />
                    Good
                  </Badge>
                )}
                {metrics && metrics.averageLatency >= 1000 && (
                  <Badge variant="destructive" className="text-xs">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Slow
                  </Badge>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="latency" className="h-[200px]">
            {latencyHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={latencyHistory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    className="text-xs"
                    tick={{ fill: 'currentColor', fontSize: 10 }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'currentColor', fontSize: 10 }}
                    label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="latency" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary) / 0.2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <BarChart className="h-8 w-8 mr-2 opacity-50" />
                <span className="text-sm">No latency data yet</span>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Alerts */}
        {metrics && metrics.circuitBreakerStatus === 'open' && (
          <Alert variant="destructive" data-testid="alert-circuit-breaker-open">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Circuit breaker is open. Service is temporarily unavailable to prevent cascading failures.
            </AlertDescription>
          </Alert>
        )}

        {metrics && metrics.successRate < 90 && (
          <Alert data-testid="alert-low-success-rate">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Network success rate is below optimal levels ({metrics.successRate.toFixed(1)}%). 
              Consider checking your connection or proxy settings.
            </AlertDescription>
          </Alert>
        )}

        {metrics?.lastError && (
          <Alert variant="destructive" data-testid="alert-last-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Last error: {metrics.lastError}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}