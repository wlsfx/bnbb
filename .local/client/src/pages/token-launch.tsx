import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../hooks/useWebSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  Rocket, 
  Settings, 
  History, 
  CheckCircle2,
  Clock,
  PlayCircle,
  StopCircle,
  AlertTriangle,
  Users,
  Coins,
  TrendingUp,
  Eye,
  RefreshCw,
  Plus,
  Edit3,
  Trash2,
  Wifi,
  WifiOff,
  AlertCircle
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { LaunchPlan, BundleExecution, Wallet } from '@shared/schema';

// Form schemas
const launchPlanSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  tokenSymbol: z.string().min(1, "Token symbol is required").max(10, "Symbol too long"),
  tokenName: z.string().min(1, "Token name is required"),
  totalSupply: z.string().min(1, "Total supply is required"),
  initialLiquidity: z.string().min(1, "Initial liquidity is required"),
  walletCount: z.number().min(1, "At least 1 wallet required").max(1000, "Too many wallets"),
});

const bundleExecutionSchema = z.object({
  launchPlanId: z.string().min(1, "Launch plan is required"),
  totalWallets: z.number().min(1, "At least 1 wallet required"),
});

const advancedStealthSchema = z.object({
  humanLikeTiming: z.object({
    enabled: z.boolean(),
    hesitationSpikes: z.object({
      probability: z.number().min(0).max(1),
      durationRange: z.object({
        min: z.number().min(1000),
        max: z.number().min(5000),
      }),
    }),
    clusteringBehavior: z.object({
      enabled: z.boolean(),
      clusterProbability: z.number().min(0).max(1),
      clusterSize: z.object({
        min: z.number().min(2),
        max: z.number().min(2),
      }),
    }),
    timeZoneDistribution: z.object({
      enabled: z.boolean(),
      preferredHours: z.array(z.number()),
    }),
  }),
  marketAwareGas: z.object({
    enabled: z.boolean(),
    congestionThresholds: z.object({
      low: z.number().min(1),
      medium: z.number().min(3),
      high: z.number().min(8),
    }),
    mevProtection: z.object({
      enabled: z.boolean(),
      minPriorityFee: z.string(),
      maxSlippage: z.number().min(0).max(1),
      antiSandwichStrategy: z.enum(['timing', 'gas-competition', 'private-mempool']),
    }),
    userBehaviorMimicking: z.object({
      enabled: z.boolean(),
      gasPricePatterns: z.enum(['conservative', 'moderate', 'aggressive']),
      tipBehavior: z.enum(['minimal', 'standard', 'generous']),
    }),
  }),
  walletBehavior: z.object({
    preWarmWallets: z.object({
      enabled: z.boolean(),
      transactionsPerWallet: z.object({
        min: z.number().min(1),
        max: z.number().min(1),
      }),
      warmingPeriodHours: z.object({
        min: z.number().min(1),
        max: z.number().min(2),
      }),
    }),
    balanceDistribution: z.object({
      strategy: z.enum(['uniform', 'weighted', 'realistic', 'pareto']),
      variancePercentage: z.number().min(0).max(1),
    }),
    behaviorDecorelation: z.object({
      enabled: z.boolean(),
      timingVariance: z.number().min(0).max(1),
      gasPriceDecorelation: z.boolean(),
      transactionOrderRandomization: z.boolean(),
    }),
  }),
  patternAvoidance: z.object({
    enabled: z.boolean(),
    sequenceBreaking: z.object({
      enabled: z.boolean(),
      breakProbability: z.number().min(0).max(1),
      randomInsertions: z.boolean(),
    }),
    adaptiveVariance: z.object({
      enabled: z.boolean(),
      baseVariance: z.number().min(0).max(1),
      networkAnalysisDetection: z.boolean(),
      varianceAmplification: z.number().min(1),
    }),
  }),
});

type LaunchPlanForm = z.infer<typeof launchPlanSchema>;
type BundleExecutionForm = z.infer<typeof bundleExecutionSchema>;
type AdvancedStealthForm = z.infer<typeof advancedStealthSchema>;

export default function TokenLaunch() {
  const [activeExecutions, setActiveExecutions] = useState<string[]>([]);
  const [showAdvancedStealth, setShowAdvancedStealth] = useState(false);
  const [stealthPreset, setStealthPreset] = useState<'basic' | 'advanced' | 'military'>('basic');
  
  // WebSocket connection
  const websocket = useWebSocket({
    enabled: true,
    fallbackToPolling: true,
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Subscribe to WebSocket updates
  useEffect(() => {
    if (websocket.isConnected) {
      websocket.subscribe('launch_plans');
      websocket.subscribe('bundle_executions');
    }
  }, [websocket.isConnected, websocket]);

  // Fetch launch plans (now without polling)
  const { data: launchPlans = [], isLoading: plansLoading, error: plansError } = useQuery<LaunchPlan[]>({
    queryKey: ['/api/launch-plans'],
    // No refetchInterval - data comes from WebSocket
  });

  // Fetch bundle executions
  const { data: executions = [], isLoading: executionsLoading, error: executionsError } = useQuery<BundleExecution[]>({
    queryKey: ['/api/bundle-executions'],
    refetchInterval: 10000, // Reduced from 3s to 10s
  });

  // Fetch available wallets
  const { data: wallets = [], isLoading: walletsLoading, error: walletsError } = useQuery<Wallet[]>({
    queryKey: ['/api/wallets'],
    refetchInterval: 30000, // Reduced from 10s to 30s
  });

  // Form for creating launch plans
  const planForm = useForm<LaunchPlanForm>({
    resolver: zodResolver(launchPlanSchema),
    defaultValues: {
      name: '',
      tokenSymbol: '',
      tokenName: '',
      totalSupply: '1000000',
      initialLiquidity: '10.0',
      walletCount: 50,
    },
  });

  // Advanced stealth configuration form
  const stealthForm = useForm<AdvancedStealthForm>({
    resolver: zodResolver(advancedStealthSchema),
    defaultValues: {
      humanLikeTiming: {
        enabled: true,
        hesitationSpikes: {
          probability: 0.1,
          durationRange: { min: 5000, max: 15000 },
        },
        clusteringBehavior: {
          enabled: true,
          clusterProbability: 0.3,
          clusterSize: { min: 2, max: 4 },
        },
        timeZoneDistribution: {
          enabled: true,
          preferredHours: [9, 10, 11, 14, 15, 16, 19, 20],
        },
      },
      marketAwareGas: {
        enabled: true,
        congestionThresholds: {
          low: 3,
          medium: 8,
          high: 15,
        },
        mevProtection: {
          enabled: true,
          minPriorityFee: '1000000000',
          maxSlippage: 0.05,
          antiSandwichStrategy: 'timing',
        },
        userBehaviorMimicking: {
          enabled: true,
          gasPricePatterns: 'moderate',
          tipBehavior: 'standard',
        },
      },
      walletBehavior: {
        preWarmWallets: {
          enabled: true,
          transactionsPerWallet: { min: 1, max: 3 },
          warmingPeriodHours: { min: 2, max: 24 },
        },
        balanceDistribution: {
          strategy: 'realistic',
          variancePercentage: 0.25,
        },
        behaviorDecorelation: {
          enabled: true,
          timingVariance: 0.3,
          gasPriceDecorelation: true,
          transactionOrderRandomization: true,
        },
      },
      patternAvoidance: {
        enabled: true,
        sequenceBreaking: {
          enabled: true,
          breakProbability: 0.15,
          randomInsertions: true,
        },
        adaptiveVariance: {
          enabled: true,
          baseVariance: 0.1,
          networkAnalysisDetection: true,
          varianceAmplification: 2.0,
        },
      },
    },
  });

  // Create launch plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: LaunchPlanForm) => {
      const response = await apiRequest('POST', '/api/launch-plans', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Launch Plan Created",
        description: `Successfully created launch plan "${data.name}"`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/launch-plans'] });
      planForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Creation Failed", 
        description: "Failed to create launch plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Execute bundle mutation
  const executeBundleMutation = useMutation({
    mutationFn: async (data: BundleExecutionForm) => {
      const response = await apiRequest('POST', '/api/bundle-executions', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bundle Execution Started",
        description: `Started execution for ${data.totalWallets} wallets`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bundle-executions'] });
      setActiveExecutions(prev => [...prev, data.id]);
    },
    onError: (error) => {
      toast({
        title: "Execution Failed", 
        description: "Failed to start bundle execution. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreatePlan = (data: LaunchPlanForm) => {
    createPlanMutation.mutate(data);
  };

  const handleExecutePlan = (planId: string, walletCount: number, advancedStealth?: AdvancedStealthForm) => {
    executeBundleMutation.mutate({
      launchPlanId: planId,
      totalWallets: walletCount,
      stealthConfig: advancedStealth,
    });
  };

  const applyStealthPreset = (preset: 'basic' | 'advanced' | 'military') => {
    setStealthPreset(preset);
    
    switch (preset) {
      case 'basic':
        stealthForm.reset({
          humanLikeTiming: { enabled: false, hesitationSpikes: { probability: 0, durationRange: { min: 1000, max: 2000 } }, clusteringBehavior: { enabled: false, clusterProbability: 0, clusterSize: { min: 2, max: 2 } }, timeZoneDistribution: { enabled: false, preferredHours: [] } },
          marketAwareGas: { enabled: false, congestionThresholds: { low: 3, medium: 8, high: 15 }, mevProtection: { enabled: false, minPriorityFee: '1000000000', maxSlippage: 0.1, antiSandwichStrategy: 'timing' }, userBehaviorMimicking: { enabled: false, gasPricePatterns: 'conservative', tipBehavior: 'minimal' } },
          walletBehavior: { preWarmWallets: { enabled: false, transactionsPerWallet: { min: 1, max: 1 }, warmingPeriodHours: { min: 1, max: 2 } }, balanceDistribution: { strategy: 'uniform', variancePercentage: 0.1 }, behaviorDecorelation: { enabled: false, timingVariance: 0.1, gasPriceDecorelation: false, transactionOrderRandomization: false } },
          patternAvoidance: { enabled: false, sequenceBreaking: { enabled: false, breakProbability: 0, randomInsertions: false }, adaptiveVariance: { enabled: false, baseVariance: 0.05, networkAnalysisDetection: false, varianceAmplification: 1.0 } },
        });
        break;
      
      case 'advanced':
        stealthForm.reset({
          humanLikeTiming: { enabled: true, hesitationSpikes: { probability: 0.1, durationRange: { min: 5000, max: 15000 } }, clusteringBehavior: { enabled: true, clusterProbability: 0.3, clusterSize: { min: 2, max: 4 } }, timeZoneDistribution: { enabled: true, preferredHours: [9, 10, 11, 14, 15, 16] } },
          marketAwareGas: { enabled: true, congestionThresholds: { low: 3, medium: 8, high: 15 }, mevProtection: { enabled: true, minPriorityFee: '1000000000', maxSlippage: 0.05, antiSandwichStrategy: 'timing' }, userBehaviorMimicking: { enabled: true, gasPricePatterns: 'moderate', tipBehavior: 'standard' } },
          walletBehavior: { preWarmWallets: { enabled: true, transactionsPerWallet: { min: 1, max: 3 }, warmingPeriodHours: { min: 2, max: 24 } }, balanceDistribution: { strategy: 'realistic', variancePercentage: 0.25 }, behaviorDecorelation: { enabled: true, timingVariance: 0.3, gasPriceDecorelation: true, transactionOrderRandomization: true } },
          patternAvoidance: { enabled: true, sequenceBreaking: { enabled: true, breakProbability: 0.15, randomInsertions: true }, adaptiveVariance: { enabled: true, baseVariance: 0.1, networkAnalysisDetection: true, varianceAmplification: 2.0 } },
        });
        break;
      
      case 'military':
        stealthForm.reset({
          humanLikeTiming: { enabled: true, hesitationSpikes: { probability: 0.15, durationRange: { min: 3000, max: 20000 } }, clusteringBehavior: { enabled: true, clusterProbability: 0.4, clusterSize: { min: 2, max: 6 } }, timeZoneDistribution: { enabled: true, preferredHours: [8, 9, 10, 11, 13, 14, 15, 16, 18, 19, 20, 21] } },
          marketAwareGas: { enabled: true, congestionThresholds: { low: 2, medium: 6, high: 12 }, mevProtection: { enabled: true, minPriorityFee: '2000000000', maxSlippage: 0.03, antiSandwichStrategy: 'gas-competition' }, userBehaviorMimicking: { enabled: true, gasPricePatterns: 'aggressive', tipBehavior: 'generous' } },
          walletBehavior: { preWarmWallets: { enabled: true, transactionsPerWallet: { min: 2, max: 5 }, warmingPeriodHours: { min: 6, max: 72 } }, balanceDistribution: { strategy: 'pareto', variancePercentage: 0.4 }, behaviorDecorelation: { enabled: true, timingVariance: 0.5, gasPriceDecorelation: true, transactionOrderRandomization: true } },
          patternAvoidance: { enabled: true, sequenceBreaking: { enabled: true, breakProbability: 0.25, randomInsertions: true }, adaptiveVariance: { enabled: true, baseVariance: 0.2, networkAnalysisDetection: true, varianceAmplification: 3.0 } },
        });
        break;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { variant: 'secondary' as const, icon: Edit3, className: 'text-gray-600' },
      ready: { variant: 'default' as const, icon: CheckCircle2, className: 'text-blue-600' },
      executing: { variant: 'default' as const, icon: PlayCircle, className: 'text-orange-600' },
      completed: { variant: 'default' as const, icon: CheckCircle2, className: 'text-green-600' },
      failed: { variant: 'destructive' as const, icon: AlertTriangle, className: 'text-red-600' },
      pending: { variant: 'secondary' as const, icon: Clock, className: 'text-yellow-600' },
      broadcasting: { variant: 'default' as const, icon: RefreshCw, className: 'text-blue-600' },
      confirmed: { variant: 'default' as const, icon: CheckCircle2, className: 'text-green-600' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={cn("text-xs", config.className)}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getExecutionProgress = (execution: BundleExecution) => {
    const progress = parseFloat(execution.progressPercentage);
    return isNaN(progress) ? 0 : progress;
  };

  const availableWallets = wallets.filter(w => w.status === 'idle').length;
  const recentExecutions = executions
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Token Launch</h1>
            <p className="text-muted-foreground">
              Configure, execute, and monitor multi-wallet token launch operations
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-sm text-blue-600">Launch System Ready</span>
          </div>
        </div>

        {/* Error Alerts */}
        {(plansError || executionsError || walletsError) && (
          <Alert variant="destructive" data-testid="token-launch-error">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load token launch data. {plansError?.message || executionsError?.message || walletsError?.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="stats-launch-plans">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Launch Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Rocket className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{launchPlans.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {launchPlans.filter(p => p.status === 'ready').length} ready to launch
              </p>
            </CardContent>
          </Card>

          <Card data-testid="stats-active-executions">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Executions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <PlayCircle className="h-5 w-5 text-orange-500" />
                <span className="text-2xl font-bold">
                  {executions.filter(e => e.status === 'executing' || e.status === 'broadcasting').length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Currently running</p>
            </CardContent>
          </Card>

          <Card data-testid="stats-available-wallets">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Available Wallets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{availableWallets}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Ready for launch</p>
            </CardContent>
          </Card>

          <Card data-testid="stats-success-rate">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">
                  {executions.length > 0 
                    ? ((executions.filter(e => e.status === 'completed').length / executions.length) * 100).toFixed(1)
                    : '0'
                  }%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Launch completion rate</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="create" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="create" data-testid="tab-create-plan">
              <Plus className="w-4 h-4 mr-2" />
              Create Plan
            </TabsTrigger>
            <TabsTrigger value="stealth" data-testid="tab-stealth-config">
              <Eye className="w-4 h-4 mr-2" />
              🕵️ Stealth Config
            </TabsTrigger>
            <TabsTrigger value="plans" data-testid="tab-launch-plans">
              <Settings className="w-4 h-4 mr-2" />
              Launch Plans
            </TabsTrigger>
            <TabsTrigger value="monitor" data-testid="tab-execution-monitor">
              <RefreshCw className="w-4 h-4 mr-2" />
              Monitor Executions
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-launch-history">
              <History className="w-4 h-4 mr-2" />
              Launch History
            </TabsTrigger>
          </TabsList>

          {/* Advanced Stealth Configuration Tab */}
          <TabsContent value="stealth" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  🕵️ Military-Grade Stealth Configuration
                  <Badge variant="secondary" className="ml-2">Advanced</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure sophisticated stealth patterns to make token launches completely undetectable by on-chain analysis tools and MEV bots.
                </p>
              </CardHeader>
              <CardContent>
                {/* Stealth Preset Selection */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold">Stealth Preset</Label>
                    <p className="text-sm text-muted-foreground mb-3">Choose a pre-configured stealth level or customize manually</p>
                    <div className="grid grid-cols-3 gap-3">
                      <Button
                        variant={stealthPreset === 'basic' ? 'default' : 'outline'}
                        onClick={() => applyStealthPreset('basic')}
                        className="h-auto p-4 flex flex-col items-center space-y-2"
                        data-testid="preset-basic"
                      >
                        <div className="text-2xl">🔰</div>
                        <div className="text-center">
                          <div className="font-semibold">Basic</div>
                          <div className="text-xs text-muted-foreground">Simple variance</div>
                        </div>
                      </Button>
                      <Button
                        variant={stealthPreset === 'advanced' ? 'default' : 'outline'}
                        onClick={() => applyStealthPreset('advanced')}
                        className="h-auto p-4 flex flex-col items-center space-y-2"
                        data-testid="preset-advanced"
                      >
                        <div className="text-2xl">🎯</div>
                        <div className="text-center">
                          <div className="font-semibold">Advanced</div>
                          <div className="text-xs text-muted-foreground">Human-like patterns</div>
                        </div>
                      </Button>
                      <Button
                        variant={stealthPreset === 'military' ? 'default' : 'outline'}
                        onClick={() => applyStealthPreset('military')}
                        className="h-auto p-4 flex flex-col items-center space-y-2"
                        data-testid="preset-military"
                      >
                        <div className="text-2xl">🛡️</div>
                        <div className="text-center">
                          <div className="font-semibold">Military</div>
                          <div className="text-xs text-muted-foreground">Maximum stealth</div>
                        </div>
                      </Button>
                    </div>
                  </div>

                  <Form {...stealthForm}>
                    <form className="space-y-6">
                      {/* Human-Like Timing Section */}
                      <div className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold">🧠 Human-Like Timing</h3>
                          <FormField
                            control={stealthForm.control}
                            name="humanLikeTiming.enabled"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={(e) => field.onChange(e.target.checked)}
                                    className="rounded"
                                    data-testid="human-timing-enabled"
                                  />
                                </FormControl>
                                <FormLabel className="text-sm">Enable</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">Simulate realistic human behavior with hesitation spikes, clustering, and timezone awareness</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={stealthForm.control}
                            name="humanLikeTiming.hesitationSpikes.probability"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Hesitation Probability</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    min="0" 
                                    max="1" 
                                    {...field} 
                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                    data-testid="hesitation-probability"
                                  />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">0.1 = 10% chance of hesitation spikes</p>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={stealthForm.control}
                            name="humanLikeTiming.clusteringBehavior.clusterProbability"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Clustering Probability</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    min="0" 
                                    max="1" 
                                    {...field} 
                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                    data-testid="clustering-probability"
                                  />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">0.3 = 30% chance to group transactions</p>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Market-Aware Gas Section */}
                      <div className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold">📊 Market-Aware Gas</h3>
                          <FormField
                            control={stealthForm.control}
                            name="marketAwareGas.enabled"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={(e) => field.onChange(e.target.checked)}
                                    className="rounded"
                                    data-testid="market-gas-enabled"
                                  />
                                </FormControl>
                                <FormLabel className="text-sm">Enable</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">Dynamic gas pricing based on network conditions and user behavior patterns</p>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={stealthForm.control}
                            name="marketAwareGas.congestionThresholds.low"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Low Congestion (gwei)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="1" 
                                    {...field} 
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    data-testid="congestion-low"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={stealthForm.control}
                            name="marketAwareGas.congestionThresholds.medium"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Medium Congestion (gwei)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="3" 
                                    {...field} 
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    data-testid="congestion-medium"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={stealthForm.control}
                            name="marketAwareGas.congestionThresholds.high"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>High Congestion (gwei)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="8" 
                                    {...field} 
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    data-testid="congestion-high"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={stealthForm.control}
                            name="marketAwareGas.mevProtection.antiSandwichStrategy"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>MEV Protection Strategy</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="mev-strategy">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="timing">Timing-based</SelectItem>
                                    <SelectItem value="gas-competition">Gas Competition</SelectItem>
                                    <SelectItem value="private-mempool">Private Mempool</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={stealthForm.control}
                            name="marketAwareGas.userBehaviorMimicking.gasPricePatterns"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Gas Price Pattern</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="gas-pattern">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="conservative">Conservative</SelectItem>
                                    <SelectItem value="moderate">Moderate</SelectItem>
                                    <SelectItem value="aggressive">Aggressive</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Wallet Behavior Section */}
                      <div className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold">👥 Wallet Behavior</h3>
                          <FormField
                            control={stealthForm.control}
                            name="walletBehavior.preWarmWallets.enabled"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={(e) => field.onChange(e.target.checked)}
                                    className="rounded"
                                    data-testid="wallet-warming-enabled"
                                  />
                                </FormControl>
                                <FormLabel className="text-sm">Enable Pre-warming</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">Pre-launch wallet preparation and realistic behavior patterns</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={stealthForm.control}
                            name="walletBehavior.balanceDistribution.strategy"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Balance Distribution</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="balance-strategy">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="uniform">Uniform</SelectItem>
                                    <SelectItem value="weighted">Weighted</SelectItem>
                                    <SelectItem value="realistic">Realistic</SelectItem>
                                    <SelectItem value="pareto">Pareto</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={stealthForm.control}
                            name="walletBehavior.balanceDistribution.variancePercentage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Balance Variance</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    min="0" 
                                    max="1" 
                                    {...field} 
                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                    data-testid="balance-variance"
                                  />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">0.25 = ±25% variance</p>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Pattern Avoidance Section */}
                      <div className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold">🛡️ Pattern Avoidance</h3>
                          <FormField
                            control={stealthForm.control}
                            name="patternAvoidance.enabled"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={(e) => field.onChange(e.target.checked)}
                                    className="rounded"
                                    data-testid="pattern-avoidance-enabled"
                                  />
                                </FormControl>
                                <FormLabel className="text-sm">Enable</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">Advanced algorithms to break detectable patterns and adapt to network analysis</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={stealthForm.control}
                            name="patternAvoidance.sequenceBreaking.breakProbability"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Sequence Break Probability</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    min="0" 
                                    max="1" 
                                    {...field} 
                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                    data-testid="break-probability"
                                  />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">0.15 = 15% chance to break sequences</p>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={stealthForm.control}
                            name="patternAvoidance.adaptiveVariance.varianceAmplification"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Variance Amplification</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.1" 
                                    min="1" 
                                    {...field} 
                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                    data-testid="variance-amplification"
                                  />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">2.0 = 2x variance when analysis detected</p>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Stealth Preview */}
                      <div className="bg-muted/50 rounded-lg p-4">
                        <h4 className="font-semibold mb-2">🎯 Stealth Preview</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Human-likeness:</span>
                            <div className="font-semibold text-blue-600">85%</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">MEV Protection:</span>
                            <div className="font-semibold text-green-600">92%</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pattern Avoidance:</span>
                            <div className="font-semibold text-purple-600">88%</div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <span className="text-muted-foreground text-sm">Overall Military-Grade Score:</span>
                          <div className="font-bold text-lg text-orange-600">90/100</div>
                        </div>
                      </div>
                    </form>
                  </Form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Create Plan Tab */}
          <TabsContent value="create" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Create New Launch Plan</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure token parameters and launch strategy
                </p>
              </CardHeader>
              <CardContent>
                <Form {...planForm}>
                  <form onSubmit={planForm.handleSubmit(handleCreatePlan)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={planForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plan Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. SuperToken Launch" {...field} data-testid="input-plan-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={planForm.control}
                        name="tokenSymbol"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Token Symbol</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. STK" {...field} data-testid="input-token-symbol" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={planForm.control}
                        name="tokenName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Token Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Super Token" {...field} data-testid="input-token-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={planForm.control}
                        name="totalSupply"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total Supply</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="1000000" {...field} data-testid="input-total-supply" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={planForm.control}
                        name="initialLiquidity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Initial Liquidity (BNB)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" placeholder="10.0" {...field} data-testid="input-initial-liquidity" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={planForm.control}
                        name="walletCount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Wallet Count</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="50" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                data-testid="input-wallet-count"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {availableWallets < planForm.watch('walletCount') && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Not enough available wallets. You have {availableWallets} available but need {planForm.watch('walletCount')}.
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={createPlanMutation.isPending || availableWallets < planForm.watch('walletCount')}
                      data-testid="button-create-plan"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {createPlanMutation.isPending ? 'Creating...' : 'Create Launch Plan'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Launch Plans Tab */}
          <TabsContent value="plans" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Launch Plans</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage and execute your token launch plans
                </p>
              </CardHeader>
              <CardContent>
                {plansLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : launchPlans.length === 0 ? (
                  <div className="text-center py-8">
                    <Rocket className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">No launch plans yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Create your first plan to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {launchPlans.map((plan) => (
                      <div 
                        key={plan.id} 
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        data-testid={`plan-card-${plan.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <h3 className="font-semibold">{plan.name}</h3>
                              {getStatusBadge(plan.status)}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Token:</span>
                                <p className="font-medium">{plan.tokenSymbol} - {plan.tokenName}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Supply:</span>
                                <p className="font-medium">{parseInt(plan.totalSupply).toLocaleString()}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Liquidity:</span>
                                <p className="font-medium">{plan.initialLiquidity} BNB</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Wallets:</span>
                                <p className="font-medium">{plan.walletCount}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (showAdvancedStealth) {
                                  handleExecutePlan(plan.id, plan.walletCount, stealthForm.getValues());
                                } else {
                                  handleExecutePlan(plan.id, plan.walletCount);
                                }
                              }}
                              disabled={
                                executeBundleMutation.isPending || 
                                plan.status !== 'ready' && plan.status !== 'draft' ||
                                availableWallets < plan.walletCount
                              }
                              data-testid={`button-execute-${plan.id}`}
                            >
                              <PlayCircle className="w-4 h-4 mr-1" />
                              Execute
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monitor Executions Tab */}
          <TabsContent value="monitor" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Active Executions</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Monitor real-time progress of bundle executions
                </p>
              </CardHeader>
              <CardContent>
                {executionsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : executions.filter(e => e.status === 'executing' || e.status === 'broadcasting').length === 0 ? (
                  <div className="text-center py-8">
                    <Eye className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">No active executions</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {executions
                      .filter(e => e.status === 'executing' || e.status === 'broadcasting')
                      .map((execution) => {
                        const plan = launchPlans.find(p => p.id === execution.launchPlanId);
                        const progress = getExecutionProgress(execution);
                        
                        return (
                          <div 
                            key={execution.id} 
                            className="border rounded-lg p-4"
                            data-testid={`execution-monitor-${execution.id}`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">{plan?.name || 'Unknown Plan'}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {plan?.tokenSymbol} • {execution.totalWallets} wallets
                                </p>
                              </div>
                              {getStatusBadge(execution.status)}
                            </div>
                            
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-sm">
                                <span>Progress</span>
                                <span>{progress.toFixed(1)}%</span>
                              </div>
                              <Progress value={progress} className="h-2" />
                              
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Completed:</span>
                                  <p className="font-medium text-green-600">{execution.completedWallets}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Failed:</span>
                                  <p className="font-medium text-red-600">{execution.failedWallets}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Remaining:</span>
                                  <p className="font-medium">
                                    {execution.totalWallets - execution.completedWallets - execution.failedWallets}
                                  </p>
                                </div>
                              </div>
                              
                              <p className="text-xs text-muted-foreground">
                                Started: {execution.startedAt 
                                  ? formatDistanceToNow(new Date(execution.startedAt), { addSuffix: true })
                                  : 'Recently'
                                }
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Launch History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Launch History</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Previous launch executions and their results
                </p>
              </CardHeader>
              <CardContent>
                {executionsLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : recentExecutions.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">No launch history yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plan</TableHead>
                        <TableHead>Wallets</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentExecutions.map((execution) => {
                        const plan = launchPlans.find(p => p.id === execution.launchPlanId);
                        const progress = getExecutionProgress(execution);
                        
                        return (
                          <TableRow key={execution.id} data-testid={`history-row-${execution.id}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{plan?.name || 'Unknown Plan'}</p>
                                <p className="text-xs text-muted-foreground">{plan?.tokenSymbol}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p>{execution.totalWallets} total</p>
                                <p className="text-xs text-muted-foreground">
                                  {execution.completedWallets} done • {execution.failedWallets} failed
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="w-20">
                                <Progress value={progress} className="h-1" />
                                <p className="text-xs text-center mt-1">{progress.toFixed(0)}%</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(execution.status)}
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">
                                {execution.completedAt && execution.startedAt
                                  ? `${Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)}s`
                                  : execution.startedAt
                                    ? 'Running...'
                                    : 'Not started'
                                }
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(execution.createdAt), { addSuffix: true })}
                              </p>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}