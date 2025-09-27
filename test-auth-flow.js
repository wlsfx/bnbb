// Test the actual auth flow to debug the issue
import { AuthService } from './server/auth-service.js';
import { DbStorage } from './server/storage.js';

async function testAuthFlow() {
  console.log('🔧 Testing authentication flow...');
  
  try {
    // Initialize storage and auth service
    const storage = new DbStorage();
    const authService = new AuthService(storage);
    
    console.log('✅ Storage and AuthService initialized');
    
    // Test getActiveAccessKeys
    console.log('\n📋 Testing getActiveAccessKeys...');
    const activeKeys = await storage.getActiveAccessKeys();
    console.log('Active keys found:', activeKeys.length);
    console.log('Keys:', activeKeys.map(k => ({ 
      id: k.id, 
      name: k.name, 
      role: k.role, 
      keyPreview: k.metadata ? JSON.parse(k.metadata).keyPreview : 'N/A'
    })));
    
    // Test verifyAccessKey
    console.log('\n🔐 Testing verifyAccessKey...');
    const testKey = 'WLSFX-ADM7WWGB2Dm0RuKqMLw';
    const keyVerification = await authService.verifyAccessKey(testKey);
    
    if (keyVerification) {
      console.log('✅ Key verified successfully!');
      console.log('Key details:', {
        id: keyVerification.id,
        name: keyVerification.name,
        role: keyVerification.role
      });
    } else {
      console.log('❌ Key verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error in auth flow test:', error);
  }
}

testAuthFlow();