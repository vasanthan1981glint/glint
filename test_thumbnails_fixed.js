// Test Enhanced Thumbnail Service
// Run this with: node test_thumbnails_fixed.js

const fs = require('fs');

// Simulate the thumbnail generation logic
function generateRandomVideoThumbnail(videoAssetId) {
  const videoId = videoAssetId.replace('firebase_', '');
  const timestamp = parseInt(videoId) || Date.now();
  
  // Create variety based on timestamp and video characteristics
  const date = new Date(timestamp);
  const hour = date.getHours();
  const minute = date.getMinutes();
  const day = date.getDate();
  
  // Enhanced themes with better branding
  const themes = [
    { bg: '1ABC9C', fg: 'FFFFFF', icon: '🔥', text: 'Smart Auto', gradient: '16A085' },
    { bg: 'E74C3C', fg: 'FFFFFF', icon: '✨', text: 'AI Generated', gradient: 'C0392B' },
    { bg: '3498DB', fg: 'FFFFFF', icon: '🚀', text: 'Auto Thumbnail', gradient: '2980B9' },
    { bg: '9B59B6', fg: 'FFFFFF', icon: '💎', text: 'Smart Design', gradient: '8E44AD' },
    { bg: 'F39C12', fg: 'FFFFFF', icon: '🎬', text: 'Video Thumb', gradient: 'E67E22' },
    { bg: '2ECC71', fg: 'FFFFFF', icon: '🌟', text: 'Fresh Content', gradient: '27AE60' },
    { bg: '34495E', fg: 'FFFFFF', icon: '⚡', text: 'Quick Upload', gradient: '2C3E50' },
    { bg: 'E67E22', fg: 'FFFFFF', icon: '🎯', text: 'Perfect Shot', gradient: 'D35400' }
  ];
  
  // Select theme based on multiple factors for more variety
  const themeIndex = (hour + minute + day + videoId.length) % themes.length;
  const theme = themes[themeIndex];
  
  // Create enhanced SVG with gradient and better styling
  const svgContent = `
    <svg width="640" height="360" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#${theme.bg};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#${theme.gradient};stop-opacity:0.9" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.3)"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#bgGradient)"/>
      <circle cx="320" cy="180" r="50" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
      <text x="50%" y="35%" text-anchor="middle" dy=".3em" 
            font-family="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" 
            font-size="36" font-weight="600" fill="#${theme.fg}" filter="url(#shadow)">
        ${theme.icon}
      </text>
      <text x="50%" y="55%" text-anchor="middle" dy=".3em" 
            font-family="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" 
            font-size="16" font-weight="500" fill="#${theme.fg}" opacity="0.95">
        ${theme.text}
      </text>
      <text x="50%" y="70%" text-anchor="middle" dy=".3em" 
            font-family="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" 
            font-size="12" font-weight="400" fill="#${theme.fg}" opacity="0.8">
        Powered by AI
      </text>
      <polygon points="295,165 295,195 325,180" fill="white" opacity="0.9"/>
    </svg>
  `.trim();
  
  const encodedSvg = encodeURIComponent(svgContent);
  const thumbnailUrl = `data:image/svg+xml,${encodedSvg}`;
  
  console.log(`🎨 Enhanced auto thumbnail for ${videoAssetId}: ${theme.text}`);
  return { thumbnailUrl, theme, svgContent };
}

// Test the function
console.log('🧪 Testing Enhanced Thumbnail Generation...\n');

const testAssets = [
  'firebase_1234567890',
  'firebase_9876543210', 
  'firebase_5555555555',
  'test_video_001',
  'mux_asset_abc123'
];

testAssets.forEach((assetId, index) => {
  console.log(`\n--- Test ${index + 1}: ${assetId} ---`);
  const result = generateRandomVideoThumbnail(assetId);
  
  console.log('Theme:', result.theme.text, result.theme.icon);
  console.log('Colors:', `#${result.theme.bg} -> #${result.theme.gradient}`);
  console.log('URL Length:', result.thumbnailUrl.length);
  console.log('URL Preview:', result.thumbnailUrl.substring(0, 100) + '...');
  
  // Save SVG to file for testing
  const filename = `thumbnail_test_${index + 1}.svg`;
  fs.writeFileSync(filename, result.svgContent);
  console.log(`✅ SVG saved as: ${filename}`);
});

console.log('\n🎉 Thumbnail generation test complete!');
console.log('📁 Check the generated .svg files to verify thumbnails look correct.');
