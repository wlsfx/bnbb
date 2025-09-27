import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../hooks/useWebSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  EyeOff, 
  Wallet as WalletIcon, 
  TrendingUp, 
  History, 
  AlertTriangle, 
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
  BarChart3,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle
} from 'lucide-react';
import { FundingConfig } from '../types/wallet';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Wallet, StealthFundingSnapshot } from '@shared/schema';

export default function StealthFunding() {
  const [config, setConfig] = useState<FundingConfig>({
    source: 'main_wallet',
    method: 'random',
    totalAmount: '5.0'
  });
  
  // WebSocket connection
  const websocket = useWebSocket({
    enabled: true,
    fallbackToPolling: true,
  });
  
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [fundingTarget, setFundingTarget] = useState<'all' | 'selected' | 'idle'>('idle');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Subscribe to WebSocket wallet updates
  useEffect(() => {
    if (websocket.isConnected) {
      websocket.subscribe('wallet_status');
    }
  }, [websocket.isConnected, websocket]);

  // Fetch wallets for selection (now without polling)
  const { data: wallets = [], isLoading: walletsLoading, error: walletsError } = useQuery<Wallet[]>({
    queryKey: ['/api/wallets'],
    // No refetchInterval - data comes from WebSocket
  });

  // Fetch funding snapshots (now without polling)
  const { data: snapshots = [], isLoading: snapshotsLoading, error: snapshotsError } = useQuery<StealthFundingSnapshot[]>({
    queryKey: ['/api/stealth-funding-snapshots'],
    // No refetchInterval - data comes from WebSocket
  });

  // Get funding statistics
  const idleWallets = wallets.filter(w => w.status === 'idle');
  const activeWallets = wallets.filter(w => w.status === 'active');
  const totalBalance = wallets.reduce((sum, w) => sum + parseFloat(w.balance), 0);
  
  const recentSnapshots = snapshots
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const totalFunded = snapshots.reduce((sum, s) => sum + parseFloat(s.netAmount), 0);
  const totalTaxCollected = snapshots.reduce((sum, s) => sum + parseFloat(s.taxAmount), 0);

  // Stealth funding mutation
  const stealthFundingMutation = useMutation({
    mutationFn: async (fundingConfig: FundingConfig & { selectedWallets: string[] }) => {
      const response = await apiRequest('POST', '/api/stealth-funding', fundingConfig);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Stealth Funding Executed",
        description: `Successfully funded ${data.walletsUpdated} wallets with ${data.netAmount.toFixed(4)} BNB`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stealth-funding-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system-metrics'] });
    },
    onError: (error) => {
      toast({
        title: "Funding Failed", 
        description: "Failed to execute stealth funding. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleExecuteFunding = () => {
    let walletsToFund: string[] = [];
    
    if (fundingTarget === 'selected') {
      walletsToFund = selectedWallets;
    } else if (fundingTarget === 'idle') {
      walletsToFund = idleWallets.map(w => w.id);
    }
    // 'all' means empty array (backend will fund all wallets)
    
    stealthFundingMutation.mutate({
      ...config,
      selectedWallets: walletsToFund
    });
  };

  const handleWalletToggle = (walletId: string) => {
    setSelectedWallets(prev => 
      prev.includes(walletId) 
        ? prev.filter(id => id !== walletId)
        : [...prev, walletId]
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { variant: 'default' as const, icon: CheckCircle2, className: 'text-green-600' },
      pending: { variant: 'secondary' as const, icon: Clock, className: 'text-yellow-600' },
      failed: { variant: 'destructive' as const, icon: AlertTriangle, className: 'text-red-600' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={cn("text-xs", config.className)}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const targetWalletCount = fundingTarget === 'selected' 
    ? selectedWallets.length 
    : fundingTarget === 'idle' 
      ? idleWallets.length 
      : wallets.length;

  const amountPerWallet = targetWalletCount > 0 ? parseFloat(config.totalAmount) / targetWalletCount : 0;
  const estimatedNetAmount = parseFloat(config.totalAmount) * 0.95; // 5% tax
  const estimatedTax = parseFloat(config.totalAmount) * 0.05;

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Stealth Funding</h1>
            <p className="text-muted-foreground">
              Execute private funding operations with advanced distribution methods
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-green-600">Live System</span>
          </div>
        </div>

        {/* Error Alerts */}
        {(walletsError || snapshotsError) && (
          <Alert variant="destructive" data-testid="stealth-funding-error">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load data. {walletsError?.message || snapshotsError?.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="stats-total-wallets">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Wallets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{wallets.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {activeWallets.length} active • {idleWallets.length} idle
              </p>
            </CardContent>
          </Card>

          <Card data-testid="stats-total-balance">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <WalletIcon className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{totalBalance.toFixed(4)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">BNB across all wallets</p>
            </CardContent>
          </Card>

          <Card data-testid="stats-total-funded">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Funded</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{totalFunded.toFixed(4)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">BNB distributed</p>
            </CardContent>
          </Card>

          <Card data-testid="stats-tax-collected">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tax Collected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-orange-500" />
                <span className="text-2xl font-bold">{totalTaxCollected.toFixed(4)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">BNB in fees</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="funding" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="funding" data-testid="tab-funding-control">
              <EyeOff className="w-4 h-4 mr-2" />
              Funding Control
            </TabsTrigger>
            <TabsTrigger value="wallets" data-testid="tab-wallet-selection">
              <WalletIcon className="w-4 h-4 mr-2" />
              Wallet Selection
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-funding-history">
              <History className="w-4 h-4 mr-2" />
              Funding History
            </TabsTrigger>
          </TabsList>

          {/* Funding Control Tab */}
          <TabsContent value="funding" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Configuration Panel */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Funding Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Funding Source */}
                    <div>
                      <Label>Funding Source</Label>
                      <Select 
                        value={config.source} 
                        onValueChange={(value: FundingConfig['source']) => 
                          setConfig(prev => ({ ...prev, source: value }))
                        }
                      >
                        <SelectTrigger className="mt-2" data-testid="select-funding-source">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main_wallet">Main Wallet</SelectItem>
                          <SelectItem value="exchange">Exchange Withdrawal</SelectItem>
                          <SelectItem value="bridge">Bridge Contract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Target Selection */}
                    <div>
                      <Label>Target Wallets</Label>
                      <RadioGroup 
                        value={fundingTarget} 
                        onValueChange={(value: typeof fundingTarget) => setFundingTarget(value)}
                        className="mt-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="idle" id="idle" data-testid="radio-target-idle" />
                          <Label htmlFor="idle">Idle Wallets ({idleWallets.length})</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="selected" id="selected" data-testid="radio-target-selected" />
                          <Label htmlFor="selected">Selected Wallets ({selectedWallets.length})</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="all" id="all" data-testid="radio-target-all" />
                          <Label htmlFor="all">All Wallets ({wallets.length})</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Distribution Method */}
                    <div>
                      <Label>Distribution Method</Label>
                      <RadioGroup 
                        value={config.method} 
                        onValueChange={(value: FundingConfig['method']) => 
                          setConfig(prev => ({ ...prev, method: value }))
                        }
                        className="mt-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="random" id="random" data-testid="radio-method-random" />
                          <Label htmlFor="random">Random Intervals</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="batch" id="batch" data-testid="radio-method-batch" />
                          <Label htmlFor="batch">Batch Distribution</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Total Amount */}
                    <div>
                      <Label htmlFor="total-amount">Total Amount</Label>
                      <div className="relative mt-2">
                        <Input
                          id="total-amount"
                          type="number"
                          step="0.1"
                          value={config.totalAmount}
                          onChange={(e) => setConfig(prev => ({ ...prev, totalAmount: e.target.value }))}
                          className="pr-12"
                          data-testid="input-total-amount"
                        />
                        <span className="absolute right-3 top-3 text-muted-foreground text-sm">BNB</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Summary & Execute Panel */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Execution Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Target Wallets:</span>
                        <span className="text-sm font-medium">{targetWalletCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Per Wallet:</span>
                        <span className="text-sm font-medium">{amountPerWallet.toFixed(4)} BNB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Gross Amount:</span>
                        <span className="text-sm font-medium">{config.totalAmount} BNB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Tax (5%):</span>
                        <span className="text-sm font-medium text-orange-600">-{estimatedTax.toFixed(4)} BNB</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-sm font-medium">Net Amount:</span>
                        <span className="text-sm font-bold text-green-600">{estimatedNetAmount.toFixed(4)} BNB</span>
                      </div>
                    </div>

                    {fundingTarget === 'selected' && selectedWallets.length === 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Please select wallets to fund from the Wallet Selection tab.
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button 
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white shadow-lg"
                      onClick={handleExecuteFunding}
                      disabled={
                        stealthFundingMutation.isPending || 
                        targetWalletCount === 0 ||
                        parseFloat(config.totalAmount) <= 0
                      }
                      data-testid="button-execute-funding"
                    >
                      <EyeOff className="w-4 h-4 mr-2" />
                      {stealthFundingMutation.isPending ? 'Executing...' : 'Execute Stealth Funding'}
                    </Button>

                    {stealthFundingMutation.isPending && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Processing funding operation...</span>
                        </div>
                        <Progress value={66} className="w-full" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Wallet Selection Tab */}
          <TabsContent value="wallets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Wallets for Funding</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Choose specific wallets to include in the funding operation
                </p>
              </CardHeader>
              <CardContent>
                {walletsLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-3">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-6 w-16" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {wallets.map((wallet) => (
                      <div 
                        key={wallet.id} 
                        className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => handleWalletToggle(wallet.id)}
                        data-testid={`wallet-item-${wallet.id}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedWallets.includes(wallet.id)}
                          onChange={() => handleWalletToggle(wallet.id)}
                          className="rounded"
                          data-testid={`checkbox-wallet-${wallet.id}`}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {wallet.label || `Wallet ${wallet.address.slice(0, 8)}...`}
                          </p>
                          <p className="text-xs text-muted-foreground">{wallet.address}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{wallet.balance} BNB</p>
                          <Badge 
                            variant={wallet.status === 'active' ? 'default' : 'secondary'} 
                            className="text-xs"
                          >
                            {wallet.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Funding History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Funding History</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Recent stealth funding operations and transaction details
                </p>
              </CardHeader>
              <CardContent>
                {snapshotsLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : recentSnapshots.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">No funding history yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Tax</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentSnapshots.map((snapshot) => (
                        <TableRow key={snapshot.id} data-testid={`snapshot-${snapshot.id}`}>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{snapshot.sessionId.slice(0, 8)}...</p>
                              {snapshot.transactionHash && (
                                <p className="text-xs text-muted-foreground">
                                  {snapshot.transactionHash.slice(0, 10)}...
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{snapshot.netAmount} BNB</p>
                              <p className="text-xs text-muted-foreground">
                                Gross: {snapshot.grossAmount} BNB
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{snapshot.taxAmount} BNB</p>
                            <p className="text-xs text-muted-foreground">
                              {snapshot.taxRate}%
                            </p>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(snapshot.status)}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">
                              {formatDistanceToNow(new Date(snapshot.createdAt), { addSuffix: true })}
                            </p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}