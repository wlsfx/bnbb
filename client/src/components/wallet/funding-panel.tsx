import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, ArrowRight, Users, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function FundingPanel() {
  const [amountPerWallet, setAmountPerWallet] = useState('0.01');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get wallets data
  const { data: wallets = [] } = useQuery<any[]>({
    queryKey: ['/api/wallets']
  });

  // Find master wallet and other wallets
  const masterWallet = wallets.find((w: any) => 
    w.label?.toLowerCase().includes('master') || w.id === wallets[0]?.id
  );
  const otherWallets = wallets.filter((w: any) => w.id !== masterWallet?.id);
  const masterBalance = parseFloat(masterWallet?.balance || '0');
  
  // Calculate funding requirements
  const totalFundingNeeded = otherWallets.length * parseFloat(amountPerWallet);
  const hasSufficientBalance = masterBalance >= totalFundingNeeded;

  const fundAllWalletsMutation = useMutation({
    mutationFn: async () => {
      // Fund all other wallets from master
      const response = await apiRequest('POST', '/api/bulk-funding', {
        sourceWallet: masterWallet.id,
        targetStrategy: 'selected',
        fundingStrategy: 'even',
        totalAmount: totalFundingNeeded.toString(),
        targetWallets: otherWallets.map((w: any) => w.id),
        batchSize: 10,
        delayBetweenBatches: 200
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Funding Complete",
        description: `Successfully funded ${data.successful} wallets from master wallet`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
    },
    onError: () => {
      toast({
        title: "Funding Failed", 
        description: "Failed to distribute funds. Please try again.",
        variant: "destructive",
      });
    }
  });

  if (!masterWallet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5" />
            <span>Fund Distribution</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Please create a master wallet first before distributing funds.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <DollarSign className="w-5 h-5" />
          <span>Fund Distribution</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Distribution Flow Visualization */}
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                masterBalance > 0.1 ? "bg-success/20" : "bg-warning/20"
              )}>
                <DollarSign className={cn(
                  "w-5 h-5",
                  masterBalance > 0.1 ? "text-success" : "text-warning"
                )} />
              </div>
              <div>
                <div className="font-medium">Master Wallet</div>
                <div className="text-xs text-muted-foreground">{masterBalance.toFixed(4)} BNB</div>
              </div>
            </div>
            
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">{otherWallets.length} Wallets</div>
                <div className="text-xs text-muted-foreground">Ready to receive</div>
              </div>
            </div>
          </div>
        </div>

        {/* Amount Configuration */}
        <div>
          <Label htmlFor="amount-per-wallet">Amount per Wallet</Label>
          <div className="relative mt-2">
            <Input
              id="amount-per-wallet"
              type="number"
              step="0.001"
              min="0.001"
              value={amountPerWallet}
              onChange={(e) => setAmountPerWallet(e.target.value)}
              className="pr-12"
              data-testid="input-amount-per-wallet"
            />
            <span className="absolute right-3 top-3 text-muted-foreground text-sm">BNB</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Each wallet will receive this amount from the master wallet
          </p>
        </div>

        {/* Funding Summary */}
        <div className="space-y-2 p-3 bg-muted rounded-lg text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total wallets to fund:</span>
            <span className="font-mono">{otherWallets.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Amount per wallet:</span>
            <span className="font-mono">{parseFloat(amountPerWallet).toFixed(4)} BNB</span>
          </div>
          <div className="border-t pt-2 flex items-center justify-between font-medium">
            <span>Total needed:</span>
            <span className={cn(
              "font-mono",
              hasSufficientBalance ? "text-success" : "text-destructive"
            )}>
              {totalFundingNeeded.toFixed(4)} BNB
            </span>
          </div>
        </div>

        {/* Balance Check Alert */}
        {!hasSufficientBalance && otherWallets.length > 0 && (
          <Alert className="bg-warning/10 border-warning">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Insufficient balance in master wallet. Need {(totalFundingNeeded - masterBalance).toFixed(4)} more BNB.
              Please fund the master wallet first.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Button */}
        <Button 
          className="w-full"
          onClick={() => fundAllWalletsMutation.mutate()}
          disabled={
            fundAllWalletsMutation.isPending || 
            !hasSufficientBalance || 
            otherWallets.length === 0 ||
            parseFloat(amountPerWallet) <= 0
          }
          data-testid="button-fund-all"
        >
          <DollarSign className="w-4 h-4 mr-2" />
          {fundAllWalletsMutation.isPending 
            ? 'Distributing Funds...' 
            : `Fund ${otherWallets.length} Wallets from Master`
          }
        </Button>

        {otherWallets.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">
            No wallets to fund. Create wallets first.
          </p>
        )}
      </CardContent>
    </Card>
  );
}