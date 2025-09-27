import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Clock, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Activity } from '@shared/schema';

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'transfer':
      return <ArrowRight className="w-4 h-4" />;
    case 'bundle_execution':
      return <Clock className="w-4 h-4" />;
    case 'wallet_generated':
      return <Plus className="w-4 h-4" />;
    default:
      return <ArrowRight className="w-4 h-4" />;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'transfer':
      return 'bg-primary';
    case 'bundle_execution':
      return 'bg-warning';
    case 'wallet_generated':
      return 'bg-accent';
    default:
      return 'bg-secondary';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-success/20 text-success';
    case 'pending':
      return 'bg-warning/20 text-warning';
    case 'failed':
      return 'bg-destructive/20 text-destructive';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export function RealTimeMonitor() {
  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ['/api/activities'],
    refetchInterval: 3000,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Real-Time Activity</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
            <span className="text-sm text-success">Live</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
            </div>
          ) : (
            activities.map((activity) => (
              <div 
                key={activity.id} 
                className="flex items-start space-x-3 p-3 bg-muted rounded-lg"
                data-testid={`activity-${activity.id}`}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white",
                  getActivityColor(activity.type)
                )}>
                  {getActivityIcon(activity.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{activity.type.replace('_', ' ')}</span>
                    {activity.description && (
                      <span className="ml-1">{activity.description}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    {activity.amount && (
                      <span className="ml-2 font-mono">{activity.amount} BNB</span>
                    )}
                  </p>
                </div>
                
                <div className="flex-shrink-0">
                  <Badge className={cn("text-xs", getStatusColor(activity.status))}>
                    {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
