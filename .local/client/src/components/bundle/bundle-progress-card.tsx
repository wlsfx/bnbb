import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import type { BundleExecution, BundleTransaction } from '@shared/schema';

interface BundleProgressData {
  bundle: BundleExecution;
  transactions: BundleTransaction[];
}

interface BundleProgressCardProps {
  bundleId: string;
  onTransactionClick?: (transaction: BundleTransaction) => void;
}

export function BundleProgressCard({ bundleId, onTransactionClick }: BundleProgressCardProps) {
  const { data: progress, isLoading, error } = useQuery<BundleProgressData>({
    queryKey: ['/api/bundles', bundleId, 'progress'],
    queryFn: async () => {
      const response = await fetch(`/api/bundles/${bundleId}/progress`);
      if (!response.ok) throw new Error('Failed to fetch bundle progress');
      return response.json();
    },
    refetchInterval: 2000, // Poll every 2 seconds for real-time updates
    enabled: !!bundleId,
  });

  if (isLoading) {
    return (
      <Card data-testid="bundle-progress-card-loading">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !progress) {
    return (
      <Card data-testid="bundle-progress-card-error">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load bundle progress</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { bundle, transactions } = progress;
  const progressPercentage = parseFloat(bundle.progressPercentage || '0');
  
  // Count transaction statuses
  const statusCounts = transactions.reduce((acc, tx) => {
    acc[tx.status] = (acc[tx.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'broadcasting': return 'bg-blue-500';
      case 'confirmed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'retrying': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'broadcasting': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'confirmed': return <CheckCircle2 className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      case 'retrying': return <AlertCircle className="h-4 w-4" />;
      default: return null;
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

  return (
    <Card data-testid="bundle-progress-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Bundle Progress</CardTitle>
          <Badge 
            variant={getBundleStatusVariant(bundle.status)}
            data-testid={`bundle-status-${bundle.status}`}
          >
            {bundle.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium" data-testid="progress-percentage">
              {progressPercentage.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={progressPercentage} 
            className="h-2"
            data-testid="progress-bar"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid="completed-count">
              {bundle.completedWallets} of {bundle.totalWallets} completed
            </span>
            {bundle.failedWallets > 0 && (
              <span className="text-destructive" data-testid="failed-count">
                {bundle.failedWallets} failed
              </span>
            )}
          </div>
        </div>

        {/* Transaction Status Breakdown */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Transaction Status</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => {
                  const tx = transactions.find(t => t.status === status);
                  if (tx && onTransactionClick) onTransactionClick(tx);
                }}
                data-testid={`status-card-${status}`}
              >
                <div className={`p-1 rounded ${getStatusColor(status)} bg-opacity-20`}>
                  <div className={`${getStatusColor(status)} text-white rounded p-0.5`}>
                    {getStatusIcon(status)}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground capitalize">{status}</p>
                  <p className="text-sm font-medium" data-testid={`status-count-${status}`}>
                    {count} transactions
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Transactions</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {transactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => onTransactionClick && onTransactionClick(tx)}
                  data-testid={`transaction-item-${tx.id}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`${getStatusColor(tx.status)} text-white rounded p-0.5`}>
                      {getStatusIcon(tx.status)}
                    </div>
                    <div>
                      <p className="text-xs font-mono truncate w-24">
                        {tx.transactionHash || 'Pending...'}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {tx.transactionType.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {tx.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timing Information */}
        {bundle.startedAt && (
          <div className="pt-2 border-t space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Started</span>
              <span data-testid="bundle-started-at">
                {new Date(bundle.startedAt).toLocaleTimeString()}
              </span>
            </div>
            {bundle.completedAt && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Completed</span>
                <span data-testid="bundle-completed-at">
                  {new Date(bundle.completedAt).toLocaleTimeString()}
                </span>
              </div>
            )}
            {!bundle.completedAt && bundle.startedAt && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Elapsed</span>
                <span data-testid="bundle-elapsed-time">
                  {Math.floor((Date.now() - new Date(bundle.startedAt).getTime()) / 1000)}s
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}