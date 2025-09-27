import { Button } from '@/components/ui/button';
import { AlertTriangle, LogOut, Server, Coins, Wallet, Crown } from 'lucide-react';
import { useSystemStore } from '../../stores/system-store';
import { useWalletStore } from '../../stores/wallet-store';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

export function TopBar() {
  const { status, taxCollectionRate } = useSystemStore();
  const { wallets } = useWalletStore();

  const activeWalletCount = wallets.filter(w => w.status === 'active').length;
  const masterWallet = wallets.find(w => w.label?.includes('Master Wallet'));

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
      // Redirect to login page
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleCreateMasterWallet = async () => {
    try {
      console.log('Creating master wallet...');
      const response = await apiRequest('POST', '/api/wallets/generate', {
        count: 1,
        labelPrefix: "Master Wallet"
        // No initialBalance - wallet starts with real 0 BNB balance
      });
      console.log('Master wallet created successfully:', response);
      // Force a refresh of wallet data
      window.location.reload();
    } catch (error) {
      console.error('Failed to create master wallet:', error);
      alert('Failed to create master wallet. Please try again.');
    }
  };

  return (
    <div className="bg-card border-b border-border p-4 flex items-center justify-between">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <Server className={cn(
            "w-4 h-4",
            status.backendConnected ? "text-success" : "text-destructive"
          )} />
          <span className="text-sm">
            Backend: <span className={cn(
              status.backendConnected ? "text-success" : "text-destructive"
            )}>
              {status.backendConnected ? "Connected" : "Disconnected"}
            </span>
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Coins className="w-4 h-4 text-warning" />
          <span className="text-sm">
            Tax Collection: <span className="text-warning">{taxCollectionRate}%</span>
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Wallet className="w-4 h-4 text-primary" />
          <span className="text-sm">
            Active Wallets: <span className="text-primary font-mono" data-testid="active-wallet-count">
              {activeWalletCount}
            </span>
          </span>
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        <Button 
          variant="destructive" 
          size="sm"
          data-testid="button-emergency-stop"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Emergency Stop
        </Button>
        
        
        <Button 
          onClick={handleLogout}
          variant="outline"
          size="sm"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}
