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
  const { data: metrics, error: metricsError } = useQuery<SystemMetricsData>({
    queryKey: ['/api/system-metrics'],
    refetchInterval: 5000,
    retry: false, // Don't retry to avoid hammering a potentially missing endpoint
  });

  // Poll activities every 3 seconds
  const { data: activities } = useQuery({
    queryKey: ['/api/activities'],
    refetchInterval: 3000,
  });

  // Poll wallets every 10 seconds
  const { data: wallets, error: walletsError } = useQuery<Wallet[]>({
    queryKey: ['/api/wallets'],
    refetchInterval: 10000,
  });

  // Poll network status to track network connectivity
  const { data: networkStatus, error: networkError } = useQuery({
    queryKey: ['/api/network/status'],
    refetchInterval: 5000,
    retry: false,
  });

  // Track backend and network connectivity based on successful API calls
  useEffect(() => {
    // If wallets query is successful, backend is connected
    // We use wallets as the primary indicator since it's actively working
    if (wallets && !walletsError) {
      setStatus({
        backendConnected: true,
        networkConnected: navigator.onLine,
      });
    } else if (walletsError) {
      setStatus({
        backendConnected: false,
        networkConnected: navigator.onLine,
      });
    }
  }, [wallets, walletsError, setStatus]);

  // Track network status based on network API calls
  useEffect(() => {
    if (networkStatus && !networkError) {
      // Network is connected if we got valid testnet/mainnet data with blockchain health
      const hasValidData = Boolean(networkStatus.chainId && networkStatus.environment);
      const blockchainHealthy = networkStatus.blockchain?.healthy === true;
      setStatus({
        networkConnected: hasValidData && blockchainHealthy,
      });
    } else if (networkError) {
      setStatus({
        networkConnected: false,
      });
    }
  }, [networkStatus, networkError, setStatus]);

  useEffect(() => {
    if (metrics && !metricsError) {
      setMetrics(metrics);
      setStatus({
        backendConnected: true,
        latency: metrics.latency,
        gasPrice: metrics.gasPrice,
      });
    }
  }, [metrics, metricsError, setMetrics, setStatus]);

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
