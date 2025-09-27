import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Info,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink
} from 'lucide-react';
import type { BundleTransaction, TransactionEvent } from '@shared/schema';

interface FailureAlert {
  id: string;
  transaction: BundleTransaction;
  events: TransactionEvent[];
  timestamp: Date;
  retryCount: number;
  isNew?: boolean;
}

interface FailureAlertsProps {
  transactions?: BundleTransaction[];
  events?: TransactionEvent[];
  onRetry?: (transactionId: string) => Promise<void>;
  explorerUrl?: string;
}

export function FailureAlerts({ 
  transactions = [], 
  events = [], 
  onRetry,
  explorerUrl = 'https://bscscan.com'
}: FailureAlertsProps) {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<FailureAlert[]>([]);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [retryingTransactions, setRetryingTransactions] = useState<Set<string>>(new Set());

  // Process failed transactions into alerts
  useEffect(() => {
    const failedTransactions = transactions.filter(
      tx => tx.status === 'failed' || tx.status === 'retrying'
    );

    const newAlerts: FailureAlert[] = failedTransactions.map(tx => {
      const txEvents = events.filter(e => e.bundleTransactionId === tx.id);
      const retryEvents = txEvents.filter(e => e.eventType === 'retry');
      
      return {
        id: tx.id,
        transaction: tx,
        events: txEvents,
        timestamp: new Date(tx.updatedAt),
        retryCount: retryEvents.length,
        isNew: !alerts.find(a => a.id === tx.id)
      };
    });

    // Check for new failures and show toast notifications
    newAlerts.forEach(alert => {
      if (alert.isNew && alert.transaction.status === 'failed') {
        const errorEvent = alert.events.find(e => e.errorMessage);
        toast({
          variant: "destructive",
          title: "Transaction Failed",
          description: errorEvent?.errorMessage || `Transaction ${alert.transaction.transactionHash || alert.transaction.id} failed`,
          action: onRetry ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRetry(alert.transaction.id)}
            >
              Retry
            </Button>
          ) : undefined,
        });
      }
    });

    setAlerts(newAlerts);
  }, [transactions, events, toast]);

  const toggleAlert = (alertId: string) => {
    setExpandedAlerts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  const handleRetry = async (transactionId: string) => {
    if (!onRetry || retryingTransactions.has(transactionId)) return;

    setRetryingTransactions(prev => new Set(prev).add(transactionId));
    
    try {
      await onRetry(transactionId);
      toast({
        title: "Retry Initiated",
        description: "Transaction retry has been initiated",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Retry Failed",
        description: error instanceof Error ? error.message : "Failed to retry transaction",
      });
    } finally {
      setRetryingTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  const getErrorDetails = (alert: FailureAlert) => {
    const errorEvents = alert.events.filter(e => e.errorMessage || e.errorCode);
    if (errorEvents.length === 0) return null;

    const latestError = errorEvents[0];
    return {
      message: latestError.errorMessage,
      code: latestError.errorCode,
      reason: latestError.retryReason
    };
  };

  const getRetryInfo = (alert: FailureAlert) => {
    const retryEvents = alert.events.filter(e => e.eventType === 'retry');
    return {
      count: retryEvents.length,
      lastAttempt: retryEvents[0]?.timestamp
    };
  };

  if (alerts.length === 0) {
    return (
      <Card data-testid="failure-alerts-empty">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No failed transactions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="failure-alerts">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Failed Transactions
          </CardTitle>
          <Badge variant="destructive" data-testid="failure-count">
            {alerts.length} Failed
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {alerts.map(alert => {
              const isExpanded = expandedAlerts.has(alert.id);
              const errorDetails = getErrorDetails(alert);
              const retryInfo = getRetryInfo(alert);
              const isRetrying = retryingTransactions.has(alert.transaction.id);

              return (
                <Alert 
                  key={alert.id}
                  variant="destructive"
                  className="relative"
                  data-testid={`failure-alert-${alert.id}`}
                >
                  <div className="pr-8">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 mt-0.5" />
                      <div className="flex-1">
                        <AlertTitle className="mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {alert.transaction.transactionType.replace('_', ' ').toUpperCase()}
                            </span>
                            {retryInfo.count > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {retryInfo.count} retries
                              </Badge>
                            )}
                          </div>
                        </AlertTitle>
                        <AlertDescription>
                          <div className="space-y-2">
                            {/* Error Summary */}
                            <div className="text-sm">
                              {errorDetails?.message || 'Transaction failed without specific error message'}
                            </div>

                            {/* Transaction Info */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {alert.transaction.transactionHash && (
                                <button
                                  onClick={() => copyToClipboard(alert.transaction.transactionHash!)}
                                  className="flex items-center gap-1 hover:text-foreground"
                                  data-testid={`copy-hash-${alert.id}`}
                                >
                                  <Copy className="h-3 w-3" />
                                  {alert.transaction.transactionHash.slice(0, 8)}...
                                </button>
                              )}
                              <span>
                                Failed at {new Date(alert.timestamp).toLocaleTimeString()}
                              </span>
                            </div>

                            {/* Expandable Details */}
                            {(errorDetails?.code || retryInfo.lastAttempt || alert.events.length > 0) && (
                              <button
                                onClick={() => toggleAlert(alert.id)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                data-testid={`toggle-details-${alert.id}`}
                              >
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                View Details
                              </button>
                            )}

                            {isExpanded && (
                              <div className="mt-3 p-3 bg-background/50 rounded space-y-2">
                                {errorDetails?.code && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Error Code: </span>
                                    <code className="font-mono">{errorDetails.code}</code>
                                  </div>
                                )}
                                {errorDetails?.reason && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Retry Reason: </span>
                                    {errorDetails.reason}
                                  </div>
                                )}
                                {alert.transaction.walletId && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Wallet: </span>
                                    <code className="font-mono">{alert.transaction.walletId}</code>
                                  </div>
                                )}
                                {alert.transaction.gasPrice && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Gas Price: </span>
                                    {alert.transaction.gasPrice} Gwei
                                  </div>
                                )}
                                {retryInfo.lastAttempt && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Last Retry: </span>
                                    {new Date(retryInfo.lastAttempt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 mt-3">
                              {onRetry && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRetry(alert.transaction.id)}
                                  disabled={isRetrying}
                                  data-testid={`button-retry-${alert.id}`}
                                >
                                  {isRetrying ? (
                                    <>
                                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                      Retrying...
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="h-3 w-3 mr-1" />
                                      Retry
                                    </>
                                  )}
                                </Button>
                              )}
                              {alert.transaction.transactionHash && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                  data-testid={`button-explorer-${alert.id}`}
                                >
                                  <a
                                    href={`${explorerUrl}/tx/${alert.transaction.transactionHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    View in Explorer
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        </AlertDescription>
                      </div>
                    </div>
                  </div>
                </Alert>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Re-export for convenience
import { CheckCircle2 } from 'lucide-react';
export { FailureAlerts as default };