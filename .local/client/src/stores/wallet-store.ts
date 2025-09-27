import { create } from 'zustand';
import { Wallet } from '@shared/schema';
import { WalletGenerationConfig, FundingConfig } from '../types/wallet';

interface WalletStore {
  wallets: Wallet[];
  selectedWallets: string[];
  isGenerating: boolean;
  generationProgress: number;
  totalBalance: string;
  
  // Actions
  setWallets: (wallets: Wallet[]) => void;
  addWallet: (wallet: Wallet) => void;
  updateWallet: (id: string, updates: Partial<Wallet>) => void;
  removeWallet: (id: string) => void;
  toggleWalletSelection: (id: string) => void;
  selectAllWallets: () => void;
  clearSelection: () => void;
  setGenerating: (isGenerating: boolean) => void;
  setGenerationProgress: (progress: number) => void;
  calculateTotalBalance: () => void;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  wallets: [],
  selectedWallets: [],
  isGenerating: false,
  generationProgress: 0,
  totalBalance: '0.000',

  setWallets: (wallets) => {
    set({ wallets });
    get().calculateTotalBalance();
  },

  addWallet: (wallet) => {
    set((state) => ({ wallets: [...state.wallets, wallet] }));
    get().calculateTotalBalance();
  },

  updateWallet: (id, updates) => {
    set((state) => ({
      wallets: state.wallets.map(wallet => 
        wallet.id === id ? { ...wallet, ...updates } : wallet
      )
    }));
    get().calculateTotalBalance();
  },

  removeWallet: (id) => {
    set((state) => ({
      wallets: state.wallets.filter(wallet => wallet.id !== id),
      selectedWallets: state.selectedWallets.filter(selectedId => selectedId !== id)
    }));
    get().calculateTotalBalance();
  },

  toggleWalletSelection: (id) => {
    set((state) => ({
      selectedWallets: state.selectedWallets.includes(id)
        ? state.selectedWallets.filter(selectedId => selectedId !== id)
        : [...state.selectedWallets, id]
    }));
  },

  selectAllWallets: () => {
    set((state) => ({
      selectedWallets: state.wallets.map(wallet => wallet.id)
    }));
  },

  clearSelection: () => {
    set({ selectedWallets: [] });
  },

  setGenerating: (isGenerating) => {
    set({ isGenerating });
  },

  setGenerationProgress: (generationProgress) => {
    set({ generationProgress });
  },

  calculateTotalBalance: () => {
    const { wallets } = get();
    const total = wallets.reduce((sum, wallet) => sum + parseFloat(wallet.balance || '0'), 0);
    set({ totalBalance: total.toFixed(3) });
  },
}));
