import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Edit, Trash2, RefreshCw, Copy, Check, DollarSign, Activity } from 'lucide-react';
import { useWalletStore } from '../../stores/wallet-store';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-success/20 text-success';
    case 'funding':
      return 'bg-warning/20 text-warning';
    case 'error':
      return 'bg-destructive/20 text-destructive';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getStatusIcon = (status: string) => {
  return <div className={cn("w-1.5 h-1.5 rounded-full mr-1", {
    'bg-success': status === 'active',
    'bg-warning': status === 'funding',
    'bg-destructive': status === 'error',
    'bg-muted-foreground': status === 'idle',
  })} />;
};

export function WalletTable() {
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const walletsPerPage = 10;

  // Fetch wallets data
  const { data: wallets = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['/api/wallets'],
  });

  // Sync balance mutation
  const syncBalancesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallets/sync-balances');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Balances Synced',
        description: `Updated ${data.updatedCount} wallet balances`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
    },
    onError: () => {
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync wallet balances',
        variant: 'destructive',
      });
    },
  });

  // Get balance mutation
  const getBalanceMutation = useMutation({
    mutationFn: async (walletId: string) => {
      const response = await apiRequest('GET', `/api/wallets/${walletId}/balance`);
      return response.json();
    },
    onSuccess: (data, walletId) => {
      toast({
        title: 'Balance Updated',
        description: `Balance: ${data.balance} BNB`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
    },
    onError: () => {
      toast({
        title: 'Failed to Get Balance',
        variant: 'destructive',
      });
    },
  });

  // Calculate total balance
  const totalBalance = wallets.reduce((sum, wallet) => {
    return sum + parseFloat(wallet.balance || '0');
  }, 0).toFixed(8);

  const startIndex = (currentPage - 1) * walletsPerPage;
  const endIndex = startIndex + walletsPerPage;
  const currentWallets = wallets.slice(startIndex, endIndex);
  const totalPages = Math.ceil(wallets.length / walletsPerPage);

  // Copy address to clipboard
  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    toast({
      title: 'Address Copied',
      description: 'Wallet address copied to clipboard',
    });
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Active Wallets</h2>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-sm">
              <span>Total Balance:</span>
              <span className="font-mono text-primary" data-testid="text-total-balance">
                {totalBalance} BNB
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => refetch()}
              disabled={isRefetching}
              data-testid="button-refresh"
            >
              <RefreshCw className={cn("w-4 h-4", isRefetching && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => syncBalancesMutation.mutate()}
              disabled={syncBalancesMutation.isPending}
              data-testid="button-sync-balances"
            >
              <Activity className="w-4 h-4 mr-2" />
              Sync All
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead>Wallet</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex items-center justify-center space-x-2">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Loading wallets...</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && wallets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No wallets found. Generate your first wallet to get started.
                  </TableCell>
                </TableRow>
              )}
              {currentWallets.map((wallet, index) => (
                <TableRow 
                  key={wallet.id} 
                  className="hover:bg-muted/50 transition-colors"
                  data-testid={`row-wallet-${wallet.id}`}
                >
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                        index % 3 === 0 ? "bg-primary text-primary-foreground" :
                        index % 3 === 1 ? "bg-accent text-accent-foreground" :
                        "bg-secondary text-secondary-foreground"
                      )}>
                        W{(startIndex + index + 1).toString().padStart(2, '0')}
                      </div>
                      <span className="font-medium">{wallet.label || `Wallet #${wallet.id.slice(0, 6)}`}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <code className="text-sm font-mono text-muted-foreground">
                        {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyAddress(wallet.address)}
                        data-testid={`button-copy-${wallet.id}`}
                      >
                        {copiedAddress === wallet.address ? (
                          <Check className="w-3 h-3 text-success" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <span className="font-mono">{parseFloat(wallet.balance).toFixed(3)} BNB</span>
                  </TableCell>
                  
                  <TableCell>
                    <Badge className={cn("inline-flex items-center", getStatusColor(wallet.status))}>
                      {getStatusIcon(wallet.status)}
                      {wallet.status.charAt(0).toUpperCase() + wallet.status.slice(1)}
                    </Badge>
                  </TableCell>
                  
                  <TableCell className="text-sm text-muted-foreground">
                    {wallet.lastActivity 
                      ? formatDistanceToNow(new Date(wallet.lastActivity), { addSuffix: true })
                      : 'Never'
                    }
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center justify-center space-x-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => getBalanceMutation.mutate(wallet.id)}
                        disabled={getBalanceMutation.isPending}
                        title="Update Balance"
                        data-testid={`button-balance-${wallet.id}`}
                      >
                        <Activity className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-success"
                        title="Fund Wallet"
                        data-testid={`button-fund-${wallet.id}`}
                      >
                        <DollarSign className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        title="View Details"
                        data-testid={`button-view-${wallet.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {wallets.length > walletsPerPage && (
          <div className="p-4 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, wallets.length)} of {wallets.length} wallets
            </span>
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                data-testid="button-previous"
              >
                Previous
              </Button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="w-8"
                  data-testid={`button-page-${page}`}
                >
                  {page}
                </Button>
              ))}
              
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                data-testid="button-next"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
