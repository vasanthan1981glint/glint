// Immediate Thumbnail Fix Utility
// Add this to any component and call fixThumbnailsNow() to fix all videos

import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Generate beautiful fallback thumbnail
const generateBeautifulThumbnail = (assetId) => {
  const videoId = assetId.replace('firebase_', '');
  const timestamp = parseInt(videoId) || Date.now();
  
  // Create variety based on video ID
  const themes = [
    { bg: '1ABC9C', icon: '🎬', text: 'My Video', accent: '16A085' },
    { bg: 'E74C3C', icon: '✨', text: 'Content', accent: 'C0392B' },
    { bg: '3498DB', icon: '🚀', text: 'Glint', accent: '2980B9' },
    { bg: '9B59B6', icon: '💎', text: 'Upload', accent: '8E44AD' },
    { bg: 'F39C12', icon: '🌟', text: 'Media', accent: 'E67E22' },
    { bg: '2ECC71', icon: '🎪', text: 'Video', accent: '27AE60' },
    { bg: '34495E', icon: '⚡', text: 'Share', accent: '2C3E50' },
    { bg: 'E67E22', icon: '🎯', text: 'Clip', accent: 'D35400' }
  ];
  
  const theme = themes[Math.abs(timestamp) % themes.length];
  
  const svgContent = `
    <svg width="640" height="360" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad${timestamp}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#${theme.bg};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#${theme.accent};stop-opacity:0.8" />
        </linearGradient>
        <filter id="shadow${timestamp}">
          <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.3)"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad${timestamp})"/>
      <circle cx="320" cy="180" r="60" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
      <text x="320" y="130" text-anchor="middle" font-family="system-ui, Arial" font-size="48" font-weight="600" fill="white" filter="url(#shadow${timestamp})">${theme.icon}</text>
      <text x="320" y="200" text-anchor="middle" font-family="system-ui, Arial" font-size="20" font-weight="500" fill="white" opacity="0.95">${theme.text}</text>
      <text x="320" y="225" text-anchor="middle" font-family="system-ui, Arial" font-size="14" font-weight="400" fill="white" opacity="0.8">Tap to Play</text>
      <circle cx="320" cy="280" r="25" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
      <polygon points="310,270 310,290 335,280" fill="#${theme.bg}"/>
    </svg>
  `;
  
  return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
};

// Fix all videos with invalid thumbnails
export const fixThumbnailsNow = async () => {
  try {
    console.log('🔧 Starting immediate thumbnail fix...');
    
    // Get all videos
    const videosSnapshot = await getDocs(collection(db, 'videos'));
    
    let fixedCount = 0;
    const totalCount = videosSnapshot.size;
    
    console.log(`📊 Found ${totalCount} videos to check`);
    
    for (const videoDoc of videosSnapshot.docs) {
      const data = videoDoc.data();
      const assetId = data.assetId || videoDoc.id;
      const currentThumbnail = data.thumbnailUrl;
      
      // Check if thumbnail needs fixing
      const needsFix = !currentThumbnail || 
                      currentThumbnail === '' || 
                      currentThumbnail.startsWith('file://') ||
                      currentThumbnail.startsWith('content://') ||
                      currentThumbnail.includes('placeholder') ||
                      currentThumbnail.includes('via.placeholder.com');
      
      if (needsFix) {
        console.log(`🔄 Fixing thumbnail for video: ${assetId}`);
        
        // Generate new beautiful thumbnail
        const newThumbnail = generateBeautifulThumbnail(assetId);
        
        // Update video document
        await updateDoc(doc(db, 'videos', videoDoc.id), {
          thumbnailUrl: newThumbnail,
          thumbnailType: 'auto',
          thumbnailGenerated: 'enhanced',
          hasThumbnail: true,
          thumbnailFixed: new Date().toISOString(),
          thumbnailSource: 'svg-generated'
        });
        
        // Try to update post document too
        try {
          await updateDoc(doc(db, 'posts', assetId), {
            thumbnailUrl: newThumbnail,
            thumbnailSource: 'svg-generated'
          });
        } catch (error) {
          // Post document might not exist, that's okay
        }
        
        fixedCount++;
        console.log(`✅ Fixed thumbnail for ${assetId}`);
      } else {
        console.log(`✅ Video ${assetId} already has valid thumbnail`);
      }
    }
    
    console.log(`🎉 Thumbnail fix complete!`);
    console.log(`📊 Total videos: ${totalCount}`);
    console.log(`🔧 Fixed: ${fixedCount}`);
    console.log(`✅ Valid: ${totalCount - fixedCount}`);
    
    return { total: totalCount, fixed: fixedCount };
    
  } catch (error) {
    console.error('❌ Error fixing thumbnails:', error);
    throw error;
  }
};

// Quick check function
export const checkThumbnailStatus = async () => {
  try {
    const videosSnapshot = await getDocs(collection(db, 'videos'));
    
    let validCount = 0;
    let invalidCount = 0;
    
    for (const videoDoc of videosSnapshot.docs) {
      const data = videoDoc.data();
      const thumbnail = data.thumbnailUrl;
      
      if (!thumbnail || thumbnail === '' || thumbnail.startsWith('file://') || thumbnail.includes('placeholder')) {
        invalidCount++;
        console.log(`❌ Invalid: ${data.assetId} - ${thumbnail}`);
      } else {
        validCount++;
        console.log(`✅ Valid: ${data.assetId} - ${thumbnail?.substring(0, 50)}...`);
      }
    }
    
    console.log(`📊 Thumbnail Status: ${validCount} valid, ${invalidCount} invalid`);
    return { valid: validCount, invalid: invalidCount };
    
  } catch (error) {
    console.error('❌ Error checking thumbnail status:', error);
    return null;
  }
};

console.log('🛠️ Thumbnail fix utilities loaded!');
console.log('📱 Call fixThumbnailsNow() to fix all invalid thumbnails');
console.log('🔍 Call checkThumbnailStatus() to check current status');
