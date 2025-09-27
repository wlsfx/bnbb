import { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Shield, Activity, Lock } from 'lucide-react';

const loginSchema = z.object({
  accessKey: z.string()
    .length(24, 'Access key must be exactly 24 characters')
    .refine((key) => key.startsWith('WLSFX-') || key.startsWith('JJIT-'), {
      message: 'Invalid key format. Must start with WLSFX- or JJIT-',
    }),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      accessKey: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const response = await apiRequest('POST', '/api/auth/login', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Login successful',
        description: 'Welcome to Stealth Bundler',
      });
      
      // Store session info if needed
      if (data.sessionToken) {
        localStorage.setItem('sessionToken', data.sessionToken);
      }
      
      // Redirect based on role
      if (data.role === 'admin') {
        setLocation('/admin');
      } else {
        setLocation('/dashboard');
      }
    },
    onError: (error: any) => {
      setError(error.message || 'Invalid access key. Please try again.');
      form.setError('accessKey', {
        type: 'manual',
        message: 'Invalid access key',
      });
    },
  });

  const handleSubmit = (data: LoginForm) => {
    setError(null);
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
      <div className="w-full max-w-md p-6 space-y-6">
        <div className="text-center space-y-2 mb-8">
          <div className="flex justify-center">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Stealth Bundler</h1>
          <p className="text-muted-foreground">Secure Bundle Execution Platform</p>
        </div>

        <Card className="shadow-xl border-muted/50 backdrop-blur">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Access Portal</CardTitle>
            <CardDescription>
              Enter your 24-character access key to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="accessKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Access Key</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="Enter your 24-character key"
                            className="pl-10 font-mono"
                            maxLength={24}
                            autoComplete="off"
                            data-testid="input-access-key"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Your access key is case-sensitive and exactly 24 characters long
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? (
                    <>
                      <Activity className="mr-2 h-4 w-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Authenticate
                    </>
                  )}
                </Button>
              </form>
            </Form>

            <div className="text-center text-sm text-muted-foreground mt-6">
              <p>Don't have an access key?</p>
              <p className="mt-1">Contact your administrator for access</p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-center space-x-4">
            <span>• Secure</span>
            <span>• Private</span>
            <span>• Efficient</span>
          </div>
          <p>© 2024 Stealth Bundler. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}