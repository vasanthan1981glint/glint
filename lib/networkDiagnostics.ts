/**
 * Network Diagnostics for Video Playback Issues
 * Helps diagnose and troubleshoot video streaming problems
 */

export interface NetworkDiagnostics {
  isConnected: boolean;
  connectionType: string;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  canReachMux: boolean;
  timestamp: string;
}

export class NetworkDiagnosticsService {
  
  /**
   * Get comprehensive network diagnostics
   */
  static async getDiagnostics(): Promise<NetworkDiagnostics> {
    try {
      const diagnostics: NetworkDiagnostics = {
        isConnected: true, // Will be determined by connectivity test
        connectionType: 'unknown',
        connectionQuality: 'good', // Will be determined by tests
        canReachMux: false,
        timestamp: new Date().toISOString()
      };

      // Test basic connectivity and Mux connectivity
      diagnostics.canReachMux = await this.testMuxConnectivity();
      diagnostics.isConnected = diagnostics.canReachMux;
      diagnostics.connectionQuality = diagnostics.canReachMux ? 'good' : 'offline';

      return diagnostics;
    } catch (error) {
      console.error('❌ Network diagnostics failed:', error);
      return {
        isConnected: false,
        connectionType: 'unknown',
        connectionQuality: 'offline',
        canReachMux: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Determine connection quality based on network info
   */
  private static determineConnectionQuality(): 'excellent' | 'good' | 'poor' | 'offline' {
    // Simple quality assessment based on connectivity
    return 'good'; // Default for now
  }

  /**
   * Test if Mux streaming service is reachable
   */
  private static async testMuxConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('https://stream.mux.com/', {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok || response.status === 404; // 404 is fine for this test
    } catch (error) {
      console.log('🌐 Mux connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Log network diagnostics for debugging
   */
  static async logNetworkDiagnostics(context: string = 'general'): Promise<void> {
    const diagnostics = await this.getDiagnostics();
    
    console.log(`🌐 [${context}] Network Diagnostics:`, {
      connected: diagnostics.isConnected,
      type: diagnostics.connectionType,
      quality: diagnostics.connectionQuality,
      muxReachable: diagnostics.canReachMux,
      timestamp: diagnostics.timestamp
    });
  }

  /**
   * Get network status for video error handling
   */
  static async getNetworkStatusForVideo(): Promise<{
    shouldRetry: boolean;
    retryDelay: number;
    reason: string;
  }> {
    const diagnostics = await this.getDiagnostics();
    
    if (!diagnostics.isConnected) {
      return {
        shouldRetry: false,
        retryDelay: 0,
        reason: 'No internet connection'
      };
    }

    if (!diagnostics.canReachMux) {
      return {
        shouldRetry: true,
        retryDelay: 5000,
        reason: 'Mux service unreachable'
      };
    }

    if (diagnostics.connectionQuality === 'poor') {
      return {
        shouldRetry: true,
        retryDelay: 3000,
        reason: 'Poor connection quality'
      };
    }

    return {
      shouldRetry: true,
      retryDelay: 2000,
      reason: 'Network available'
    };
  }
}

/**
 * Enhanced error categorization for video playback
 */
export class VideoErrorAnalyzer {
  
  /**
   * Analyze video error and provide recommendations
   */
  static analyzeError(error: any): {
    category: 'network' | 'codec' | 'url' | 'permission' | 'unknown';
    severity: 'low' | 'medium' | 'high';
    shouldRetry: boolean;
    message: string;
    solution: string;
  } {
    const errorString = typeof error === 'string' ? error : JSON.stringify(error);
    
    // Network errors (most common with Mux)
    if (errorString.includes('-1008') || 
        errorString.includes('-1100') ||
        errorString.includes('NSURLErrorDomain') ||
        errorString.includes('network') ||
        errorString.includes('connection') ||
        errorString.includes('timeout')) {
      return {
        category: 'network',
        severity: 'medium',
        shouldRetry: true,
        message: 'Network connection issue detected',
        solution: 'Check internet connection and retry. This often resolves on retry.'
      };
    }

    // URL/DNS resolution errors
    if (errorString.includes('-1003') || 
        errorString.includes('cannot find host') ||
        errorString.includes('DNS') ||
        errorString.includes('host unreachable')) {
      return {
        category: 'url',
        severity: 'high',
        shouldRetry: true,
        message: 'Cannot reach video server',
        solution: 'Server may be temporarily unavailable. Retry in a few moments.'
      };
    }

    // Codec/format errors
    if (errorString.includes('codec') || 
        errorString.includes('format') ||
        errorString.includes('unsupported') ||
        errorString.includes('Decoder init failed') ||
        errorString.includes('MediaCodec')) {
      return {
        category: 'codec',
        severity: 'high',
        shouldRetry: false,
        message: 'Video format not supported on this device',
        solution: 'This video may require a newer device or different format.'
      };
    }

    // Permission errors
    if (errorString.includes('permission') || 
        errorString.includes('access denied') ||
        errorString.includes('unauthorized')) {
      return {
        category: 'permission',
        severity: 'high',
        shouldRetry: false,
        message: 'Access denied to video content',
        solution: 'Check app permissions or sign in again.'
      };
    }

    // Unknown errors
    return {
      category: 'unknown',
      severity: 'medium',
      shouldRetry: true,
      message: 'Unknown playback error occurred',
      solution: 'Try refreshing the app or restarting the video.'
    };
  }
}
