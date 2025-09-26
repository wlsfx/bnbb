import { create } from 'zustand';
import { SystemStatus, SystemMetricsData } from '../types/wallet';

interface SystemStore {
  status: SystemStatus;
  metrics: SystemMetricsData | null;
  taxCollectionRate: number;
  
  // Actions
  setStatus: (status: Partial<SystemStatus>) => void;
  setMetrics: (metrics: SystemMetricsData) => void;
  setTaxCollectionRate: (rate: number) => void;
}

export const useSystemStore = create<SystemStore>((set) => ({
  status: {
    backendConnected: false,
    networkConnected: false,
    latency: 0,
    gasPrice: '0.0',
  },
  metrics: null,
  taxCollectionRate: 5.0,

  setStatus: (status) => {
    set((state) => ({
      status: { ...state.status, ...status }
    }));
  },

  setMetrics: (metrics) => {
    set({ metrics });
  },

  setTaxCollectionRate: (taxCollectionRate) => {
    set({ taxCollectionRate });
  },
}));
