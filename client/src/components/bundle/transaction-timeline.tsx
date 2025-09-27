import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Clock, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronDown,
  ChevronRight,
  Activity,
  Wallet,
  Hash,
  Fuel,
  DollarSign
} from 'lucide-react';
import type { BundleTransaction, TransactionEvent } from '@shared/schema';

interface TransactionTimelineProps {
  transactions: BundleTransaction[];
  events?: TransactionEvent[];
  onRefresh?: () => void;
}

export function TransactionTimeline({ transactions, events = [], onRefresh }: TransactionTimelineProps) {
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set());

  const toggleTransaction = (txId: string) => {
    setExpandedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(txId)) {
        newSet.delete(txId);
      } else {
        newSet.add(txId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950';
      case 'broadcasting': return 'border-blue-500 bg-blue-50 dark:bg-blue-950';
      case 'confirmed': return 'border-green-500 bg-green-50 dark:bg-green-950';
      case 'failed': return 'border-red-500 bg-red-50 dark:bg-red-950';
      case 'retrying': return 'border-orange-500 bg-orange-50 dark:bg-orange-950';
      default: return 'border-gray-500 bg-gray-50 dark:bg-gray-950';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'broadcasting': return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'confirmed': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'failed': return <XCircle className="h-5 w-5 text-red-600" />;
      case 'retrying': return <AlertCircle className="h-5 w-5 text-orange-600" />;
      default: return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTimelinePosition = (status: string): number => {
    const positions: Record<string, number> = {
      'pending': 0,
      'broadcasting': 25,
      'retrying': 50,
      'confirmed': 100,
      'failed': 100,
    };
    return positions[status] || 0;
  };

  const formatAddress = (address: string) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatValue = (value: string | null) => {
    if (!value) return '0';
    const num = parseFloat(value);
    return num > 0.01 ? num.toFixed(4) : num.toExponential(2);
  };

  const getTransactionEvents = (txId: string) => {
    return events.filter(e => e.bundleTransactionId === txId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  // Group transactions by status for summary
  const statusGroups = transactions.reduce((acc, tx) => {
    if (!acc[tx.status]) acc[tx.status] = [];
    acc[tx.status].push(tx);
    return acc;
  }, {} as Record<string, BundleTransaction[]>);

  return (
    <Card data-testid="transaction-timeline">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Transaction Timeline</CardTitle>
          {onRefresh && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onRefresh}
              data-testid="button-refresh-timeline"
            >
              <Activity className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Status Summary Bar */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            {Object.entries(statusGroups).map(([status, txs]) => (
              <div
                key={status}
                className="flex items-center gap-1"
                data-testid={`timeline-status-summary-${status}`}
              >
                {getStatusIcon(status)}
                <span className="text-sm font-medium">{txs.length}</span>
              </div>
            ))}
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            {Object.entries(statusGroups).map(([status]) => {
              const position = getTimelinePosition(status);
              return (
                <div
                  key={status}
                  className={`absolute h-full w-1 ${getStatusColor(status).split(' ')[0]}`}
                  style={{ left: `${position}%` }}
                  data-testid={`timeline-progress-marker-${status}`}
                />
              );
            })}
          </div>
        </div>

        {/* Transaction List */}
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {transactions.map((tx, index) => {
              const isExpanded = expandedTransactions.has(tx.id);
              const txEvents = getTransactionEvents(tx.id);
              
              return (
                <Collapsible
                  key={tx.id}
                  open={isExpanded}
                  data-testid={`transaction-timeline-item-${tx.id}`}
                >
                  <div 
                    className={`relative rounded-lg border-2 transition-colors ${getStatusColor(tx.status)}`}
                  >
                    {/* Timeline Connector */}
                    {index < transactions.length - 1 && (
                      <div className="absolute left-7 top-full h-8 w-0.5 bg-border" />
                    )}

                    {/* Main Transaction Row */}
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full p-4 justify-start hover:bg-transparent"
                        onClick={() => toggleTransaction(tx.id)}
                      >
                        <div className="flex items-start gap-3 w-full">
                          {/* Status Icon */}
                          <div className="mt-1">
                            {getStatusIcon(tx.status)}
                          </div>

                          {/* Transaction Info */}
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {tx.transactionType.replace('_', ' ').toUpperCase()}
                              </span>
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                                data-testid={`transaction-status-badge-${tx.id}`}
                              >
                                {tx.status}
                              </Badge>
                              {tx.blockNumber && (
                                <Badge variant="secondary" className="text-xs">
                                  Block #{tx.blockNumber}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Wallet className="h-3 w-3" />
                                {formatAddress(tx.fromAddress)}
                              </span>
                              {tx.transactionHash && (
                                <span className="flex items-center gap-1">
                                  <Hash className="h-3 w-3" />
                                  {formatAddress(tx.transactionHash)}
                                </span>
                              )}
                              {tx.value && (
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  {formatValue(tx.value)}
                                </span>
                              )}
                            </div>

                            {/* Timestamp */}
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(tx.createdAt).toLocaleString()}
                            </div>
                          </div>

                          {/* Expand Icon */}
                          <div className="mt-1">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </Button>
                    </CollapsibleTrigger>

                    {/* Expanded Details */}
                    <CollapsibleContent>
                      <div className="px-4 pb-4 border-t pt-3 space-y-3">
                        {/* Transaction Details */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">From:</span>
                            <p className="font-mono text-xs mt-0.5">{tx.fromAddress}</p>
                          </div>
                          {tx.toAddress && (
                            <div>
                              <span className="text-muted-foreground">To:</span>
                              <p className="font-mono text-xs mt-0.5">{tx.toAddress}</p>
                            </div>
                          )}
                          {tx.gasPrice && (
                            <div>
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Fuel className="h-3 w-3" />
                                Gas Price:
                              </span>
                              <p className="font-mono text-xs mt-0.5">{tx.gasPrice} Gwei</p>
                            </div>
                          )}
                          {tx.gasUsed && (
                            <div>
                              <span className="text-muted-foreground">Gas Used:</span>
                              <p className="font-mono text-xs mt-0.5">{tx.gasUsed}</p>
                            </div>
                          )}
                          {tx.nonce !== null && tx.nonce !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Nonce:</span>
                              <p className="font-mono text-xs mt-0.5">{tx.nonce}</p>
                            </div>
                          )}
                        </div>

                        {/* Transaction Events */}
                        {txEvents.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Event History</h4>
                            <div className="space-y-1">
                              {txEvents.map((event) => (
                                <div 
                                  key={event.id}
                                  className="flex items-start gap-2 text-xs p-2 bg-background/50 rounded"
                                  data-testid={`transaction-event-${event.id}`}
                                >
                                  <Activity className="h-3 w-3 mt-0.5 text-muted-foreground" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        {event.eventType}
                                      </Badge>
                                      <span className="text-muted-foreground">
                                        {new Date(event.timestamp).toLocaleTimeString()}
                                      </span>
                                    </div>
                                    {event.description && (
                                      <p className="mt-1">{event.description}</p>
                                    )}
                                    {event.errorMessage && (
                                      <p className="mt-1 text-destructive">
                                        Error: {event.errorMessage}
                                      </p>
                                    )}
                                    {event.retryCount > 0 && (
                                      <p className="mt-1 text-orange-600">
                                        Retry attempt {event.retryCount}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}