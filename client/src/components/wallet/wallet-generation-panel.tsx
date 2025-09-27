import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, Upload, Shield, Settings, ChevronDown, Zap, Users, Target } from 'lucide-react';
import { useWalletStore } from '../../stores/wallet-store';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { WalletGenerationConfig } from '../../types/wallet';

export function WalletGenerationPanel() {
  const [config, setConfig] = useState<WalletGenerationConfig>({
    count: 50,
    initialBalance: '0.1',
    labelPrefix: 'Wallet',
    quantityPreset: 'custom',
    nameTemplate: 'Wallet_{index}',
    groupTag: 'default',
    batchSize: 25,
    priority: 'normal',
    stealthConfig: {
      enabled: false,
      delayMin: 100,
      delayMax: 500,
      randomizeOrder: false
    }
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const quantityPresets = {
    custom: { value: config.count, label: 'Custom' },
    small: { value: 50, label: 'Small (50)' },
    medium: { value: 200, label: 'Medium (200)' },
    large: { value: 1000, label: 'Large (1000)' },
    enterprise: { value: 5000, label: 'Enterprise (5000)' }
  };

  const nameTemplates = [
    'Wallet_{index}',
    'Bundle_{index}',
    '{groupTag}_{index}',
    'Stealth_{batch}_{index}',
    'Pool_{groupTag}_{index}'
  ];

  const { isGenerating, generationProgress, setGenerating, setGenerationProgress } = useWalletStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateWalletsMutation = useMutation({
    mutationFn: async (config: WalletGenerationConfig) => {
      const response = await apiRequest('POST', '/api/wallets/bulk', {
        count: config.count,
        initialBalance: config.initialBalance,
        labelPrefix: config.labelPrefix,
        nameTemplate: config.nameTemplate,
        groupTag: config.groupTag,
        batchSize: config.batchSize,
        priority: config.priority,
        stealthConfig: config.stealthConfig
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

  const handlePresetChange = (preset: string) => {
    const presetData = quantityPresets[preset as keyof typeof quantityPresets];
    setConfig(prev => ({
      ...prev,
      quantityPreset: preset as any,
      count: presetData.value
    }));
  };

  const handleTemplateChange = (template: string) => {
    setConfig(prev => ({ ...prev, nameTemplate: template }));
  };

  const getEstimatedTime = (count: number, batchSize: number) => {
    const batches = Math.ceil(count / batchSize);
    const avgDelayPerBatch = config.stealthConfig?.enabled 
      ? (config.stealthConfig.delayMin + config.stealthConfig.delayMax) / 2 
      : 200;
    const totalTime = (batches * avgDelayPerBatch) / 1000;
    return totalTime < 60 ? `~${Math.ceil(totalTime)}s` : `~${Math.ceil(totalTime / 60)}m`;
  };

  // Simulate progress updates
  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setGenerationProgress(Math.min(generationProgress + Math.random() * 10, 90));
      }, 500);

      return () => clearInterval(interval);
    }
  }, [isGenerating, setGenerationProgress, generationProgress]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-xl">Advanced Wallet Generation</CardTitle>
            {config.count >= 1000 && (
              <Badge variant="secondary" className="text-xs">
                Bulk Mode
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Secure Generation Active</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Quantity Presets */}
        <div className="space-y-4">
          <div>
            <Label>Wallet Quantity</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(quantityPresets).map(([key, preset]) => (
                <Button
                  key={key}
                  variant={config.quantityPreset === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetChange(key)}
                  className="text-xs"
                  data-testid={`button-preset-${key}`}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="wallet-count">Custom Count</Label>
              <Input
                id="wallet-count"
                type="number"
                min="1"
                max="10000"
                value={config.count}
                onChange={(e) => {
                  const count = parseInt(e.target.value) || 1;
                  setConfig(prev => ({ ...prev, count, quantityPreset: 'custom' }));
                }}
                className="mt-2"
                data-testid="input-wallet-count"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Est. time: {getEstimatedTime(config.count, config.batchSize)}
              </div>
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
        </div>

        {/* Basic Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="label-prefix">Label Prefix</Label>
            <Input
              id="label-prefix"
              value={config.labelPrefix}
              onChange={(e) => setConfig(prev => ({ ...prev, labelPrefix: e.target.value }))}
              className="mt-2"
              data-testid="input-label-prefix"
            />
          </div>
          
          <div>
            <Label htmlFor="group-tag">Group Tag</Label>
            <Input
              id="group-tag"
              value={config.groupTag}
              onChange={(e) => setConfig(prev => ({ ...prev, groupTag: e.target.value }))}
              className="mt-2"
              placeholder="e.g., stealth, bundle, pool"
              data-testid="input-group-tag"
            />
          </div>
        </div>

        {/* Advanced Configuration */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-between p-0" data-testid="button-toggle-advanced">
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Advanced Configuration</span>
                {config.stealthConfig?.enabled && <Badge variant="secondary" className="text-xs">Stealth</Badge>}
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 mt-4 p-4 border rounded-lg bg-muted/20">
            {/* Naming Template */}
            <div>
              <Label htmlFor="name-template">Naming Template</Label>
              <Select value={config.nameTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger className="mt-2" data-testid="select-name-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {nameTemplates.map((template) => (
                    <SelectItem key={template} value={template}>
                      {template}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground mt-1">
                Preview: {config.nameTemplate.replace('{index}', '001').replace('{groupTag}', config.groupTag).replace('{batch}', '01')}
              </div>
            </div>

            {/* Batch Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="batch-size">Batch Size</Label>
                <Input
                  id="batch-size"
                  type="number"
                  min="5"
                  max="100"
                  value={config.batchSize}
                  onChange={(e) => setConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 25 }))}
                  className="mt-2"
                  data-testid="input-batch-size"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  {Math.ceil(config.count / config.batchSize)} batches
                </div>
              </div>
              
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={config.priority} onValueChange={(value: any) => setConfig(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger className="mt-2" data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stealth Configuration */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="stealth-enabled"
                  checked={config.stealthConfig?.enabled || false}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({
                      ...prev,
                      stealthConfig: { ...prev.stealthConfig!, enabled: checked as boolean }
                    }))
                  }
                  data-testid="checkbox-stealth-enabled"
                />
                <Label htmlFor="stealth-enabled" className="flex items-center space-x-2">
                  <Shield className="w-4 h-4" />
                  <span>Enable Stealth Mode</span>
                </Label>
              </div>
              
              {config.stealthConfig?.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                  <div>
                    <Label htmlFor="delay-min">Min Delay (ms)</Label>
                    <Input
                      id="delay-min"
                      type="number"
                      min="50"
                      max="5000"
                      value={config.stealthConfig.delayMin}
                      onChange={(e) => 
                        setConfig(prev => ({
                          ...prev,
                          stealthConfig: { ...prev.stealthConfig!, delayMin: parseInt(e.target.value) || 100 }
                        }))
                      }
                      className="mt-2"
                      data-testid="input-delay-min"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="delay-max">Max Delay (ms)</Label>
                    <Input
                      id="delay-max"
                      type="number"
                      min="50"
                      max="5000"
                      value={config.stealthConfig.delayMax}
                      onChange={(e) => 
                        setConfig(prev => ({
                          ...prev,
                          stealthConfig: { ...prev.stealthConfig!, delayMax: parseInt(e.target.value) || 500 }
                        }))
                      }
                      className="mt-2"
                      data-testid="input-delay-max"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="randomize-order"
                        checked={config.stealthConfig.randomizeOrder}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({
                            ...prev,
                            stealthConfig: { ...prev.stealthConfig!, randomizeOrder: checked as boolean }
                          }))
                        }
                        data-testid="checkbox-randomize-order"
                      />
                      <Label htmlFor="randomize-order">Randomize Generation Order</Label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Action Buttons */}
        <div className="flex items-center space-x-4">
          <Button 
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleGenerate}
            disabled={isGenerating}
            data-testid="button-generate"
          >
            {config.stealthConfig?.enabled ? <Shield className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {isGenerating ? 'Generating...' : `Generate ${config.count} Wallets`}
          </Button>
          
          <Button variant="secondary" size="icon" data-testid="button-export">
            <Download className="w-4 h-4" />
          </Button>
          
          <Button variant="secondary" size="icon" data-testid="button-import">
            <Upload className="w-4 h-4" />
          </Button>
        </div>

        {/* Enhanced Progress Tracking */}
        {(isGenerating || generationProgress > 0) && (
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  {config.stealthConfig?.enabled && <Shield className="w-4 h-4 text-primary" />}
                  {config.priority === 'high' && <Zap className="w-4 h-4 text-orange-500" />}
                  <span className="text-sm font-medium">Generation Progress</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {config.priority} priority
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground">
                {Math.round((generationProgress / 100) * config.count)}/{config.count} wallets
              </span>
            </div>
            
            <Progress value={generationProgress} className="w-full" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Users className="w-3 h-3" />
                <span>Batch: {Math.ceil((generationProgress / 100) * Math.ceil(config.count / config.batchSize))}/{Math.ceil(config.count / config.batchSize)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Target className="w-3 h-3" />
                <span>Group: {config.groupTag}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Shield className="w-3 h-3" />
                <span>Stealth: {config.stealthConfig?.enabled ? 'On' : 'Off'}</span>
              </div>
              <div className="text-right">
                <span>ETA: {getEstimatedTime(config.count - Math.round((generationProgress / 100) * config.count), config.batchSize)}</span>
              </div>
            </div>
            
            {config.stealthConfig?.enabled && (
              <div className="text-xs text-muted-foreground italic">
                Using stealth delays ({config.stealthConfig.delayMin}-{config.stealthConfig.delayMax}ms) for enhanced privacy
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
