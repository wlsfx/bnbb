import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Wallet } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function WalletGenerationPanel() {
  const [count, setCount] = useState(5);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateWalletsMutation = useMutation({
    mutationFn: async (walletCount: number) => {
      const response = await apiRequest('POST', '/api/wallets/generate', {
        count: walletCount,
        labelPrefix: 'Wallet'
      });
      if (!response.ok) {
        throw new Error(`Failed to create wallets: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (wallets) => {
      toast({
        title: "Wallets Created",
        description: `Successfully created ${Array.isArray(wallets) ? wallets.length : count} wallets`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      setCount(5); // Reset to default
    },
    onError: (error) => {
      console.error('Wallet generation error:', error);
      toast({
        title: "Creation Failed",
        description: "Failed to create wallets. Please check network connection and try again.",
        variant: "destructive",
      });
    }
  });

  const handleGenerate = () => {
    if (count > 0 && count <= 100) {
      generateWalletsMutation.mutate(count);
    } else {
      toast({
        title: "Invalid Count",
        description: "Please enter a number between 1 and 100",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Wallet className="w-5 h-5" />
          <span>Create New Wallets</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="wallet-count">Number of Wallets</Label>
          <Input
            id="wallet-count"
            type="number"
            min="1"
            max="100"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value) || 1)}
            className="mt-2"
            placeholder="Enter number of wallets (1-100)"
            data-testid="input-wallet-count"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Each wallet will be created with 0 balance
          </p>
        </div>

        <Button 
          className="w-full"
          onClick={handleGenerate}
          disabled={generateWalletsMutation.isPending}
          data-testid="button-generate"
        >
          <Plus className="w-4 h-4 mr-2" />
          {generateWalletsMutation.isPending 
            ? `Creating ${count} Wallets...` 
            : `Create ${count} Wallet${count !== 1 ? 's' : ''}`
          }
        </Button>
        
        <div className="text-xs text-muted-foreground text-center">
          Tip: Fund the master wallet first, then distribute to these wallets
        </div>
      </CardContent>
    </Card>
  );
}