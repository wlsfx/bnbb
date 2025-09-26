import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, XCircle, Activity, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Wallet } from '@shared/schema';

interface WalletStatusMetrics {
  total: number;
  active: number;
  totalBalance: string;
  healthDistribution: Record<string, number>;
}

export function WalletStatusMonitor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: wallets, isLoading: walletsLoading } = useQuery<Wallet[]>({
    queryKey: ['/api/wallets'],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  const { data: dashboardSummary } = useQuery<{ walletSummary: WalletStatusMetrics }>({
    queryKey: ['/api/real-time/dashboard-summary'],
    refetchInterval: 5000,
  });

  const heartbeatMutation = useMutation({
    mutationFn: async (walletId: string) => {
      const response = await apiRequest('POST', `/api/wallets/${walletId}/heartbeat`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
      toast({
        title: "Heartbeat Updated",
        description: "Wallet heartbeat successfully updated",
      });
    },
    onError: () => {
      toast({
        title: "Heartbeat Failed",
        description: "Failed to update wallet heartbeat",
        variant: "destructive",
      });
    },
  });

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'good':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'offline':
        return <WifiOff className="w-4 h-4 text-gray-500" />;
      default:
        return <Activity className="w-4 h-4 text-blue-500" />;
    }
  };

  const getHealthBadge = (health: string) => {
    const config = {
      good: { variant: 'default' as const, className: 'bg-green-100 text-green-800' },
      warning: { variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800' },
      critical: { variant: 'destructive' as const, className: 'bg-red-100 text-red-800' },
      offline: { variant: 'outline' as const, className: 'bg-gray-100 text-gray-800' },
    };
    return config[health as keyof typeof config] || config.good;
  };

  const getConnectionIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatLastActivity = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const now = new Date();
    const last = new Date(timestamp);
    const diffMs = now.getTime() - last.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const healthDistribution = dashboardSummary?.walletSummary.healthDistribution || {};
  const totalWallets = dashboardSummary?.walletSummary.total || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          Wallet Status Monitor
        </h3>
        <Badge variant="outline" className="text-xs">
          Live • {wallets?.length || 0} wallets
        </Badge>
      </div>

      {/* Health Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(healthDistribution).map(([health, count]) => {
          const percentage = totalWallets > 0 ? (count / totalWallets) * 100 : 0;
          return (
            <Card key={health}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {getHealthIcon(health)}
                  {health.charAt(0).toUpperCase() + health.slice(1)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold" data-testid={`health-${health}-count`}>
                  {count}
                </div>
                <Progress value={percentage} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {percentage.toFixed(1)}% of total
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detailed Wallet Status Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Wallet Details</CardTitle>
        </CardHeader>
        <CardContent>
          {walletsLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              <div className="text-sm text-muted-foreground">Loading wallet status...</div>
            </div>
          ) : !wallets?.length ? (
            <div className="text-center py-8">
              <Activity className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">No wallets found</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Connection</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallets.slice(0, 10).map((wallet) => (
                    <TableRow key={wallet.id} data-testid={`wallet-row-${wallet.id}`}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-mono text-xs">
                            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {wallet.label || `Wallet ${wallet.id.slice(0, 8)}`}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getHealthBadge(wallet.health).variant}
                          className={`${getHealthBadge(wallet.health).className} flex items-center gap-1 w-fit`}
                        >
                          {getHealthIcon(wallet.health)}
                          {wallet.health}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getConnectionIcon(wallet.connectionStatus)}
                          <span className="text-xs capitalize">
                            {wallet.connectionStatus}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm">
                          {parseFloat(wallet.balance).toFixed(4)} BNB
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div>{formatLastActivity(wallet.lastActivity)}</div>
                          {wallet.lastHeartbeat && (
                            <div className="text-muted-foreground">
                              HB: {formatLastActivity(wallet.lastHeartbeat)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => heartbeatMutation.mutate(wallet.id)}
                          disabled={heartbeatMutation.isPending}
                          data-testid={`heartbeat-${wallet.id}`}
                        >
                          {heartbeatMutation.isPending ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Activity className="w-3 h-3" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {wallets.length > 10 && (
                <div className="text-center py-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing 10 of {wallets.length} wallets
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}