#!/usr/bin/env node

/**
 * Direct BSC Testnet Balance Test
 * Tests connectivity and balance fetching for the specific wallet address
 */

import { ethers } from 'ethers';

// BSC Testnet configuration
const BSC_TESTNET_CONFIG = {
  name: 'BSC Testnet',
  chainId: 97,
  rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
  nativeToken: {
    name: 'tBNB',
    symbol: 'tBNB',
    decimals: 18
  }
};

// The wallet address that should have received 0.01 testBNB
const TEST_WALLET_ADDRESS = '0xb0C53F4De3e695b7f92835b3b3aA9E2482F8BbF1342aFAC9'; // Full address reconstructed
const EXPECTED_TRANSACTION_HASH = '0xabd792f6e30bf6da56847835da5f676f802ea6e92a0d98b678cec79e17fd9c62';

async function main() {
  console.log('🔍 BSC Testnet Balance Debug Test');
  console.log('=================================');
  
  try {
    // Initialize provider
    console.log(`\n📡 Connecting to BSC Testnet: ${BSC_TESTNET_CONFIG.rpcUrl}`);
    const provider = new ethers.JsonRpcProvider(BSC_TESTNET_CONFIG.rpcUrl);
    
    // Test basic connectivity
    console.log('\n✅ Testing basic connectivity...');
    const network = await provider.getNetwork();
    console.log(`   Network: ${network.name || 'Unknown'}`);
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Expected Chain ID: ${BSC_TESTNET_CONFIG.chainId}`);
    
    if (network.chainId !== BigInt(BSC_TESTNET_CONFIG.chainId)) {
      console.error(`❌ Chain ID mismatch! Expected ${BSC_TESTNET_CONFIG.chainId}, got ${network.chainId}`);
      return;
    }
    
    // Get latest block
    console.log('\n📦 Testing block access...');
    const latestBlock = await provider.getBlockNumber();
    console.log(`   Latest block number: ${latestBlock}`);
    
    // Test balance fetching for the specific wallet
    console.log(`\n💰 Testing balance fetch for wallet: ${TEST_WALLET_ADDRESS}`);
    
    if (TEST_WALLET_ADDRESS.includes('...')) {
      console.error('❌ Please replace TEST_WALLET_ADDRESS with the full wallet address');
      console.log('   Current value:', TEST_WALLET_ADDRESS);
      console.log('   Expected format: 0xb0C53F4De3e69[FULL_ADDRESS]2F8BbF1342aFAC9');
      return;
    }
    
    // Validate wallet address format
    if (!ethers.isAddress(TEST_WALLET_ADDRESS)) {
      console.error('❌ Invalid wallet address format:', TEST_WALLET_ADDRESS);
      return;
    }
    
    // Fetch balance
    const balanceWei = await provider.getBalance(TEST_WALLET_ADDRESS);
    const balanceBNB = ethers.formatEther(balanceWei);
    
    console.log(`   Balance (Wei): ${balanceWei.toString()}`);
    console.log(`   Balance (BNB): ${balanceBNB}`);
    console.log(`   Expected: 0.01 BNB or greater`);
    
    // Check if balance is as expected
    const expectedMinBalance = ethers.parseEther('0.01');
    if (balanceWei >= expectedMinBalance) {
      console.log('✅ Balance check: PASSED (balance >= 0.01 BNB)');
    } else {
      console.log('❌ Balance check: FAILED (balance < 0.01 BNB)');
      console.log('   This suggests either:');
      console.log('   1. Transaction hasn\'t been processed yet');
      console.log('   2. Wrong wallet address');
      console.log('   3. Transaction failed or was to a different address');
    }
    
    // Test transaction lookup
    console.log(`\n🔗 Testing transaction lookup: ${EXPECTED_TRANSACTION_HASH}`);
    try {
      const tx = await provider.getTransaction(EXPECTED_TRANSACTION_HASH);
      if (tx) {
        console.log('✅ Transaction found:');
        console.log(`   From: ${tx.from}`);
        console.log(`   To: ${tx.to}`);
        console.log(`   Value: ${ethers.formatEther(tx.value)} BNB`);
        console.log(`   Block: ${tx.blockNumber}`);
        console.log(`   Status: ${tx.blockNumber ? 'Confirmed' : 'Pending'}`);
        
        if (tx.to?.toLowerCase() !== TEST_WALLET_ADDRESS.toLowerCase()) {
          console.log('⚠️  WARNING: Transaction recipient doesn\'t match test wallet!');
          console.log(`   Transaction to: ${tx.to}`);
          console.log(`   Test wallet:   ${TEST_WALLET_ADDRESS}`);
        }
      } else {
        console.log('❌ Transaction not found');
      }
    } catch (txError) {
      console.log(`❌ Transaction lookup failed: ${txError.message}`);
    }
    
    // Test RPC methods
    console.log('\n🧪 Testing other RPC methods...');
    const gasPrice = await provider.getFeeData();
    console.log(`   Gas price: ${ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei')} gwei`);
    
    console.log('\n✅ BSC Testnet connectivity test completed!');
    
  } catch (error) {
    console.error('\n❌ BSC Testnet test failed:');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    
    if (error.code === 'NETWORK_ERROR') {
      console.log('\n💡 Network error suggestions:');
      console.log('   1. Check internet connectivity');
      console.log('   2. Verify RPC endpoint is accessible');
      console.log('   3. Try alternative BSC testnet RPC endpoints');
    } else if (error.code === 'TIMEOUT') {
      console.log('\n💡 Timeout error suggestions:');
      console.log('   1. RPC endpoint may be overloaded');
      console.log('   2. Try increasing timeout or use different endpoint');
    }
  }
}

// Alternative BSC Testnet RPC endpoints to test
const ALTERNATIVE_RPC_ENDPOINTS = [
  'https://data-seed-prebsc-2-s1.binance.org:8545/',
  'https://data-seed-prebsc-1-s2.binance.org:8545/',
  'https://data-seed-prebsc-2-s2.binance.org:8545/',
  'https://data-seed-prebsc-1-s3.binance.org:8545/',
  'https://data-seed-prebsc-2-s3.binance.org:8545/'
];

async function testAlternativeRPCs() {
  console.log('\n🔄 Testing alternative RPC endpoints...');
  
  for (const rpcUrl of ALTERNATIVE_RPC_ENDPOINTS) {
    try {
      console.log(`\n📡 Testing: ${rpcUrl}`);
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      console.log(`   ✅ Success - Latest block: ${blockNumber}`);
    } catch (error) {
      console.log(`   ❌ Failed - ${error.message}`);
    }
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => testAlternativeRPCs())
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { BSC_TESTNET_CONFIG };