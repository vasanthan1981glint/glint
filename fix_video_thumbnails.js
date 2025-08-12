// Fix existing videos with missing or invalid thumbnails
// This script will update all videos in Firestore to have proper Firebase Storage thumbnails

import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, updateDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

// Firebase config (replace with your actual config)
const firebaseConfig = {
  // Add your Firebase config here
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Enhanced thumbnail generator
function generateEnhancedThumbnail(videoAssetId) {
  const videoId = videoAssetId.replace('firebase_', '');
  const timestamp = parseInt(videoId) || Date.now();
  
  const date = new Date(timestamp);
  const hour = date.getHours();
  const minute = date.getMinutes();
  const day = date.getDate();
  
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
  
  const themeIndex = (hour + minute + day + videoId.length) % themes.length;
  const theme = themes[themeIndex];
  
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
  
  return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
}

// Upload thumbnail to Firebase Storage
async function uploadThumbnailToFirebase(thumbnailData, videoAssetId) {
  try {
    console.log(`📤 Uploading thumbnail for video ${videoAssetId}...`);
    
    // Convert SVG data URI to blob
    const base64Data = thumbnailData.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/svg+xml' });
    
    // Upload to Firebase Storage
    const timestamp = Date.now();
    const thumbnailRef = ref(storage, `thumbnails/${videoAssetId}_${timestamp}.svg`);
    await uploadBytes(thumbnailRef, blob);
    
    // Get download URL
    const downloadURL = await getDownloadURL(thumbnailRef);
    console.log(`✅ Thumbnail uploaded: ${downloadURL}`);
    
    return downloadURL;
  } catch (error) {
    console.error(`❌ Failed to upload thumbnail for ${videoAssetId}:`, error);
    // Return the original data URI as fallback
    return thumbnailData;
  }
}

// Fix all videos with missing thumbnails
async function fixVideoThumbnails() {
  try {
    console.log('🔄 Starting thumbnail fix process...');
    
    // Get all videos
    const videosSnapshot = await getDocs(collection(db, 'videos'));
    const videos = [];
    
    videosSnapshot.forEach((doc) => {
      const data = doc.data();
      videos.push({ id: doc.id, ...data });
    });
    
    console.log(`📊 Found ${videos.length} videos to check`);
    
    let fixedCount = 0;
    
    for (const video of videos) {
      const needsFix = !video.thumbnailUrl || 
                      video.thumbnailUrl === '' || 
                      video.thumbnailUrl.includes('placeholder') ||
                      video.thumbnailUrl.startsWith('file://') ||
                      video.thumbnailUrl.startsWith('content://');
      
      if (needsFix) {
        console.log(`🔧 Fixing thumbnail for video: ${video.assetId}`);
        
        // Generate new thumbnail
        const thumbnailData = generateEnhancedThumbnail(video.assetId);
        
        // Upload to Firebase Storage
        const firebaseThumbnailUrl = await uploadThumbnailToFirebase(thumbnailData, video.assetId);
        
        // Update video document
        await updateDoc(doc(db, 'videos', video.id), {
          thumbnailUrl: firebaseThumbnailUrl,
          thumbnailType: 'auto',
          thumbnailGenerated: 'firebase',
          thumbnailStorage: 'firebase-storage',
          hasThumbnail: true,
          thumbnailFixed: new Date().toISOString()
        });
        
        // Update post document if it exists
        try {
          await updateDoc(doc(db, 'posts', video.assetId), {
            thumbnailUrl: firebaseThumbnailUrl,
            thumbnailStorage: 'firebase-storage'
          });
        } catch (error) {
          console.log(`⚠️ No post document found for ${video.assetId}`);
        }
        
        fixedCount++;
        console.log(`✅ Fixed thumbnail for video ${video.assetId}`);
      } else {
        console.log(`✅ Video ${video.assetId} already has valid thumbnail`);
      }
    }
    
    console.log(`🎉 Thumbnail fix complete! Fixed ${fixedCount} out of ${videos.length} videos`);
    
  } catch (error) {
    console.error('❌ Error fixing thumbnails:', error);
  }
}

// Export for manual use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fixVideoThumbnails, generateEnhancedThumbnail, uploadThumbnailToFirebase };
} else {
  // Run if called directly
  console.log('🚀 Starting thumbnail fix...');
  fixVideoThumbnails();
}
