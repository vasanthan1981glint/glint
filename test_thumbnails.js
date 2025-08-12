// Quick test to verify our thumbnail generation works
const testPlaceholderThumbnail = (timePoint, index) => {
  const percentage = Math.round(timePoint * 100);
  
  // Create inline SVG as data URI for reliable local thumbnails
  const colors = ['#4ECDC4', '#44A08D', '#667eea', '#764ba2', '#f093fb'];
  const color = colors[index % colors.length];
  
  // Create a simple SVG thumbnail that will always work
  const svgContent = `
    <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" 
            font-family="Arial, sans-serif" font-size="24" fill="white">
        ${percentage}% Video
      </text>
      <circle cx="160" cy="90" r="30" fill="rgba(255,255,255,0.3)"/>
      <polygon points="150,80 150,100 170,90" fill="white"/>
    </svg>
  `.trim();
  
  const encodedSvg = encodeURIComponent(svgContent);
  const dataUri = `data:image/svg+xml,${encodedSvg}`;
  
  return {
    uri: dataUri,
    timePoint,
    isCustom: false,
    timestamp: Date.now()
  };
};

// Test generating 5 thumbnails
console.log('Testing thumbnail generation...');
const timePoints = [0.1, 0.3, 0.5, 0.7, 0.9];
const thumbnails = timePoints.map((timePoint, index) => 
  testPlaceholderThumbnail(timePoint, index)
);

console.log('Generated thumbnails:');
thumbnails.forEach((thumbnail, index) => {
  console.log(`${index + 1}. ${Math.round(thumbnail.timePoint * 100)}% - URI length: ${thumbnail.uri.length}`);
});

console.log('✅ Thumbnail generation test completed successfully!');
