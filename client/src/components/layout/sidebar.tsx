import { Link, useLocation } from 'wouter';
import { Gem, Wallet, Rocket, Layers, TrendingUp, EyeOff } from 'lucide-react';
import { useSystemStore } from '../../stores/system-store';
import { cn } from '@/lib/utils';

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
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Network</span>
            <div className="flex items-center space-x-1">
              <div 
                className={cn(
                  "w-2 h-2 rounded-full",
                  status.networkConnected ? "bg-success animate-pulse" : "bg-destructive"
                )}
              />
              <span className={cn(
                "text-sm",
                status.networkConnected ? "text-success" : "text-destructive"
              )}>
                {status.networkConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <p className="text-sm font-medium">BNB Smart Chain</p>
          <p className="text-xs text-muted-foreground font-mono">Mainnet</p>
        </div>
      </div>
    </div>
  );
}
