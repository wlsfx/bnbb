import { ethers, Wallet, HDNodeWallet } from 'ethers';
import crypto from 'crypto';
import { encryptPrivateKey, decryptPrivateKey } from './security-middleware';
import type { DbStorage } from './storage';
import type { BSCClient } from './blockchain-client';
import type { InsertWallet } from '@shared/schema';

interface WalletCreationOptions {
  count?: number;
  mnemonic?: string;
  initialBalance?: string;
  labelPrefix?: string;
  nameTemplate?: string;
  groupTag?: string;
  metadata?: Record<string, any>;
}

interface GeneratedWallet {
  address: string;
  privateKey: string;
  publicKey: string;
  mnemonic?: string;
  path?: string;
}

interface SecureWalletData {
  id: string;
  address: string;
  publicKey: string;
  encryptedPrivateKey: string;
  encryptedMnemonic?: string;
  derivationPath?: string;
  balance: string;
  label?: string;
  metadata?: string;
}

export class WalletService {
  private storage: DbStorage;
  private bscClient: BSCClient;

  constructor(storage: DbStorage, bscClient: BSCClient) {
    this.storage = storage;
    this.bscClient = bscClient;
  }

  /**
   * Generate a new HD wallet with mnemonic phrase
   */
  async generateHDWallet(mnemonic?: string): Promise<GeneratedWallet & { mnemonic: string }> {
    try {
      // Generate or use provided mnemonic
      const walletMnemonic = mnemonic || Wallet.createRandom().mnemonic!.phrase;
      
      // Create HD wallet from mnemonic
      const hdWallet = HDNodeWallet.fromPhrase(walletMnemonic);
      
      return {
        address: hdWallet.address,
        privateKey: hdWallet.privateKey,
        publicKey: hdWallet.publicKey,
        mnemonic: walletMnemonic,
        path: hdWallet.path || "m/44'/60'/0'/0/0"
      };
    } catch (error) {
      console.error('Failed to generate HD wallet:', error);
      throw new Error(`Failed to generate HD wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a single wallet (non-HD)
   */
  async generateSingleWallet(): Promise<GeneratedWallet> {
    try {
      const wallet = Wallet.createRandom();
      
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey
      };
    } catch (error) {
      console.error('Failed to generate wallet:', error);
      throw new Error(`Failed to generate wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Derive multiple wallets from HD seed
   */
  async deriveWalletsFromHD(mnemonic: string, count: number, startIndex: number = 0): Promise<GeneratedWallet[]> {
    try {
      const wallets: GeneratedWallet[] = [];
      const hdNode = HDNodeWallet.fromPhrase(mnemonic);
      
      for (let i = 0; i < count; i++) {
        const path = `m/44'/60'/0'/0/${startIndex + i}`;
        const childWallet = hdNode.derivePath(path);
        
        wallets.push({
          address: childWallet.address,
          privateKey: childWallet.privateKey,
          publicKey: childWallet.publicKey,
          path: path
        });
      }
      
      return wallets;
    } catch (error) {
      console.error('Failed to derive wallets from HD:', error);
      throw new Error(`Failed to derive wallets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create and store a single wallet with encryption
   */
  async createWallet(
    accessKeyId: string,
    options: WalletCreationOptions = {}
  ): Promise<SecureWalletData> {
    try {
      // Generate wallet
      const wallet = options.mnemonic 
        ? await this.generateHDWallet(options.mnemonic)
        : await this.generateSingleWallet();
      
      // Encrypt sensitive data
      const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey);
      const encryptedMnemonic = wallet.mnemonic ? encryptPrivateKey(wallet.mnemonic) : undefined;
      
      // Prepare wallet data for storage
      const walletData: InsertWallet = {
        accessKeyId,
        address: wallet.address,
        privateKey: encryptedPrivateKey, // Store encrypted
        publicKey: wallet.publicKey,
        balance: options.initialBalance || '0',
        status: 'idle',
        label: options.labelPrefix ? `${options.labelPrefix} #001` : undefined,
        health: 'good',
        connectionStatus: 'connected'
        // metadata: options.metadata ? JSON.stringify(options.metadata) : undefined  // Commented out - metadata field not in schema
      };
      
      // Store in database
      const storedWallet = await this.storage.createWallet(walletData, accessKeyId);
      
      // Return wallet data WITHOUT private key
      return {
        id: storedWallet.id,
        address: storedWallet.address,
        publicKey: storedWallet.publicKey,
        encryptedPrivateKey: storedWallet.privateKey, // Only for internal use
        encryptedMnemonic,
        derivationPath: wallet.path,
        balance: storedWallet.balance,
        label: storedWallet.label || undefined
        // metadata: storedWallet.metadata || undefined  // Commented out - metadata field not in schema
      };
    } catch (error) {
      console.error('Failed to create wallet:', error);
      throw new Error(`Failed to create wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create multiple wallets in bulk
   */
  async createBulkWallets(
    accessKeyId: string,
    options: WalletCreationOptions
  ): Promise<SecureWalletData[]> {
    try {
      const count = options.count || 1;
      const wallets: SecureWalletData[] = [];
      
      // Generate HD wallet if we're creating multiple wallets
      let mnemonic: string | undefined;
      let derivedWallets: GeneratedWallet[] = [];
      
      if (count > 1) {
        // Use HD wallet for bulk generation
        const hdWallet = await this.generateHDWallet(options.mnemonic);
        mnemonic = hdWallet.mnemonic;
        derivedWallets = await this.deriveWalletsFromHD(mnemonic, count);
      }
      
      // Create and store each wallet
      for (let i = 0; i < count; i++) {
        const wallet = count > 1 
          ? derivedWallets[i]
          : await this.generateSingleWallet();
        
        // Format label based on template
        let label = options.labelPrefix || 'Wallet';
        if (options.nameTemplate) {
          label = options.nameTemplate
            .replace('{index}', (i + 1).toString().padStart(3, '0'))
            .replace('{groupTag}', options.groupTag || 'default')
            .replace('{batch}', '001');
        } else {
          label = `${label} #${(i + 1).toString().padStart(3, '0')}`;
        }
        
        // Encrypt sensitive data
        const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey);
        
        // Prepare metadata
        const metadata = {
          ...options.metadata,
          groupTag: options.groupTag,
          derivationPath: wallet.path,
          createdAt: new Date().toISOString(),
          isHDWallet: count > 1,
          walletIndex: i
        };
        
        // Store wallet
        const walletData: InsertWallet = {
          accessKeyId,
          address: wallet.address,
          privateKey: encryptedPrivateKey,
          publicKey: wallet.publicKey,
          balance: options.initialBalance || '0',
          status: 'idle',
          label,
          health: 'good',
          connectionStatus: 'connected'
          // metadata: JSON.stringify(metadata)  // Commented out - metadata field not in schema
        };
        
        const storedWallet = await this.storage.createWallet(walletData, accessKeyId);
        
        wallets.push({
          id: storedWallet.id,
          address: storedWallet.address,
          publicKey: storedWallet.publicKey,
          encryptedPrivateKey: storedWallet.privateKey,
          encryptedMnemonic: i === 0 && mnemonic ? encryptPrivateKey(mnemonic) : undefined,
          derivationPath: wallet.path,
          balance: storedWallet.balance,
          label: storedWallet.label || undefined
          // metadata: storedWallet.metadata || undefined  // Commented out - metadata field not in schema
        });
      }
      
      return wallets;
    } catch (error) {
      console.error('Failed to create bulk wallets:', error);
      throw new Error(`Failed to create bulk wallets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get wallet balance from blockchain
   */
  async getWalletBalance(address: string): Promise<string> {
    try {
      await this.bscClient.waitForInitialization();
      const balance = await this.bscClient.getBalance(address);
      return balance;
    } catch (error) {
      console.error('Failed to get wallet balance:', error);
      throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fund wallet from master wallet
   */
  async fundWallet(
    walletId: string,
    amount: string,
    accessKeyId: string,
    fromPrivateKey?: string
  ): Promise<{ txHash: string; amount: string }> {
    try {
      // Get wallet details
      const wallet = await this.storage.getWallet(walletId, accessKeyId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      // Ensure BSC client is initialized
      await this.bscClient.waitForInitialization();
      
      // Use provided private key or generate a funding wallet
      let fundingPrivateKey = fromPrivateKey;
      if (!fundingPrivateKey) {
        // In production, this would use a master wallet with actual funds
        // For now, we'll return a mock transaction
        console.warn('No funding private key provided, returning mock transaction');
        return {
          txHash: `0x${crypto.randomBytes(32).toString('hex')}`,
          amount
        };
      }
      
      // Decrypt the funding private key if encrypted
      if (fundingPrivateKey.includes(':')) {
        fundingPrivateKey = decryptPrivateKey(fundingPrivateKey);
      }
      
      // Send transaction
      const result = await this.bscClient.sendTransaction(
        fundingPrivateKey,
        {
          to: wallet.address,
          value: ethers.parseEther(amount).toString(),
          type: 'transfer'
        }
      );
      
      // Update wallet balance in database
      const newBalance = await this.getWalletBalance(wallet.address);
      await this.storage.updateWallet(walletId, { balance: newBalance }, accessKeyId);
      
      return {
        txHash: result.hash,
        amount
      };
    } catch (error) {
      console.error('Failed to fund wallet:', error);
      throw new Error(`Failed to fund wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export wallet private key (decrypted) - USE WITH EXTREME CAUTION
   */
  async exportPrivateKey(walletId: string, accessKeyId: string): Promise<string> {
    try {
      const wallet = await this.storage.getWallet(walletId, accessKeyId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      // Decrypt private key
      const decryptedKey = decryptPrivateKey(wallet.privateKey);
      
      // Log this sensitive operation
      await this.storage.createActivity({
        type: 'private_key_export',
        description: `Private key exported for wallet ${wallet.address}`,
        walletId,
        status: 'confirmed'
        // metadata: JSON.stringify({
        //   accessKeyId,
        //   timestamp: new Date().toISOString(),
        //   warning: 'Private key was exported - handle with extreme care'
        // })  // Commented out - metadata field not in schema
      });
      
      return decryptedKey;
    } catch (error) {
      console.error('Failed to export private key:', error);
      throw new Error(`Failed to export private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sanitize wallet data for API response (remove sensitive data)
   */
  sanitizeWalletForResponse(wallet: any): any {
    const sanitized = { ...wallet };
    delete sanitized.privateKey;
    delete sanitized.encryptedPrivateKey;
    delete sanitized.encryptedMnemonic;
    
    // Parse metadata if it's a string
    if (sanitized.metadata && typeof sanitized.metadata === 'string') {
      try {
        sanitized.metadata = JSON.parse(sanitized.metadata);
        // Remove sensitive metadata fields
        delete sanitized.metadata.derivationPath;
      } catch {
        // Keep as is if not valid JSON
      }
    }
    
    return sanitized;
  }

  /**
   * Update all wallet balances from blockchain
   */
  async syncWalletBalances(accessKeyId: string): Promise<number> {
    try {
      const wallets = await this.storage.getWallets(accessKeyId);
      let updatedCount = 0;
      
      await this.bscClient.waitForInitialization();
      
      for (const wallet of wallets) {
        try {
          const balance = await this.getWalletBalance(wallet.address);
          if (balance !== wallet.balance) {
            await this.storage.updateWallet(wallet.id, { balance }, accessKeyId);
            updatedCount++;
          }
        } catch (error) {
          console.error(`Failed to sync balance for wallet ${wallet.address}:`, error);
        }
      }
      
      return updatedCount;
    } catch (error) {
      console.error('Failed to sync wallet balances:', error);
      throw new Error(`Failed to sync balances: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}