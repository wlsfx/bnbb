import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Plus, Key, Trash2, Copy, Check, AlertCircle } from 'lucide-react';

interface AccessKey {
  id: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
  revokedAt?: string;
  metadata?: {
    keyPreview: string;
  };
}

export default function AccessKeys() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyRole, setNewKeyRole] = useState<'user' | 'admin'>('user');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch access keys
  const { data: accessKeys = [], isLoading } = useQuery<AccessKey[]>({
    queryKey: ['/api/admin/access-keys'],
  });

  // Create new access key
  const createKeyMutation = useMutation({
    mutationFn: async (data: { name: string; role: 'user' | 'admin' }) => {
      return apiRequest('POST', '/api/admin/access-keys', data);
    },
    onSuccess: (data: any) => {
      setGeneratedKey(data.key);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/access-keys'] });
      toast({
        title: 'Access key created',
        description: `${data.keyInfo.role === 'admin' ? 'Admin' : 'User'} key "${data.keyInfo.name}" has been created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create key',
        description: error.message || 'An error occurred while creating the access key',
        variant: 'destructive',
      });
    },
  });

  // Revoke access key
  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return apiRequest('POST', `/api/admin/access-keys/${keyId}/revoke`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/access-keys'] });
      toast({
        title: 'Key revoked',
        description: 'The access key has been revoked successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to revoke key',
        description: error.message || 'An error occurred while revoking the key',
        variant: 'destructive',
      });
    },
  });

  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for the access key',
        variant: 'destructive',
      });
      return;
    }
    createKeyMutation.mutate({ name: newKeyName, role: newKeyRole });
  };

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied to clipboard',
        description: 'The access key has been copied to your clipboard',
      });
    }
  };

  const handleCloseDialog = () => {
    setShowCreateDialog(false);
    setNewKeyName('');
    setNewKeyRole('user');
    setGeneratedKey(null);
    setCopied(false);
  };

  if (isLoading) {
    return <div>Loading access keys...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Access Key Management</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage access keys for users and administrators
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Access Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Access Key</DialogTitle>
              <DialogDescription>
                Generate a new access key with the specified role and name
              </DialogDescription>
            </DialogHeader>
            
            {!generatedKey ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Key Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter a descriptive name"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    data-testid="input-key-name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newKeyRole} onValueChange={(value: 'user' | 'admin') => setNewKeyRole(value)}>
                    <SelectTrigger id="role" data-testid="select-role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User (JJIT- prefix)</SelectItem>
                      <SelectItem value="admin">Admin (WLSFX- prefix)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateKey}
                    disabled={createKeyMutation.isPending}
                    data-testid="button-create-key"
                  >
                    {createKeyMutation.isPending ? 'Creating...' : 'Create Key'}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert className="bg-green-50 border-green-200">
                  <AlertCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Access key created successfully! Copy it now - it won't be shown again.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-2">
                  <Label>Generated Access Key</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      readOnly
                      value={generatedKey}
                      className="font-mono text-sm"
                      data-testid="text-generated-key"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={handleCopyKey}
                      data-testid="button-copy-key"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button onClick={handleCloseDialog} data-testid="button-close">
                    Close
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Access Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Access Keys</CardTitle>
          <CardDescription>
            All active access keys in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Key Preview</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Usage Count</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accessKeys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No access keys found. Create your first key to get started.
                  </TableCell>
                </TableRow>
              ) : (
                accessKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <Badge variant={key.role === 'admin' ? 'destructive' : 'default'}>
                        {key.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {key.metadata?.keyPreview || 'N/A'}
                    </TableCell>
                    <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell>{key.usageCount}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => revokeKeyMutation.mutate(key.id)}
                        disabled={revokeKeyMutation.isPending}
                        data-testid={`button-revoke-${key.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Key Format Information */}
      <Card>
        <CardHeader>
          <CardTitle>Key Format Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Admin Keys:</span>
              <span className="font-mono">WLSFX-XXXXXXXXXXXXXXXXXXX</span>
              <Badge variant="destructive">Full Access</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">User Keys:</span>
              <span className="font-mono">JJIT-XXXXXXXXXXXXXXXXXXXX</span>
              <Badge>Limited Access</Badge>
            </div>
            <p className="text-muted-foreground mt-2">
              All keys are exactly 24 characters long and are case-sensitive.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}