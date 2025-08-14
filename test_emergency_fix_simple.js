// Test the emergency video fix - Node.js version
const ASSET_TO_PLAYBACK_MAP = {
  'yF7df1c9tEPRUiDJFtkeZdeOyZqIX00oJQEhRs64fTe4': '99BTIBmdTI4ku34qvneLGF8JcvGEGW01QLIabzMHzeYM',
  'jOYrW01xoAW2aFhI0000wKLC31rZ4QNRFQwUlfDtfqcvo8': 'y7eD79sxoZFquh4p00SVMvAOA02hDjPZ7qe01NxgGeAiIc', 
  't3V7ny19JXL7nzhGTfUkmK5axoPWqdl1WPwOgc7aagM': 'UoNvdXszRp15wxKod00rGRpjq00Wj8P7qKjB2022chbOsQ'
};

function fixVideoUrl(assetId, originalUrl) {
  if (ASSET_TO_PLAYBACK_MAP[assetId]) {
    const playbackId = ASSET_TO_PLAYBACK_MAP[assetId];
    const fixedUrl = `https://stream.mux.com/${playbackId}.m3u8`;
    console.log(`🔧 Emergency fix applied: ${assetId} → ${playbackId}`);
    console.log(`   Original URL: ${originalUrl}`);
    console.log(`   Fixed URL: ${fixedUrl}`);
    return fixedUrl;
  }
  return originalUrl;
}

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
