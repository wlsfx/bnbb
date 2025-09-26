import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Analytics() {
  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">Analytics Dashboard</h3>
              <p className="text-muted-foreground">
                View comprehensive analytics, performance metrics, and trading insights.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
