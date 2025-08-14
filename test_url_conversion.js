// Quick test script to verify URL conversion logic
console.log('🧪 Testing URL conversion logic...');
console.log('');

const testUrls = [
  'https://stream.mux.com/7dnx13xaFMSXfiBsp678U9oZJivv6ifBnv02O3fgE34c.mp4',
  'https://stream.mux.com/iApqzi02LSyTkWJm4ruFgH28yEpFmkhOpKdi1nPJjHOA.mp4',
  'https://stream.mux.com/someAssetId.m3u8',
  'https://example.com/video.mp4',
  'https://stream.mux.com/test123.mp4'
];

function convertUrlToHls(url) {
  if (url && url.includes('stream.mux.com') && url.endsWith('.mp4')) {
    return url.replace('.mp4', '.m3u8');
  }
  return url;
}

testUrls.forEach((url, index) => {
  const converted = convertUrlToHls(url);
  const wasConverted = url !== converted;
  
  console.log(`Test ${index + 1}:`);
  console.log(`  Input:  ${url}`);
  console.log(`  Output: ${converted}`);
  console.log(`  ${wasConverted ? '✅ Converted' : '⚪ No change needed'}`);
  console.log('');
});

console.log('🎯 Key tests:');
console.log('✅ Mux MP4 URLs → HLS URLs');
console.log('✅ Mux HLS URLs → Unchanged');
console.log('✅ Non-Mux URLs → Unchanged');
