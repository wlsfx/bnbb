import bcrypt from 'bcrypt';

// The key we're trying to verify
const testKey = 'WLSFX-ADM7WWGB2Dm0RuKqMLw';

// The stored hash from the database
const storedHash = '$2b$10$XRrR.HSzOdIn5Alqkq/YWeH5EuTc5L5BYuRY/GGv3/6ohIjWW6zEi';

console.log('Testing BCrypt verification...');
console.log('Key to test:', testKey);
console.log('Stored hash:', storedHash);

bcrypt.compare(testKey, storedHash)
  .then(result => {
    console.log('BCrypt comparison result:', result);
    if (result) {
      console.log('✅ Key matches the stored hash!');
    } else {
      console.log('❌ Key does NOT match the stored hash');
      
      // Let's also generate what the hash should be for this key
      return bcrypt.hash(testKey, 10);
    }
  })
  .then(newHash => {
    if (newHash) {
      console.log('Expected hash for this key:', newHash);
    }
  })
  .catch(error => {
    console.error('Error during verification:', error);
  });