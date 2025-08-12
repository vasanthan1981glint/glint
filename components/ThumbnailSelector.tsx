import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    Modal,
    PanResponder,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LocalThumbnailService, { GeneratedThumbnail, ThumbnailSet } from '../lib/localThumbnailService';
import EnhancedCaptionInput from './EnhancedCaptionInput';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive dimensions for different screen sizes
const getResponsiveDimensions = () => {
  const isSmallScreen = screenWidth < 375;
  const isMediumScreen = screenWidth >= 375 && screenWidth < 414;
  const isLargeScreen = screenWidth >= 414;

  return {
    videoHeight: isSmallScreen ? 160 : isMediumScreen ? 180 : 200,
    thumbnailSize: isSmallScreen ? 70 : isMediumScreen ? 75 : 80, // Reduced for slimmer look
    thumbnailHeight: isSmallScreen ? 42 : isMediumScreen ? 45 : 48, // Reduced height
    padding: isSmallScreen ? 12 : isMediumScreen ? 16 : 20,
    thumbnailSpacing: 6, // Consistent spacing
    fontSize: {
      title: isSmallScreen ? 18 : isMediumScreen ? 19 : 20,
      section: isSmallScreen ? 16 : isMediumScreen ? 17 : 18,
      subtitle: isSmallScreen ? 13 : 14,
      caption: isSmallScreen ? 14 : isMediumScreen ? 15 : 16,
    }
  };
};

interface ThumbnailSelectorProps {
  videoUri: string;
  onThumbnailSelected: (thumbnail: GeneratedThumbnail) => void;
  selectedThumbnail?: GeneratedThumbnail;
  onCaptionChange?: (caption: string) => void;
  onProceed?: () => void;
  onCancel?: () => void;
  initialCaption?: string; // Allow setting initial caption
}

const ThumbnailSelector: React.FC<ThumbnailSelectorProps> = ({
  videoUri,
  onThumbnailSelected,
  selectedThumbnail,
  onCaptionChange,
  onProceed,
  onCancel,
  initialCaption = ''
}) => {
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video>(null);
  const [thumbnailSet, setThumbnailSet] = useState<ThumbnailSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingCustom, setGeneratingCustom] = useState(false);
  const [caption, setCaption] = useState(initialCaption);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showCustomImageModal, setShowCustomImageModal] = useState(false);
  const [previewThumbnail, setPreviewThumbnail] = useState<GeneratedThumbnail | null>(null);
  const [videoProcessing, setVideoProcessing] = useState(true);
  const [currentThumbnailIndex, setCurrentThumbnailIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const thumbnailScrollRef = useRef<ScrollView>(null);
  
  // Get responsive dimensions
  const dimensions = getResponsiveDimensions();

  // Create pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Handle swipe movement
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (!thumbnailSet) return;
        
        const allThumbnails = [
          ...thumbnailSet.autoThumbnails,
          ...(thumbnailSet.customThumbnail ? [thumbnailSet.customThumbnail] : [])
        ];
        
        // Swipe threshold
        const swipeThreshold = 50;
        
        if (gestureState.dx > swipeThreshold && currentThumbnailIndex > 0) {
          // Swipe right - go to previous thumbnail
          const newIndex = currentThumbnailIndex - 1;
          setCurrentThumbnailIndex(newIndex);
          handleThumbnailSelect(allThumbnails[newIndex]);
          scrollToThumbnail(newIndex);
        } else if (gestureState.dx < -swipeThreshold && currentThumbnailIndex < allThumbnails.length - 1) {
          // Swipe left - go to next thumbnail
          const newIndex = currentThumbnailIndex + 1;
          setCurrentThumbnailIndex(newIndex);
          handleThumbnailSelect(allThumbnails[newIndex]);
          scrollToThumbnail(newIndex);
        }
      },
    })
  ).current;

  const scrollToThumbnail = (index: number) => {
    if (thumbnailScrollRef.current && thumbnailSet) {
      const thumbnailWidth = dimensions.thumbnailSize + dimensions.thumbnailSpacing; // More precise calculation
      const scrollPosition = index * thumbnailWidth;
      // Use smoother scrolling with timing
      thumbnailScrollRef.current.scrollTo({ 
        x: scrollPosition, 
        animated: true 
      });
    }
  };

  useEffect(() => {
    generateThumbnails();
  }, [videoUri]);

  // Update caption when initialCaption changes
  useEffect(() => {
    if (initialCaption !== caption) {
      setCaption(initialCaption);
      if (onCaptionChange) {
        onCaptionChange(initialCaption);
      }
    }
  }, [initialCaption]);

  const generateThumbnails = async () => {
    try {
      setLoading(true);
      setVideoProcessing(true);
      console.log('🎬 Starting thumbnail generation for video...');

      const set = await LocalThumbnailService.generateThumbnailSet(videoUri);
      setThumbnailSet(set);
      
      // Automatically select the default thumbnail
      onThumbnailSelected(set.selectedThumbnail);

      console.log('✅ Thumbnails ready for selection');
    } catch (error) {
      console.error('❌ Thumbnail generation failed:', error);
      
      // Create a fallback thumbnail set even if generation fails
      const fallbackSet: ThumbnailSet = {
        autoThumbnails: [
          {
            uri: 'https://via.placeholder.com/320x180/4ECDC4/FFFFFF?text=Video+Thumbnail',
            timePoint: 0.5,
            isCustom: false,
            timestamp: Date.now()
          }
        ],
        selectedThumbnail: {
          uri: 'https://via.placeholder.com/320x180/4ECDC4/FFFFFF?text=Video+Thumbnail',
          timePoint: 0.5,
          isCustom: false,
          timestamp: Date.now()
        }
      };
      
      setThumbnailSet(fallbackSet);
      onThumbnailSelected(fallbackSet.selectedThumbnail);
      
      Alert.alert(
        'Thumbnail Generation',
        'Could not extract thumbnails from video. Using placeholder thumbnail.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setLoading(false);
      setVideoProcessing(false);
    }
  };

  const handleCustomThumbnail = async () => {
    try {
      setGeneratingCustom(true);
      
      // Ask user to choose between camera or gallery
      Alert.alert(
        'Add Custom Thumbnail',
        'Choose how you want to add a custom thumbnail image',
        [
          {
            text: 'Camera',
            onPress: () => pickCustomThumbnailFromCamera(),
          },
          {
            text: 'Gallery',
            onPress: () => pickCustomThumbnailFromGallery(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setGeneratingCustom(false),
          },
        ]
      );
    } catch (error) {
      console.error('❌ Custom thumbnail selection failed:', error);
      setGeneratingCustom(false);
    }
  };

  const pickCustomThumbnailFromCamera = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos!');
        setGeneratingCustom(false);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9], // YouTube thumbnail aspect ratio
        quality: 1,
      });

      if (!result.canceled) {
        const customThumbnail: GeneratedThumbnail = {
          uri: result.assets[0].uri,
          timePoint: 0,
          isCustom: true,
          timestamp: Date.now()
        };

        if (thumbnailSet) {
          const updatedSet = {
            ...thumbnailSet,
            customThumbnail,
            selectedThumbnail: customThumbnail
          };
          
          setThumbnailSet(updatedSet);
          onThumbnailSelected(customThumbnail);
          
          console.log('📸 Custom thumbnail from camera selected');
        }
      }
    } catch (error) {
      console.error('❌ Camera thumbnail failed:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setGeneratingCustom(false);
    }
  };

  const pickCustomThumbnailFromGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery permission is required to select photos!');
        setGeneratingCustom(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9], // YouTube thumbnail aspect ratio
        quality: 1,
      });

      if (!result.canceled) {
        const customThumbnail: GeneratedThumbnail = {
          uri: result.assets[0].uri,
          timePoint: 0,
          isCustom: true,
          timestamp: Date.now()
        };

        if (thumbnailSet) {
          const updatedSet = {
            ...thumbnailSet,
            customThumbnail,
            selectedThumbnail: customThumbnail
          };
          
          setThumbnailSet(updatedSet);
          onThumbnailSelected(customThumbnail);
          
          console.log('📸 Custom thumbnail from gallery selected');
        }
      }
    } catch (error) {
      console.error('❌ Gallery thumbnail failed:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    } finally {
      setGeneratingCustom(false);
    }
  };

  const handleThumbnailSelect = (thumbnail: GeneratedThumbnail) => {
    if (thumbnailSet) {
      const updatedSet = {
        ...thumbnailSet,
        selectedThumbnail: thumbnail
      };
      setThumbnailSet(updatedSet);
      
      // Update current index for swipe functionality
      const allThumbnails = [
        ...thumbnailSet.autoThumbnails,
        ...(thumbnailSet.customThumbnail ? [thumbnailSet.customThumbnail] : [])
      ];
      const newIndex = allThumbnails.findIndex(t => t.uri === thumbnail.uri);
      if (newIndex !== -1) {
        setCurrentThumbnailIndex(newIndex);
      }
    }
    onThumbnailSelected(thumbnail);
  };

  const handleCaptionChange = (text: string) => {
    setCaption(text);
    // Immediately notify parent component of caption changes
    if (onCaptionChange) {
      onCaptionChange(text);
    }
    console.log('📝 Caption updated:', text);
  };

  const addHashtag = (hashtag: string) => {
    const newCaption = caption.trim() + (caption.trim() ? ' ' : '') + hashtag;
    handleCaptionChange(newCaption);
  };

  const replaceCustomThumbnail = async () => {
    try {
      setGeneratingCustom(true);
      
      // Ask user to choose between camera or gallery for replacement
      Alert.alert(
        'Change Custom Thumbnail',
        'Choose how you want to replace your custom thumbnail',
        [
          {
            text: 'Camera',
            onPress: () => pickCustomThumbnailFromCamera(),
          },
          {
            text: 'Gallery',
            onPress: () => pickCustomThumbnailFromGallery(),
          },
          {
            text: 'Remove Custom',
            style: 'destructive',
            onPress: () => removeCustomThumbnail(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setGeneratingCustom(false),
          },
        ]
      );
    } catch (error) {
      console.error('❌ Custom thumbnail replacement failed:', error);
      setGeneratingCustom(false);
    }
  };

  const removeCustomThumbnail = () => {
    if (thumbnailSet) {
      const updatedSet = {
        ...thumbnailSet,
        customThumbnail: undefined
      };
      
      // Select the first auto thumbnail as default
      const newSelected = thumbnailSet.autoThumbnails[0] || thumbnailSet.selectedThumbnail;
      updatedSet.selectedThumbnail = newSelected;
      
      setThumbnailSet(updatedSet);
      onThumbnailSelected(newSelected);
      
      console.log('🗑️ Custom thumbnail removed');
      Alert.alert('Custom Thumbnail Removed', 'Your custom thumbnail has been removed.');
    }
    setGeneratingCustom(false);
  };

  const showThumbnailPreview = (thumbnail: GeneratedThumbnail) => {
    setPreviewThumbnail(thumbnail);
  };

  const closeThumbnailPreview = () => {
    setPreviewThumbnail(null);
  };

  const handleProceedWithUpload = () => {
    // Validate before proceeding
    if (!selectedThumbnail) {
      Alert.alert('Missing Thumbnail', 'Please select a thumbnail before uploading.');
      return;
    }

    if (!caption.trim()) {
      Alert.alert('Missing Caption', 'Please add a caption for your video.');
      return;
    }

    // Show confirmation with preview
    Alert.alert(
      'Ready to Share?',
      `Caption: "${caption.substring(0, 50)}${caption.length > 50 ? '...' : ''}"\n\nThumbnail: ${selectedThumbnail.isCustom ? 'Custom image' : 'Auto-generated'}`,
      [
        { text: 'Edit', style: 'cancel' },
        { 
          text: 'Share', 
          style: 'default',
          onPress: () => {
            // Prevent multiple calls by immediately returning if already called
            if (onProceed) {
              console.log('🎯 ThumbnailSelector: Calling onProceed');
              onProceed();
            }
          }
        }
      ]
    );
  };

  const toggleVideoPlayback = async () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        await videoRef.current.pauseAsync();
        setIsVideoPlaying(false);
      } else {
        await videoRef.current.playAsync();
        setIsVideoPlaying(true);
      }
    }
  };

  const renderThumbnailOption = (thumbnail: GeneratedThumbnail, index: number) => {
    const isSelected = selectedThumbnail?.uri === thumbnail.uri;
    const displayInfo = LocalThumbnailService.getThumbnailDisplayInfo(thumbnail);

    return (
      <TouchableOpacity
        key={`${thumbnail.uri}-${index}`}
        style={[
          styles.thumbnailOption,
          isSelected && styles.selectedThumbnailOption,
          { 
            marginRight: dimensions.thumbnailSpacing,
            // Make touch area bigger
            paddingHorizontal: 8,
            paddingVertical: 6,
            minWidth: dimensions.thumbnailSize + 16, // Add extra touch area
            minHeight: dimensions.thumbnailHeight + 32, // Add extra touch area
          }
        ]}
        onPress={() => handleThumbnailSelect(thumbnail)}
        onLongPress={() => showThumbnailPreview(thumbnail)}
        delayLongPress={300} // Reduced delay for better responsiveness
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Bigger touch area
      >
        <View style={[
          styles.thumbnailContainer,
          { 
            width: dimensions.thumbnailSize, 
            height: dimensions.thumbnailHeight,
            borderColor: isSelected ? '#007AFF' : 'transparent',
          }
        ]}>
          <Image 
            source={{ uri: thumbnail.uri }} 
            style={[
              styles.thumbnailImage,
              { 
                width: dimensions.thumbnailSize, 
                height: dimensions.thumbnailHeight 
              }
            ]}
            resizeMode="cover"
            defaultSource={{ uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' }}
          />
          
          {isSelected && (
            <View style={styles.selectedOverlay}>
              <Ionicons name="checkmark-circle" size={18} color="#007AFF" />
            </View>
          )}
          
          {displayInfo.isRecommended && !thumbnail.isCustom && (
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>✨</Text>
            </View>
          )}

          {/* Edit button for custom thumbnails */}
          {thumbnail.isCustom && (
            <TouchableOpacity 
              style={styles.editThumbnailButton}
              onPress={(e) => {
                e.stopPropagation(); // Prevent thumbnail selection
                replaceCustomThumbnail();
              }}
              hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            >
              <Ionicons name="create-outline" size={14} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={[
          styles.thumbnailTitle,
          isSelected && styles.selectedThumbnailTitle,
          { fontSize: 10, maxWidth: dimensions.thumbnailSize + 16 }
        ]} numberOfLines={1}>
          {displayInfo.title}
        </Text>
        
        <Text style={[
          styles.thumbnailSubtitle, 
          { fontSize: 8, maxWidth: dimensions.thumbnailSize + 16 }
        ]} numberOfLines={1}>
          {displayInfo.subtitle}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header with Back Button */}
        <View style={[styles.header, { paddingHorizontal: dimensions.padding }]}>
          <TouchableOpacity style={styles.backButton} onPress={onCancel}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: dimensions.fontSize.title }]}>
            Create Post
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Loading Overlay */}
        <View style={styles.loadingContainer}>
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
          <Text style={styles.loadingText}>Processing your video...</Text>
          <Text style={styles.loadingSubtext}>
            Generating thumbnails like YouTube
          </Text>
          <View style={styles.loadingSteps}>
            <View style={styles.loadingStep}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingStepText}>Analyzing video frames</Text>
            </View>
            <View style={styles.loadingStep}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingStepText}>Creating thumbnails</Text>
            </View>
            <View style={styles.loadingStep}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingStepText}>Optimizing preview</Text>
            </View>
          </View>
          
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={styles.progressFill} />
            </View>
            <Text style={styles.progressText}>This may take a few seconds...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!thumbnailSet) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to generate thumbnails</Text>
        <TouchableOpacity style={styles.retryButton} onPress={generateThumbnails}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with Back Button */}
      <View style={[styles.header, { paddingHorizontal: dimensions.padding }]}>
        <TouchableOpacity style={styles.backButton} onPress={onCancel}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: dimensions.fontSize.title }]}>
          Create Post
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Video Preview Section */}
        <View style={[styles.videoPreviewSection, { paddingHorizontal: dimensions.padding }]}>
          <Text style={[styles.sectionTitle, { fontSize: dimensions.fontSize.section }]}>
            Preview Your Video
          </Text>
          <TouchableOpacity 
            style={styles.videoContainer} 
            onPress={videoProcessing ? undefined : toggleVideoPlayback}
            disabled={videoProcessing}
          >
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={[styles.videoPreview, { height: dimensions.videoHeight }]}
              useNativeControls={false}
              shouldPlay={isVideoPlaying}
              isLooping={true}
              resizeMode={ResizeMode.COVER}
            />
            {videoProcessing ? (
              <View style={styles.videoLoadingOverlay}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.videoLoadingText}>Processing video...</Text>
              </View>
            ) : (
              <View style={styles.playOverlay}>
                <Ionicons 
                  name={isVideoPlaying ? "pause-circle" : "play-circle"} 
                  size={screenWidth < 375 ? 40 : 48} 
                  color="rgba(255, 255, 255, 0.9)" 
                />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Caption Input Section */}
        <View style={[styles.captionSection, { paddingHorizontal: dimensions.padding }]}>
          <Text style={[styles.sectionTitle, { fontSize: dimensions.fontSize.section }]}>
            Add Caption
          </Text>
          <EnhancedCaptionInput
            value={caption}
            onChangeText={handleCaptionChange}
            placeholder="Write a caption for your video..."
            maxLength={2200}
            style={styles.enhancedCaptionInput}
            showPasteButton={true}
          />
          
          {/* Caption Suggestions */}
          {caption.length === 0 && (
            <View style={styles.captionSuggestions}>
              <Text style={styles.suggestionsTitle}>💡 Caption Ideas:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[
                  "Check this out! 🔥",
                  "New video is live! ✨",
                  "What do you think? 💭",
                  "Behind the scenes 🎬",
                  "Just dropped this! 🚀"
                ].map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionButton}
                    onPress={() => handleCaptionChange(suggestion)}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Hashtag Suggestions */}
          <View style={styles.hashtagSuggestions}>
            <Text style={styles.suggestionsTitle}># Popular Hashtags:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                "#viral",
                "#trending",
                "#fyp",
                "#video",
                "#content",
                "#creator",
                "#awesome",
                "#amazing"
              ].map((hashtag, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.hashtagButton}
                  onPress={() => addHashtag(hashtag)}
                >
                  <Text style={styles.hashtagText}>{hashtag}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Thumbnail Selection Section */}
        <View style={styles.thumbnailSection}>
          <Text style={[
            styles.sectionTitle, 
            { 
              fontSize: dimensions.fontSize.section,
              paddingHorizontal: dimensions.padding 
            }
          ]}>
            Choose Thumbnail
          </Text>
          <Text style={[
            styles.subtitle,
            { 
              fontSize: dimensions.fontSize.subtitle,
              paddingHorizontal: dimensions.padding 
            }
          ]}>
            Select the best frame or upload a custom image like YouTube
          </Text>

          <View {...panResponder.panHandlers}>
            <ScrollView 
              ref={thumbnailScrollRef}
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.thumbnailScroll}
              contentContainerStyle={[styles.thumbnailScrollContent, { paddingHorizontal: dimensions.padding }]}
              pagingEnabled={false}
              snapToInterval={dimensions.thumbnailSize + dimensions.thumbnailSpacing}
              snapToAlignment="start"
              decelerationRate="fast"
              bounces={false}
              alwaysBounceHorizontal={false}
              overScrollMode="never"
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: false }
              )}
              scrollEventThrottle={8}
              removeClippedSubviews={true}
            >
              {videoProcessing ? (
                <View style={styles.thumbnailLoadingContainer}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.thumbnailLoadingText}>Generating...</Text>
                </View>
              ) : (
                <>
                  {/* Auto-generated thumbnails */}
                  {thumbnailSet?.autoThumbnails.map((thumbnail, index) => 
                    renderThumbnailOption(thumbnail, index)
                  )}

                  {/* Custom thumbnail option */}
                  {thumbnailSet?.customThumbnail ? (
                    <View style={[
                      styles.customThumbnailWrapper,
                      { minWidth: dimensions.thumbnailSize + 16 } // Match the regular thumbnail touch area
                    ]}>
                      {renderThumbnailOption(thumbnailSet.customThumbnail, 999)}
                      <TouchableOpacity 
                        style={styles.changeThumbnailButton}
                        onPress={replaceCustomThumbnail}
                        disabled={generatingCustom}
                      >
                        <Ionicons name="swap-horizontal" size={16} color="#fff" />
                        <Text style={styles.changeThumbnailText}>
                          {generatingCustom ? 'Changing...' : 'Change'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.customThumbnailOption}
                      onPress={handleCustomThumbnail}
                      disabled={generatingCustom}
                    >
                      <View style={[
                        styles.customThumbnailContainer,
                        { 
                          width: dimensions.thumbnailSize, 
                          height: dimensions.thumbnailHeight 
                        }
                      ]}>
                        {generatingCustom ? (
                          <ActivityIndicator size="small" color="#007AFF" />
                        ) : (
                          <Ionicons name="add-circle-outline" size={screenWidth < 375 ? 24 : 32} color="#007AFF" />
                        )}
                      </View>
                      <Text style={[styles.customThumbnailTitle, { fontSize: 11 }]}>
                        {generatingCustom ? 'Adding...' : 'Custom'}
                      </Text>
                      <Text style={[styles.customThumbnailSubtitle, { fontSize: 9 }]}>
                        Upload image
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
          </View>

          {/* Swipe indicator dots */}
          {thumbnailSet && !videoProcessing && (
            <View style={styles.paginationContainer}>
              {[
                ...thumbnailSet.autoThumbnails,
                ...(thumbnailSet.customThumbnail ? [thumbnailSet.customThumbnail] : []),
                ...(thumbnailSet.customThumbnail ? [] : [{ uri: 'custom-placeholder', isCustom: true }])
              ].map((_, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.paginationDot,
                    currentThumbnailIndex === index && styles.paginationDotActive
                  ]}
                  onPress={() => {
                    const allThumbnails = [
                      ...thumbnailSet.autoThumbnails,
                      ...(thumbnailSet.customThumbnail ? [thumbnailSet.customThumbnail] : [])
                    ];
                    if (index < allThumbnails.length) {
                      setCurrentThumbnailIndex(index);
                      handleThumbnailSelect(allThumbnails[index]);
                      scrollToThumbnail(index);
                    }
                  }}
                />
              ))}
            </View>
          )}

          {/* Swipe hint */}
          <View style={styles.swipeHintContainer}>
            <Ionicons 
              name="chevron-back" 
              size={screenWidth < 375 ? 14 : screenWidth < 414 ? 16 : 18} 
              color="#007AFF" 
            />
            <Text style={styles.swipeHintText}>Swipe to browse thumbnails</Text>
            <Ionicons 
              name="chevron-forward" 
              size={screenWidth < 375 ? 14 : screenWidth < 414 ? 16 : 18} 
              color="#007AFF" 
            />
          </View>
        </View>

        {/* Tips section */}
        <View style={[styles.tipsContainer, { marginHorizontal: dimensions.padding }]}>
          <Text style={[styles.tipsTitle, { fontSize: dimensions.fontSize.subtitle }]}>
            💡 Thumbnail Tips
          </Text>
          <Text style={[styles.tipsText, { fontSize: dimensions.fontSize.subtitle - 2 }]}>
            • Choose clear, bright images{'\n'}
            • Faces and text work well{'\n'}
            • Custom images get more clicks{'\n'}
            • Recommended size: 1280×720px
          </Text>
        </View>
      </ScrollView>

      {/* Fixed Action Buttons at Bottom */}
      <View style={[
        styles.actionButtons, 
        { 
          paddingHorizontal: dimensions.padding,
          paddingBottom: Math.max(insets.bottom, 16)
        }
      ]}>
        <TouchableOpacity 
          style={[
            styles.proceedButton,
            (!selectedThumbnail || !caption.trim()) && styles.proceedButtonDisabled
          ]} 
          onPress={handleProceedWithUpload}
          disabled={!selectedThumbnail || !caption.trim()}
        >
          <Text style={[styles.proceedButtonText, { fontSize: dimensions.fontSize.caption }]}>
            {!selectedThumbnail ? 'Select Thumbnail' : !caption.trim() ? 'Add Caption' : 'Share'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Thumbnail Preview Modal */}
      <Modal
        visible={!!previewThumbnail}
        transparent={true}
        animationType="fade"
        onRequestClose={closeThumbnailPreview}
      >
        <TouchableOpacity 
          style={styles.previewModalOverlay}
          activeOpacity={1}
          onPress={closeThumbnailPreview}
        >
          <View style={styles.previewModalContent}>
            {previewThumbnail && (
              <>
                <Image 
                  source={{ uri: previewThumbnail.uri }} 
                  style={styles.previewImage}
                  resizeMode="contain"
                />
                <View style={styles.previewInfo}>
                  <Text style={styles.previewTitle}>
                    {previewThumbnail.isCustom ? 'Custom Thumbnail' : 'Auto Thumbnail'}
                  </Text>
                  <Text style={styles.previewSubtitle}>
                    {previewThumbnail.isCustom 
                      ? 'Uploaded by you' 
                      : `Frame at ${Math.round(previewThumbnail.timePoint * 100)}%`
                    }
                  </Text>
                  <TouchableOpacity 
                    style={styles.previewCloseButton}
                    onPress={closeThumbnailPreview}
                  >
                    <Text style={styles.previewCloseText}>Close Preview</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40, // Same width as back button to center title
  },
  scrollContainer: {
    flex: 1,
  },
  videoPreviewSection: {
    marginBottom: 8,
    marginTop: 4,
  },
  videoContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  videoPreview: {
    width: '100%',
    backgroundColor: '#000',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  videoLoadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
  captionSection: {
    marginBottom: 8,
  },
  enhancedCaptionInput: {
    marginTop: 8,
  },
  captionInputContainer: {
    position: 'relative',
  },
  clearCaptionButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    padding: 4,
  },
  captionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#ff6b6b',
    fontWeight: '500',
  },
  captionSuggestions: {
    marginTop: 8,
  },
  suggestionsTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
  suggestionButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  suggestionText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  hashtagSuggestions: {
    marginTop: 6,
  },
  hashtagButton: {
    backgroundColor: '#e8f4fd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  hashtagText: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 6,
  },
  captionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    color: '#000',
    textAlignVertical: 'top',
    backgroundColor: '#f9f9f9',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  thumbnailSection: {
    marginBottom: 8,
  },
  actionButtons: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  proceedButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  proceedButtonDisabled: {
    backgroundColor: '#ccc',
  },
  proceedButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  loadingSpinner: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  loadingSteps: {
    marginTop: 24,
    alignItems: 'center',
  },
  loadingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
  },
  loadingStepText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 8,
  },
  progressContainer: {
    marginTop: 20,
    width: '80%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    width: '60%',
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  thumbnailScroll: {
    marginBottom: 12,
    height: 110, // Increased height for bigger touch areas
    maxHeight: 110,
  },
  thumbnailScrollContent: {
    paddingVertical: 8,
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  thumbnailLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  thumbnailLoadingText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 8,
  },
  thumbnailOption: {
    alignItems: 'center',
    marginRight: 6, // Reduced spacing
    marginBottom: 4, // Add bottom margin for better layout
  },
  selectedThumbnailOption: {
    transform: [{ scale: 1.05 }], // Slight scale for selected state
  },
  thumbnailContainer: {
    position: 'relative',
    borderRadius: 8, // Slightly more rounded
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#f8f9fa', // Light background
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  thumbnailImage: {
    borderRadius: 4,
  },
  selectedOverlay: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    padding: 1,
  },
  editThumbnailButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    padding: 3,
  },
  recommendedBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  recommendedText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  thumbnailTitle: {
    fontWeight: '600',
    color: '#000',
    marginTop: 3,
    textAlign: 'center',
    lineHeight: 12,
  },
  selectedThumbnailTitle: {
    color: '#007AFF',
  },
  thumbnailSubtitle: {
    color: '#666',
    marginTop: 1,
    textAlign: 'center',
    lineHeight: 10,
  },
  customThumbnailOption: {
    alignItems: 'center',
    marginRight: 8,
  },
  customThumbnailWrapper: {
    alignItems: 'center',
    marginRight: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  changeThumbnailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    minHeight: 28,
  },
  changeThumbnailText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  customThumbnailContainer: {
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  customThumbnailTitle: {
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 4,
    textAlign: 'center',
  },
  customThumbnailSubtitle: {
    color: '#666',
    marginTop: 1,
    textAlign: 'center',
  },
  tipsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
    marginBottom: 16,
  },
  tipsTitle: {
    fontWeight: '600',
    color: '#000',
    marginBottom: 6,
  },
  tipsText: {
    color: '#666',
    lineHeight: 16,
  },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  previewModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    maxWidth: '90%',
    maxHeight: '70%',
    alignItems: 'center',
  },
  previewImage: {
    width: 280,
    height: 160,
    borderRadius: 8,
    marginBottom: 16,
  },
  previewInfo: {
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  previewCloseButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  previewCloseText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    borderRadius: 20,
    marginHorizontal: 20,
  },
  paginationDot: {
    width: screenWidth < 375 ? 10 : screenWidth < 414 ? 12 : 14,
    height: screenWidth < 375 ? 10 : screenWidth < 414 ? 12 : 14,
    borderRadius: screenWidth < 375 ? 5 : screenWidth < 414 ? 6 : 7,
    backgroundColor: '#E0E0E0',
    marginHorizontal: screenWidth < 375 ? 5 : 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
  },
  paginationDotActive: {
    backgroundColor: '#007AFF',
    width: screenWidth < 375 ? 14 : screenWidth < 414 ? 16 : 18,
    height: screenWidth < 375 ? 14 : screenWidth < 414 ? 16 : 18,
    borderRadius: screenWidth < 375 ? 7 : screenWidth < 414 ? 8 : 9,
    borderWidth: 2,
    borderColor: '#007AFF',
    transform: [{ scale: 1.1 }],
  },
  swipeHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
  },
  swipeHintText: {
    color: '#007AFF',
    fontSize: screenWidth < 375 ? 11 : screenWidth < 414 ? 12 : 13,
    fontWeight: '600',
    marginHorizontal: 8,
  },
});

export default ThumbnailSelector;
