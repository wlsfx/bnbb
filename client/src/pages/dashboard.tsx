// Tab navigation removed - using sidebar navigation instead
import { MasterWalletStatus } from '../components/wallet/master-wallet-status';
import { WalletGenerationPanel } from '../components/wallet/wallet-generation-panel';
import { WalletTable } from '../components/wallet/wallet-table';
import { useRealTimeWebSocket } from '../hooks/useWebSocket';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const websocket = useRealTimeWebSocket();

  // Connection status indicator
  const ConnectionStatus = () => {
    if (websocket.isConnected) {
      return (
        <Badge variant="default" className="text-green-600 bg-green-100 dark:bg-green-900" data-testid="connection-status-connected">
          <Wifi className="w-3 h-3 mr-1" />
          Real-time Connected
        </Badge>
      );
    } else if (websocket.isConnecting) {
      return (
        <Badge variant="secondary" className="text-yellow-600 bg-yellow-100 dark:bg-yellow-900" data-testid="connection-status-connecting">
          <AlertCircle className="w-3 h-3 mr-1" />
          Connecting...
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" className="text-red-600 bg-red-100 dark:bg-red-900" data-testid="connection-status-disconnected">
          <WifiOff className="w-3 h-3 mr-1" />
          Disconnected
        </Badge>
      );
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="h-full flex flex-col">
        <div className="bg-card border-b border-border">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <ConnectionStatus />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6 m-0">
            {/* Master Wallet Status - Prominent at top */}
            <MasterWalletStatus />
            
            {/* Wallet Generation */}
            <WalletGenerationPanel />
            
            {/* Wallet Table - View and manage wallets only */}
            <WalletTable />
          </div>
        </div>
      </div>
    </div>
  );
}
