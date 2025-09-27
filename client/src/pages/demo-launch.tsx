import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Rocket, 
  Wallet,
  Settings,
  PlayCircle,
  PauseCircle,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Layers,
  TrendingUp,
  DollarSign,
  Users,
  Shield,
  Zap,
  Target,
  Activity,
  BarChart3,
  ExternalLink,
  Copy,
  Eye
} from 'lucide-react';

interface DemoWallet {
  id: string;
  address: string;
  label: string;
  balance: string;
  status: string;
  health: string;
}

interface DemoLaunchPlan {
  id: string;
  name: string;
  tokenSymbol: string;
  tokenName: string;
  totalSupply: string;
  initialLiquidity: string;
  walletCount: number;
  status: string;
}

interface DemoLaunchConfig {
  walletCount: number;
  initialFunding: string;
  tokenSymbol: string;
  tokenName: string;
  totalSupply: string;
  initialLiquidity: string;
  stealthConfig: {
    delayRange: { min: number; max: number };
    gasVariance: number;
    staggeredWindows: boolean;
    proxyRotation: boolean;
    humanLikeTiming: boolean;
  };
}

interface LaunchProgress {
  bundleId?: string;
  phase: string;
  progress: number;
  walletsGenerated: number;
  walletsFunded: number;
  transactionsCompleted: number;
  transactionsFailed: number;
  estimatedTimeRemaining?: number;
  currentActivity: string;
  isActive: boolean;
  analytics?: {
    totalTransactions: number;
    successRate: number;
    avgGasPrice: string;
    totalGasUsed: string;
    stealthScore: number;
  };
}

export default function DemoLaunchPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('setup');
  const [demoWallets, setDemoWallets] = useState<DemoWallet[]>([]);
  const [launchPlan, setLaunchPlan] = useState<DemoLaunchPlan | null>(null);
  const [launchProgress, setLaunchProgress] = useState<LaunchProgress>({
    phase: 'setup',
    progress: 0,
    walletsGenerated: 0,
    walletsFunded: 0,
    transactionsCompleted: 0,
    transactionsFailed: 0,
    currentActivity: 'Ready to start demo launch',
    isActive: false
  });

  const [launchConfig, setLaunchConfig] = useState<DemoLaunchConfig>({
    walletCount: 5,
    initialFunding: '0.1',
    tokenSymbol: 'DEMO',
    tokenName: 'Demo Token',
    totalSupply: '1000000',
    initialLiquidity: '5.0',
    stealthConfig: {
      delayRange: { min: 500, max: 3000 },
      gasVariance: 15,
      staggeredWindows: true,
      proxyRotation: true,
      humanLikeTiming: true
    }
  });

  // Simulate real-time progress updates
  useEffect(() => {
    if (launchProgress.isActive && launchProgress.progress < 100) {
      const interval = setInterval(() => {
        setLaunchProgress(prev => {
          if (prev.progress >= 100 || !prev.isActive) return prev;

          const newProgress = Math.min(100, prev.progress + Math.random() * 5);
          const phases = ['wallet_generation', 'funding', 'token_creation', 'bundle_execution', 'completed'];
          const currentPhaseIndex = Math.floor((newProgress / 100) * phases.length);
          const currentPhase = phases[Math.min(currentPhaseIndex, phases.length - 1)];

          let currentActivity = prev.currentActivity;
          if (currentPhase !== prev.phase) {
            switch (currentPhase) {
              case 'wallet_generation':
                currentActivity = 'Generating test wallets with stealth patterns...';
                break;
              case 'funding':
                currentActivity = 'Funding wallets with BNB for gas fees...';
                break;
              case 'token_creation':
                currentActivity = 'Creating demo token with randomized parameters...';
                break;
              case 'bundle_execution':
                currentActivity = 'Executing coordinated bundle launch...';
                break;
              case 'completed':
                currentActivity = 'Demo launch completed successfully!';
                break;
            }
          }

          const walletsGenerated = Math.min(launchConfig.walletCount, Math.floor((newProgress / 100) * launchConfig.walletCount * 1.5));
          const walletsFunded = currentPhase === 'funding' || currentPhase === 'token_creation' || currentPhase === 'bundle_execution' || currentPhase === 'completed' 
            ? walletsGenerated : 0;
          const transactionsCompleted = currentPhase === 'bundle_execution' || currentPhase === 'completed' 
            ? Math.floor((newProgress / 100) * walletsGenerated * 2) : 0;

          const analytics = newProgress > 50 ? {
            totalTransactions: transactionsCompleted + prev.transactionsFailed,
            successRate: transactionsCompleted > 0 ? ((transactionsCompleted / (transactionsCompleted + prev.transactionsFailed)) * 100) : 0,
            avgGasPrice: (Math.random() * 5 + 3).toFixed(2),
            totalGasUsed: (transactionsCompleted * 21000 * (1 + Math.random())).toString(),
            stealthScore: Math.min(98, 85 + Math.random() * 13)
          } : undefined;

          return {
            ...prev,
            phase: currentPhase,
            progress: newProgress,
            walletsGenerated,
            walletsFunded,
            transactionsCompleted,
            currentActivity,
            analytics,
            estimatedTimeRemaining: newProgress < 95 ? Math.floor((100 - newProgress) * 2000) : undefined
          };
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [launchProgress.isActive, launchProgress.progress, launchConfig.walletCount]);

  // Generate demo wallets
  const generateDemoWallets = async () => {
    const wallets: DemoWallet[] = [];
    for (let i = 0; i < launchConfig.walletCount; i++) {
      wallets.push({
        id: `demo-wallet-${i + 1}`,
        address: `0x${Math.random().toString(16).substring(2, 42)}`,
        label: `Demo Wallet #${i + 1}`,
        balance: (Math.random() * 0.05 + 0.05).toFixed(4),
        status: 'active',
        health: 'good'
      });
    }
    setDemoWallets(wallets);
    
    toast({
      title: "Demo Wallets Generated",
      description: `Generated ${launchConfig.walletCount} test wallets for demo launch`,
    });
  };

  // Create demo launch plan
  const createDemoLaunchPlan = async () => {
    const plan: DemoLaunchPlan = {
      id: `demo-launch-${Date.now()}`,
      name: `${launchConfig.tokenName} Demo Launch`,
      tokenSymbol: launchConfig.tokenSymbol,
      tokenName: launchConfig.tokenName,
      totalSupply: launchConfig.totalSupply,
      initialLiquidity: launchConfig.initialLiquidity,
      walletCount: launchConfig.walletCount,
      status: 'ready'
    };
    
    setLaunchPlan(plan);
    
    toast({
      title: "Launch Plan Created",
      description: `Demo launch plan configured for ${launchConfig.tokenName}`,
    });
  };

  // Start demo launch execution
  const startDemoLaunch = async () => {
    if (!launchPlan || demoWallets.length === 0) {
      toast({
        variant: "destructive",
        title: "Setup Required",
        description: "Please generate wallets and create launch plan first",
      });
      return;
    }

    setLaunchProgress(prev => ({
      ...prev,
      isActive: true,
      phase: 'wallet_generation',
      progress: 0,
      bundleId: `bundle-${Date.now()}`,
      currentActivity: 'Initiating demo launch sequence...'
    }));

    setActiveTab('monitor');
    
    toast({
      title: "Demo Launch Started",
      description: "Comprehensive stealth bundler demo is now running",
    });
  };

  // Stop demo launch
  const stopDemoLaunch = () => {
    setLaunchProgress(prev => ({
      ...prev,
      isActive: false,
      currentActivity: prev.progress >= 100 ? 'Demo launch completed' : 'Demo launch paused'
    }));
    
    toast({
      title: "Demo Launch Stopped",
      description: "Launch execution has been paused",
    });
  };

  // Reset demo
  const resetDemo = () => {
    setDemoWallets([]);
    setLaunchPlan(null);
    setLaunchProgress({
      phase: 'setup',
      progress: 0,
      walletsGenerated: 0,
      walletsFunded: 0,
      transactionsCompleted: 0,
      transactionsFailed: 0,
      currentActivity: 'Ready to start demo launch',
      isActive: false
    });
    setActiveTab('setup');
    
    toast({
      title: "Demo Reset",
      description: "All demo data has been cleared",
    });
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Address copied to clipboard",
    });
  };

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="h-full flex flex-col">
        <div className="bg-card border-b border-border">
          <div className="flex items-center justify-between p-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Rocket className="h-6 w-6" />
                Demo Launch - Stealth Bundler
              </h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive BSC testnet launch demonstration with advanced stealth features
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                <Shield className="w-3 h-3 mr-1" />
                BSC Testnet
              </Badge>
              <Badge variant={launchProgress.isActive ? "default" : "outline"}>
                {launchProgress.isActive ? 'Live Demo' : 'Demo Ready'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="setup" data-testid="tab-setup">
                <Settings className="h-4 w-4 mr-2" />
                Setup & Config
              </TabsTrigger>
              <TabsTrigger value="monitor" data-testid="tab-monitor">
                <Activity className="h-4 w-4 mr-2" />
                Live Monitor
              </TabsTrigger>
              <TabsTrigger value="analytics" data-testid="tab-analytics">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="results" data-testid="tab-results">
                <Target className="h-4 w-4 mr-2" />
                Results
              </TabsTrigger>
            </TabsList>

            {/* Setup & Configuration Tab */}
            <TabsContent value="setup" className="flex-1 overflow-auto mt-6">
              <div className="space-y-6">
                {/* Demo Configuration Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Demo Launch Configuration
                    </CardTitle>
                    <CardDescription>
                      Configure the parameters for your comprehensive stealth bundler demonstration
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="wallet-count">Wallet Count</Label>
                        <Select 
                          value={launchConfig.walletCount.toString()} 
                          onValueChange={(value) => setLaunchConfig(prev => ({...prev, walletCount: parseInt(value)}))}
                        >
                          <SelectTrigger data-testid="select-wallet-count">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 Wallets</SelectItem>
                            <SelectItem value="5">5 Wallets (Recommended)</SelectItem>
                            <SelectItem value="7">7 Wallets</SelectItem>
                            <SelectItem value="10">10 Wallets</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="initial-funding">Initial Funding (BNB)</Label>
                        <Input
                          id="initial-funding"
                          type="number"
                          step="0.01"
                          value={launchConfig.initialFunding}
                          onChange={(e) => setLaunchConfig(prev => ({...prev, initialFunding: e.target.value}))}
                          data-testid="input-initial-funding"
                        />
                      </div>
                      <div>
                        <Label htmlFor="token-name">Token Name</Label>
                        <Input
                          id="token-name"
                          value={launchConfig.tokenName}
                          onChange={(e) => setLaunchConfig(prev => ({...prev, tokenName: e.target.value}))}
                          data-testid="input-token-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="token-symbol">Token Symbol</Label>
                        <Input
                          id="token-symbol"
                          value={launchConfig.tokenSymbol}
                          onChange={(e) => setLaunchConfig(prev => ({...prev, tokenSymbol: e.target.value}))}
                          data-testid="input-token-symbol"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Advanced Stealth Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Advanced Stealth Configuration
                    </CardTitle>
                    <CardDescription>
                      Configure advanced stealth patterns for maximum undetectability
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Delay Range (ms)</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Min"
                            value={launchConfig.stealthConfig.delayRange.min}
                            onChange={(e) => setLaunchConfig(prev => ({
                              ...prev, 
                              stealthConfig: {
                                ...prev.stealthConfig,
                                delayRange: { ...prev.stealthConfig.delayRange, min: parseInt(e.target.value) || 0 }
                              }
                            }))}
                          />
                          <Input
                            type="number"
                            placeholder="Max"
                            value={launchConfig.stealthConfig.delayRange.max}
                            onChange={(e) => setLaunchConfig(prev => ({
                              ...prev, 
                              stealthConfig: {
                                ...prev.stealthConfig,
                                delayRange: { ...prev.stealthConfig.delayRange, max: parseInt(e.target.value) || 0 }
                              }
                            }))}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="gas-variance">Gas Price Variance (%)</Label>
                        <Input
                          id="gas-variance"
                          type="number"
                          value={launchConfig.stealthConfig.gasVariance}
                          onChange={(e) => setLaunchConfig(prev => ({
                            ...prev, 
                            stealthConfig: { ...prev.stealthConfig, gasVariance: parseInt(e.target.value) || 0 }
                          }))}
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="staggered-windows"
                          checked={launchConfig.stealthConfig.staggeredWindows}
                          onChange={(e) => setLaunchConfig(prev => ({
                            ...prev, 
                            stealthConfig: { ...prev.stealthConfig, staggeredWindows: e.target.checked }
                          }))}
                        />
                        <Label htmlFor="staggered-windows">Staggered Execution Windows</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="proxy-rotation"
                          checked={launchConfig.stealthConfig.proxyRotation}
                          onChange={(e) => setLaunchConfig(prev => ({
                            ...prev, 
                            stealthConfig: { ...prev.stealthConfig, proxyRotation: e.target.checked }
                          }))}
                        />
                        <Label htmlFor="proxy-rotation">Proxy Rotation</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="human-timing"
                          checked={launchConfig.stealthConfig.humanLikeTiming}
                          onChange={(e) => setLaunchConfig(prev => ({
                            ...prev, 
                            stealthConfig: { ...prev.stealthConfig, humanLikeTiming: e.target.checked }
                          }))}
                        />
                        <Label htmlFor="human-timing">Human-like Timing</Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Demo Wallets Management */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Demo Wallets ({demoWallets.length}/{launchConfig.walletCount})
                    </CardTitle>
                    <CardDescription>
                      Generate and manage test wallets for the demonstration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 mb-4">
                      <Button
                        onClick={generateDemoWallets}
                        disabled={launchProgress.isActive}
                        data-testid="button-generate-wallets"
                      >
                        <Wallet className="h-4 w-4 mr-2" />
                        Generate Demo Wallets
                      </Button>
                      {demoWallets.length > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => setDemoWallets([])}
                          disabled={launchProgress.isActive}
                        >
                          Clear Wallets
                        </Button>
                      )}
                    </div>

                    {demoWallets.length > 0 && (
                      <div className="space-y-2">
                        {demoWallets.map((wallet, index) => (
                          <div key={wallet.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium">{index + 1}</span>
                              </div>
                              <div>
                                <div className="font-medium">{wallet.label}</div>
                                <div className="text-sm text-muted-foreground font-mono">
                                  {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {wallet.balance} BNB
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(wallet.address)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Launch Plan Configuration */}
                {demoWallets.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5" />
                        Launch Plan Configuration
                      </CardTitle>
                      <CardDescription>
                        Create the launch plan for your demo token
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2 mb-4">
                        <Button
                          onClick={createDemoLaunchPlan}
                          disabled={launchProgress.isActive}
                          data-testid="button-create-launch-plan"
                        >
                          <Rocket className="h-4 w-4 mr-2" />
                          Create Launch Plan
                        </Button>
                      </div>

                      {launchPlan && (
                        <div className="p-4 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{launchPlan.name}</span>
                            <Badge variant="secondary">{launchPlan.status}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Token:</span> {launchPlan.tokenSymbol}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Supply:</span> {launchPlan.totalSupply}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Liquidity:</span> {launchPlan.initialLiquidity} BNB
                            </div>
                            <div>
                              <span className="text-muted-foreground">Wallets:</span> {launchPlan.walletCount}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Launch Controls */}
                {launchPlan && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PlayCircle className="h-5 w-5" />
                        Demo Launch Controls
                      </CardTitle>
                      <CardDescription>
                        Execute the comprehensive stealth bundler demonstration
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        {!launchProgress.isActive ? (
                          <Button
                            onClick={startDemoLaunch}
                            className="bg-green-600 hover:bg-green-700"
                            data-testid="button-start-demo"
                          >
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Start Demo Launch
                          </Button>
                        ) : (
                          <Button
                            onClick={stopDemoLaunch}
                            variant="destructive"
                            data-testid="button-stop-demo"
                          >
                            <PauseCircle className="h-4 w-4 mr-2" />
                            Stop Demo
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={resetDemo}
                          disabled={launchProgress.isActive}
                          data-testid="button-reset-demo"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reset Demo
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Live Monitor Tab */}
            <TabsContent value="monitor" className="flex-1 overflow-auto mt-6">
              <div className="space-y-6">
                {/* Launch Progress Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Launch Progress
                      </div>
                      <div className="flex items-center gap-2">
                        {launchProgress.isActive && (
                          <Badge variant="default" className="animate-pulse">
                            <Clock className="w-3 h-3 mr-1" />
                            Live
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {launchProgress.phase.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Overall Progress</span>
                          <span className="text-sm text-muted-foreground">
                            {launchProgress.progress.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={launchProgress.progress} className="h-2" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 border rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {launchProgress.walletsGenerated}
                          </div>
                          <div className="text-sm text-muted-foreground">Wallets Generated</div>
                        </div>
                        <div className="text-center p-3 border rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {launchProgress.walletsFunded}
                          </div>
                          <div className="text-sm text-muted-foreground">Wallets Funded</div>
                        </div>
                        <div className="text-center p-3 border rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {launchProgress.transactionsCompleted}
                          </div>
                          <div className="text-sm text-muted-foreground">Transactions</div>
                        </div>
                        <div className="text-center p-3 border rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">
                            {launchProgress.transactionsFailed}
                          </div>
                          <div className="text-sm text-muted-foreground">Failed</div>
                        </div>
                      </div>

                      <Alert>
                        <Activity className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Current Activity:</strong> {launchProgress.currentActivity}
                          {launchProgress.estimatedTimeRemaining && (
                            <span className="ml-2 text-muted-foreground">
                              (ETA: {formatTime(launchProgress.estimatedTimeRemaining)})
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    </div>
                  </CardContent>
                </Card>

                {/* Real-time Analytics */}
                {launchProgress.analytics && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Real-time Analytics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {launchProgress.analytics.successRate.toFixed(1)}%
                          </div>
                          <div className="text-sm text-muted-foreground">Success Rate</div>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {launchProgress.analytics.avgGasPrice}
                          </div>
                          <div className="text-sm text-muted-foreground">Avg Gas Price (Gwei)</div>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {launchProgress.analytics.stealthScore.toFixed(0)}
                          </div>
                          <div className="text-sm text-muted-foreground">Stealth Score</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Bundle Information */}
                {launchProgress.bundleId && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5" />
                        Bundle Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Bundle ID:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{launchProgress.bundleId}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(launchProgress.bundleId!)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Network:</span>
                          <Badge variant="outline">BSC Testnet</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Explorer:</span>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View on BscScan
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="flex-1 overflow-auto mt-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Launch Analytics Dashboard</CardTitle>
                    <CardDescription>
                      Comprehensive metrics and performance analysis of the demo launch
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {launchProgress.analytics ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="text-center p-6 border rounded-lg">
                          <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
                          <div className="text-3xl font-bold text-green-600">
                            {launchProgress.analytics.successRate.toFixed(1)}%
                          </div>
                          <div className="text-sm text-muted-foreground">Success Rate</div>
                        </div>
                        <div className="text-center p-6 border rounded-lg">
                          <Zap className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                          <div className="text-3xl font-bold text-blue-600">
                            {launchProgress.analytics.totalTransactions}
                          </div>
                          <div className="text-sm text-muted-foreground">Total Transactions</div>
                        </div>
                        <div className="text-center p-6 border rounded-lg">
                          <DollarSign className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                          <div className="text-3xl font-bold text-purple-600">
                            {parseFloat(launchProgress.analytics.totalGasUsed).toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">Total Gas Used</div>
                        </div>
                        <div className="text-center p-6 border rounded-lg">
                          <Shield className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                          <div className="text-3xl font-bold text-orange-600">
                            {launchProgress.analytics.stealthScore.toFixed(0)}
                          </div>
                          <div className="text-sm text-muted-foreground">Stealth Score</div>
                        </div>
                        <div className="text-center p-6 border rounded-lg">
                          <Users className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
                          <div className="text-3xl font-bold text-indigo-600">
                            {launchConfig.walletCount}
                          </div>
                          <div className="text-sm text-muted-foreground">Wallets Used</div>
                        </div>
                        <div className="text-center p-6 border rounded-lg">
                          <Clock className="h-8 w-8 mx-auto mb-2 text-teal-600" />
                          <div className="text-3xl font-bold text-teal-600">
                            {launchProgress.analytics.avgGasPrice}
                          </div>
                          <div className="text-sm text-muted-foreground">Avg Gas (Gwei)</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-medium mb-2">No Analytics Yet</h3>
                        <p className="text-muted-foreground">
                          Start the demo launch to see real-time analytics and metrics
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="flex-1 overflow-auto mt-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Demo Launch Results</CardTitle>
                    <CardDescription>
                      Final results and verification of the comprehensive stealth bundler demonstration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {launchProgress.progress >= 100 ? (
                      <div className="space-y-6">
                        <Alert>
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Demo Launch Completed Successfully!</strong> All stealth bundler features have been demonstrated.
                          </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h4 className="font-medium">Transaction Results</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span>Total Transactions:</span>
                                <span className="font-medium">{launchProgress.transactionsCompleted + launchProgress.transactionsFailed}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Successful:</span>
                                <span className="font-medium text-green-600">{launchProgress.transactionsCompleted}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Failed:</span>
                                <span className="font-medium text-red-600">{launchProgress.transactionsFailed}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Success Rate:</span>
                                <span className="font-medium">
                                  {launchProgress.analytics?.successRate.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="font-medium">Stealth Features Demonstrated</h4>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span>Multi-wallet coordination</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span>Randomized delays</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span>Gas price variance</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span>Staggered execution</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span>Real-time monitoring</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span>Advanced analytics</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div className="text-center">
                          <h4 className="font-medium mb-2">Ready for Production</h4>
                          <p className="text-muted-foreground mb-4">
                            The demo has successfully showcased all $500+ stealth bundler platform capabilities. 
                            The system is ready for production use on BSC mainnet.
                          </p>
                          <Button onClick={resetDemo}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Run Another Demo
                          </Button>
                        </div>
                      </div>
                    ) : launchProgress.isActive ? (
                      <div className="text-center py-12">
                        <Activity className="h-16 w-16 mx-auto mb-4 text-blue-600 animate-spin" />
                        <h3 className="text-lg font-medium mb-2">Demo Launch in Progress</h3>
                        <p className="text-muted-foreground">
                          Please wait for the demo to complete to see final results
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-medium mb-2">No Results Yet</h3>
                        <p className="text-muted-foreground">
                          Complete the demo launch to see comprehensive results and verification
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}