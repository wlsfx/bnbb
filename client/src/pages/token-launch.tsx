import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TokenLaunch() {
  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Token Launch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">Token Launch Configuration</h3>
              <p className="text-muted-foreground">
                Configure your token parameters, launch strategy, and deployment settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
