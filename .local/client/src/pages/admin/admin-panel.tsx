import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Key, Settings, FileText, LogOut, Home, Activity, Users } from 'lucide-react';
import AccessKeys from './access-keys';
import EnvironmentConfig from './environment-config';
import AuditLogs from './audit-logs';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('access-keys');

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/auth/logout');
    },
    onSuccess: () => {
      localStorage.removeItem('sessionToken');
      setLocation('/');
      toast({
        title: 'Logged out successfully',
        description: 'You have been securely logged out',
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Admin Panel</h1>
                <p className="text-sm text-muted-foreground">Stealth Bundler Control Center</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <Home className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Admin Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Users className="mr-2 h-4 w-4" />
                Active Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Key className="mr-2 h-4 w-4" />
                Access Keys
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Total keys</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Activity className="mr-2 h-4 w-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Online</div>
              <p className="text-xs text-muted-foreground">All systems operational</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Admin Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Administration</CardTitle>
            <CardDescription>
              Manage access keys, environment settings, and monitor system activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="access-keys" className="flex items-center">
                  <Key className="mr-2 h-4 w-4" />
                  Access Keys
                </TabsTrigger>
                <TabsTrigger value="environment" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  Environment
                </TabsTrigger>
                <TabsTrigger value="audit-logs" className="flex items-center">
                  <FileText className="mr-2 h-4 w-4" />
                  Audit Logs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="access-keys" className="mt-6">
                <AccessKeys />
              </TabsContent>

              <TabsContent value="environment" className="mt-6">
                <EnvironmentConfig />
              </TabsContent>

              <TabsContent value="audit-logs" className="mt-6">
                <AuditLogs />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}