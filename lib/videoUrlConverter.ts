// Video URL converter for videos with null playbackUrl
// This will convert upload IDs to proper Mux streaming URLs

const { convertVideoUrl } = require('./uploadIdConverter');

/**
 * Convert a video with null/invalid playbackUrl to a working URL
 * This handles the transition period where videos have upload IDs but no asset IDs
 */
export async function getWorkingVideoUrl(video: any): Promise<string | null> {
  console.log(`🔧 Getting working video URL for: ${video.assetId}`);
  
  // If we already have a valid playback URL, use it
  if (video.playbackUrl && video.playbackUrl.includes('stream.mux.com')) {
    console.log(`✅ Using existing playback URL: ${video.playbackUrl}`);
    return video.playbackUrl;
  }
  
  // If assetId looks like an upload ID, try to convert it
  if (video.assetId && video.assetId.length > 30) {
    console.log(`🔄 Converting upload ID to playback URL: ${video.assetId}`);
    
    try {
      // Use the upload ID converter to get the real playback URL
      const workingUrl = await convertVideoUrl(`https://stream.mux.com/${video.assetId}.m3u8`);
      
      if (workingUrl && workingUrl !== `https://stream.mux.com/${video.assetId}.m3u8`) {
        console.log(`✅ Converted to working URL: ${workingUrl}`);
        return workingUrl;
      }
    } catch (error) {
      console.error(`❌ Error converting upload ID: ${error}`);
    }
  }
  
  // If we have an uploadId field, try to use that
  if (video.uploadId) {
    console.log(`🔄 Trying uploadId: ${video.uploadId}`);
    
    try {
      const workingUrl = await convertVideoUrl(`https://stream.mux.com/${video.uploadId}.m3u8`);
      
      if (workingUrl && workingUrl !== `https://stream.mux.com/${video.uploadId}.m3u8`) {
        console.log(`✅ Converted uploadId to working URL: ${workingUrl}`);
        return workingUrl;
      }
    } catch (error) {
      console.error(`❌ Error converting uploadId: ${error}`);
    }
  }
  
  console.warn(`❌ Could not find working video URL for: ${video.assetId}`);
  return null;
}

/**
 * Get working thumbnail URL for a video
 */
export async function getWorkingThumbnailUrl(video: any): Promise<string | null> {
  // If we already have a thumbnail, use it
  if (video.thumbnailUrl && (video.thumbnailUrl.includes('image.mux.com') || video.thumbnailUrl.includes('firebase'))) {
    return video.thumbnailUrl;
  }
  
  // Try to get the working video URL first, then derive thumbnail
  const workingVideoUrl = await getWorkingVideoUrl(video);
  
  if (workingVideoUrl) {
    // Extract playback ID from the working URL
    const playbackIdMatch = workingVideoUrl.match(/stream\.mux\.com\/([^\.]+)/);
    if (playbackIdMatch) {
      const playbackId = playbackIdMatch[1];
      const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&width=320&height=180&fit_mode=crop`;
      console.log(`✅ Generated thumbnail URL: ${thumbnailUrl}`);
      return thumbnailUrl;
    }
  }
  
  return null;
}

export default {
  getWorkingVideoUrl,
  getWorkingThumbnailUrl
};
