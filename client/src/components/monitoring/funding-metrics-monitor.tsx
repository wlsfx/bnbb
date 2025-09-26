import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, DollarSign, Receipt, Eye, AlertTriangle } from 'lucide-react';

interface FundingMetrics {
  timeframe: string;
  totalTransactions: number;
  metrics: {
    grossAmount: string;
    netAmount: string;
    taxCollected: string;
    averageTransactionSize: string;
  };
  recentSnapshots: Array<{
    id: string;
    grossAmount: string;
    netAmount: string;
    taxAmount: string;
    status: string;
    createdAt: string;
  }>;
  timestamp: string;
}

export function FundingMetricsMonitor() {
  const [timeframe, setTimeframe] = useState('24h');
  
  const { data: fundingMetrics, isLoading, error } = useQuery<FundingMetrics>({
    queryKey: ['/api/real-time/funding-metrics', timeframe],
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 3000, // Data considered stale after 3 seconds
  });

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return num.toFixed(4);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { variant: 'default' as const, color: 'text-green-600' },
      pending: { variant: 'secondary' as const, color: 'text-yellow-600' },
      failed: { variant: 'destructive' as const, color: 'text-red-600' },
    };
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  };

  const calculateEfficiency = () => {
    if (!fundingMetrics) return 0;
    const gross = parseFloat(fundingMetrics.metrics.grossAmount);
    const net = parseFloat(fundingMetrics.metrics.netAmount);
    return gross > 0 ? ((net / gross) * 100) : 0;
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Funding Metrics Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Failed to load funding metrics. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Eye className="w-5 h-5 text-warning" />
          Stealth Funding Monitor
        </h3>
        <Select value={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-32" data-testid="select-timeframe">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="24h">24 Hours</SelectItem>
            <SelectItem value="7d">7 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              Gross Amount
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold" data-testid="gross-amount">
              {isLoading ? '...' : `${formatCurrency(fundingMetrics?.metrics.grossAmount || '0')} BNB`}
            </div>
            <p className="text-xs text-muted-foreground">
              Total funding before tax
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Net Amount
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold" data-testid="net-amount">
              {isLoading ? '...' : `${formatCurrency(fundingMetrics?.metrics.netAmount || '0')} BNB`}
            </div>
            <p className="text-xs text-muted-foreground">
              Amount distributed to wallets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="w-4 h-4 text-orange-500" />
              Tax Collected
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold" data-testid="tax-collected">
              {isLoading ? '...' : `${formatCurrency(fundingMetrics?.metrics.taxCollected || '0')} BNB`}
            </div>
            <p className="text-xs text-muted-foreground">
              5% operational tax
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Efficiency</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold" data-testid="efficiency">
              {isLoading ? '...' : `${calculateEfficiency().toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              Net/Gross ratio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Stealth Funding</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">Loading recent transactions...</div>
            </div>
          ) : !fundingMetrics?.recentSnapshots.length ? (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">No recent funding activity</div>
            </div>
          ) : (
            <div className="space-y-2">
              {fundingMetrics.recentSnapshots.map((snapshot) => (
                <div 
                  key={snapshot.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  data-testid={`snapshot-${snapshot.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={getStatusBadge(snapshot.status).variant}
                      className={getStatusBadge(snapshot.status).color}
                    >
                      {snapshot.status}
                    </Badge>
                    <div className="text-sm">
                      <div className="font-medium">
                        {formatCurrency(snapshot.netAmount)} BNB
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Tax: {formatCurrency(snapshot.taxAmount)} BNB
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {new Date(snapshot.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold" data-testid="total-transactions">
              {isLoading ? '...' : fundingMetrics?.totalTransactions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              in {timeframe}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Size</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold" data-testid="average-size">
              {isLoading ? '...' : `${formatCurrency(fundingMetrics?.metrics.averageTransactionSize || '0')} BNB`}
            </div>
            <p className="text-xs text-muted-foreground">
              per transaction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm font-medium" data-testid="last-updated">
              {isLoading ? '...' : fundingMetrics ? new Date(fundingMetrics.timestamp).toLocaleTimeString() : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">
              Auto-refresh: 5s
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}