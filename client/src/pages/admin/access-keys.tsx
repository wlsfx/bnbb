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
import { Plus, Key, Trash2, Copy, Check, AlertCircle, Eye, Clock, Users, FileText } from 'lucide-react';

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

interface KeyDetails {
  id: string;
  name: string;
  role: string;
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
  revokedAt?: string;
  createdBy?: string;
  metadata: {
    keyPreview?: string;
    securityNote: string;
    [key: string]: any;
  };
  activeSessions: number;
  totalSessions: number;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    timestamp: string;
    ipAddress?: string;
    details?: string;
  }>;
}

export default function AccessKeys() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyRole, setNewKeyRole] = useState<'user' | 'admin'>('user');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState<string | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedKeyDetails, setSelectedKeyDetails] = useState<KeyDetails | null>(null);

  // Fetch access keys
  const { data: accessKeys = [], isLoading } = useQuery<AccessKey[]>({
    queryKey: ['/api/admin/access-keys'],
  });

  // Create new access key
  const createKeyMutation = useMutation({
    mutationFn: async (data: { name: string; role: 'user' | 'admin' }) => {
      const res = await apiRequest('POST', '/api/admin/access-keys', data);
      return await res.json();
    },
    onSuccess: (response: any) => {
      console.log('Key creation response:', response);
      
      // Check if response is successful and has required fields
      if (response && response.success === true) {
        if (response.key && response.keyInfo) {
          setGeneratedKey(response.key);
          queryClient.invalidateQueries({ queryKey: ['/api/admin/access-keys'] });
          toast({
            title: 'Access key created successfully',
            description: `${response.keyInfo.role === 'admin' ? 'Admin' : 'User'} key "${response.keyInfo.name}" has been created`,
          });
        } else {
          console.error('Missing key or keyInfo in response:', response);
          throw new Error('Invalid response format: missing key or keyInfo');
        }
      } else if (response && response.success === false) {
        // Handle API error responses
        throw new Error(response.message || 'Server returned an error');
      } else {
        console.error('Unexpected response format:', response);
        throw new Error('Invalid response format from server');
      }
    },
    onError: (error: any) => {
      console.error('Key creation error:', error);
      toast({
        title: 'Failed to create access key',
        description: error.message || 'An unexpected error occurred while creating the access key. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Fetch key details
  const fetchKeyDetailsMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const res = await apiRequest('GET', `/api/admin/access-keys/${keyId}/details`);
      return await res.json();
    },
    onSuccess: (response: any) => {
      console.log('Key details response:', response);
      
      // Check if response is successful and has required fields
      if (response && response.success === true) {
        if (response.keyDetails) {
          setSelectedKeyDetails(response.keyDetails);
          setShowDetailsDialog(true);
          toast({
            title: 'Key details loaded',
            description: 'Access key information has been retrieved successfully',
          });
        } else {
          console.error('Missing keyDetails in response:', response);
          throw new Error('Invalid response format: missing keyDetails');
        }
      } else if (response && response.success === false) {
        // Handle API error responses
        throw new Error(response.message || 'Server returned an error');
      } else {
        console.error('Unexpected response format:', response);
        throw new Error('Invalid response format from server');
      }
    },
    onError: (error: any) => {
      console.error('Key details fetch error:', error);
      toast({
        title: 'Failed to load key details',
        description: error.message || 'Unable to retrieve key information. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Revoke access key
  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const res = await apiRequest('POST', `/api/admin/access-keys/${keyId}/revoke`);
      return await res.json();
    },
    onSuccess: (response: any) => {
      console.log('Key revocation response:', response);
      
      // Check if response is successful
      if (response && response.success === true) {
        queryClient.invalidateQueries({ queryKey: ['/api/admin/access-keys'] });
        toast({
          title: 'Access key revoked',
          description: response.message || 'The access key has been permanently revoked and can no longer be used',
        });
      } else if (response && response.success === false) {
        // Handle API error responses
        throw new Error(response.message || 'Server returned an error');
      } else {
        console.error('Unexpected response format:', response);
        throw new Error('Invalid response format from server');
      }
    },
    onError: (error: any) => {
      console.error('Key revocation error:', error);
      toast({
        title: 'Failed to revoke key',
        description: error.message || 'Unable to revoke the access key. Please try again.',
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

  const handleCopyKeyPreview = (keyPreview: string) => {
    if (keyPreview && keyPreview !== 'N/A') {
      navigator.clipboard.writeText(keyPreview);
      setCopiedPreview(keyPreview);
      setTimeout(() => setCopiedPreview(null), 2000);
      toast({
        title: 'Key preview copied',
        description: 'The key preview has been copied to your clipboard',
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

  const handleViewKeyDetails = (keyId: string) => {
    fetchKeyDetailsMutation.mutate(keyId);
  };

  const handleCloseDetailsDialog = () => {
    setShowDetailsDialog(false);
    setSelectedKeyDetails(null);
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
                      <div className="flex items-center space-x-2">
                        <span>{key.metadata?.keyPreview || 'N/A'}</span>
                        {key.metadata?.keyPreview && key.metadata.keyPreview !== 'N/A' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyKeyPreview(key.metadata!.keyPreview)}
                            data-testid={`button-copy-preview-${key.id}`}
                            className="h-6 w-6 p-0"
                          >
                            {copiedPreview === key.metadata.keyPreview ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell>{key.usageCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewKeyDetails(key.id)}
                          disabled={fetchKeyDetailsMutation.isPending}
                          data-testid={`button-view-details-${key.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => revokeKeyMutation.mutate(key.id)}
                          disabled={revokeKeyMutation.isPending}
                          data-testid={`button-revoke-${key.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

      {/* Key Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5" />
              <span>Access Key Details</span>
            </DialogTitle>
            <DialogDescription>
              Detailed information about the selected access key
            </DialogDescription>
          </DialogHeader>
          
          {selectedKeyDetails && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <p className="text-sm text-muted-foreground" data-testid="text-key-name">
                    {selectedKeyDetails.name}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Role</Label>
                  <Badge variant={selectedKeyDetails.role === 'admin' ? 'destructive' : 'default'} data-testid="badge-key-role">
                    {selectedKeyDetails.role}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created</Label>
                  <p className="text-sm text-muted-foreground flex items-center space-x-1" data-testid="text-created-date">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(selectedKeyDetails.createdAt).toLocaleString()}</span>
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Last Used</Label>
                  <p className="text-sm text-muted-foreground" data-testid="text-last-used">
                    {selectedKeyDetails.lastUsed ? new Date(selectedKeyDetails.lastUsed).toLocaleString() : 'Never'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Usage Count</Label>
                  <p className="text-sm text-muted-foreground" data-testid="text-usage-count">
                    {selectedKeyDetails.usageCount} times
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Sessions</Label>
                  <p className="text-sm text-muted-foreground flex items-center space-x-1" data-testid="text-sessions">
                    <Users className="h-3 w-3" />
                    <span>{selectedKeyDetails.activeSessions} active / {selectedKeyDetails.totalSessions} total</span>
                  </p>
                </div>
              </div>

              {/* Key Preview and Security Information */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Key Preview</Label>
                  <div className="bg-muted p-3 rounded-md flex items-center justify-between">
                    <p className="font-mono text-sm" data-testid="text-key-preview">
                      {selectedKeyDetails.metadata.keyPreview || 'Preview not available'}
                    </p>
                    {selectedKeyDetails.metadata.keyPreview && selectedKeyDetails.metadata.keyPreview !== 'Preview not available' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyKeyPreview(selectedKeyDetails.metadata.keyPreview!)}
                        data-testid="button-copy-details-preview"
                        className="h-8 w-8 p-0"
                      >
                        {copiedPreview === selectedKeyDetails.metadata.keyPreview ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {selectedKeyDetails.metadata.securityNote}
                  </AlertDescription>
                </Alert>
              </div>

              {/* Recent Audit Logs */}
              {selectedKeyDetails.recentAuditLogs && selectedKeyDetails.recentAuditLogs.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <Label className="text-sm font-medium">Recent Audit Logs</Label>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Action</TableHead>
                          <TableHead className="text-xs">Time</TableHead>
                          <TableHead className="text-xs">IP Address</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedKeyDetails.recentAuditLogs.slice(0, 10).map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs">{log.action}</TableCell>
                            <TableCell className="text-xs">
                              {new Date(log.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {log.ipAddress || 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={handleCloseDetailsDialog} data-testid="button-close-details">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}