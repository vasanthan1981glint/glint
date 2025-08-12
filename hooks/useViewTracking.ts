import { useCallback, useEffect, useRef } from 'react';
import { viewTracker } from '../lib/viewTrackingService';

interface UseViewTrackingOptions {
  videoId: string;
  isVisible?: boolean;
  isPlaying?: boolean;
  visibilityPercentage?: number;
  onViewRecorded?: (videoId: string) => void;
  onViewThresholdReached?: (videoId: string) => void;
}

interface ViewTrackingHookReturn {
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  updateVisibility: (percentage: number) => Promise<void>;
  isTracking: boolean;
}

export const useViewTracking = ({
  videoId,
  isVisible = true,
  isPlaying = false,
  visibilityPercentage = 100,
  onViewRecorded,
  onViewThresholdReached
}: UseViewTrackingOptions): ViewTrackingHookReturn => {
  const sessionIdRef = useRef<string | null>(null);
  const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTrackingRef = useRef(false);
  const hasReachedThresholdRef = useRef(false);
  const lastStartAttemptRef = useRef<number>(0);
  const isVideoOwnerRef = useRef<boolean>(false);
  const ownershipCheckedRef = useRef<boolean>(false);

  // Start view tracking
  const startTracking = useCallback(async () => {
    const now = Date.now();
    
    // Prevent rapid successive calls - increased debounce time for better performance
    if (now - lastStartAttemptRef.current < 2000) {
      return;
    }
    lastStartAttemptRef.current = now;
    
    if (isTrackingRef.current || !videoId || !isVisible || !isPlaying) {
      return;
    }

    // Don't try to track if we already know the user owns this video
    if (ownershipCheckedRef.current && isVideoOwnerRef.current) {
      return;
    }

    // Quick silent ownership check to prevent unnecessary attempts
    if (!ownershipCheckedRef.current) {
      try {
        const isOwner = await viewTracker.isCurrentUserVideoOwner(videoId);
        if (isOwner) {
          isVideoOwnerRef.current = true;
          ownershipCheckedRef.current = true;
          return; // Exit silently without logging
        }
        ownershipCheckedRef.current = true;
      } catch (error) {
        // If check fails, continue with normal flow
      }
    }

    try {
      const sessionId = await viewTracker.startViewTracking(videoId);
      sessionIdRef.current = sessionId;
      isTrackingRef.current = true;
      hasReachedThresholdRef.current = false;

      console.log(`🎬 View tracking started for video: ${videoId}`);

      // Start periodic updates
  trackingIntervalRef.current = setInterval(async () => {
        if (sessionIdRef.current && isVisible && isPlaying) {
          await viewTracker.updateViewProgress(sessionIdRef.current);
          
          // Check if threshold reached (this is a simplified check)
          if (!hasReachedThresholdRef.current) {
            // In a real implementation, this would be determined by the service
            // For now, we'll call the callback after 3 seconds
            setTimeout(() => {
              if (!hasReachedThresholdRef.current) {
                hasReachedThresholdRef.current = true;
                onViewThresholdReached?.(videoId);
              }
            }, 3000);
          }
        }
      }, 1000); // Update every second

      console.log(`✅ View tracking started for video: ${videoId}`);
    } catch (error: any) {
      // Handle specific error cases silently
      if (error?.message === 'Video owner views are not counted') {
        console.log(`👤 Skipping view tracking for video owner: ${videoId}`);
        // Remember that this user owns this video to prevent retries
        isVideoOwnerRef.current = true;
        ownershipCheckedRef.current = true;
        // Don't set isTrackingRef to true for owners
        return;
      }
      
      // Handle video not found errors (video might have been deleted)
  if (error?.message === 'Video not found') {
        console.log(`🚫 Video ${videoId} not found - possibly deleted`);
        return;
      }
      
      // Handle debounce errors silently (don't spam logs)
  if (error?.message?.includes('debounced')) {
        return;
      }
      
      // Only log unexpected errors
      console.error('❌ Failed to start view tracking:', error);
      isTrackingRef.current = false;
    }
  }, [videoId, isVisible, onViewThresholdReached]);

  // Stop view tracking
  const stopTracking = useCallback(async () => {
    if (!isTrackingRef.current || !sessionIdRef.current) {
      return;
    }

    try {
      console.log(`🛑 Stopping view tracking for video: ${videoId}`);
      
      // Clear interval
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }

      // Stop tracking service
      await viewTracker.stopViewTracking(sessionIdRef.current);
      
      // Call callback if view was recorded
      if (hasReachedThresholdRef.current) {
        onViewRecorded?.(videoId);
      }

      // Reset state
      sessionIdRef.current = null;
      isTrackingRef.current = false;
      hasReachedThresholdRef.current = false;

      console.log(`✅ View tracking stopped for video: ${videoId}`);
    } catch (error) {
      console.error('❌ Failed to stop view tracking:', error);
    }
  }, [videoId, onViewRecorded]);

  // Auto-start/stop tracking based on visibility and play state
  useEffect(() => {
    if (isVisible && isPlaying && !isTrackingRef.current) {
      startTracking();
    } else if ((!isVisible || !isPlaying) && isTrackingRef.current) {
      stopTracking();
    }
  }, [isVisible, isPlaying, startTracking, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
      if (isTrackingRef.current && sessionIdRef.current) {
        viewTracker.stopViewTracking(sessionIdRef.current);
      }
    };
  }, []);

  // Cleanup when videoId changes
  useEffect(() => {
    // Reset ownership state when video changes
    isVideoOwnerRef.current = false;
    ownershipCheckedRef.current = false;
    
    return () => {
      if (isTrackingRef.current) {
        stopTracking();
      }
    };
  }, [videoId, stopTracking]);

  // Update visibility percentage
  const updateVisibility = useCallback(async (percentage: number) => {
    if (sessionIdRef.current) {
      await viewTracker.updateVisibility(sessionIdRef.current, percentage);
    }
  }, []);

  return {
    startTracking,
    stopTracking,
    updateVisibility,
    isTracking: isTrackingRef.current
  };
};
