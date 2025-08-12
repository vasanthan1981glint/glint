// app/(tabs)/plus.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import TemplateEditor from '../../components/TemplateEditor';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  duration: number;
  clipSlots: number;
  category: 'music' | 'trending' | 'photo' | 'duet';
  previewColor: string;
}

export default function PlusScreen() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<'video' | 'template'>('video');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const slideAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, []);

  const videoTemplates: VideoTemplate[] = [
    {
      id: 'beat-sync',
      name: 'Beat Sync',
      description: 'Auto-sync to music beats',
      icon: 'musical-notes',
      duration: 15,
      clipSlots: 4,
      category: 'music',
      previewColor: '#FF6B6B',
    },
    {
      id: 'photo-slideshow',
      name: 'Photo Slideshow',
      description: 'Multiple photos with transitions',
      icon: 'images',
      duration: 30,
      clipSlots: 6,
      category: 'photo',
      previewColor: '#4ECDC4',
    },
    {
      id: 'trending-format',
      name: 'Trending Format',
      description: 'Popular Short layout',
      icon: 'trending-up',
      duration: 15,
      clipSlots: 3,
      category: 'trending',
      previewColor: '#45B7D1',
    },
    {
      id: 'split-screen',
      name: 'Split Screen',
      description: 'Reaction & duet style',
      icon: 'copy',
      duration: 20,
      clipSlots: 2,
      category: 'duet',
      previewColor: '#96CEB4',
    },
  ];

  const handleVideoRecording = async () => {
    try {
      console.log('🎥 Starting video recording...');
      
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to record videos!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: Platform.OS === 'ios',
        quality: 1,
        videoMaxDuration: 60,
        videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
      });

      if (!result.canceled && result.assets?.[0]) {
        const videoUri = result.assets[0].uri;
        console.log('✅ Video recorded:', videoUri);
        router.push(`/caption/${encodeURIComponent(videoUri)}`);
      }
    } catch (error) {
      console.error('❌ Error recording video:', error);
      Alert.alert('Recording Error', 'Failed to record video. Please try again.');
    }
  };

  const handleGalleryUpload = async () => {
    try {
      console.log('📱 Opening gallery...');
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library permission is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: Platform.OS === 'ios',
        quality: 1,
        videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
      });

      if (!result.canceled && result.assets?.[0]) {
        const videoUri = result.assets[0].uri;
        console.log('✅ Video selected:', videoUri);
        router.push(`/caption/${encodeURIComponent(videoUri)}`);
      }
    } catch (error) {
      console.error('❌ Error selecting video:', error);
      Alert.alert('Selection Error', 'Failed to select video. Please try again.');
    }
  };

  const handleRemixGreenScreen = () => {
    Alert.alert(
      'Remix & Green Screen',
      'Feature coming soon! This will let you:\n\n• Take parts of other videos\n• Replace backgrounds\n• Create reaction videos',
      [{ text: 'Got it', style: 'default' }]
    );
  };

  const handleTemplateSelect = (template: VideoTemplate) => {
    setSelectedTemplate(template);
    setShowTemplateModal(true);
  };

  const createFromTemplate = () => {
    if (!selectedTemplate) return;
    
    setShowTemplateModal(false);
    setShowTemplateEditor(true);
  };

  const handleTemplateComplete = (videoUri: string) => {
    console.log('✅ Template video created:', videoUri);
    setShowTemplateEditor(false);
    setSelectedTemplate(null);
    router.push(`/caption/${encodeURIComponent(videoUri)}`);
  };

  const VideoCreationOptions = () => (
    <View style={styles.optionsContainer}>
      {/* Record Now */}
      <TouchableOpacity style={styles.mainOption} onPress={handleVideoRecording}>
        <LinearGradient
          colors={['#FF6B6B', '#FF8E8E']}
          style={styles.optionGradient}
        >
          <View style={styles.recordButton}>
            <View style={styles.recordInner} />
          </View>
          <Text style={styles.optionTitle}>Record Now</Text>
          <Text style={styles.optionSubtitle}>Camera preview with controls</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Upload From Device */}
      <TouchableOpacity style={styles.option} onPress={handleGalleryUpload}>
        <View style={styles.optionContent}>
          <Ionicons name="cloud-upload" size={32} color="#4ECDC4" />
          <Text style={styles.optionTitle}>Upload From Device</Text>
          <Text style={styles.optionSubtitle}>Select from gallery</Text>
        </View>
      </TouchableOpacity>

      {/* Remix / Green Screen */}
      <TouchableOpacity style={styles.option} onPress={handleRemixGreenScreen}>
        <View style={styles.optionContent}>
          <Ionicons name="color-filter" size={32} color="#45B7D1" />
          <Text style={styles.optionTitle}>Remix / Green Screen</Text>
          <Text style={styles.optionSubtitle}>Use parts of other videos</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const TemplateOptions = () => (
    <ScrollView style={styles.templatesContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Choose a Template</Text>
      <Text style={styles.sectionSubtitle}>Pre-structured video blueprints for quick creation</Text>
      
      {videoTemplates.map((template) => (
        <TouchableOpacity
          key={template.id}
          style={styles.templateCard}
          onPress={() => handleTemplateSelect(template)}
        >
          <LinearGradient
            colors={[template.previewColor, `${template.previewColor}80`]}
            style={styles.templateGradient}
          >
            <View style={styles.templateContent}>
              <Ionicons name={template.icon as any} size={24} color="#fff" />
              <View style={styles.templateInfo}>
                <Text style={styles.templateName}>{template.name}</Text>
                <Text style={styles.templateDescription}>{template.description}</Text>
                <Text style={styles.templateDetails}>
                  {template.duration}s • {template.clipSlots} clips
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View 
        style={[
          styles.content,
          {
            transform: [{
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            }],
            opacity: slideAnim,
          }
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create</Text>
          <Text style={styles.headerSubtitle}>Choose how to make your video</Text>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'video' && styles.activeTab]}
            onPress={() => setSelectedTab('video')}
          >
            <Ionicons 
              name="videocam" 
              size={20} 
              color={selectedTab === 'video' ? '#fff' : '#666'} 
            />
            <Text style={[styles.tabText, selectedTab === 'video' && styles.activeTabText]}>
              Video
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'template' && styles.activeTab]}
            onPress={() => setSelectedTab('template')}
          >
            <Ionicons 
              name="library" 
              size={20} 
              color={selectedTab === 'template' ? '#fff' : '#666'} 
            />
            <Text style={[styles.tabText, selectedTab === 'template' && styles.activeTabText]}>
              Template
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {selectedTab === 'video' ? <VideoCreationOptions /> : <TemplateOptions />}
      </Animated.View>

      {/* Template Detail Modal */}
      <Modal
        visible={showTemplateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTemplateModal(false)}
      >
        <BlurView intensity={20} style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedTemplate && (
              <>
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowTemplateModal(false)}
                  >
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalContent}>
                  <LinearGradient
                    colors={[selectedTemplate.previewColor, `${selectedTemplate.previewColor}80`]}
                    style={styles.templatePreview}
                  >
                    <Ionicons name={selectedTemplate.icon as any} size={48} color="#fff" />
                  </LinearGradient>

                  <Text style={styles.modalTitle}>{selectedTemplate.name}</Text>
                  <Text style={styles.modalDescription}>{selectedTemplate.description}</Text>

                  <View style={styles.templateFeatures}>
                    <View style={styles.feature}>
                      <Ionicons name="time" size={16} color="#666" />
                      <Text style={styles.featureText}>{selectedTemplate.duration} seconds</Text>
                    </View>
                    <View style={styles.feature}>
                      <Ionicons name="film" size={16} color="#666" />
                      <Text style={styles.featureText}>{selectedTemplate.clipSlots} clip slots</Text>
                    </View>
                    <View style={styles.feature}>
                      <Ionicons name="pulse" size={16} color="#666" />
                      <Text style={styles.featureText}>Auto beat sync</Text>
                    </View>
                    <View style={styles.feature}>
                      <Ionicons name="flash" size={16} color="#666" />
                      <Text style={styles.featureText}>Pre-timed transitions</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.createButton} onPress={createFromTemplate}>
                    <LinearGradient
                      colors={['#007AFF', '#0051D2']}
                      style={styles.createButtonGradient}
                    >
                      <Text style={styles.createButtonText}>Start Creating</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </BlurView>
      </Modal>

      {/* Template Editor */}
      <TemplateEditor
        visible={showTemplateEditor}
        template={selectedTemplate}
        onClose={() => {
          setShowTemplateEditor(false);
          setSelectedTemplate(null);
        }}
        onComplete={handleTemplateComplete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 25,
    padding: 4,
    marginBottom: 30,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  optionsContainer: {
    flex: 1,
  },
  mainOption: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  optionGradient: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  recordInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
  },
  option: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  optionContent: {
    padding: 24,
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  templatesContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 24,
  },
  templateCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  templateGradient: {
    padding: 20,
  },
  templateContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateInfo: {
    flex: 1,
    marginLeft: 16,
  },
  templateName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  templateDetails: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: 24,
    alignItems: 'center',
  },
  templatePreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  templateFeatures: {
    width: '100%',
    marginBottom: 32,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 12,
  },
  createButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  createButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});
