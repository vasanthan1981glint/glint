import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Dimensions, Modal, StyleSheet, Text, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export interface UploadProgress {
  progress: number;
  stage: 'compressing' | 'uploading' | 'processing' | 'complete';
  message: string;
  fileSize?: string;
  uploadSpeed?: string;
  timeRemaining?: string;
}

interface GlintUploadModalProps {
  visible: boolean;
  onClose: () => void;
  progress: UploadProgress;
}

export const GlintUploadModal: React.FC<GlintUploadModalProps> = ({
  visible,
  onClose,
  progress,
}) => {
  const getStageIcon = () => {
    switch (progress.stage) {
      case 'compressing': return '📹';
      case 'uploading': return '📤';
      case 'processing': return '⚡';
      case 'complete': return '✅';
      default: return '📱';
    }
  };

  const getStageColor = (): [string, string] => {
    switch (progress.stage) {
      case 'compressing': return ['#FF6B6B', '#FF8E8E'];
      case 'uploading': return ['#4ECDC4', '#44A08D'];
      case 'processing': return ['#A8E6CF', '#7FCDCD'];
      case 'complete': return ['#98FB98', '#90EE90'];
      default: return ['#DDD', '#BBB'];
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={getStageColor()}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.icon}>{getStageIcon()}</Text>
              <Text style={styles.title}>Uploading to Glint</Text>
            </View>

            {/* Progress Circle */}
            <View style={styles.progressContainer}>
              <View style={styles.progressCircle}>
                <View style={[styles.progressFill, { 
                  transform: [{ rotate: `${(progress.progress / 100) * 360}deg` }] 
                }]} />
                <View style={styles.progressInner}>
                  <Text style={styles.progressText}>{Math.round(progress.progress)}%</Text>
                </View>
              </View>
            </View>

            {/* Stage Info */}
            <View style={styles.infoContainer}>
              <Text style={styles.stageText}>
                {progress.stage.charAt(0).toUpperCase() + progress.stage.slice(1)}
              </Text>
              <Text style={styles.messageText}>{progress.message}</Text>
              
              {/* Upload Details */}
              {progress.stage === 'uploading' && (
                <View style={styles.uploadDetails}>
                  {progress.fileSize && (
                    <Text style={styles.detailText}>📦 Size: {progress.fileSize}</Text>
                  )}
                  {progress.uploadSpeed && (
                    <Text style={styles.detailText}>⚡ Speed: {progress.uploadSpeed}</Text>
                  )}
                  {progress.timeRemaining && (
                    <Text style={styles.detailText}>⏱️ Remaining: {progress.timeRemaining}</Text>
                  )}
                </View>
              )}
              
              {/* Compression Info */}
              {progress.stage === 'compressing' && (
                <View style={styles.compressionInfo}>
                  <Text style={styles.detailText}>🎥 Optimizing video quality...</Text>
                  <Text style={styles.detailText}>📱 Reducing file size for faster upload</Text>
                </View>
              )}
            </View>

            {/* Progress Steps */}
            <View style={styles.stepsContainer}>
              {['compressing', 'uploading', 'processing', 'complete'].map((stage, index) => (
                <View key={stage} style={styles.step}>
                  <View style={[
                    styles.stepCircle,
                    progress.stage === stage && styles.stepActive,
                    ['compressing', 'uploading', 'processing'].indexOf(progress.stage) > index && styles.stepComplete
                  ]}>
                    <Text style={styles.stepNumber}>{index + 1}</Text>
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    progress.stage === stage && styles.stepLabelActive
                  ]}>
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Loading Animation */}
            {progress.stage !== 'complete' && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.loadingText}>Please wait...</Text>
              </View>
            )}

            {/* Complete Message */}
            {progress.stage === 'complete' && (
              <View style={styles.completeContainer}>
                <Text style={styles.completeText}>🎉 Your video is live!</Text>
                <Text style={styles.completeSubtext}>Ready for the world to see</Text>
              </View>
            )}
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: Math.min(screenWidth - 40, 320), // Responsive width
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    padding: screenWidth > 400 ? 30 : 24, // Responsive padding
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: screenWidth > 400 ? 30 : 24, // Responsive margin
  },
  icon: {
    fontSize: screenWidth > 400 ? 40 : 35, // Responsive icon size
    marginBottom: 10,
  },
  title: {
    fontSize: screenWidth > 400 ? 20 : 18, // Responsive title size
    fontWeight: 'bold',
    color: '#FFF',
  },
  progressContainer: {
    marginBottom: screenWidth > 400 ? 30 : 24, // Responsive margin
  },
  progressCircle: {
    width: screenWidth > 400 ? 120 : 100, // Responsive circle size
    height: screenWidth > 400 ? 120 : 100,
    borderRadius: screenWidth > 400 ? 60 : 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    width: screenWidth > 400 ? 120 : 100, // Responsive fill size
    height: screenWidth > 400 ? 120 : 100,
    borderRadius: screenWidth > 400 ? 60 : 50,
    backgroundColor: 'rgba(255,255,255,0.5)',
    transformOrigin: 'center',
  },
  progressInner: {
    width: screenWidth > 400 ? 100 : 85, // Responsive inner circle
    height: screenWidth > 400 ? 100 : 85,
    borderRadius: screenWidth > 400 ? 50 : 42.5,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: screenWidth > 400 ? 24 : 20, // Responsive progress text
    fontWeight: 'bold',
    color: '#333',
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: screenWidth > 400 ? 30 : 24, // Responsive margin
  },
  stageText: {
    fontSize: screenWidth > 400 ? 18 : 16, // Responsive stage text
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 5,
  },
  messageText: {
    fontSize: screenWidth > 400 ? 14 : 12, // Responsive message size
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: screenWidth > 400 ? 20 : 16, // Responsive margin
  },
  step: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: screenWidth > 400 ? 30 : 26, // Responsive step circle
    height: screenWidth > 400 ? 30 : 26,
    borderRadius: screenWidth > 400 ? 15 : 13,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  stepActive: {
    backgroundColor: '#FFF',
  },
  stepComplete: {
    backgroundColor: '#4CAF50',
  },
  stepNumber: {
    fontSize: screenWidth > 400 ? 12 : 10, // Responsive step number
    fontWeight: 'bold',
    color: '#333',
  },
  stepLabel: {
    fontSize: screenWidth > 400 ? 10 : 8, // Responsive step label
    color: 'rgba(255,255,255,0.7)',
  },
  stepLabelActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 10,
    color: '#FFF',
    fontSize: screenWidth > 400 ? 14 : 12, // Responsive loading text
  },
  completeContainer: {
    alignItems: 'center',
  },
  completeText: {
    fontSize: screenWidth > 400 ? 18 : 16, // Responsive complete text
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 5,
  },
  completeSubtext: {
    fontSize: screenWidth > 400 ? 14 : 12, // Responsive subtext
    color: 'rgba(255,255,255,0.8)',
  },
  uploadDetails: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    width: '100%',
  },
  compressionInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    width: '100%',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 4,
  },
});
