export interface MuxThumbnailOptions {
  time?: number;           // Time in seconds (default: 5)
  width?: number;          // Width in pixels (default: 720)
  height?: number;         // Height in pixels (optional)
  format?: 'jpg' | 'png' | 'webp';  // Image format (default: jpg)
  fit_mode?: 'preserve' | 'crop' | 'smartcrop' | 'pad' | 'stretch';  // Fit mode (optional)
}

export interface MuxAnimatedOptions {
  start?: number;          // Start time in seconds (default: 2)
  end?: number;            // End time in seconds (default: 7)
  fps?: number;            // Frames per second (default: 10)
  width?: number;          // Width in pixels (optional)
  height?: number;         // Height in pixels (optional)
}

/**
 * Builds a Mux thumbnail URL for a given playback ID
 * @param playbackId - The Mux playback ID
 * @param opts - Thumbnail options
 * @returns Formatted thumbnail URL
 */
export function buildMuxThumbUrl(playbackId: string, opts: MuxThumbnailOptions = {}): string {
  if (!playbackId) {
    throw new Error('playbackId is required');
  }

  const {
    time = 5,
    width = 720,
    height,
    format = 'jpg',
    fit_mode
  } = opts;

  const baseUrl = `https://image.mux.com/${playbackId}/thumbnail.${format}`;
  const params = new URLSearchParams();

  // Add required/default parameters
  params.append('time', time.toString());
  params.append('width', width.toString());

  // Add optional parameters
  if (height) {
    params.append('height', height.toString());
  }
  
  if (fit_mode) {
    params.append('fit_mode', fit_mode);
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Builds a Mux animated preview URL for a given playback ID
 * @param playbackId - The Mux playback ID
 * @param opts - Animation options
 * @returns Formatted animated preview URL
 */
export function buildMuxAnimatedUrl(playbackId: string, opts: MuxAnimatedOptions = {}): string {
  if (!playbackId) {
    throw new Error('playbackId is required');
  }

  const {
    start = 2,
    end = 7,
    fps = 10,
    width,
    height
  } = opts;

  const baseUrl = `https://image.mux.com/${playbackId}/animated.webp`;
  const params = new URLSearchParams();

  // Add required parameters
  params.append('start', start.toString());
  params.append('end', end.toString());
  params.append('fps', fps.toString());

  // Add optional parameters
  if (width) {
    params.append('width', width.toString());
  }
  
  if (height) {
    params.append('height', height.toString());
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Extract playback ID from Mux video URL
 * @param muxUrl - Full Mux video URL
 * @returns Playback ID or null if not found
 */
export function extractMuxPlaybackId(muxUrl: string): string | null {
  if (!muxUrl) return null;
  
  // Pattern for Mux playback URLs: https://stream.mux.com/{playbackId}.m3u8
  const playbackMatch = muxUrl.match(/stream\.mux\.com\/([^./?]+)/);
  return playbackMatch ? playbackMatch[1] : null;
}
