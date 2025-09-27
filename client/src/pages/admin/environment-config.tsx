import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Globe, Database, Shield, Cpu, Save, RefreshCw, AlertCircle } from 'lucide-react';

export default function EnvironmentConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  
  // Network Configuration
  const [networkConfig, setNetworkConfig] = useState({
    rpcUrl: 'https://bsc-dataseed1.binance.org',
    wsUrl: 'wss://bsc-ws-node.nariox.org',
    chainId: 56,
    gasMultiplier: 1.1,
    maxRetries: 3,
    requestTimeout: 30000,
  });

  // Proxy Configuration
  const [proxyConfig, setProxyConfig] = useState({
    enabled: true,
    rotationInterval: 300,
    maxFailures: 5,
    healthCheckInterval: 60,
    proxyList: [],
  });

  // Bundle Configuration
  const [bundleConfig, setBundleConfig] = useState({
    maxBundleSize: 100,
    parallelExecution: true,
    maxParallelBundles: 5,
    transactionTimeout: 120,
    retryOnFailure: true,
    stealthMode: true,
  });

  // Security Configuration
  const [securityConfig, setSecurityConfig] = useState({
    enableRateLimit: true,
    maxRequestsPerMinute: 60,
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 0.5,
    enableAuditLogging: true,
    encryptSensitiveData: true,
  });

  const handleSave = async (configType: string) => {
    setIsSaving(true);
    
    // Simulate save operation
    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: 'Configuration saved',
        description: `${configType} configuration has been updated successfully`,
      });
    }, 1000);
  };

  // Network switching mutation
  const switchNetworkMutation = useMutation({
    mutationFn: async (environment: 'testnet' | 'mainnet') => {
      const response = await apiRequest('POST', '/api/network/switch', { environment });
      if (!response.ok) {
        throw new Error(`Failed to switch network: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data, environment) => {
      // Update network config to reflect the switch
      const newConfig = {
        ...networkConfig,
        chainId: environment === 'testnet' ? 97 : 56,
        rpcUrl: environment === 'testnet' 
          ? 'https://data-seed-prebsc-1-s1.binance.org:8545'
          : 'https://bsc-dataseed1.binance.org',
        wsUrl: environment === 'testnet'
          ? 'wss://testnet-ws-node.binance.org'
          : 'wss://bsc-ws-node.nariox.org'
      };
      setNetworkConfig(newConfig);
      
      toast({
        title: 'Network Switched',
        description: `Successfully switched to ${environment === 'testnet' ? 'BSC Testnet' : 'BSC Mainnet'}`,
      });
      
      // Invalidate all network-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/network/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
      setSwitching(false);
    },
    onError: (error) => {
      console.error('Network switch error:', error);
      toast({
        title: 'Network Switch Failed',
        description: 'Failed to switch network. Please try again.',
        variant: 'destructive',
      });
      setSwitching(false);
    },
  });

  const switchEnvironment = (environment: 'testnet' | 'mainnet') => {
    setSwitching(true);
    switchNetworkMutation.mutate(environment);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Environment Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure network, proxy, bundle execution, and security settings
        </p>
      </div>

      <Tabs defaultValue="network" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="network">
            <Globe className="mr-2 h-4 w-4" />
            Network
          </TabsTrigger>
          <TabsTrigger value="proxy">
            <RefreshCw className="mr-2 h-4 w-4" />
            Proxy
          </TabsTrigger>
          <TabsTrigger value="bundle">
            <Cpu className="mr-2 h-4 w-4" />
            Bundle
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Network Configuration Tab */}
        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Settings</CardTitle>
              <CardDescription>
                Configure blockchain network connection parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rpc-url">RPC URL</Label>
                  <Input
                    id="rpc-url"
                    value={networkConfig.rpcUrl}
                    onChange={(e) => setNetworkConfig({ ...networkConfig, rpcUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-url">WebSocket URL</Label>
                  <Input
                    id="ws-url"
                    value={networkConfig.wsUrl}
                    onChange={(e) => setNetworkConfig({ ...networkConfig, wsUrl: e.target.value })}
                    placeholder="wss://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chain-id">Chain ID</Label>
                  <Input
                    id="chain-id"
                    type="number"
                    value={networkConfig.chainId}
                    onChange={(e) => setNetworkConfig({ ...networkConfig, chainId: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gas-multiplier">Gas Multiplier</Label>
                  <Input
                    id="gas-multiplier"
                    type="number"
                    step="0.1"
                    value={networkConfig.gasMultiplier}
                    onChange={(e) => setNetworkConfig({ ...networkConfig, gasMultiplier: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-retries">Max Retries</Label>
                  <Input
                    id="max-retries"
                    type="number"
                    value={networkConfig.maxRetries}
                    onChange={(e) => setNetworkConfig({ ...networkConfig, maxRetries: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="request-timeout">Request Timeout (ms)</Label>
                  <Input
                    id="request-timeout"
                    type="number"
                    value={networkConfig.requestTimeout}
                    onChange={(e) => setNetworkConfig({ ...networkConfig, requestTimeout: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave('Network')} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Network Configuration
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Environment Switch */}
          <Card>
            <CardHeader>
              <CardTitle>Network Environment</CardTitle>
              <CardDescription>
                Quickly switch between mainnet and testnet environments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  variant={networkConfig.chainId === 97 ? "default" : "outline"}
                  size="sm"
                  onClick={() => switchEnvironment('testnet')}
                  disabled={switching}
                  data-testid="button-switch-testnet"
                >
                  {switching && networkConfig.chainId === 97 ? "Switching..." : "BSC Testnet"}
                </Button>
                <Button 
                  variant={networkConfig.chainId === 56 ? "default" : "outline"}
                  size="sm"
                  onClick={() => switchEnvironment('mainnet')}
                  disabled={switching}
                  data-testid="button-switch-mainnet"
                >
                  {switching && networkConfig.chainId === 56 ? "Switching..." : "BSC Mainnet"}
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                <strong>Current Network:</strong> {networkConfig.chainId === 97 ? 'BSC Testnet (Chain ID: 97)' : networkConfig.chainId === 56 ? 'BSC Mainnet (Chain ID: 56)' : 'Unknown'}
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Switching networks will update all blockchain connections and reload wallet data.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proxy Configuration Tab */}
        <TabsContent value="proxy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Proxy Settings</CardTitle>
              <CardDescription>
                Configure proxy rotation and health monitoring
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="proxy-enabled"
                  checked={proxyConfig.enabled}
                  onCheckedChange={(checked) => setProxyConfig({ ...proxyConfig, enabled: checked })}
                />
                <Label htmlFor="proxy-enabled">Enable Proxy Rotation</Label>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rotation-interval">Rotation Interval (seconds)</Label>
                  <Input
                    id="rotation-interval"
                    type="number"
                    value={proxyConfig.rotationInterval}
                    onChange={(e) => setProxyConfig({ ...proxyConfig, rotationInterval: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-failures">Max Failures Before Rotation</Label>
                  <Input
                    id="max-failures"
                    type="number"
                    value={proxyConfig.maxFailures}
                    onChange={(e) => setProxyConfig({ ...proxyConfig, maxFailures: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="health-check">Health Check Interval (seconds)</Label>
                  <Input
                    id="health-check"
                    type="number"
                    value={proxyConfig.healthCheckInterval}
                    onChange={(e) => setProxyConfig({ ...proxyConfig, healthCheckInterval: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Proxy rotation helps maintain anonymity and avoid rate limiting
                </AlertDescription>
              </Alert>
              
              <div className="flex justify-end">
                <Button onClick={() => handleSave('Proxy')} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Proxy Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bundle Configuration Tab */}
        <TabsContent value="bundle" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bundle Execution Settings</CardTitle>
              <CardDescription>
                Configure bundle execution parameters and strategies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-bundle-size">Max Bundle Size</Label>
                  <Input
                    id="max-bundle-size"
                    type="number"
                    value={bundleConfig.maxBundleSize}
                    onChange={(e) => setBundleConfig({ ...bundleConfig, maxBundleSize: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-parallel">Max Parallel Bundles</Label>
                  <Input
                    id="max-parallel"
                    type="number"
                    value={bundleConfig.maxParallelBundles}
                    onChange={(e) => setBundleConfig({ ...bundleConfig, maxParallelBundles: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tx-timeout">Transaction Timeout (seconds)</Label>
                  <Input
                    id="tx-timeout"
                    type="number"
                    value={bundleConfig.transactionTimeout}
                    onChange={(e) => setBundleConfig({ ...bundleConfig, transactionTimeout: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="parallel-execution"
                    checked={bundleConfig.parallelExecution}
                    onCheckedChange={(checked) => setBundleConfig({ ...bundleConfig, parallelExecution: checked })}
                  />
                  <Label htmlFor="parallel-execution">Enable Parallel Execution</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="retry-failure"
                    checked={bundleConfig.retryOnFailure}
                    onCheckedChange={(checked) => setBundleConfig({ ...bundleConfig, retryOnFailure: checked })}
                  />
                  <Label htmlFor="retry-failure">Retry on Failure</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="stealth-mode"
                    checked={bundleConfig.stealthMode}
                    onCheckedChange={(checked) => setBundleConfig({ ...bundleConfig, stealthMode: checked })}
                  />
                  <Label htmlFor="stealth-mode">Stealth Mode</Label>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={() => handleSave('Bundle')} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Bundle Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Configuration Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Configure security features and protection mechanisms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="rate-limit">Rate Limiting</Label>
                    <p className="text-sm text-muted-foreground">
                      Limit API requests per minute
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="rate-limit"
                      checked={securityConfig.enableRateLimit}
                      onCheckedChange={(checked) => setSecurityConfig({ ...securityConfig, enableRateLimit: checked })}
                    />
                    {securityConfig.enableRateLimit && (
                      <Input
                        type="number"
                        value={securityConfig.maxRequestsPerMinute}
                        onChange={(e) => setSecurityConfig({ ...securityConfig, maxRequestsPerMinute: parseInt(e.target.value) })}
                        className="w-20"
                      />
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="circuit-breaker">Circuit Breaker</Label>
                    <p className="text-sm text-muted-foreground">
                      Prevent cascading failures
                    </p>
                  </div>
                  <Switch
                    id="circuit-breaker"
                    checked={securityConfig.enableCircuitBreaker}
                    onCheckedChange={(checked) => setSecurityConfig({ ...securityConfig, enableCircuitBreaker: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="audit-logging">Audit Logging</Label>
                    <p className="text-sm text-muted-foreground">
                      Track all system activities
                    </p>
                  </div>
                  <Switch
                    id="audit-logging"
                    checked={securityConfig.enableAuditLogging}
                    onCheckedChange={(checked) => setSecurityConfig({ ...securityConfig, enableAuditLogging: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="encrypt-data">Data Encryption</Label>
                    <p className="text-sm text-muted-foreground">
                      Encrypt sensitive data at rest
                    </p>
                  </div>
                  <Switch
                    id="encrypt-data"
                    checked={securityConfig.encryptSensitiveData}
                    onCheckedChange={(checked) => setSecurityConfig({ ...securityConfig, encryptSensitiveData: checked })}
                  />
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={() => handleSave('Security')} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Security Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}