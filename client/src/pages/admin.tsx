import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  KeyRound, Shield, Plus, Trash2, Copy, CheckCircle, 
  AlertCircle, Activity, Settings, Users, BarChart, 
  LogOut, RefreshCw, Eye, EyeOff, Server 
} from 'lucide-react';
import { format } from 'date-fns';

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newKeyDialog, setNewKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyRole, setNewKeyRole] = useState<'user' | 'admin'>('user');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  // Fetch access keys
  const { data: accessKeys, isLoading: keysLoading } = useQuery({
    queryKey: ['/api/admin/access-keys'],
  });

  // Fetch audit logs
  const { data: auditLogs } = useQuery({
    queryKey: ['/api/admin/audit-logs'],
  });

  // Fetch system stats
  const { data: systemStats } = useQuery({
    queryKey: ['/api/admin/system-stats'],
  });

  // Create access key mutation
  const createKeyMutation = useMutation({
    mutationFn: async (data: { name: string; role: string }) => {
      return apiRequest('/api/admin/access-keys', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      setGeneratedKey(data.key);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/access-keys'] });
      toast({
        title: 'Access key created',
        description: 'The new access key has been generated successfully.',
      });
    },
  });

  // Revoke access key mutation
  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return apiRequest(`/api/admin/access-keys/${keyId}/revoke`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/access-keys'] });
      toast({
        title: 'Access key revoked',
        description: 'The access key has been revoked and can no longer be used.',
      });
      setRevokeConfirm(null);
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/auth/logout', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      localStorage.removeItem('sessionToken');
      setLocation('/');
    },
  });

  const handleCreateKey = () => {
    if (newKeyName.trim()) {
      createKeyMutation.mutate({ name: newKeyName, role: newKeyRole });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: 'The access key has been copied to your clipboard.',
    });
  };

  const formatKey = (key: string | undefined) => {
    if (!key) return '••••••••••••••••••••••••';
    const metadata = key.metadata ? JSON.parse(key.metadata) : {};
    return metadata.keyPreview || '••••••••••••••••••••••••';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <div className="flex items-center space-x-4">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Admin Panel</h1>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <Badge variant="secondary" className="px-3 py-1">
              <Shield className="mr-1 h-3 w-3" />
              Admin
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setLocation('/dashboard')}>
              <Activity className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={() => logoutMutation.mutate()}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto py-6 px-4">
        <Tabs defaultValue="keys" className="space-y-4">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="keys" data-testid="tab-keys">
              <KeyRound className="mr-2 h-4 w-4" />
              Access Keys
            </TabsTrigger>
            <TabsTrigger value="environment" data-testid="tab-environment">
              <Settings className="mr-2 h-4 w-4" />
              Environment
            </TabsTrigger>
            <TabsTrigger value="monitoring" data-testid="tab-monitoring">
              <BarChart className="mr-2 h-4 w-4" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit">
              <Activity className="mr-2 h-4 w-4" />
              Audit Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Access Key Management</CardTitle>
                    <CardDescription>
                      Manage access keys for users and administrators
                    </CardDescription>
                  </div>
                  <Button onClick={() => setNewKeyDialog(true)} data-testid="button-new-key">
                    <Plus className="mr-2 h-4 w-4" />
                    New Access Key
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {keysLoading ? (
                    <div>Loading access keys...</div>
                  ) : (
                    <div className="space-y-2">
                      {accessKeys?.map((key: any) => (
                        <div
                          key={key.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                          data-testid={`card-key-${key.id}`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{key.name}</span>
                              <Badge variant={key.role === 'admin' ? 'destructive' : 'default'}>
                                {key.role}
                              </Badge>
                              {key.revokedAt && (
                                <Badge variant="secondary">Revoked</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-x-4">
                              <span>Key: {formatKey(key)}</span>
                              <span>Used: {key.usageCount} times</span>
                              {key.lastUsed && (
                                <span>Last used: {format(new Date(key.lastUsed), 'MMM d, yyyy HH:mm')}</span>
                              )}
                            </div>
                          </div>
                          {!key.revokedAt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRevokeConfirm(key.id)}
                              data-testid={`button-revoke-${key.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="environment">
            <Card>
              <CardHeader>
                <CardTitle>Environment Configuration</CardTitle>
                <CardDescription>
                  Manage environment settings and network configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Server className="h-4 w-4" />
                  <AlertTitle>Environment Controls</AlertTitle>
                  <AlertDescription>
                    Environment configuration has been moved here from the main dashboard for security.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring">
            <Card>
              <CardHeader>
                <CardTitle>System Monitoring</CardTitle>
                <CardDescription>
                  Overview of system health and bundle execution statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                {systemStats && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{systemStats.activeSessions || 0}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Access Keys</CardTitle>
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{systemStats.totalKeys || 0}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Bundle Executions</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{systemStats.bundleExecutions || 0}</div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>
                  Track all authentication and access key operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {auditLogs?.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-3">
                        {log.action === 'login' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : log.action === 'access_denied' ? (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Activity className="h-4 w-4 text-blue-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{log.action.replace('_', ' ').toUpperCase()}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.ipAddress} • {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Access Key Dialog */}
      <Dialog open={newKeyDialog} onOpenChange={setNewKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate New Access Key</DialogTitle>
            <DialogDescription>
              Create a new access key for user authentication
            </DialogDescription>
          </DialogHeader>
          {!generatedKey ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                  data-testid="input-key-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key-role">Role</Label>
                <select
                  id="key-role"
                  value={newKeyRole}
                  onChange={(e) => setNewKeyRole(e.target.value as 'user' | 'admin')}
                  className="w-full px-3 py-2 border rounded-md"
                  data-testid="select-role"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewKeyDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateKey} disabled={createKeyMutation.isPending}>
                  Generate Key
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  Save this access key now. You won't be able to see it again!
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>Access Key</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={generatedKey}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(generatedKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setNewKeyDialog(false);
                    setGeneratedKey(null);
                    setNewKeyName('');
                    setShowKey(false);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={!!revokeConfirm} onOpenChange={() => setRevokeConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Access Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this access key? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeConfirm && revokeKeyMutation.mutate(revokeConfirm)}
            >
              Revoke Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}