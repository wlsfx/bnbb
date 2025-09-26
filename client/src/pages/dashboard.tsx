import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WalletGenerationPanel } from '../components/wallet/wallet-generation-panel';
import { FundingPanel } from '../components/wallet/funding-panel';
import { WalletTable } from '../components/wallet/wallet-table';
import { RealTimeMonitor } from '../components/monitoring/real-time-monitor';
import { SystemStats } from '../components/monitoring/system-stats';
import { FundingMetricsMonitor } from '../components/monitoring/funding-metrics-monitor';
import { WalletStatusMonitor } from '../components/monitoring/wallet-status-monitor';
import { EnvironmentControlPanel } from '../components/monitoring/environment-control-panel';
import { useRealTimeUpdates } from '../hooks/use-real-time';

export default function Dashboard() {
  useRealTimeUpdates();

  return (
    <div className="flex-1 overflow-auto bg-background">
      <Tabs defaultValue="management" className="h-full flex flex-col">
        <div className="bg-card border-b border-border">
          <TabsList className="flex space-x-1 p-1">
            <TabsTrigger 
              value="management" 
              className="px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              data-testid="tab-wallet-management"
            >
              Wallet Management
            </TabsTrigger>
            <TabsTrigger 
              value="configuration" 
              className="px-4 py-2"
              data-testid="tab-launch-configuration"
            >
              Launch Configuration
            </TabsTrigger>
            <TabsTrigger 
              value="monitor" 
              className="px-4 py-2"
              data-testid="tab-bundle-monitor"
            >
              Bundle Monitor
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="px-4 py-2"
              data-testid="tab-analytics-dashboard"
            >
              Analytics Dashboard
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="management" className="p-6 space-y-6 m-0">
            {/* Environment Control */}
            <EnvironmentControlPanel />
            
            {/* Main Wallet Management */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <WalletGenerationPanel />
              <FundingPanel />
            </div>
            
            {/* Enhanced Monitoring */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RealTimeMonitor />
              <SystemStats />
            </div>
            
            {/* Wallet Status & Table */}
            <WalletStatusMonitor />
            <WalletTable />
          </TabsContent>

          <TabsContent value="configuration" className="p-6 space-y-6 m-0">
            {/* Environment Configuration */}
            <EnvironmentControlPanel />
            
            {/* Future: Launch Plan Configuration */}
            <div className="text-center py-12 border-2 border-dashed border-muted rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Token Launch Configuration</h3>
              <p className="text-muted-foreground">
                Configure token parameters, supply, liquidity settings, and launch timing.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Coming soon: Advanced launch configuration tools
              </p>
            </div>
          </TabsContent>

          <TabsContent value="monitor" className="p-6 space-y-6 m-0">
            {/* Real-time Funding Monitor */}
            <FundingMetricsMonitor />
            
            {/* Wallet Status Overview */}
            <WalletStatusMonitor />
            
            {/* System Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RealTimeMonitor />
              <SystemStats />
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="p-6 space-y-6 m-0">
            {/* Comprehensive Analytics */}
            <FundingMetricsMonitor />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Historical Performance */}
              <div className="text-center py-12 border-2 border-dashed border-muted rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Historical Analytics</h3>
                <p className="text-muted-foreground">
                  Detailed charts and trends for funding efficiency, wallet performance, and launch success rates.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Coming soon: Advanced analytics dashboard
                </p>
              </div>
              
              {/* Launch Performance Metrics */}
              <div className="text-center py-12 border-2 border-dashed border-muted rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Launch Metrics</h3>
                <p className="text-muted-foreground">
                  Track token launch performance, liquidity provision, and market impact analysis.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Coming soon: Launch performance tracking
                </p>
              </div>
            </div>
            
            {/* Current System Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RealTimeMonitor />
              <SystemStats />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
