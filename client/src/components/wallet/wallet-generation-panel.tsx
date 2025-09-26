import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Download, Upload, Shield } from 'lucide-react';
import { useWalletStore } from '../../stores/wallet-store';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { WalletGenerationConfig } from '../../types/wallet';

export function WalletGenerationPanel() {
  const [config, setConfig] = useState<WalletGenerationConfig>({
    count: 50,
    initialBalance: '0.1',
    labelPrefix: 'Wallet'
  });

  const { isGenerating, generationProgress, setGenerating, setGenerationProgress } = useWalletStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateWalletsMutation = useMutation({
    mutationFn: async (config: WalletGenerationConfig) => {
      const response = await apiRequest('POST', '/api/wallets/bulk', {
        count: config.count,
        initialBalance: config.initialBalance,
        labelPrefix: config.labelPrefix
      });
      return response.json();
    },
    onMutate: () => {
      setGenerating(true);
      setGenerationProgress(0);
    },
    onSuccess: (wallets) => {
      toast({
        title: "Wallets Generated",
        description: `Successfully generated ${wallets.length} wallets`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate wallets. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setGenerating(false);
      setGenerationProgress(100);
    }
  });

  const handleGenerate = () => {
    generateWalletsMutation.mutate(config);
  };

  // Simulate progress updates
  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setGenerationProgress((prev: number) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 500);

      return () => clearInterval(interval);
    }
  }, [isGenerating, setGenerationProgress]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Wallet Generation</CardTitle>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Secure Generation Active</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="wallet-count">Number of Wallets</Label>
            <Input
              id="wallet-count"
              type="number"
              min="1"
              max="1000"
              value={config.count}
              onChange={(e) => setConfig(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))}
              className="mt-2"
              data-testid="input-wallet-count"
            />
          </div>
          
          <div>
            <Label htmlFor="initial-balance">Initial BNB Amount</Label>
            <div className="relative mt-2">
              <Input
                id="initial-balance"
                type="number"
                step="0.01"
                value={config.initialBalance}
                onChange={(e) => setConfig(prev => ({ ...prev, initialBalance: e.target.value }))}
                className="pr-12"
                data-testid="input-initial-balance"
              />
              <span className="absolute right-3 top-3 text-muted-foreground text-sm">BNB</span>
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="label-prefix">Wallet Label Prefix</Label>
          <Input
            id="label-prefix"
            value={config.labelPrefix}
            onChange={(e) => setConfig(prev => ({ ...prev, labelPrefix: e.target.value }))}
            className="mt-2"
            data-testid="input-label-prefix"
          />
        </div>

        <div className="flex items-center space-x-4">
          <Button 
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleGenerate}
            disabled={isGenerating}
            data-testid="button-generate"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Generate Wallets'}
          </Button>
          
          <Button variant="secondary" size="icon" data-testid="button-export">
            <Download className="w-4 h-4" />
          </Button>
          
          <Button variant="secondary" size="icon" data-testid="button-import">
            <Upload className="w-4 h-4" />
          </Button>
        </div>

        {(isGenerating || generationProgress > 0) && (
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Generation Progress</span>
              <span className="text-sm text-muted-foreground">
                {Math.round((generationProgress / 100) * config.count)}/{config.count} wallets
              </span>
            </div>
            <Progress value={generationProgress} className="w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
