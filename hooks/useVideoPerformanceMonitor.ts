/**
 * 🚀 VIDEO PERFORMANCE MONITOR HOOK
 * Tracks video loading performance and provides optimization insights
 */

import { useCallback, useState } from 'react';

interface VideoLoadMetrics {
  assetId: string;
  loadStartTime: number;
  loadEndTime?: number;
  loadDuration?: number;
  preloadStatus: 'preloaded' | 'loading' | 'not-loaded';
  networkType?: string;
  videoSize?: number;
  errorCount: number;
}

interface PerformanceStats {
  averageLoadTime: number;
  fastestLoadTime: number;
  slowestLoadTime: number;
  totalVideosLoaded: number;
  preloadHitRate: number; // Percentage of videos that were preloaded
  errorRate: number;
}

export const useVideoPerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<Map<string, VideoLoadMetrics>>(new Map());
  const [isMonitoring, setIsMonitoring] = useState(true);
  
  // 📊 Start tracking video load
  const startVideoLoad = useCallback((assetId: string, preloadStatus: string) => {
    if (!isMonitoring) return;
    
    const metric: VideoLoadMetrics = {
      assetId,
      loadStartTime: Date.now(),
      preloadStatus: preloadStatus as any,
      errorCount: 0,
    };
    
    setMetrics(prev => new Map(prev).set(assetId, metric));
  }, [isMonitoring]);
  
  // ✅ Complete video load tracking
  const completeVideoLoad = useCallback((assetId: string, success: boolean = true) => {
    if (!isMonitoring) return;
    
    setMetrics(prev => {
      const newMetrics = new Map(prev);
      const existing = newMetrics.get(assetId);
      
      if (existing && !existing.loadEndTime) {
        const endTime = Date.now();
        const updatedMetric: VideoLoadMetrics = {
          ...existing,
          loadEndTime: endTime,
          loadDuration: endTime - existing.loadStartTime,
          errorCount: success ? existing.errorCount : existing.errorCount + 1,
        };
        
        newMetrics.set(assetId, updatedMetric);
        
        // Log performance for debugging
        if (__DEV__) {
          const duration = updatedMetric.loadDuration!;
          const status = updatedMetric.preloadStatus;
          console.log(`🚀 Video Load: ${assetId.slice(0, 8)}... | ${duration}ms | ${status} | ${success ? '✅' : '❌'}`);
        }
      }
      
      return newMetrics;
    });
  }, [isMonitoring]);
  
  // 🔄 Record video error
  const recordVideoError = useCallback((assetId: string, error: any) => {
    if (!isMonitoring) return;
    
    setMetrics(prev => {
      const newMetrics = new Map(prev);
      const existing = newMetrics.get(assetId);
      
      if (existing) {
        const updatedMetric: VideoLoadMetrics = {
          ...existing,
          errorCount: existing.errorCount + 1,
        };
        newMetrics.set(assetId, updatedMetric);
      }
      
      return newMetrics;
    });
    
    if (__DEV__) {
      console.warn(`🚨 Video Error: ${assetId.slice(0, 8)}...`, error);
    }
  }, [isMonitoring]);
  
  // 📈 Calculate performance statistics
  const getPerformanceStats = useCallback((): PerformanceStats => {
    const completedLoads = Array.from(metrics.values()).filter(m => m.loadDuration !== undefined);
    
    if (completedLoads.length === 0) {
      return {
        averageLoadTime: 0,
        fastestLoadTime: 0,
        slowestLoadTime: 0,
        totalVideosLoaded: 0,
        preloadHitRate: 0,
        errorRate: 0,
      };
    }
    
    const loadTimes = completedLoads.map(m => m.loadDuration!);
    const preloadedCount = completedLoads.filter(m => m.preloadStatus === 'preloaded').length;
    const totalErrors = completedLoads.reduce((sum, m) => sum + m.errorCount, 0);
    
    return {
      averageLoadTime: loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length,
      fastestLoadTime: Math.min(...loadTimes),
      slowestLoadTime: Math.max(...loadTimes),
      totalVideosLoaded: completedLoads.length,
      preloadHitRate: (preloadedCount / completedLoads.length) * 100,
      errorRate: (totalErrors / completedLoads.length) * 100,
    };
  }, [metrics]);
  
  // 🎯 Get recommendations based on performance
  const getOptimizationRecommendations = useCallback((): string[] => {
    const stats = getPerformanceStats();
    const recommendations: string[] = [];
    
    if (stats.averageLoadTime > 3000) {
      recommendations.push('Consider reducing video quality or enabling more aggressive compression');
    }
    
    if (stats.preloadHitRate < 50) {
      recommendations.push('Increase preload radius to improve video start times');
    }
    
    if (stats.errorRate > 10) {
      recommendations.push('Check network stability and video source reliability');
    }
    
    if (stats.slowestLoadTime > 10000) {
      recommendations.push('Implement timeout handling for slow video loads');
    }
    
    return recommendations;
  }, [getPerformanceStats]);
  
  // 🧹 Clear performance data
  const clearMetrics = useCallback(() => {
    setMetrics(new Map());
  }, []);
  
  // 📊 Export performance data
  const exportMetrics = useCallback(() => {
    const data = {
      timestamp: new Date().toISOString(),
      stats: getPerformanceStats(),
      recommendations: getOptimizationRecommendations(),
      detailedMetrics: Array.from(metrics.entries()).map(([id, metric]) => ({
        id,
        ...metric,
      })),
    };
    
    if (__DEV__) {
      console.log('🚀 Video Performance Report:', JSON.stringify(data, null, 2));
    }
    
    return data;
  }, [metrics, getPerformanceStats, getOptimizationRecommendations]);
  
  return {
    // Core tracking
    startVideoLoad,
    completeVideoLoad,
    recordVideoError,
    
    // Analytics
    getPerformanceStats,
    getOptimizationRecommendations,
    
    // Management
    clearMetrics,
    exportMetrics,
    
    // State
    isMonitoring,
    setIsMonitoring,
    metricsCount: metrics.size,
  };
};
