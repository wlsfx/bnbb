import { Link, useLocation } from 'wouter';
import { Gem, Wallet, Rocket, Layers, TrendingUp, EyeOff, Globe, Settings } from 'lucide-react';
import { useSystemStore } from '../../stores/system-store';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

const navigationItems = [
  { path: '/dashboard', icon: Wallet, label: 'Wallet Manager' },
  { path: '/token-launch', icon: Rocket, label: 'Token Launch' },
  { path: '/bundle-execution', icon: Layers, label: 'Bundle Execution' },
  { path: '/analytics', icon: TrendingUp, label: 'Analytics' },
  { path: '/stealth-funding', icon: EyeOff, label: 'Stealth Funding' },
];

export function Sidebar() {
  const [location] = useLocation();
  const { status } = useSystemStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  
  // Define network status type
  interface NetworkStatusResponse {
    environment: 'testnet' | 'mainnet';
    chainId: number;
    network: string;
    blockchain?: {
      healthy: boolean;
      latency: number;
      gasPrice: string;
      blockHeight: number;
      congestionLevel: string;
      chainId: number;
      network: string;
    };
    connected?: boolean;
  }

  // Fetch network status
  const { data: networkStatus, isLoading } = useQuery<NetworkStatusResponse>({
    queryKey: ['/api/network/status'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });
  
  // Switch network mutation
  const switchNetworkMutation = useMutation({
    mutationFn: async (environment: 'testnet' | 'mainnet') => {
      const response = await apiRequest('POST', '/api/network/switch', { environment });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Network Switched',
        description: `Switched to ${data.environment}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/network/status'] });
      // Store preference
      localStorage.setItem('preferred-network', data.environment);
    },
    onError: () => {
      toast({
        title: 'Network Switch Failed',
        description: 'Failed to switch network',
        variant: 'destructive',
      });
    },
  });
  
  // Check connection status - consider connected if we have valid network data
  useEffect(() => {
    if (networkStatus) {
      // Network is connected if we successfully got the status AND blockchain is healthy
      const hasValidData = Boolean(networkStatus.chainId && networkStatus.environment);
      const blockchainHealthy = networkStatus.blockchain?.healthy === true;
      setIsConnected(hasValidData && (blockchainHealthy || networkStatus.connected === true));
    } else {
      setIsConnected(false);
    }
  }, [networkStatus]);

  return (
    <div className="w-64 bg-card border-r border-border flex-shrink-0 flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Gem className="text-primary-foreground text-xl" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Stealth Bundler</h1>
            <p className="text-muted-foreground text-sm">Bundle Execution Platform</p>
          </div>
        </div>
      </div>

      <nav className="p-4 space-y-2 flex-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          return (
            <Link key={item.path} href={item.path}>
              <div 
                className={cn(
                  "flex items-center space-x-3 p-3 rounded-lg transition-colors cursor-pointer",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-between"
              disabled={isLoading}
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-muted-foreground">Network:</span>
                  <div className="flex items-center space-x-1">
                    <div 
                      className={cn(
                        "w-2 h-2 rounded-full",
                        isConnected ? "bg-success animate-pulse" : "bg-destructive"
                      )}
                    />
                    <span className={cn(
                      "text-sm",
                      isConnected ? "text-success" : "text-destructive"
                    )}>
                      {isConnected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-medium">BNB Smart Chain</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {networkStatus?.environment === 'mainnet' ? 'Mainnet' : 'BSC Testnet'}
                  {networkStatus?.chainId && ` (Chain: ${networkStatus.chainId})`}
                </p>
              </div>
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Select Network</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => switchNetworkMutation.mutate('testnet')}
              className={cn(
                networkStatus?.environment === 'testnet' && "bg-accent"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div>
                  <Globe className="h-4 w-4 mr-2 inline" />
                  BSC Testnet
                </div>
                {networkStatus?.environment === 'testnet' && (
                  <span className="text-xs text-muted-foreground">Active</span>
                )}
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => switchNetworkMutation.mutate('mainnet')}
              className={cn(
                networkStatus?.environment === 'mainnet' && "bg-accent"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div>
                  <Globe className="h-4 w-4 mr-2 inline" />
                  BSC Mainnet
                </div>
                {networkStatus?.environment === 'mainnet' && (
                  <span className="text-xs text-muted-foreground">Active</span>
                )}
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
