import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Crown, AlertTriangle, DollarSign, Copy, Check, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import type { Wallet } from '@shared/schema';

export function MasterWalletStatus() {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const { toast } = useToast();
  
  // Fetch wallets and find master wallet
  const { data: wallets = [] } = useQuery<Wallet[]>({
    queryKey: ['/api/wallets'],
    refetchInterval: 10000 // Refresh every 10 seconds
  });
  
  const masterWallet = wallets.find((w) => 
    w.label?.toLowerCase().includes('master') || 
    w.label?.toLowerCase().includes('main') ||
    w.id === wallets[0]?.id
  ) || wallets[0]; // Fallback to first wallet if none found
  
  const balance = parseFloat(masterWallet?.balance || '0');
  const needsFunding = balance < 0.1;
  
  // Create master wallet mutation
  const createMasterWalletMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallets/generate', {
        count: 1,
        labelPrefix: "Master Wallet"
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Master Wallet Created",
        description: "Your master wallet is ready. Fund it to get started!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
      // Force page refresh to ensure UI updates
      setTimeout(() => window.location.reload(), 1000);
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create master wallet. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Sync balance mutation
  const syncBalanceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', `/api/wallets/${masterWallet!.id}/balance`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Balance Updated",
        description: `Current balance: ${data.balance} BNB`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        variant: "destructive",
      });
    }
  });
  
  const copyAddress = () => {
    if (masterWallet?.address) {
      navigator.clipboard.writeText(masterWallet.address);
      setCopiedAddress(true);
      toast({
        title: "Address Copied",
        description: "Master wallet address copied to clipboard",
      });
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };
  
  // If no wallets exist at all
  if (wallets.length === 0) {
    return (
      <Card className="border-primary/50 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Crown className="w-5 h-5 text-primary" />
            <span>Setup Master Wallet</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-muted border-primary/50">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              No master wallet found. Create one to start managing your wallet network.
            </AlertDescription>
          </Alert>
          
          <Button 
            onClick={() => createMasterWalletMutation.mutate()}
            disabled={createMasterWalletMutation.isPending}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            data-testid="button-create-master"
          >
            <Crown className="w-4 h-4 mr-2" />
            {createMasterWalletMutation.isPending ? "Creating..." : "Create Master Wallet"}
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={cn(
      "relative overflow-hidden bg-card",
      needsFunding ? "border-warning/50" : "border-primary/50"
    )}>
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
        <Crown className={cn(
          "w-full h-full",
          needsFunding ? "text-warning" : "text-primary"
        )} />
      </div>
      
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Crown className={cn(
              "w-5 h-5",
              needsFunding ? "text-warning" : "text-primary"
            )} />
            <span>Master Wallet</span>
            <Badge variant={needsFunding ? "secondary" : "default"} className="ml-2">
              {needsFunding ? "Needs Funding" : "Ready"}
            </Badge>
          </CardTitle>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => syncBalanceMutation.mutate()}
            disabled={syncBalanceMutation.isPending}
            data-testid="button-sync-master"
          >
            <Activity className={cn(
              "w-4 h-4",
              syncBalanceMutation.isPending && "animate-spin"
            )} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Balance Display */}
        <div className="flex items-center justify-between p-4 bg-background rounded-lg border">
          <div>
            <div className="text-sm text-muted-foreground">Current Balance</div>
            <div className="flex items-center space-x-2 mt-1">
              <span className={cn(
                "text-2xl font-bold font-mono",
                needsFunding ? "text-warning" : "text-primary"
              )} data-testid="text-master-balance">
                {balance.toFixed(4)}
              </span>
              <span className="text-sm text-muted-foreground">testBNB</span>
            </div>
          </div>
          
          <div className={cn(
            "p-3 rounded-full",
            needsFunding ? "bg-warning/20" : "bg-primary/20"
          )}>
            <DollarSign className={cn(
              "w-6 h-6",
              needsFunding ? "text-warning" : "text-primary"
            )} />
          </div>
        </div>
        
        {/* Wallet Address */}
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Wallet Address</div>
          <div className="flex items-center space-x-2 p-2 bg-muted rounded">
            <code className="text-sm font-mono flex-1">
              {masterWallet!.address.slice(0, 6)}...{masterWallet!.address.slice(-6)}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyAddress}
              data-testid="button-copy-master-address"
            >
              {copiedAddress ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Funding Alert */}
        {needsFunding && (
          <Alert className="bg-warning/10 border-warning">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <strong>Action Required:</strong> Master wallet balance is below 0.1 testBNB. 
              Please fund this wallet to enable automatic distribution to other wallets.
              <div className="mt-2 text-xs">
                Send at least 0.1 testBNB to: <code className="font-mono">{masterWallet!.address}</code>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Status Summary */}
        {!needsFunding && (
          <div className="flex items-center space-x-2 text-sm text-primary">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span>Master wallet is funded and ready for distribution</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}