// Mux Thumbnail Service
// DISABLED - Remove this comment when you add new Mux credentials

/*
 * THIS FILE IS TEMPORARILY DISABLED
 * Uncomment when you have new Mux credentials
 */

export interface MuxThumbnailOptions {
  time?: number;
  width?: number;
  height?: number;
  format?: 'jpg' | 'png' | 'webp';
  fit_mode?: 'preserve' | 'crop' | 'smartcrop' | 'pad' | 'stretch';
}

export interface MuxAnimatedOptions {
  start?: number;
  end?: number;
  fps?: number;
  width?: number;
  height?: number;
}

// Disabled functions - return placeholder/error until re-enabled
export function buildMuxThumbUrl(playbackId: string, opts: MuxThumbnailOptions = {}): string {
  console.warn('Mux thumbnail service is disabled. Please add new credentials.');
  return 'https://via.placeholder.com/720x405/000000/FFFFFF?text=Video+Thumbnail';
}

export function buildMuxAnimatedUrl(playbackId: string, opts: MuxAnimatedOptions = {}): string {
  console.warn('Mux animated thumbnail service is disabled. Please add new credentials.');
  return 'https://via.placeholder.com/720x405/000000/FFFFFF?text=Animated+Preview';
}

export function generateRandomThumbnail(playbackId: string): string {
  console.warn('Mux thumbnail service is disabled. Please add new credentials.');
  return 'https://via.placeholder.com/720x405/000000/FFFFFF?text=Random+Thumbnail';
}

export function validateMuxPlaybackId(playbackId: string): boolean {
  console.warn('Mux validation service is disabled. Please add new credentials.');
  return false;
}
