import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { useWebSocket } from '../hooks/useWebSocket';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  PlayCircle, 
  PauseCircle,
  Calendar,
  TrendingUp,
  Package,
  Activity,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Import our custom components
import { BundleProgressCard } from '@/components/bundle/bundle-progress-card';
import { TransactionTimeline } from '@/components/bundle/transaction-timeline';
import { BundleAnalytics } from '@/components/bundle/bundle-analytics';
import { FailureAlerts } from '@/components/bundle/failure-alerts';

import type { BundleExecution, BundleTransaction, TransactionEvent } from '@shared/schema';

interface BundleHistoryResponse {
  data: BundleExecution[];
  total: number;
  page: number;
  pageSize: number;
}

interface BundleProgressResponse {
  bundle: BundleExecution;
  transactions: BundleTransaction[];
  events: TransactionEvent[];
  analytics?: any;
}

export default function BundleExecutionPage() {
  const { toast } = useToast();
  const params = useParams();
  const bundleIdFromUrl = (params as any).id;
  const [selectedBundle, setSelectedBundle] = useState<string | null>(bundleIdFromUrl || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [realtimeProgress, setRealtimeProgress] = useState<any>(null);

  // WebSocket connection for real-time updates
  const websocket = useWebSocket({
    enabled: true,
    onMessage: (data) => {
      if (data.type === 'bundleExecutionUpdate') {
        const update = data.data;
        if (update.bundleExecutionId === selectedBundle) {
          setRealtimeProgress(update.progress);
          // Refresh queries to get latest data
          queryClient.invalidateQueries({ queryKey: ['/api/bundles', selectedBundle] });
        }
      }
    }
  });

  // Set selected bundle from URL on mount
  useEffect(() => {
    if (bundleIdFromUrl) {
      setSelectedBundle(bundleIdFromUrl);
    }
  }, [bundleIdFromUrl]);

  // Fetch bundle history
  const { data: history, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery<BundleHistoryResponse>({
    queryKey: ['/api/bundles', currentPage, pageSize, statusFilter, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(dateRange.start && { startDate: dateRange.start }),
        ...(dateRange.end && { endDate: dateRange.end }),
      });
      const response = await apiRequest('GET', `/api/bundles?${params}`);
      const bundles = await response.json();
      return {
        data: bundles,
        total: bundles.length,
        page: currentPage,
        pageSize: pageSize
      };
    },
  });

  // Fetch selected bundle progress
  const { data: bundleProgress, isLoading: isLoadingProgress } = useQuery<BundleProgressResponse>({
    queryKey: ['/api/bundles', selectedBundle, 'progress'],
    queryFn: async () => {
      // Get bundle status
      const statusResponse = await apiRequest('GET', `/api/bundles/${selectedBundle}/status`);
      const bundle = await statusResponse.json();
      
      // Get bundle transactions
      const transactionsResponse = await apiRequest('GET', `/api/bundles/${selectedBundle}/transactions`);
      const transactionData = await transactionsResponse.json();
      
      return {
        bundle: bundle,
        transactions: transactionData.transactions || [],
        events: [],
        analytics: transactionData.summary || realtimeProgress
      };
    },
    enabled: !!selectedBundle,
    refetchInterval: selectedBundle ? 5000 : false, // Poll every 5 seconds for active bundles
  });

  // Update bundle status mutation
  const updateBundleStatus = useMutation({
    mutationFn: async ({ bundleId, action }: { 
      bundleId: string; 
      action: 'pause' | 'resume' | 'cancel';
    }) => {
      return apiRequest('POST', `/api/bundles/${bundleId}/${action}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Bundle execution status has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bundles'] });
      refetchHistory();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update bundle status",
      });
    },
  });

  // Retry failed transaction
  const retryTransaction = async (transactionId: string) => {
    try {
      // In a real implementation, this would call an API to retry the transaction
      toast({
        title: "Retry Initiated",
        description: `Retrying transaction ${transactionId}`,
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/bundles'] });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Retry Failed",
        description: error instanceof Error ? error.message : "Failed to retry transaction",
      });
    }
  };

  const handleBundleSelect = (bundleId: string) => {
    setSelectedBundle(bundleId === selectedBundle ? null : bundleId);
  };

  const handleBundleAction = (bundleId: string, action: 'pause' | 'resume' | 'cancel') => {
    updateBundleStatus.mutate({ bundleId, action });
  };

  const getBundleStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'executing': return 'bg-blue-500';
      case 'broadcasting': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getBundleStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'executing': return 'secondary';
      case 'failed': return 'destructive';
      case 'pending': return 'outline';
      default: return 'outline';
    }
  };

  const totalPages = history ? Math.ceil(history.total / pageSize) : 0;

  return (
    <div className="flex-1 overflow-hidden bg-background">
      <div className="h-full flex flex-col p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Bundle Execution Monitor</h1>
          <p className="text-muted-foreground">
            Monitor and manage multi-wallet transaction bundles in real-time
          </p>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="monitoring" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="monitoring" data-testid="tab-monitoring">
              <Activity className="h-4 w-4 mr-2" />
              Live Monitoring
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <Package className="h-4 w-4 mr-2" />
              Bundle History
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <TrendingUp className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Live Monitoring Tab */}
          <TabsContent value="monitoring" className="flex-1 overflow-auto mt-6">
            {selectedBundle && bundleProgress ? (
              <div className="space-y-6">
                {/* Bundle Selection Info */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Monitoring Bundle</CardTitle>
                        <CardDescription className="mt-1">
                          ID: {selectedBundle}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedBundle(null)}
                          data-testid="button-close-monitor"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Close Monitor
                        </Button>
                        {bundleProgress.bundle.status === 'executing' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBundleAction(selectedBundle, 'pause')}
                            data-testid="button-pause-bundle"
                          >
                            <PauseCircle className="h-4 w-4 mr-2" />
                            Pause
                          </Button>
                        )}
                        {bundleProgress.bundle.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(selectedBundle, 'executing')}
                            data-testid="button-start-bundle"
                          >
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Start
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Monitoring Components Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <BundleProgressCard 
                    bundleId={selectedBundle}
                    onTransactionClick={(tx) => {
                      toast({
                        title: "Transaction Selected",
                        description: `Viewing transaction ${tx.id}`,
                      });
                    }}
                  />
                  <FailureAlerts
                    transactions={bundleProgress.transactions}
                    events={bundleProgress.events}
                    onRetry={retryTransaction}
                  />
                </div>

                {/* Transaction Timeline */}
                <TransactionTimeline
                  transactions={bundleProgress.transactions}
                  events={bundleProgress.events}
                  onRefresh={() => queryClient.invalidateQueries({ queryKey: ['/api/bundles', selectedBundle] })}
                />
              </div>
            ) : (
              <Card className="flex-1" data-testid="no-bundle-selected">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Package className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Bundle Selected</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    Select a bundle from the history tab or wait for active bundles to appear
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Bundle History Tab */}
          <TabsContent value="history" className="flex-1 overflow-hidden mt-6">
            <div className="space-y-4">
              {/* Filters */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Filters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <Label htmlFor="search" className="mb-1">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="search"
                          placeholder="Search bundles..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8"
                          data-testid="input-search-bundles"
                        />
                      </div>
                    </div>
                    <div className="min-w-[150px]">
                      <Label htmlFor="status-filter" className="mb-1">Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger id="status-filter" data-testid="select-status-filter">
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="executing">Executing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-[150px]">
                      <Label htmlFor="date-start" className="mb-1">Start Date</Label>
                      <Input
                        id="date-start"
                        type="date"
                        value={dateRange.start || ''}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        data-testid="input-date-start"
                      />
                    </div>
                    <div className="min-w-[150px]">
                      <Label htmlFor="date-end" className="mb-1">End Date</Label>
                      <Input
                        id="date-end"
                        type="date"
                        value={dateRange.end || ''}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        data-testid="input-date-end"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={() => refetchHistory()}
                        data-testid="button-refresh-history"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bundle History List */}
              <Card className="flex-1">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Bundle History</CardTitle>
                    <Badge variant="secondary" data-testid="total-bundles">
                      {history?.total || 0} Total Bundles
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                      <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : history && history.data.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {history.data.map((bundle) => (
                          <div
                            key={bundle.id}
                            className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50 ${
                              selectedBundle === bundle.id ? 'border-primary bg-accent/30' : ''
                            }`}
                            onClick={() => handleBundleSelect(bundle.id)}
                            data-testid={`bundle-history-item-${bundle.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">Bundle #{bundle.id.slice(0, 8)}</span>
                                  <Badge variant={getBundleStatusVariant(bundle.status)}>
                                    {bundle.status}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {bundle.totalWallets} wallets • {bundle.completedWallets} completed • {bundle.failedWallets} failed
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Created: {new Date(bundle.createdAt).toLocaleString()}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold">
                                  {parseFloat(bundle.progressPercentage).toFixed(1)}%
                                </div>
                                <div className="text-xs text-muted-foreground">Progress</div>
                              </div>
                            </div>
                            {bundle.failureReason && (
                              <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                                {bundle.failureReason}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Package className="h-12 w-12 text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">No bundles found</p>
                    </div>
                  )}

                  {/* Pagination */}
                  {history && totalPages > 1 && (
                    <>
                      <Separator className="my-4" />
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, history.total)} of {history.total} bundles
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            data-testid="button-prev-page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          <span className="text-sm">
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            data-testid="button-next-page"
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="flex-1 overflow-auto mt-6">
            <BundleAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}