// PERMANENT FIX - Auto Playback ID Retrieval System (TypeScript)
// This system automatically converts Asset IDs to Playback IDs in real-time

const RAILWAY_API_URL = 'https://glint-production-b62b.up.railway.app';

// Cache for Asset ID → Playback ID mappings to avoid repeated API calls
const playbackIdCache = new Map<string, string>();

// Queue to prevent duplicate requests for the same asset
const pendingRequests = new Map<string, Promise<string | null>>();

interface MuxAssetResponse {
  success: boolean;
  asset?: {
    id: string;
    status: string;
    playback_ids: Array<{
      id: string;
      policy: string;
    }>;
  };
}

/**
 * Get correct Playback ID for an Asset ID from Mux backend
 */
export async function getPlaybackIdForAsset(assetId: string): Promise<string | null> {
  // Check cache first
  if (playbackIdCache.has(assetId)) {
    console.log(`🚀 Cache hit for Asset ID: ${assetId.substring(0, 20)}...`);
    return playbackIdCache.get(assetId) || null;
  }
  
  // Check if request is already pending
  if (pendingRequests.has(assetId)) {
    console.log(`⏳ Request already pending for Asset ID: ${assetId.substring(0, 20)}...`);
    return await pendingRequests.get(assetId) || null;
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
async function fetchPlaybackIdFromBackend(assetId: string): Promise<string | null> {
  try {
    console.log(`🔍 Fetching Playback ID for Asset: ${assetId.substring(0, 20)}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${RAILWAY_API_URL}/api/mux/asset/${assetId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`❌ Backend request failed: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data: MuxAssetResponse = await response.json();
    
    if (data.success && data.asset && data.asset.playback_ids && data.asset.playback_ids.length > 0) {
      // Prefer public playback IDs
      const publicPlaybackId = data.asset.playback_ids.find(p => p.policy === 'public');
      const playbackId = publicPlaybackId ? publicPlaybackId.id : data.asset.playback_ids[0].id;
      
      console.log(`✅ Retrieved Playback ID: ${assetId.substring(0, 20)}... → ${playbackId}`);
      return playbackId;
    } else {
      console.log(`❌ No playback IDs found for Asset: ${assetId.substring(0, 20)}...`);
      return null;
    }
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`⏰ Timeout fetching Playback ID for ${assetId.substring(0, 20)}...`);
    } else {
      console.error(`❌ Error fetching Playback ID for ${assetId.substring(0, 20)}...:`, error);
    }
    return null;
  }
}

/**
 * Convert Asset ID URL to Playback ID URL
 */
export async function convertAssetUrlToPlaybackUrl(originalUrl: string): Promise<string> {
  console.log(`🔧 Converting URL: ${originalUrl.substring(0, 100)}...`);
  
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
    console.log(`✅ URL converted successfully!`);
    return fixedUrl;
  } else {
    console.log(`❌ Could not convert URL, keeping original`);
    return originalUrl;
  }
}

/**
 * Batch convert multiple Asset IDs (for efficiency)
 */
export async function batchConvertAssetIds(assetIds: string[]): Promise<Record<string, string>> {
  console.log(`🔄 Batch converting ${assetIds.length} Asset IDs...`);
  
  const results: Record<string, string> = {};
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
export function isAssetIdUrl(url: string): boolean {
  const idMatch = url.match(/([a-zA-Z0-9]{32,})/);
  if (!idMatch) return false;
  
  const id = idMatch[1];
  // Asset IDs are typically longer than Playback IDs
  return id.length >= 40;
}

/**
 * Clear cache (useful for debugging)
 */
export function clearPlaybackIdCache(): void {
  playbackIdCache.clear();
  console.log('🧹 Playback ID cache cleared');
}

/**
 * Get cache status
 */
export function getCacheStatus() {
  return {
    size: playbackIdCache.size,
    entries: Array.from(playbackIdCache.entries()).map(([assetId, playbackId]) => ({
      assetId: assetId.substring(0, 20) + '...',
      playbackId
    }))
  };
}
