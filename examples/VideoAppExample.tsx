/**
 * Complete Video App Integration Example
 * Shows how to use all Mux components together
 */

import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

// Import all our Mux components
import VideoFeed from '../components/VideoFeed';
import backgroundUploadService from '../lib/backgroundUploadService';
import muxUploadManager from '../lib/muxUploadManager';
import VideoUploadScreen from '../screens/VideoUploadScreen';

interface VideoAppProps {
  initialTab?: 'feed' | 'upload' | 'profile';
}

export default function VideoAppExample({ initialTab = 'feed' }: VideoAppProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<any>(null);

  useEffect(() => {
    // Monitor upload progress globally
    const progressCallback = (uploadId: string, progress: any) => {
      setUploadProgress({ uploadId, ...progress });
    };

    backgroundUploadService.onProgressUpdate(progressCallback);

    return () => {
      backgroundUploadService.offProgressUpdate(progressCallback);
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleUploadComplete = (videoData: any) => {
    console.log('✅ Video upload completed:', videoData);
    setActiveTab('feed'); // Switch to feed to see new video
    Alert.alert(
      'Upload Complete!',
      'Your video has been uploaded and is being processed. It will appear in your feed shortly.',
      [{ text: 'OK' }]
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'feed':
        return (
          <VideoFeed 
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        );
      
      case 'upload':
        return (
          <VideoUploadScreen 
            onUploadComplete={handleUploadComplete}
          />
        );
      
      case 'profile':
        return (
          <View style={styles.profileContainer}>
            <Text style={styles.profileTitle}>My Videos</Text>
            <VideoFeed 
              userId="current_user" // Would use actual user ID
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Global Upload Progress */}
      {uploadProgress && uploadProgress.stage !== 'complete' && (
        <View style={styles.globalProgress}>
          <View style={styles.progressContent}>
            <MaterialIcons name="cloud-upload" size={16} color="#6366f1" />
            <Text style={styles.progressText}>
              {uploadProgress.message} ({Math.round(uploadProgress.progress)}%)
            </Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View 
              style={[styles.progressBar, { width: `${uploadProgress.progress}%` }]} 
            />
          </View>
        </View>
      )}

      {/* Main Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'feed' && styles.navItemActive]}
          onPress={() => setActiveTab('feed')}
        >
          <MaterialIcons 
            name="home" 
            size={24} 
            color={activeTab === 'feed' ? '#6366f1' : '#6b7280'} 
          />
          <Text style={[styles.navText, activeTab === 'feed' && styles.navTextActive]}>
            Feed
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'upload' && styles.navItemActive]}
          onPress={() => setActiveTab('upload')}
        >
          <View style={styles.uploadButton}>
            <MaterialIcons name="add" size={24} color="white" />
          </View>
          <Text style={[styles.navText, activeTab === 'upload' && styles.navTextActive]}>
            Upload
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'profile' && styles.navItemActive]}
          onPress={() => setActiveTab('profile')}
        >
          <MaterialIcons 
            name="person" 
            size={24} 
            color={activeTab === 'profile' ? '#6366f1' : '#6b7280'} 
          />
          <Text style={[styles.navText, activeTab === 'profile' && styles.navTextActive]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  globalProgress: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  progressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  profileContainer: {
    flex: 1,
    padding: 16,
  },
  profileTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navItemActive: {
    // Active state styling
  },
  navText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontWeight: '500',
  },
  navTextActive: {
    color: '#6366f1',
  },
  uploadButton: {
    backgroundColor: '#6366f1',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// Export additional utility functions for advanced usage
export const VideoAppUtils = {
  /**
   * Upload video with custom options
   */
  uploadVideo: async (videoUri: string, options: any = {}) => {
    try {
      const result = await muxUploadManager.uploadVideo({
        videoUri,
        title: options.title || 'Untitled Video',
        description: options.description || '',
        metadata: options.metadata || {},
        onProgress: options.onProgress,
        onComplete: options.onComplete,
        onError: options.onError,
      });
      return result;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  },

  /**
   * Check if backend is healthy
   */
  checkBackendHealth: async () => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://glint-production-b62b.up.railway.app';
      const response = await fetch(`${apiUrl}/health`);
      const data = await response.json();
      return data.status === 'OK' && data.muxEnabled;
    } catch (error) {
      console.error('Backend health check failed:', error);
      return false;
    }
  },

  /**
   * Get Mux asset information
   */
  getAssetInfo: async (assetId: string) => {
    return muxUploadManager.getAssetInfo(assetId);
  },

  /**
   * Validate video URL
   */
  validateVideoUrl: async (url: string) => {
    return muxUploadManager.validateVideoUrl(url);
  },
};
