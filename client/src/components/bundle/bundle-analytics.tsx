import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
  Activity
} from 'lucide-react';
import { useState } from 'react';

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
  analytics: Array<{
    id: string;
    timeframe: string;
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    successRate: string;
    avgConfirmationTime: number | null;
    totalGasUsed: string | null;
    avgGasPrice: string | null;
    totalValue: string | null;
    totalFees: string | null;
    periodStartAt: string;
    periodEndAt: string;
  }>;
}

export function BundleAnalytics() {
  const [timeframe, setTimeframe] = useState('daily');
  
  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['/api/bundles/analytics', timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/bundles/analytics?timeframe=${timeframe}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card data-testid="bundle-analytics-loading">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Activity className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading analytics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card data-testid="bundle-analytics-error">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load analytics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary, analytics } = data;

  // Prepare data for charts
  const successRateData = [
    { name: 'Successful', value: summary.successfulTransactions, color: '#10b981' },
    { name: 'Failed', value: summary.failedTransactions, color: '#ef4444' },
  ];

  const timeSeriesData = analytics.map(a => ({
    date: new Date(a.periodStartAt).toLocaleDateString(),
    successful: a.successfulTransactions,
    failed: a.failedTransactions,
    successRate: parseFloat(a.successRate),
    avgConfirmationTime: a.avgConfirmationTime || 0,
  }));

  const gasData = analytics.filter(a => a.totalGasUsed).map(a => ({
    date: new Date(a.periodStartAt).toLocaleDateString(),
    gasUsed: parseFloat(a.totalGasUsed || '0'),
    avgGasPrice: parseFloat(a.avgGasPrice || '0'),
    totalFees: parseFloat(a.totalFees || '0'),
  }));

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toString();
  };

  const getSuccessRateTrend = () => {
    if (analytics.length < 2) return null;
    const recent = parseFloat(analytics[0].successRate);
    const previous = parseFloat(analytics[1].successRate);
    const diff = recent - previous;
    
    if (diff > 0) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (diff < 0) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return null;
  };

  return (
    <div className="space-y-6" data-testid="bundle-analytics">
      {/* Header with Timeframe Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Bundle Analytics</h2>
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="analytics-summary-transactions">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.totalTransactions)}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {summary.successfulTransactions}
              </Badge>
              <Badge variant="destructive" className="text-xs">
                <XCircle className="h-3 w-3 mr-1" />
                {summary.failedTransactions}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="analytics-summary-success-rate">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{summary.successRate}%</span>
              {getSuccessRateTrend()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.successfulTransactions} successful
            </p>
          </CardContent>
        </Card>

        <Card data-testid="analytics-summary-confirmation-time">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Confirmation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{summary.avgConfirmationTime}s</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per transaction
            </p>
          </CardContent>
        </Card>

        <Card data-testid="analytics-summary-gas">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Fuel className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{parseFloat(summary.totalFees).toFixed(4)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gas: {formatNumber(parseFloat(summary.totalGasUsed))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="success-rate" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="success-rate" data-testid="tab-success-rate">
            Success Rate
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            Timeline
          </TabsTrigger>
          <TabsTrigger value="gas-usage" data-testid="tab-gas-usage">
            Gas Usage
          </TabsTrigger>
          <TabsTrigger value="confirmation-time" data-testid="tab-confirmation-time">
            Confirmation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="success-rate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Success Rate Distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-6">
              <div className="flex-1">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={successRateData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
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
              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height={250}>
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gas-usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gas Usage & Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={gasData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="gasUsed" 
                    stroke="#8b5cf6" 
                    name="Gas Used"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="totalFees" 
                    stroke="#f59e0b" 
                    name="Total Fees"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="confirmation-time" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Average Confirmation Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="avgConfirmationTime" 
                    stroke="#3b82f6" 
                    fill="#3b82f6"
                    fillOpacity={0.6}
                    name="Avg Confirmation (s)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}