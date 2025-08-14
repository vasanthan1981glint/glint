// COMPLETE PERMANENT FIX - Upload ID to Playback ID Conversion
// This handles the Upload ID → Asset ID → Playback ID chain conversion

const RAILWAY_API_URL = 'https://glint-production-b62b.up.railway.app';

// Cache for conversions
const uploadToAssetCache = new Map();
const assetToPlaybackCache = new Map();
const uploadToPlaybackCache = new Map(); // Direct cache

/**
 * Get Asset ID from Upload ID
 */
async function getAssetIdFromUploadId(uploadId) {
  // Check cache first
  if (uploadToAssetCache.has(uploadId)) {
    console.log(`🚀 Upload→Asset cache hit: ${uploadId.substring(0, 20)}...`);
    return uploadToAssetCache.get(uploadId);
  }
  
  try {
    console.log(`🔍 Getting Asset ID for Upload: ${uploadId.substring(0, 20)}...`);
    
    const response = await fetch(`${RAILWAY_API_URL}/api/mux/upload/${uploadId}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      console.log(`❌ Upload API failed: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.upload && data.upload.asset_id) {
      const assetId = data.upload.asset_id;
      console.log(`✅ Upload→Asset: ${uploadId.substring(0, 20)}... → ${assetId.substring(0, 20)}...`);
      
      // Cache the result
      uploadToAssetCache.set(uploadId, assetId);
      return assetId;
    } else {
      console.log(`❌ No Asset ID found for Upload: ${uploadId.substring(0, 20)}...`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error getting Asset ID for Upload ${uploadId.substring(0, 20)}...:`, error);
    return null;
  }
}

/**
 * Get Playback ID from Asset ID
 */
async function getPlaybackIdFromAssetId(assetId) {
  // Check cache first
  if (assetToPlaybackCache.has(assetId)) {
    console.log(`🚀 Asset→Playback cache hit: ${assetId.substring(0, 20)}...`);
    return assetToPlaybackCache.get(assetId);
  }
  
  try {
    console.log(`🔍 Getting Playback ID for Asset: ${assetId.substring(0, 20)}...`);
    
    const response = await fetch(`${RAILWAY_API_URL}/api/mux/asset/${assetId}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      console.log(`❌ Asset API failed: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.asset && data.asset.playback_ids && data.asset.playback_ids.length > 0) {
      // Prefer public playback IDs
      const publicPlaybackId = data.asset.playback_ids.find(p => p.policy === 'public');
      const playbackId = publicPlaybackId ? publicPlaybackId.id : data.asset.playback_ids[0].id;
      
      console.log(`✅ Asset→Playback: ${assetId.substring(0, 20)}... → ${playbackId}`);
      
      // Cache the result
      assetToPlaybackCache.set(assetId, playbackId);
      return playbackId;
    } else {
      console.log(`❌ No Playback IDs found for Asset: ${assetId.substring(0, 20)}...`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error getting Playback ID for Asset ${assetId.substring(0, 20)}...:`, error);
    return null;
  }
}

/**
 * MASTER FUNCTION: Convert Upload ID directly to Playback ID
 */
async function convertUploadIdToPlaybackId(uploadId) {
  // Check direct cache first
  if (uploadToPlaybackCache.has(uploadId)) {
    console.log(`🚀 Direct cache hit: ${uploadId.substring(0, 20)}...`);
    return uploadToPlaybackCache.get(uploadId);
  }
  
  console.log(`🎯 Starting Upload→Playback conversion: ${uploadId.substring(0, 20)}...`);
  
  // Step 1: Get Asset ID from Upload ID
  const assetId = await getAssetIdFromUploadId(uploadId);
  if (!assetId) {
    console.log(`❌ Failed at Upload→Asset step for: ${uploadId.substring(0, 20)}...`);
    return null;
  }
  
  // Step 2: Get Playback ID from Asset ID
  const playbackId = await getPlaybackIdFromAssetId(assetId);
  if (!playbackId) {
    console.log(`❌ Failed at Asset→Playback step for: ${uploadId.substring(0, 20)}...`);
    return null;
  }
  
  // Cache the direct conversion
  uploadToPlaybackCache.set(uploadId, playbackId);
  
  console.log(`✅ Complete conversion: ${uploadId.substring(0, 20)}... → ${playbackId}`);
  return playbackId;
}

/**
 * Convert video URL with Upload ID to working Playback URL
 */
async function convertVideoUrl(originalUrl) {
  console.log(`🔧 Converting URL: ${originalUrl.substring(0, 80)}...`);
  
  // Extract ID from URL
  const idMatch = originalUrl.match(/([a-zA-Z0-9]{40,})/);
  if (!idMatch) {
    console.log('🔍 No ID found in URL');
    return originalUrl;
  }
  
  const id = idMatch[1];
  console.log(`🎯 Extracted ID: ${id.substring(0, 20)}... (${id.length} chars)`);
  
  // Try converting as Upload ID
  const playbackId = await convertUploadIdToPlaybackId(id);
  
  if (playbackId) {
    const fixedUrl = `https://stream.mux.com/${playbackId}.m3u8`;
    console.log(`✅ URL conversion successful!`);
    return fixedUrl;
  } else {
    console.log(`❌ Could not convert URL, keeping original`);
    return originalUrl;
  }
}

/**
 * Detect if an ID is likely an Upload ID vs Asset ID vs Playback ID
 */
function detectIdType(id) {
  if (id.length >= 50) {
    return 'upload_id'; // Upload IDs are typically very long
  } else if (id.length >= 40) {
    return 'asset_id'; // Asset IDs are long but shorter than Upload IDs
  } else if (id.length <= 30) {
    return 'playback_id'; // Playback IDs are shorter
  } else {
    return 'unknown';
  }
}

/**
 * Batch process multiple IDs
 */
async function batchConvertUploadIds(uploadIds) {
  console.log(`🔄 Batch converting ${uploadIds.length} Upload IDs...`);
  
  const results = {};
  const promises = uploadIds.map(async (uploadId) => {
    const playbackId = await convertUploadIdToPlaybackId(uploadId);
    if (playbackId) {
      results[uploadId] = playbackId;
    }
  });
  
  await Promise.all(promises);
  
  console.log(`✅ Batch conversion complete: ${Object.keys(results).length}/${uploadIds.length} successful`);
  return results;
}

/**
 * Clear all caches
 */
function clearAllCaches() {
  uploadToAssetCache.clear();
  assetToPlaybackCache.clear();
  uploadToPlaybackCache.clear();
  console.log('🧹 All caches cleared');
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    uploadToAsset: uploadToAssetCache.size,
    assetToPlayback: assetToPlaybackCache.size,
    uploadToPlayback: uploadToPlaybackCache.size,
    total: uploadToAssetCache.size + assetToPlaybackCache.size + uploadToPlaybackCache.size
  };
}

module.exports = {
  convertUploadIdToPlaybackId,
  convertVideoUrl,
  detectIdType,
  batchConvertUploadIds,
  clearAllCaches,
  getCacheStats
};
