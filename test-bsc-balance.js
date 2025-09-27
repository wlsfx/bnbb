#!/usr/bin/env node

// Test script to check BSC testnet connectivity and balance fetching
import { ethers } from 'ethers';

const TEST_ADDRESS = '0xAa82c9c68DEcb5c37844eE5bb5f37de0DD8A7947';
const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545/';

async function testBSCBalance() {
  console.log('🔍 Testing BSC Testnet connectivity and balance fetching...');
  console.log(`📝 Target address: ${TEST_ADDRESS}`);
  console.log(`🌐 RPC URL: ${BSC_TESTNET_RPC}`);
  
  try {
    // Create provider
    const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC, {
      chainId: 97,
      name: 'bsc-testnet'
    });
    
    console.log('✅ Provider created successfully');
    
    // Test network connectivity
    const network = await provider.getNetwork();
    console.log(`🔗 Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
    
    // Get latest block to verify connectivity
    const blockNumber = await provider.getBlockNumber();
    console.log(`📦 Latest block: ${blockNumber}`);
    
    // Get balance
    console.log(`\n💰 Fetching balance for ${TEST_ADDRESS}...`);
    const balanceWei = await provider.getBalance(TEST_ADDRESS);
    const balanceBNB = ethers.formatEther(balanceWei);
    
    console.log(`💎 Balance: ${balanceBNB} tBNB`);
    console.log(`🔢 Balance (wei): ${balanceWei.toString()}`);
    
    // Check if balance matches expected 0.01 tBNB
    const expectedBalance = "0.01";
    if (balanceBNB === expectedBalance) {
      console.log(`✅ SUCCESS: Balance matches expected ${expectedBalance} tBNB`);
    } else {
      console.log(`⚠️  WARNING: Balance ${balanceBNB} tBNB does not match expected ${expectedBalance} tBNB`);
    }
    
    // Get transaction count (nonce) to verify address activity
    const txCount = await provider.getTransactionCount(TEST_ADDRESS);
    console.log(`📊 Transaction count: ${txCount}`);
    
  } catch (error) {
    console.error('❌ Error testing BSC connectivity:', error);
    process.exit(1);
  }
}

// Run the test
testBSCBalance()
  .then(() => {
    console.log('\n🎉 BSC connectivity test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 BSC connectivity test failed:', error);
    process.exit(1);
  });