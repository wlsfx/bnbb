#!/usr/bin/env node

/**
 * Setup script to create initial admin access key for the Stealth Bundler
 * Run this after setting up the database to get your first admin access key
 */

import { DbStorage } from './storage';
import { AuthService } from './auth-service';

async function setupAdminKey() {
  console.log('🔐 Stealth Bundler - Initial Admin Setup');
  console.log('=========================================\n');

  try {
    // Initialize services
    const storage = new DbStorage();
    const authService = new AuthService(storage);

    // Check if admin key already exists
    const existingAdminKeys = await storage.getAccessKeysByRole('admin');
    
    if (existingAdminKeys.length > 0) {
      console.log('⚠️  Admin access keys already exist:');
      existingAdminKeys.forEach(key => {
        console.log(`   - ${key.name} (created: ${key.createdAt})`);
      });
      console.log('\nIf you need a new admin key, please use the admin panel to create one.');
      process.exit(0);
    }

    // Use the specific admin access key
    console.log('📝 Creating initial admin access key...\n');
    
    const accessKey = 'WLSFX-ADM7WWGB2Dm0RuKqMLw';
    const keyHash = await authService.hashAccessKey(accessKey);
    
    // Store the key
    const keyInfo = await storage.createAccessKey({
      name: 'Master Admin Key',
      keyHash,
      role: 'admin',
      metadata: JSON.stringify({
        keyPreview: accessKey.substring(0, 6) + '****' + accessKey.substring(20),
        createdBySetup: true
      })
    });

    // Create audit log
    await storage.createAuditLog({
      action: 'initial_setup',
      accessKeyId: keyInfo.id,
      ipAddress: 'localhost',
      userAgent: 'setup_script',
      details: JSON.stringify({ keyName: 'Master Admin Key' })
    });

    console.log('✅ Admin access key created successfully!\n');
    console.log('========================================');
    console.log('🔑 YOUR ADMIN ACCESS KEY:');
    console.log('');
    console.log(`   ${accessKey}`);
    console.log('');
    console.log('========================================');
    console.log('\n⚠️  IMPORTANT:');
    console.log('1. Save this key securely - it will NOT be shown again');
    console.log('2. Use this key to login at the root (/) of your application');
    console.log('3. Once logged in, you can create additional access keys from the admin panel');
    console.log('4. This key has full admin privileges\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Setup failed:', error);
    console.error('\nPlease ensure:');
    console.error('1. The database is properly configured');
    console.error('2. DATABASE_URL environment variable is set');
    console.error('3. Database migrations have been run');
    process.exit(1);
  }
}

// Run setup if called directly
// Using import.meta.url to check if this module is the main entry point
import { fileURLToPath } from 'url';
import { argv } from 'process';

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  setupAdminKey();
}

export { setupAdminKey };