import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EyeOff } from 'lucide-react';
import { FundingConfig } from '../../types/wallet';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function FundingPanel() {
  const [config, setConfig] = useState<FundingConfig>({
    source: 'main_wallet',
    method: 'random',
    totalAmount: '5.0'
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const stealthFundingMutation = useMutation({
    mutationFn: async (fundingConfig: FundingConfig) => {
      const response = await apiRequest('POST', '/api/stealth-funding', {
        source: fundingConfig.source,
        method: fundingConfig.method,
        totalAmount: fundingConfig.totalAmount,
        selectedWallets: [] // Fund all idle wallets
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Stealth Funding Executed",
        description: `Successfully funded ${data.walletsUpdated} wallets with ${data.netAmount.toFixed(4)} BNB`,
      });
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
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
    stealthFundingMutation.mutate(config);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Stealth Funding</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
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
              <RadioGroupItem value="random" id="random" />
              <Label htmlFor="random">Random Intervals</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="batch" id="batch" />
              <Label htmlFor="batch">Batch Distribution</Label>
            </div>
          </RadioGroup>
        </div>

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

        <Button 
          className="w-full bg-warning text-background hover:bg-warning/90 shadow-lg shadow-warning/30"
          onClick={handleExecuteFunding}
          disabled={stealthFundingMutation.isPending}
          data-testid="button-execute-funding"
        >
          <EyeOff className="w-4 h-4 mr-2" />
          {stealthFundingMutation.isPending ? 'Executing...' : 'Execute Stealth Funding'}
        </Button>
      </CardContent>
    </Card>
  );
}
