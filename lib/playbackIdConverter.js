// PERMANENT FIX - Auto Playback ID Retrieval System
// This system automatically converts Asset IDs to Playback IDs in real-time

const RAILWAY_API_URL = 'https://glint-production-b62b.up.railway.app';

// Cache for Asset ID → Playback ID mappings to avoid repeated API calls
const playbackIdCache = new Map();

// Queue to prevent duplicate requests for the same asset
const pendingRequests = new Map();

/**
 * Get correct Playback ID for an Asset ID from Mux backend
 */
async function getPlaybackIdForAsset(assetId) {
  // Check cache first
  if (playbackIdCache.has(assetId)) {
    console.log(`🚀 Cache hit for Asset ID: ${assetId.substring(0, 20)}...`);
    return playbackIdCache.get(assetId);
  }
  
  // Check if request is already pending
  if (pendingRequests.has(assetId)) {
    console.log(`⏳ Request already pending for Asset ID: ${assetId.substring(0, 20)}...`);
    return await pendingRequests.get(assetId);
  }
  
  // Create new request
  const requestPromise = fetchPlaybackIdFromBackend(assetId);
  pendingRequests.set(assetId, requestPromise);
  
  try {
    const playbackId = await requestPromise;
    
    // Cache the result
    if (playbackId) {
      playbackIdCache.set(assetId, playbackId);
      console.log(`✅ Cached mapping: ${assetId.substring(0, 20)}... → ${playbackId}`);
    }
    
    return playbackId;
  } finally {
    // Clean up pending request
    pendingRequests.delete(assetId);
  }
}

/**
 * Fetch Playback ID from Railway backend
 */
async function fetchPlaybackIdFromBackend(assetId) {
  try {
    console.log(`🔍 Fetching Playback ID for Asset: ${assetId.substring(0, 20)}...`);
    
    const response = await fetch(`${RAILWAY_API_URL}/api/mux/asset/${assetId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000 // 10 second timeout
    });
    
    if (!response.ok) {
      console.log(`❌ Backend request failed: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.asset && data.asset.playback_ids && data.asset.playback_ids.length > 0) {
      const playbackId = data.asset.playback_ids[0].id;
      console.log(`✅ Retrieved Playback ID: ${assetId.substring(0, 20)}... → ${playbackId}`);
      return playbackId;
    } else {
      console.log(`❌ No playback IDs found for Asset: ${assetId.substring(0, 20)}...`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error fetching Playback ID for ${assetId.substring(0, 20)}...:`, error);
    return null;
  }
}

/**
 * Convert Asset ID URL to Playback ID URL
 */
async function convertAssetUrlToPlaybackUrl(originalUrl) {
  console.log(`🔧 Converting URL: ${originalUrl}`);
  
  // Extract Asset ID from URL
  const assetIdMatch = originalUrl.match(/([a-zA-Z0-9]{32,})/);
  if (!assetIdMatch) {
    console.log('🔍 No Asset ID found in URL');
    return originalUrl;
  }
  
  const assetId = assetIdMatch[1];
  
  // Check if this looks like an Asset ID (longer format)
  if (assetId.length < 40) {
    console.log(`🔍 ID too short (${assetId.length} chars), likely already a Playback ID`);
    return originalUrl;
  }
  
  console.log(`🎯 Converting Asset ID: ${assetId.substring(0, 20)}...`);
  
  // Get the correct Playback ID
  const playbackId = await getPlaybackIdForAsset(assetId);
  
  if (playbackId) {
    const fixedUrl = `https://stream.mux.com/${playbackId}.m3u8`;
    console.log(`✅ URL converted: ${originalUrl} → ${fixedUrl}`);
    return fixedUrl;
  } else {
    console.log(`❌ Could not convert URL, keeping original: ${originalUrl}`);
    return originalUrl;
  }
}

/**
 * Batch convert multiple Asset IDs (for efficiency)
 */
async function batchConvertAssetIds(assetIds) {
  console.log(`🔄 Batch converting ${assetIds.length} Asset IDs...`);
  
  const results = {};
  const promises = assetIds.map(async (assetId) => {
    const playbackId = await getPlaybackIdForAsset(assetId);
    if (playbackId) {
      results[assetId] = playbackId;
    }
  });
  
  await Promise.all(promises);
  
  console.log(`✅ Batch conversion complete: ${Object.keys(results).length}/${assetIds.length} successful`);
  return results;
}

/**
 * Check if URL contains Asset ID instead of Playback ID
 */
function isAssetIdUrl(url) {
  const idMatch = url.match(/([a-zA-Z0-9]{32,})/);
  if (!idMatch) return false;
  
  const id = idMatch[1];
  // Asset IDs are typically longer than Playback IDs
  return id.length >= 40;
}

/**
 * Clear cache (useful for debugging)
 */
function clearPlaybackIdCache() {
  playbackIdCache.clear();
  console.log('🧹 Playback ID cache cleared');
}

/**
 * Get cache status
 */
function getCacheStatus() {
  return {
    size: playbackIdCache.size,
    entries: Array.from(playbackIdCache.entries()).map(([assetId, playbackId]) => ({
      assetId: assetId.substring(0, 20) + '...',
      playbackId
    }))
  };
}

module.exports = {
  getPlaybackIdForAsset,
  convertAssetUrlToPlaybackUrl,
  batchConvertAssetIds,
  isAssetIdUrl,
  clearPlaybackIdCache,
  getCacheStatus
};
