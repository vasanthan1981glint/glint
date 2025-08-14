// Complete Video System Fix
// This comprehensive script addresses all video playback issues identified

const RAILWAY_API_URL = 'https://glint-production-b62b.up.railway.app';

// Known problematic uploads that need Asset ID correction
const problemUploads = [
  {
    uploadId: 'yF7df1c9tEPRUiDJFtkeZdeOyZqIX00oJQEhRs64fTe4',
    actualAssetId: 'OyW2BJCnZCfkk8v54GAQLG7dSviw5GGdqiSiO9I7hJs'
  },
  {
    uploadId: 'jOYrW01xoAW2aFhI0000wKLC31rZ4QNRFQwUlfDtfqcvo8', 
    actualAssetId: 'w7rVemuEUYFjnHe501q1YM8poMLrJhbGrI01uXkxh7WeI'
  },
  {
    uploadId: 't3V7ny19JXL7nzhGTfUkmK5axoPWqdl1WPwOgc7aagM',
    actualAssetId: 'brUgO02kARoyfrdVhvd02QA00GDp00j0196B2zVyOwibiqhg'  
  }
];

// Step 1: Check system health
async function checkSystemHealth() {
  console.log('🏥 Checking system health...');
  
  try {
    const response = await fetch(`${RAILWAY_API_URL}/health`);
    const data = await response.json();
    
    console.log('✅ Backend Health:', data);
    
    if (!data.mux_configured && !data.muxEnabled) {
      console.error('❌ Mux is not properly configured in backend');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Backend health check failed:', error);
    return false;
  }
}

// Step 2: Check if assets exist and their status
async function checkAssetStatus(assetId) {
  console.log(`🔍 Checking status of asset: ${assetId}`);
  
  try {
    const response = await fetch(`${RAILWAY_API_URL}/api/mux/asset/${assetId}`);
    
    if (!response.ok) {
      console.log(`❌ Asset ${assetId} not accessible: ${response.status}`);
      return { exists: false, status: 'not_found' };
    }
    
    const data = await response.json();
    const status = data.asset?.status || 'unknown';
    const playbackIds = data.asset?.playback_ids || [];
    
    console.log(`📊 Asset ${assetId} status: ${status}`);
    
    return {
      exists: true,
      status: status,
      playbackIds: playbackIds,
      asset: data.asset
    };
    
  } catch (error) {
    console.error(`❌ Error checking asset ${assetId}:`, error);
    return { exists: false, status: 'error' };
  }
}

// Step 3: Get or create working playback ID
async function getWorkingPlaybackId(assetId) {
  const assetStatus = await checkAssetStatus(assetId);
  
  if (!assetStatus.exists) {
    console.log(`❌ Asset ${assetId} does not exist`);
    return null;
  }
  
  if (assetStatus.status === 'errored') {
    console.log(`❌ Asset ${assetId} is in errored state - needs re-upload`);
    return null;
  }
  
  if (assetStatus.status === 'ready' && assetStatus.playbackIds.length > 0) {
    const playbackId = assetStatus.playbackIds[0].id;
    console.log(`✅ Asset ${assetId} is ready with playback ID: ${playbackId}`);
    return playbackId;
  }
  
  if (assetStatus.status === 'preparing') {
    console.log(`⏳ Asset ${assetId} is still preparing...`);
    return null;
  }
  
  console.log(`❓ Asset ${assetId} has unknown status: ${assetStatus.status}`);
  return null;
}

// Step 4: Create new asset from working video if needed
async function createNewAssetFromVideo(originalUploadId) {
  console.log(`🆕 Creating new asset for upload: ${originalUploadId}`);
  
  try {
    const response = await fetch(`${RAILWAY_API_URL}/api/videos/${originalUploadId}/recreate-asset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.log(`❌ Failed to recreate asset for ${originalUploadId}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`✅ New asset created: ${data.assetId}`);
    return data.assetId;
    
  } catch (error) {
    console.error(`❌ Error creating new asset for ${originalUploadId}:`, error);
    return null;
  }
}

// Step 5: Update video with correct asset information
async function updateVideoAsset(uploadId, correctAssetId, playbackId) {
  console.log(`🔄 Updating video ${uploadId} with asset ${correctAssetId}`);
  
  try {
    const response = await fetch(`${RAILWAY_API_URL}/api/videos/${uploadId}/fix-asset`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        correctAssetId: correctAssetId,
        playbackId: playbackId,
        playbackUrl: `https://stream.mux.com/${playbackId}.m3u8`
      })
    });
    
    if (!response.ok) {
      console.log(`❌ Failed to update video ${uploadId}: ${response.status}`);
      return false;
    }
    
    console.log(`✅ Successfully updated video ${uploadId}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error updating video ${uploadId}:`, error);
    return false;
  }
}

// Step 6: Update emergency fix mapping with working playback IDs
async function updateEmergencyFix(assetToPlaybackMap) {
  console.log('🚨 Updating emergency fix mapping...');
  
  const emergencyFixContent = `// Emergency Video Fix - Auto-generated mapping
// This file provides a temporary fix for videos with incorrect Asset IDs

export const ASSET_TO_PLAYBACK_MAP: Record<string, string> = {
${Object.entries(assetToPlaybackMap).map(([assetId, playbackId]) => 
  `  '${assetId}': '${playbackId}',`
).join('\n')}
};

export function fixVideoUrl(originalUrl: string): string {
  // Extract Asset ID from URL patterns
  const assetIdMatch = originalUrl.match(/([a-zA-Z0-9]{32,})/);
  if (!assetIdMatch) {
    console.log('🔍 No Asset ID found in URL:', originalUrl);
    return originalUrl;
  }
  
  const assetId = assetIdMatch[1];
  const correctPlaybackId = ASSET_TO_PLAYBACK_MAP[assetId];
  
  if (correctPlaybackId) {
    const fixedUrl = \`https://stream.mux.com/\${correctPlaybackId}.m3u8\`;
    console.log('🔧 Emergency fix applied:', { original: originalUrl, fixed: fixedUrl });
    return fixedUrl;
  }
  
  console.log('🔍 No emergency fix mapping found for Asset ID:', assetId);
  return originalUrl;
}

// Auto-generated on: ${new Date().toISOString()}
// Total mappings: ${Object.keys(assetToPlaybackMap).length}
`;

  try {
    // Write to TypeScript file
    require('fs').writeFileSync('/Users/ganesanaathmanathan/glint/lib/emergencyVideoFix.ts', emergencyFixContent);
    console.log('✅ Emergency fix mapping updated');
    return true;
  } catch (error) {
    console.error('❌ Failed to update emergency fix:', error);
    return false;
  }
}

// Main fix function
async function fixEverything() {
  console.log('🚀 Starting Complete Video System Fix...');
  console.log(`🔗 Backend URL: ${RAILWAY_API_URL}`);
  
  // Step 1: Check system health
  const isHealthy = await checkSystemHealth();
  if (!isHealthy) {
    console.error('❌ System health check failed. Cannot proceed.');
    return;
  }
  
  const fixedMappings = {};
  const failedFixes = [];
  
  // Step 2: Process each problematic upload
  for (const item of problemUploads) {
    console.log(`\n📹 Processing: ${item.uploadId}`);
    console.log(`🎯 Target Asset: ${item.actualAssetId}`);
    
    // Check if the asset is working
    let workingPlaybackId = await getWorkingPlaybackId(item.actualAssetId);
    
    if (!workingPlaybackId) {
      console.log(`🔄 Asset ${item.actualAssetId} not ready, attempting to recreate...`);
      
      // Try to create a new asset
      const newAssetId = await createNewAssetFromVideo(item.uploadId);
      if (newAssetId) {
        // Wait a bit for processing to start
        await new Promise(resolve => setTimeout(resolve, 5000));
        workingPlaybackId = await getWorkingPlaybackId(newAssetId);
        
        if (workingPlaybackId) {
          // Update the actual asset ID to the new one
          item.actualAssetId = newAssetId;
        }
      }
    }
    
    if (workingPlaybackId) {
      // Update the video with correct asset information
      const success = await updateVideoAsset(item.uploadId, item.actualAssetId, workingPlaybackId);
      
      if (success) {
        fixedMappings[item.actualAssetId] = workingPlaybackId;
        console.log(`✅ Fixed: ${item.uploadId} → ${item.actualAssetId} (${workingPlaybackId})`);
      } else {
        failedFixes.push(item);
      }
    } else {
      console.log(`❌ Could not get working playback ID for ${item.uploadId}`);
      failedFixes.push(item);
    }
    
    // Delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Step 3: Update emergency fix with working mappings
  if (Object.keys(fixedMappings).length > 0) {
    await updateEmergencyFix(fixedMappings);
  }
  
  // Step 4: Report results
  console.log('\n📊 Fix Results:');
  console.log(`✅ Successfully fixed: ${Object.keys(fixedMappings).length} videos`);
  console.log(`❌ Failed to fix: ${failedFixes.length} videos`);
  
  if (failedFixes.length > 0) {
    console.log('\n❌ Failed fixes:');
    failedFixes.forEach(item => {
      console.log(`  - ${item.uploadId} (${item.actualAssetId})`);
    });
    console.log('\n💡 These videos may need manual re-upload with fresh video files');
  }
  
  console.log('\n🎉 Complete video system fix finished!');
  console.log('📱 Restart your app to see the changes');
  
  if (Object.keys(fixedMappings).length > 0) {
    console.log('🚨 Emergency fix mapping is now active with working Playback IDs');
  }
}

// Run the complete fix
fixEverything().catch(console.error);
