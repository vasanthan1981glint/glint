/**
 * Example of how to integrate video codec utilities into your video feed
 */

import React, { useMemo } from 'react';
import { filterCompatibleVideos, logCodecInfo } from '../utils/videoCodecUtils';

// Example usage in your video feed component
export const useCompatibleVideos = <T extends { playbackUrl: string; assetId: string }>(videos: T[]) => {
  // Log codec info on first load (useful for debugging)
  React.useEffect(() => {
    logCodecInfo();
  }, []);
  
  // Filter videos to only include compatible ones
  const compatibleVideos = useMemo(() => {
    return filterCompatibleVideos(videos);
  }, [videos]);
  
  return {
    compatibleVideos,
    filteredCount: videos.length - compatibleVideos.length,
    totalCount: videos.length,
  };
};

// Example integration with your existing video player
export const VideoFeedWithCodecFiltering: React.FC<{
  videos: Array<{ playbackUrl: string; assetId: string; [key: string]: any }>;
  children: (props: {
    videos: Array<{ playbackUrl: string; assetId: string; [key: string]: any }>;
    filteredCount: number;
    totalCount: number;
  }) => React.ReactNode;
}> = ({ videos, children }) => {
  const { compatibleVideos, filteredCount, totalCount } = useCompatibleVideos(videos);
  
  // Show warning if many videos were filtered
  React.useEffect(() => {
    if (filteredCount > 0) {
      console.warn(`⚠️ ${filteredCount} videos filtered due to codec incompatibility`);
      
      // You could also show a user-friendly message here
      if (filteredCount > videos.length * 0.3) { // More than 30% filtered
        console.warn('📱 Many videos are incompatible with this device. Consider uploading H.264 versions.');
      }
    }
  }, [filteredCount, videos.length]);
  
  return <>{children({ videos: compatibleVideos, filteredCount, totalCount })}</>;
};
