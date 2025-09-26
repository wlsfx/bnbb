import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSystemStore } from '../stores/system-store';
import { useWalletStore } from '../stores/wallet-store';
import { SystemMetricsData } from '../types/wallet';
import { Wallet } from '@shared/schema';

export function useRealTimeUpdates() {
  const queryClient = useQueryClient();
  const setStatus = useSystemStore((state) => state.setStatus);
  const setMetrics = useSystemStore((state) => state.setMetrics);

  // Poll system metrics every 5 seconds
  const { data: metrics } = useQuery<SystemMetricsData>({
    queryKey: ['/api/system-metrics'],
    refetchInterval: 5000,
  });

  // Poll activities every 3 seconds
  const { data: activities } = useQuery({
    queryKey: ['/api/activities'],
    refetchInterval: 3000,
  });

  // Poll wallets every 10 seconds
  const { data: wallets } = useQuery<Wallet[]>({
    queryKey: ['/api/wallets'],
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (metrics) {
      setMetrics(metrics);
      setStatus({
        backendConnected: true,
        latency: metrics.latency,
        gasPrice: metrics.gasPrice,
      });
    }
  }, [metrics, setMetrics, setStatus]);

  useEffect(() => {
    if (wallets && Array.isArray(wallets)) {
      useWalletStore.getState().setWallets(wallets);
    }
  }, [wallets]);

  // Simulate network connection check
  useEffect(() => {
    const checkConnection = () => {
      setStatus({
        networkConnected: navigator.onLine,
      });
    };

    checkConnection();
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);

    return () => {
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
    };
  }, [setStatus]);

  return {
    activities: activities || [],
    metrics,
    wallets: wallets || [],
  };
}
