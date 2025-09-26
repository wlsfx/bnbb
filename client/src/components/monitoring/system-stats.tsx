import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSystemStore } from '../../stores/system-store';
import { cn } from '@/lib/utils';

export function SystemStats() {
  const { status, metrics } = useSystemStore();

  const getLatencyColor = (latency: number) => {
    if (latency <= 50) return 'text-success';
    if (latency <= 100) return 'text-warning';
    return 'text-destructive';
  };

  const getUsageColor = (usage: number) => {
    if (usage <= 50) return 'bg-success';
    if (usage <= 80) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">System Metrics</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">Backend Latency</span>
          <div className="flex items-center space-x-2">
            <div className={cn("w-2 h-2 rounded-full", status.backendConnected ? "bg-success" : "bg-destructive")} />
            <span className={cn("text-sm font-mono", getLatencyColor(status.latency))}>
              {status.latency}ms
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">Gas Price</span>
          <span className="text-sm font-mono">{status.gasPrice} gwei</span>
        </div>

        {metrics && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm">Bundle Success Rate</span>
              <span className="text-sm font-mono text-success">{metrics.successRate}%</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Total Tax Collected</span>
              <span className="text-sm font-mono text-primary">{metrics.taxCollected} BNB</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">CPU Usage</span>
                <span className="text-sm font-mono">{metrics.cpuUsage}%</span>
              </div>
              <Progress 
                value={metrics.cpuUsage} 
                className={`w-full`}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Memory Usage</span>
                <span className="text-sm font-mono">{metrics.memoryUsage}%</span>
              </div>
              <Progress 
                value={metrics.memoryUsage} 
                className={`w-full`}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
