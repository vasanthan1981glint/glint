import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface VideoTimelineProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
}

export const VideoTimeline: React.FC<VideoTimelineProps> = ({
  duration,
  currentTime,
  onSeek,
  isPlaying,
  onPlayPause,
}) => {
  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* Play/Pause Button */}
      <TouchableOpacity style={styles.playButton} onPress={onPlayPause}>
        <Ionicons 
          name={isPlaying ? "pause" : "play"} 
          size={20} 
          color="#000" 
        />
      </TouchableOpacity>

      {/* Timeline */}
      <View style={styles.timelineContainer}>
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${progressPercent}%` }
              ]} 
            />
            <View 
              style={[
                styles.progressThumb, 
                { left: `${progressPercent}%` }
              ]} 
            />
          </View>
        </View>

        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>

      {/* Speed Control */}
      <TouchableOpacity style={styles.speedButton}>
        <Text style={styles.speedText}>1x</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    margin: 16,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  timelineContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    minWidth: 35,
    textAlign: 'center',
  },
  progressContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    marginLeft: -8,
  },
  speedButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 15,
    marginLeft: 12,
  },
  speedText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
});
