// Simple thumbnail debugging and fixing script for React Native
// This can be run in the app to check and fix thumbnail issues

export const debugAndFixThumbnails = async () => {
  try {
    console.log('🔍 Starting thumbnail debugging...');
    
    // Import Firebase services
    const { collection, getDocs, updateDoc, doc } = require('firebase/firestore');
    const { db } = require('../firebaseConfig');
    
    // Get all videos from Firestore
    const videosQuery = collection(db, 'videos');
    const videosSnapshot = await getDocs(videosQuery);
    
    console.log(`📊 Found ${videosSnapshot.size} videos in database`);
    
    const issues = [];
    const fixes = [];
    
    for (const videoDoc of videosSnapshot.docs) {
      const data = videoDoc.data();
      const assetId = data.assetId || videoDoc.id;
      const thumbnailUrl = data.thumbnailUrl;
      
      console.log(`\n📹 Video: ${assetId}`);
      console.log(`🖼️ Thumbnail URL: ${thumbnailUrl}`);
      console.log(`📊 Has thumbnail: ${data.hasThumbnail}`);
      console.log(`🔧 Thumbnail type: ${data.thumbnailType}`);
      
      // Check for issues
      const hasIssue = !thumbnailUrl || 
                      thumbnailUrl === '' || 
                      thumbnailUrl.startsWith('file://') ||
                      thumbnailUrl.startsWith('content://') ||
                      thumbnailUrl.includes('placeholder');
      
      if (hasIssue) {
        console.log(`❌ Issue found with video ${assetId}`);
        issues.push({ id: videoDoc.id, assetId, issue: 'Invalid thumbnail URL' });
        
        // Generate a new thumbnail
        const newThumbnail = generateQuickThumbnail(assetId);
        
        try {
          await updateDoc(doc(db, 'videos', videoDoc.id), {
            thumbnailUrl: newThumbnail,
            thumbnailType: 'auto',
            thumbnailGenerated: 'fallback',
            hasThumbnail: true,
            thumbnailFixed: new Date().toISOString()
          });
          
          console.log(`✅ Fixed thumbnail for video ${assetId}`);
          fixes.push({ assetId, newThumbnail });
          
        } catch (error) {
          console.error(`❌ Failed to fix video ${assetId}:`, error);
        }
      } else {
        console.log(`✅ Video ${assetId} has valid thumbnail`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`Total videos: ${videosSnapshot.size}`);
    console.log(`Issues found: ${issues.length}`);
    console.log(`Fixed: ${fixes.length}`);
    
    return { total: videosSnapshot.size, issues, fixes };
    
  } catch (error) {
    console.error('❌ Error debugging thumbnails:', error);
    return null;
  }
};

// Generate a quick fallback thumbnail
const generateQuickThumbnail = (assetId) => {
  const videoId = assetId.replace('firebase_', '');
  const timestamp = parseInt(videoId) || Date.now();
  
  const styles = [
    { bg: '1ABC9C', icon: '🎬', text: 'Video' },
    { bg: 'E74C3C', icon: '💎', text: 'Content' },
    { bg: '3498DB', icon: '⚡', text: 'Media' },
    { bg: '9B59B6', icon: '🌟', text: 'Clip' },
    { bg: 'F39C12', icon: '🔮', text: 'Upload' },
    { bg: '2ECC71', icon: '🎪', text: 'Video' },
    { bg: '8E44AD', icon: '🎯', text: 'Share' },
    { bg: '16A085', icon: '🎊', text: 'Glint' }
  ];
  
  const style = styles[Math.abs(timestamp) % styles.length];
  
  const svgContent = `
    <svg width="640" height="360" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad${timestamp}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#${style.bg};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#${style.bg};stop-opacity:0.8" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad${timestamp})"/>
      <circle cx="320" cy="180" r="50" fill="rgba(255,255,255,0.2)"/>
      <text x="320" y="150" text-anchor="middle" font-family="Arial" font-size="36" fill="white">${style.icon}</text>
      <text x="320" y="200" text-anchor="middle" font-family="Arial" font-size="18" fill="white">${style.text}</text>
      <polygon points="300,170 300,190 325,180" fill="white"/>
    </svg>
  `;
  
  return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
};

// Quick fix function that can be called from anywhere in the app
export const quickFixThumbnails = async () => {
  const result = await debugAndFixThumbnails();
  if (result) {
    console.log('🎉 Thumbnail fix complete!');
    return result.fixes.length;
  }
  return 0;
};

console.log('🛠️ Thumbnail debugging utilities loaded');
console.log('📱 Call debugAndFixThumbnails() or quickFixThumbnails() to fix thumbnails');
