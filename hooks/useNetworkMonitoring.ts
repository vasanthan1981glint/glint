import { useCallback, useEffect, useState } from 'react';

export type NetworkQuality = 'high' | 'medium' | 'low' | 'offline';
export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'other' | 'unknown';

interface NetworkStatus {
  quality: NetworkQuality;
  connectionType: ConnectionType;
  isConnected: boolean;
  effectiveType?: string;
  downloadSpeed?: number; // Mbps
  rtt?: number; // Round trip time in ms
}

// ✅ 2. Adaptive Quality Selection based on Network
export const useNetworkMonitoring = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    quality: 'high', // Default to high quality
    connectionType: 'wifi', // Assume WiFi by default for better UX
    isConnected: true,
  });
  
  const [speedTestResults, setSpeedTestResults] = useState<{
    downloadSpeed: number;
    latency: number;
    timestamp: number;
  } | null>(null);
  
  // Simple speed test using image download
  const performSpeedTest = useCallback(async (): Promise<{ speed: number; latency: number }> => {
    try {
      const testImageUrl = 'https://www.google.com/favicon.ico?v=' + Date.now();
      const testSize = 1024; // Approximate size in bytes
      
      const startTime = Date.now();
      const response = await fetch(testImageUrl, { 
        cache: 'no-cache',
        method: 'GET',
      });
      const endTime = Date.now();
      
      if (response.ok) {
        const latency = endTime - startTime;
        const speed = (testSize * 8) / (latency / 1000) / 1000; // Convert to Kbps
        
        return { speed, latency };
      }
      
      throw new Error('Speed test failed');
    } catch (error) {
      console.warn('Speed test failed:', error);
      return { speed: 5000, latency: 100 }; // Default to good values for better UX
    }
  }, []);
  
  // Determine network quality based on speed test
  const determineNetworkQuality = useCallback((
    speedTest: { speed: number; latency: number }
  ): NetworkQuality => {
    const { speed, latency } = speedTest;
    
    if (speed > 5000 && latency < 100) { // > 5 Mbps, < 100ms latency
      return 'high';
    } else if (speed > 1000 && latency < 300) { // > 1 Mbps, < 300ms latency
      return 'medium';
    } else if (speed > 0) {
      return 'low';
    } else {
      return 'offline';
    }
  }, []);
  
  // Initialize network monitoring with periodic speed tests
  useEffect(() => {
    let speedTestInterval: ReturnType<typeof setInterval>;
    
    // Perform periodic speed tests (every 5 minutes)
    const performPeriodicSpeedTest = async () => {
      try {
        const results = await performSpeedTest();
        const newSpeedTest = {
          downloadSpeed: results.speed,
          latency: results.latency,
          timestamp: Date.now(),
        };
        
        setSpeedTestResults(newSpeedTest);
        
        // Update network quality based on speed test
        const newQuality = determineNetworkQuality(results);
        
        setNetworkStatus(prev => ({
          ...prev,
          quality: newQuality,
          downloadSpeed: results.speed,
          rtt: results.latency,
          isConnected: results.speed > 0,
        }));
        
        console.log('🚀 Speed test completed:', results, 'Quality:', newQuality);
        
      } catch (error) {
        console.warn('Speed test error:', error);
        // On error, assume medium quality to avoid degrading UX
        setNetworkStatus(prev => ({
          ...prev,
          quality: 'medium',
          isConnected: true,
        }));
      }
    };
    
    // Initial speed test
    performPeriodicSpeedTest();
    
    // Periodic speed tests every 5 minutes
    speedTestInterval = setInterval(performPeriodicSpeedTest, 300000);
    
    return () => {
      if (speedTestInterval) {
        clearInterval(speedTestInterval);
      }
    };
  }, [performSpeedTest, determineNetworkQuality]);
  
  // Get recommended video quality based on network
  const getRecommendedVideoQuality = useCallback((): {
    resolution: string;
    bitrate: string;
    description: string;
  } => {
    switch (networkStatus.quality) {
      case 'high':
        return {
          resolution: '1080p',
          bitrate: 'high',
          description: 'High quality (1080p)',
        };
      case 'medium':
        return {
          resolution: '720p',
          bitrate: 'medium',
          description: 'Medium quality (720p)',
        };
      case 'low':
        return {
          resolution: '480p',
          bitrate: 'low',
          description: 'Low quality (480p)',
        };
      case 'offline':
        return {
          resolution: 'offline',
          bitrate: 'none',
          description: 'Offline mode',
        };
      default:
        return {
          resolution: '1080p', // Default to high quality for better UX
          bitrate: 'high',
          description: 'Default quality (1080p)',
        };
    }
  }, [networkStatus.quality]);
  
  // Check if we should preload videos
  const shouldPreloadVideos = useCallback((): boolean => {
    if (!networkStatus.isConnected) return false;
    
    // Preload on high and medium quality connections
    return networkStatus.quality === 'high' || networkStatus.quality === 'medium';
  }, [networkStatus]);
  
  // Check if we should auto-play videos
  const shouldAutoPlay = useCallback((): boolean => {
    if (!networkStatus.isConnected) return false;
    
    // Auto-play on all connections except offline for better UX
    return networkStatus.quality !== 'offline';
  }, [networkStatus]);
  
  // Get data savings recommendations
  const getDataSavingsMode = useCallback((): {
    enabled: boolean;
    recommendations: string[];
  } => {
    const isLowBandwidth = networkStatus.quality === 'low';
    
    if (isLowBandwidth) {
      return {
        enabled: true,
        recommendations: [
          'Lower video quality to 480p',
          'Reduce preloading',
          'Compress thumbnails',
          'Limit background updates',
        ],
      };
    }
    
    return {
      enabled: false,
      recommendations: [],
    };
  }, [networkStatus]);
  
  return {
    networkStatus,
    speedTestResults,
    getRecommendedVideoQuality,
    shouldPreloadVideos,
    shouldAutoPlay,
    getDataSavingsMode,
    performSpeedTest,
  };
};

// ✅ 17. Offline Support Hook (Simplified)
export const useOfflineSupport = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<string[]>([]);
  
  // Simple online/offline detection using fetch
  useEffect(() => {
    const checkOnlineStatus = async () => {
      try {
        const response = await fetch('https://www.google.com/favicon.ico?v=' + Date.now(), {
          method: 'HEAD',
          cache: 'no-cache',
        });
        const online = response.ok;
        setIsOffline(!online);
        
        if (online && offlineQueue.length > 0) {
          console.log('📱 Back online - processing offline queue');
          processOfflineQueue();
        }
      } catch (error) {
        setIsOffline(true);
        console.log('📱 Device appears to be offline');
      }
    };
    
    // Check immediately
    checkOnlineStatus();
    
    // Check every 30 seconds
    const interval = setInterval(checkOnlineStatus, 30000);
    
    return () => clearInterval(interval);
  }, [offlineQueue.length]);
  
  const addToOfflineQueue = useCallback((action: string) => {
    setOfflineQueue(prev => [...prev, action]);
    console.log('📱 Added to offline queue:', action);
  }, []);
  
  const processOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0) return;
    
    console.log(`📱 Processing ${offlineQueue.length} offline actions`);
    
    // Process queued actions
    for (const action of offlineQueue) {
      try {
        // Here you would implement actual offline action processing
        console.log('📱 Processing offline action:', action);
      } catch (error) {
        console.error('Error processing offline action:', error);
      }
    }
    
    setOfflineQueue([]);
  }, [offlineQueue]);
  
  return {
    isOffline,
    offlineQueue,
    addToOfflineQueue,
    processOfflineQueue,
  };
};

export default useNetworkMonitoring;
