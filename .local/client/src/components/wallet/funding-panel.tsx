import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { EyeOff, Settings, ChevronDown, DollarSign, Target, Zap, Clock, Users, Activity } from 'lucide-react';
import { FundingConfig, AdvancedBulkFunding, BulkOperation } from '../../types/wallet';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function FundingPanel() {
  const [config, setConfig] = useState<AdvancedBulkFunding>({
    sourceWallet: 'main_wallet',
    targetStrategy: 'all',
    fundingStrategy: 'even',
    totalAmount: '5.0',
    batchSize: 20,
    delayBetweenBatches: 500,
    targetWallets: [],
    targetPools: []
  });
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [processedWallets, setProcessedWallets] = useState(0);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get available wallets for selection
  const { data: wallets = [] } = useQuery<any[]>({
    queryKey: ['/api/wallets'],
    select: (data: any) => (Array.isArray(data) ? data : [])
  });

  // Get available wallet pools
  const { data: walletPools = [] } = useQuery<any[]>({
    queryKey: ['/api/wallet-pools'],
    select: (data: any) => (Array.isArray(data) ? data : [])
  });

  const fundingStrategies = {
    even: { label: 'Even Distribution', description: 'Equal amount to each wallet' },
    weighted: { label: 'Weighted Distribution', description: 'Based on wallet balance' },
    random: { label: 'Random Distribution', description: 'Random amounts within range' },
    custom: { label: 'Custom Amounts', description: 'Specify individual amounts' },
    smart: { label: 'Smart Distribution', description: 'AI-optimized distribution' }
  };

  const targetStrategies = {
    all: { label: 'All Wallets', description: 'Fund all available wallets' },
    selected: { label: 'Selected Wallets', description: 'Fund specific wallets' },
    pools: { label: 'Wallet Pools', description: 'Fund wallets in selected pools' },
    filtered: { label: 'Filtered Wallets', description: 'Fund based on criteria' }
  };

  const bulkFundingMutation = useMutation({
    mutationFn: async (fundingConfig: AdvancedBulkFunding) => {
      const response = await apiRequest('POST', '/api/bulk-funding', fundingConfig);
      return response.json();
    },
    onMutate: () => {
      setIsExecuting(true);
      setExecutionProgress(0);
      setCurrentBatch(0);
      setProcessedWallets(0);
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Funding Completed",
        description: `Successfully funded ${data.successful} wallets with ${data.totalAmount} BNB`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bulk-operations'] });
    },
    onError: (error) => {
      toast({
        title: "Funding Failed", 
        description: "Failed to execute bulk funding. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsExecuting(false);
      setExecutionProgress(100);
    }
  });

  const handleExecuteFunding = () => {
    bulkFundingMutation.mutate(config);
  };

  const getTargetWalletCount = () => {
    switch (config.targetStrategy) {
      case 'all':
        return wallets.length;
      case 'selected':
        return config.targetWallets?.length || 0;
      case 'pools':
        return config.targetPools?.reduce((total, poolId) => {
          const pool = walletPools.find((p: any) => p.id === poolId);
          return total + (pool?.wallets?.length || 0);
        }, 0) || 0;
      case 'filtered':
        return wallets.filter((w: any) => w.status === 'idle' && parseFloat(w.balance) < 0.05).length;
      default:
        return 0;
    }
  };

  const getAmountPerWallet = () => {
    const targetCount = getTargetWalletCount();
    if (targetCount === 0 || config.fundingStrategy === 'custom') return 'Custom';
    return (parseFloat(config.totalAmount) / targetCount).toFixed(4);
  };

  const getBatchCount = () => {
    const targetCount = getTargetWalletCount();
    return Math.ceil(targetCount / config.batchSize);
  };

  const getEstimatedTime = () => {
    const batchCount = getBatchCount();
    const totalTime = (batchCount * config.delayBetweenBatches) / 1000;
    return totalTime < 60 ? `~${Math.ceil(totalTime)}s` : `~${Math.ceil(totalTime / 60)}m`;
  };

  // Simulate progress updates
  useEffect(() => {
    if (isExecuting) {
      const interval = setInterval(() => {
        setExecutionProgress((prev) => {
          if (prev >= 90) return prev;
          const increment = Math.random() * 8 + 2;
          const newProgress = Math.min(prev + increment, 90);
          
          // Update batch and wallet counts
          const targetCount = getTargetWalletCount();
          const newProcessed = Math.floor((newProgress / 100) * targetCount);
          setProcessedWallets(newProcessed);
          setCurrentBatch(Math.floor(newProcessed / config.batchSize) + 1);
          
          return newProgress;
        });
      }, 300);

      return () => clearInterval(interval);
    }
  }, [isExecuting, config.batchSize]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-xl">Advanced Bulk Funding</CardTitle>
            {getTargetWalletCount() >= 100 && (
              <Badge variant="secondary" className="text-xs">
                Bulk Mode
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <EyeOff className="w-4 h-4" />
            <span>Stealth Distribution Active</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Target Strategy Selection */}
        <div className="space-y-4">
          <div>
            <Label>Target Strategy</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              {Object.entries(targetStrategies).map(([key, strategy]) => (
                <Button
                  key={key}
                  variant={config.targetStrategy === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setConfig(prev => ({ ...prev, targetStrategy: key as any }))}
                  className="text-xs h-auto py-2 px-3"
                  data-testid={`button-target-${key}`}
                >
                  <div className="text-center">
                    <div className="font-medium">{strategy.label}</div>
                    <div className="text-xs opacity-70">{strategy.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {config.targetStrategy === 'selected' && (
            <div>
              <Label>Select Wallets ({config.targetWallets?.length || 0} selected)</Label>
              <div className="mt-2 max-h-32 overflow-y-auto border rounded p-2 bg-muted/20">
                {wallets.slice(0, 10).map((wallet: any) => (
                  <div key={wallet.id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      checked={config.targetWallets?.includes(wallet.id) || false}
                      onCheckedChange={(checked) => {
                        const updatedWallets = checked
                          ? [...(config.targetWallets || []), wallet.id]
                          : config.targetWallets?.filter(id => id !== wallet.id) || [];
                        setConfig(prev => ({ ...prev, targetWallets: updatedWallets }));
                      }}
                    />
                    <Label className="text-xs flex-1">{wallet.label} ({wallet.balance} BNB)</Label>
                  </div>
                ))}
                {wallets.length > 10 && <div className="text-xs text-muted-foreground">... and {wallets.length - 10} more</div>}
              </div>
            </div>
          )}

          {config.targetStrategy === 'pools' && (
            <div>
              <Label>Select Wallet Pools ({config.targetPools?.length || 0} selected)</Label>
              <div className="mt-2 space-y-2">
                {walletPools.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-3 border rounded bg-muted/20">
                    No wallet pools available. Create pools to organize wallets.
                  </div>
                ) : (
                  walletPools.map((pool: any) => (
                    <div key={pool.id} className="flex items-center space-x-2 p-2 border rounded">
                      <Checkbox
                        checked={config.targetPools?.includes(pool.id) || false}
                        onCheckedChange={(checked) => {
                          const updatedPools = checked
                            ? [...(config.targetPools || []), pool.id]
                            : config.targetPools?.filter(id => id !== pool.id) || [];
                          setConfig(prev => ({ ...prev, targetPools: updatedPools }));
                        }}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{pool.name}</div>
                        <div className="text-xs text-muted-foreground">{pool.wallets?.length || 0} wallets</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Funding Strategy Selection */}
        <div>
          <Label>Funding Strategy</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
            {Object.entries(fundingStrategies).map(([key, strategy]) => (
              <Button
                key={key}
                variant={config.fundingStrategy === key ? "default" : "outline"}
                size="sm"
                onClick={() => setConfig(prev => ({ ...prev, fundingStrategy: key as any }))}
                className="text-xs h-auto py-3 px-3"
                data-testid={`button-strategy-${key}`}
              >
                <div className="text-center">
                  <div className="font-medium">{strategy.label}</div>
                  <div className="text-xs opacity-70">{strategy.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Amount Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div>
            <Label htmlFor="source-wallet">Source Wallet</Label>
            <Select 
              value={config.sourceWallet} 
              onValueChange={(value) => setConfig(prev => ({ ...prev, sourceWallet: value }))}
            >
              <SelectTrigger className="mt-2" data-testid="select-source-wallet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main_wallet">Main Wallet</SelectItem>
                <SelectItem value="exchange">Exchange Withdrawal</SelectItem>
                <SelectItem value="bridge">Bridge Contract</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Funding Summary */}
        <div className="bg-muted rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-primary" />
              <div>
                <div className="font-medium">{getTargetWalletCount()}</div>
                <div className="text-xs text-muted-foreground">Target Wallets</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <div>
                <div className="font-medium">{getAmountPerWallet()}</div>
                <div className="text-xs text-muted-foreground">Per Wallet</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-500" />
              <div>
                <div className="font-medium">{getBatchCount()}</div>
                <div className="text-xs text-muted-foreground">Batches</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <div>
                <div className="font-medium">{getEstimatedTime()}</div>
                <div className="text-xs text-muted-foreground">Est. Time</div>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Configuration */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-between p-0" data-testid="button-toggle-advanced">
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Advanced Configuration</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 mt-4 p-4 border rounded-lg bg-muted/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="batch-size">Batch Size</Label>
                <Input
                  id="batch-size"
                  type="number"
                  min="5"
                  max="100"
                  value={config.batchSize}
                  onChange={(e) => setConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 20 }))}
                  className="mt-2"
                  data-testid="input-batch-size"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Wallets processed per batch
                </div>
              </div>
              
              <div>
                <Label htmlFor="delay-between-batches">Delay Between Batches (ms)</Label>
                <Input
                  id="delay-between-batches"
                  type="number"
                  min="100"
                  max="5000"
                  value={config.delayBetweenBatches}
                  onChange={(e) => setConfig(prev => ({ ...prev, delayBetweenBatches: parseInt(e.target.value) || 500 }))}
                  className="mt-2"
                  data-testid="input-delay-batches"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Stealth delay for privacy
                </div>
              </div>
              
              {config.fundingStrategy === 'custom' && (
                <div className="md:col-span-2">
                  <Label>Custom Amounts</Label>
                  <div className="mt-2 p-3 border rounded bg-muted/20">
                    <div className="text-sm text-muted-foreground">
                      Custom amount configuration will be available after wallet selection
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Execute Button */}
        <Button 
          className="w-full bg-warning text-background hover:bg-warning/90 shadow-lg shadow-warning/30"
          onClick={handleExecuteFunding}
          disabled={bulkFundingMutation.isPending || getTargetWalletCount() === 0}
          data-testid="button-execute-funding"
        >
          <EyeOff className="w-4 h-4 mr-2" />
          {bulkFundingMutation.isPending ? 'Executing...' : `Fund ${getTargetWalletCount()} Wallets`}
        </Button>

        {/* Enhanced Progress Tracking */}
        {(isExecuting || executionProgress > 0) && (
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-sm font-medium">Bulk Funding Progress</span>
                <Badge variant="outline" className="text-xs">
                  {config.fundingStrategy} strategy
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground">
                {processedWallets}/{getTargetWalletCount()} wallets
              </span>
            </div>
            
            <Progress value={executionProgress} className="w-full" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Users className="w-3 h-3" />
                <span>Batch: {currentBatch}/{getBatchCount()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <DollarSign className="w-3 h-3" />
                <span>Amount: {config.totalAmount} BNB</span>
              </div>
              <div className="flex items-center space-x-1">
                <Zap className="w-3 h-3" />
                <span>Strategy: {config.fundingStrategy}</span>
              </div>
              <div className="text-right">
                <span>ETA: {getEstimatedTime()}</span>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground italic">
              Using {config.delayBetweenBatches}ms delays between batches for enhanced stealth
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
