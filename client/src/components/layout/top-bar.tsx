import { Button } from '@/components/ui/button';
import { AlertTriangle, Plus, Server, Coins, Wallet } from 'lucide-react';
import { useSystemStore } from '../../stores/system-store';
import { useWalletStore } from '../../stores/wallet-store';
import { cn } from '@/lib/utils';

export function TopBar() {
  const { status, taxCollectionRate } = useSystemStore();
  const { wallets } = useWalletStore();

  const activeWalletCount = wallets.filter(w => w.status === 'active').length;

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
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30"
          size="sm"
          data-testid="button-generate-wallets"
        >
          <Plus className="w-4 h-4 mr-2" />
          Generate Wallets
        </Button>
      </div>
    </div>
  );
}
