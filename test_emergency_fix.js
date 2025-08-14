// Test the emergency video fix
import { fixVideoUrl } from './lib/emergencyVideoFix';

console.log('🧪 Testing Emergency Video Fix...');

const testCases = [
  {
    assetId: 'jOYrW01xoAW2aFhI0000wKLC31rZ4QNRFQwUlfDtfqcvo8',
    originalUrl: 'https://stream.mux.com/jOYrW01xoAW2aFhI0000wKLC31rZ4QNRFQwUlfDtfqcvo8.m3u8'
  },
  {
    assetId: 'unknown-asset-id',
    originalUrl: 'https://stream.mux.com/unknown-asset-id.m3u8'
  }
];

testCases.forEach(test => {
  console.log(`\n📹 Testing: ${test.assetId}`);
  const result = fixVideoUrl(test.assetId, test.originalUrl);
  console.log(`   Original: ${test.originalUrl}`);
  console.log(`   Fixed: ${result}`);
  console.log(`   Changed: ${result !== test.originalUrl}`);
});

console.log('\n✅ Emergency fix test complete!');
