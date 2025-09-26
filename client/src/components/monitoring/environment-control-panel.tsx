import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Globe, Shield, AlertTriangle, CheckCircle, Settings, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { EnvironmentConfig } from '@shared/schema';

export function EnvironmentControlPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const { data: environments, isLoading } = useQuery<EnvironmentConfig[]>({
    queryKey: ['/api/environment-configs'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: activeEnvironment } = useQuery<EnvironmentConfig>({
    queryKey: ['/api/environment-configs/active'],
    refetchInterval: 5000,
  });

  const switchEnvironmentMutation = useMutation({
    mutationFn: async (environment: string) => {
      const response = await apiRequest('POST', `/api/environment-configs/${environment}/activate`, {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/environment-configs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/environment-configs/active'] });
      setSwitchingTo(null);
      toast({
        title: "Environment Switched",
        description: data.message,
      });
    },
    onError: (error) => {
      setSwitchingTo(null);
      toast({
        title: "Switch Failed",
        description: "Failed to switch environment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEnvironmentSwitch = (environment: string) => {
    setSwitchingTo(environment);
    switchEnvironmentMutation.mutate(environment);
  };

  const getEnvironmentIcon = (env: string) => {
    switch (env.toLowerCase()) {
      case 'mainnet':
        return <Globe className="w-4 h-4 text-green-500" />;
      case 'testnet':
        return <Settings className="w-4 h-4 text-blue-500" />;
      default:
        return <Shield className="w-4 h-4 text-purple-500" />;
    }
  };

  const getEnvironmentBadge = (env: string, isActive: boolean) => {
    if (isActive) {
      return env.toLowerCase() === 'mainnet' 
        ? { variant: 'default' as const, className: 'bg-green-100 text-green-800' }
        : { variant: 'secondary' as const, className: 'bg-blue-100 text-blue-800' };
    }
    return { variant: 'outline' as const, className: 'text-muted-foreground' };
  };

  const isMainnetActive = activeEnvironment?.environment.toLowerCase() === 'mainnet';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-500" />
          Environment Control
        </h3>
        <Badge 
          variant={isMainnetActive ? 'default' : 'secondary'}
          className={isMainnetActive ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}
        >
          {activeEnvironment?.environment || 'Unknown'}
        </Badge>
      </div>

      {/* Safety Warning for Mainnet */}
      {isMainnetActive && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Live Mainnet Mode:</strong> All transactions will use real funds. Exercise extreme caution.
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Quick Environment Switch
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Production Mode</Label>
              <div className="text-xs text-muted-foreground">
                Switch between testnet (safe) and mainnet (live funds)
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="mainnet-toggle" className="text-xs text-blue-600">
                Testnet
              </Label>
              <Switch
                id="mainnet-toggle"
                checked={isMainnetActive}
                disabled={switchEnvironmentMutation.isPending}
                onCheckedChange={(checked) => {
                  const targetEnv = checked ? 'mainnet' : 'testnet';
                  if (checked) {
                    // Require confirmation for mainnet switch
                    document.getElementById(`confirm-${targetEnv}`)?.click();
                  } else {
                    handleEnvironmentSwitch(targetEnv);
                  }
                }}
                data-testid="environment-toggle"
              />
              <Label htmlFor="mainnet-toggle" className="text-xs text-green-600">
                Mainnet
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Environment Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Environment Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">Loading environments...</div>
            </div>
          ) : !environments?.length ? (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">No environments configured</div>
            </div>
          ) : (
            <div className="space-y-3">
              {environments.map((env) => {
                const isActive = env.id === activeEnvironment?.id;
                const isSwitching = switchingTo === env.environment;
                
                return (
                  <div 
                    key={env.id}
                    className={`p-4 rounded-lg border ${isActive ? 'border-primary bg-primary/5' : 'border-border'}`}
                    data-testid={`environment-${env.environment}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getEnvironmentIcon(env.environment)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{env.environment}</span>
                            <Badge 
                              variant={getEnvironmentBadge(env.environment, isActive).variant}
                              className={getEnvironmentBadge(env.environment, isActive).className}
                            >
                              {isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            {isActive && <CheckCircle className="w-4 h-4 text-green-500" />}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Chain ID: {env.chainId} • Network ID: {env.networkId}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Currency: {env.nativeCurrency} • Gas Limit: {env.gasLimitMultiplier}x
                          </div>
                        </div>
                      </div>
                      
                      {!isActive && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              id={`confirm-${env.environment}`}
                              size="sm" 
                              variant={env.environment.toLowerCase() === 'mainnet' ? 'destructive' : 'outline'}
                              disabled={switchEnvironmentMutation.isPending}
                              data-testid={`switch-to-${env.environment}`}
                            >
                              {isSwitching ? 'Switching...' : `Switch to ${env.environment}`}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                {env.environment.toLowerCase() === 'mainnet' ? (
                                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                                ) : (
                                  <Settings className="w-5 h-5 text-blue-500" />
                                )}
                                Switch to {env.environment}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {env.environment.toLowerCase() === 'mainnet' ? (
                                  <>
                                    <strong className="text-orange-600">Warning:</strong> You are about to switch to mainnet where all transactions will use real funds. 
                                    This action will affect all wallet operations, token launches, and stealth funding activities.
                                    <br /><br />
                                    <strong>Are you absolutely sure you want to proceed?</strong>
                                  </>
                                ) : (
                                  <>
                                    You are about to switch to {env.environment}. This is a safe testing environment where no real funds are at risk.
                                    All operations will use test tokens and simulated transactions.
                                  </>
                                )}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleEnvironmentSwitch(env.environment)}
                                className={env.environment.toLowerCase() === 'mainnet' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                              >
                                {env.environment.toLowerCase() === 'mainnet' ? 'Switch to Mainnet' : `Switch to ${env.environment}`}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Environment Info */}
      {activeEnvironment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Environment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">RPC URL:</span>
                <div className="font-mono text-xs break-all">{activeEnvironment.rpcUrl}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Explorer:</span>
                <div className="font-mono text-xs break-all">{activeEnvironment.explorerUrl || 'Not set'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Max Gas Price:</span>
                <div className="font-mono text-xs">{activeEnvironment.maxGasPrice} Gwei</div>
              </div>
              <div>
                <span className="text-muted-foreground">Last Updated:</span>
                <div className="text-xs">{new Date(activeEnvironment.updatedAt).toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}