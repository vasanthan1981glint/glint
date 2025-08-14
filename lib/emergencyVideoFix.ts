// PERMANENT VIDEO FIX - Auto Playback ID Conversion
// This file provides automatic Upload ID and Asset ID to Playback ID conversion

import { convertAssetUrlToPlaybackUrl, isAssetIdUrl } from './playbackIdConverter';
import { convertVideoUrl } from './uploadIdConverter.js';

// Dynamic mapping for Upload ID → Playback ID
const UPLOAD_TO_PLAYBACK_MAP: Record<string, string> = {
  // Pre-cached working mappings from testing
  'H00rUEZPwkFVPE8YrrTF02Uc02rVHzD5cgZnINyyi6t01400': 'ym4C8vM7mJ4JxJWFy00yejH0102Q9qphPN02uuttsl202lvQ',
  'i5W00Mt00xSWd102G1oarUdLeEnzXhHe1o7LanMti9pa3A': 'exI02CGE00pZ8UZTV54w22afKhOj75xLLkA1njkM8eapA',
};

// Legacy problematic Asset IDs (for reference)
const LEGACY_ASSET_MAP: Record<string, string> = {
  'OyW2BJCnZCfkk8v54GAQLG7dSviw5GGdqiSiO9I7hJs': 'NEEDS_REUPLOAD',
  'w7rVemuEUYFjnHe501q1YM8poMLrJhbGrI01uXkxh7WeI': 'NEEDS_REUPLOAD',
  'brUgO02kARoyfrdVhvd02QA00GDp00j0196B2zVyOwibiqhg': 'NEEDS_REUPLOAD',
  'yF7df1c9tEPRUiDJFtkeZdeOyZqIX00oJQEhRs64fTe4': 'NEEDS_REUPLOAD',
  'jOYrW01xoAW2aFhI0000wKLC31rZ4QNRFQwUlfDtfqcvo8': 'NEEDS_REUPLOAD',
  't3V7ny19JXL7nzhGTfUkmK5axoPWqdl1WPwOgc7aagM': 'NEEDS_REUPLOAD',
};

/**
 * PERMANENT FIX: Automatically converts Upload IDs to Playback IDs
 * This is the main function that should be used for all video URL processing
 */
export async function fixVideoUrl(originalUrl: string): Promise<string> {
  console.log('🔧 Permanent fix processing URL:', originalUrl.substring(0, 80) + '...');
  
  try {
    // First try Upload ID conversion (handles Upload ID → Asset ID → Playback ID)
    const convertedUrl = await convertVideoUrl(originalUrl);
    
    if (convertedUrl !== originalUrl) {
      console.log('✅ PERMANENT FIX APPLIED: Upload ID → Playback ID conversion successful');
      
      // Extract and cache the mapping
      const uploadIdMatch = originalUrl.match(/([a-zA-Z0-9]{40,})/);
      const playbackIdMatch = convertedUrl.match(/([a-zA-Z0-9]{30,})/);
      
      if (uploadIdMatch && playbackIdMatch) {
        const uploadId = uploadIdMatch[1];
        const playbackId = playbackIdMatch[1];
        UPLOAD_TO_PLAYBACK_MAP[uploadId] = playbackId;
        console.log(`📝 Cached mapping: ${uploadId.substring(0, 20)}... → ${playbackId}`);
      }
      
      return convertedUrl;
    }
    
    // If not an Upload ID, try Asset ID conversion
    if (isAssetIdUrl(originalUrl)) {
      const assetConvertedUrl = await convertAssetUrlToPlaybackUrl(originalUrl);
      if (assetConvertedUrl !== originalUrl) {
        console.log('✅ ASSET ID CONVERSION APPLIED');
        return assetConvertedUrl;
      }
    }
    
  } catch (error) {
    console.error('❌ Automatic conversion failed:', error);
  }
  
  console.log('🔍 No conversion applied, returning original URL');
  return originalUrl;
}

/**
 * Synchronous version for backwards compatibility
 * This will check cached mappings and legacy mappings only
 */
export function fixVideoUrlSync(originalUrl: string): string {
  console.log('🔧 Sync fix (cached only):', originalUrl.substring(0, 80) + '...');
  
  // Extract ID from URL
  const idMatch = originalUrl.match(/([a-zA-Z0-9]{30,})/);
  if (!idMatch) {
    return originalUrl;
  }
  
  const id = idMatch[1];
  
  // Check Upload ID cache first
  const cachedPlaybackId = UPLOAD_TO_PLAYBACK_MAP[id];
  if (cachedPlaybackId) {
    const fixedUrl = `https://stream.mux.com/${cachedPlaybackId}.m3u8`;
    console.log('🔧 Sync fix applied from Upload ID cache');
    return fixedUrl;
  }
  
  // Check legacy asset mapping
  const legacyMapping = LEGACY_ASSET_MAP[id];
  if (legacyMapping && legacyMapping !== 'NEEDS_REUPLOAD') {
    const fixedUrl = `https://stream.mux.com/${legacyMapping}.m3u8`;
    console.log('🔧 Sync fix applied from legacy mapping');
    return fixedUrl;
  }
  
  return originalUrl;
}

/**
 * Check if URL contains Upload ID (40+ characters)
 */
export function isUploadIdUrl(url: string): boolean {
  const idMatch = url.match(/([a-zA-Z0-9]{40,})/);
  if (!idMatch) return false;
  
  const id = idMatch[1];
  return id.length >= 40;
}

/**
 * Get current Upload ID → Playback ID mappings
 */
export function getUploadMappings(): Record<string, string> {
  return { ...UPLOAD_TO_PLAYBACK_MAP };
}

/**
 * Add a manual mapping (useful for testing)
 */
export function addUploadMapping(uploadId: string, playbackId: string): void {
  UPLOAD_TO_PLAYBACK_MAP[uploadId] = playbackId;
  console.log(`📝 Manual mapping added: ${uploadId.substring(0, 20)}... → ${playbackId}`);
}

/**
 * Check if an asset needs re-upload
 */
export function assetNeedsReupload(assetId: string): boolean {
  return LEGACY_ASSET_MAP[assetId] === 'NEEDS_REUPLOAD';
}

/**
 * Get list of assets that need re-upload
 */
export function getAssetsNeedingReupload(): string[] {
  return Object.keys(LEGACY_ASSET_MAP).filter(
    assetId => LEGACY_ASSET_MAP[assetId] === 'NEEDS_REUPLOAD'
  );
}

// Export legacy mapping for backwards compatibility
export const ASSET_TO_PLAYBACK_MAP = LEGACY_ASSET_MAP;
