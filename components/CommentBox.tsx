import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Keyboard,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CommentBoxProps {
  // User profile data
  currentUserProfile: {
    avatar?: string;
    username?: string;
    userId?: string;
  };
  
  // Comment input states
  commentInput: string;
  setCommentInput: (text: string) => void;
  replyInput: string;
  setReplyInput: (text: string) => void;
  
  // Reply state
  replyingToCommentId: string | null;
  setReplyingToCommentId: (id: string | null) => void;
  
  // Focus and typing states
  commentInputFocused: boolean;
  setCommentInputFocused: (focused: boolean) => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  
  // Keyboard states
  isKeyboardVisible: boolean;
  setIsKeyboardVisible: (visible: boolean) => void;
  showAndroidTypeBar: boolean;
  setShowAndroidTypeBar: (show: boolean) => void;
  
  // Refs
  commentInputRef: React.RefObject<TextInput | null>;
  replyInputRef: React.RefObject<TextInput | null>;
  
  // Animation values
  commentBoxOpacity: Animated.Value;
  commentListOffset: Animated.Value;
  
  // Functions
  addComment: (text: string, parentId?: string, userProfile?: any) => Promise<void>;
  onCommentCountUpdate?: (count: number) => void;
  CommentCountService?: any;
  
  // Platform-specific
  inputAccessoryViewID?: string;
  replyInputAccessoryViewID?: string;
}

export default function CommentBox({
  currentUserProfile,
  commentInput,
  setCommentInput,
  replyInput,
  setReplyInput,
  replyingToCommentId,
  setReplyingToCommentId,
  commentInputFocused,
  setCommentInputFocused,
  isTyping,
  setIsTyping,
  isKeyboardVisible,
  setIsKeyboardVisible,
  showAndroidTypeBar,
  setShowAndroidTypeBar,
  commentInputRef,
  replyInputRef,
  commentBoxOpacity,
  commentListOffset,
  addComment,
  onCommentCountUpdate,
  CommentCountService,
  inputAccessoryViewID,
  replyInputAccessoryViewID,
}: CommentBoxProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  
  // Debug logging for user profile
  console.log('💬 CommentBox currentUserProfile:', {
    avatar: currentUserProfile?.avatar,
    username: currentUserProfile?.username,
    userId: currentUserProfile?.userId,
  });
  
  // Create enhanced user profile with better fallbacks
    // Enhanced user profile with comprehensive fallbacks
  const enhancedUserProfile = useMemo(() => {
    return {
      avatar: currentUserProfile?.avatar || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserProfile?.username || currentUserProfile?.userId || 'User')}&size=40&background=4ECDC4&color=ffffff&format=png`,
      username: currentUserProfile?.username || currentUserProfile?.userId || 'User',
      userId: currentUserProfile?.userId || 'anonymous'
    };
  }, [currentUserProfile]);
  
  console.log('💬 CommentBox enhancedUserProfile:', enhancedUserProfile);
  
  // Local state for better control
  const [localKeyboardHeight, setLocalKeyboardHeight] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputHeight, setInputHeight] = useState(24);
  
  // Animation values for smooth transitions
  const containerHeightAnim = useRef(new Animated.Value(Platform.OS === 'android' ? 50 : 60)).current;
  const sendButtonScaleAnim = useRef(new Animated.Value(1)).current;
  
  // Enhanced keyboard listeners for better Android support
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        console.log('📱 Keyboard showing:', event.endCoordinates.height);
        setLocalKeyboardHeight(event.endCoordinates.height);
        setIsKeyboardVisible(true);
        setIsTyping(true);
        
        // Enhanced Android keyboard handling with better constraints
        if (Platform.OS === 'android') {
          // For Android, use minimal height to prevent extra space
          const safeAndroidHeight = Math.max(50, Math.min(60, inputHeight + 16));
          Animated.timing(containerHeightAnim, {
            toValue: safeAndroidHeight,
            duration: 150, // Faster animation for Android
            useNativeDriver: false,
          }).start();
        } else {
          // iOS handling
          Animated.timing(containerHeightAnim, {
            toValue: Math.max(80, inputHeight + 40),
            duration: 250,
            useNativeDriver: false,
          }).start();
        }
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        console.log('📱 Keyboard hiding');
        setLocalKeyboardHeight(0);
        setIsKeyboardVisible(false);
        
        // Delay typing mode exit for smooth transitions - more aggressive for Android
        setTimeout(() => {
          if (!commentInputFocused) {
            setIsTyping(false);
            
            Animated.timing(containerHeightAnim, {
              toValue: Platform.OS === 'android' ? 50 : 60,
              duration: Platform.OS === 'ios' ? 250 : 150, // Faster on Android
              useNativeDriver: false,
            }).start();
          }
        }, Platform.OS === 'android' ? 200 : 100); // Shorter delay for Android
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [commentInputFocused, inputHeight, containerHeightAnim]);

  // Enhanced comment submission with retry logic - works for ALL users
  const handleSubmitComment = useCallback(async (textToSubmit: string, isReply: boolean) => {
    if (!textToSubmit.trim() || isSubmitting) {
      console.log('❌ No text to send or already submitting');
      return;
    }

    console.log('🚀 Starting comment submission:', {
      text: textToSubmit,
      isReply,
      userId: currentUserProfile?.userId || 'anonymous',
      username: currentUserProfile?.username || 'Anonymous'
    });

    setIsSubmitting(true);
    
    // Animate send button for visual feedback
    Animated.sequence([
      Animated.timing(sendButtonScaleAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(sendButtonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Clear inputs immediately for responsive UX
    if (isReply) {
      setReplyInput('');
      const parentId = replyingToCommentId;
      setReplyingToCommentId(null);
      
      try {
        // Universal reply submission - works for any user with enhanced profile handling
        const userProfile = {
          username: currentUserProfile?.username || currentUserProfile?.userId || 'User',
          avatar: currentUserProfile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserProfile?.username || currentUserProfile?.userId || 'User')}&size=40&background=4ECDC4&color=ffffff&format=png`,
          userId: currentUserProfile?.userId || currentUserProfile?.username || `user_${Date.now()}`,
          timestamp: new Date().toISOString()
        };

        console.log('💬 Submitting reply with profile:', userProfile);

        await addComment(
          textToSubmit.trim(),
          parentId || undefined,
          userProfile
        );
        console.log('✅ Reply added successfully for user:', currentUserProfile?.username || 'Anonymous');
        
        // Enhanced haptic feedback
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (hapticError) {
          console.log('Haptic feedback not available');
        }
        
        // Dismiss keyboard after successful submission
        if (replyInputRef.current) {
          replyInputRef.current.blur();
        }
        
      } catch (error) {
        console.error('❌ Failed to add reply:', error);
        // Restore input on error
        setReplyInput(textToSubmit);
        setReplyingToCommentId(parentId);
        
        // Show user-friendly error message
        console.log('Please try again - reply submission failed');
      }
    } else {
      setCommentInput('');
      
      try {
        // Universal comment submission - works for any user with enhanced profile handling
        const userProfile = {
          username: currentUserProfile?.username || currentUserProfile?.userId || 'User',
          avatar: currentUserProfile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserProfile?.username || currentUserProfile?.userId || 'User')}&size=40&background=4ECDC4&color=ffffff&format=png`,
          userId: currentUserProfile?.userId || currentUserProfile?.username || `user_${Date.now()}`,
          timestamp: new Date().toISOString()
        };

        console.log('💬 Submitting comment with profile:', userProfile);

        await addComment(
          textToSubmit.trim(),
          undefined,
          userProfile
        );
        
        // Update comment count if service is provided
        if (CommentCountService && onCommentCountUpdate) {
          try {
            const newCount = await CommentCountService.getCommentCount('1');
            onCommentCountUpdate(newCount);
          } catch (countError) {
            console.warn('⚠️ Failed to update comment count:', countError);
          }
        }
        
        console.log('✅ Comment added successfully for user:', currentUserProfile?.username || 'Anonymous');
        
        // Enhanced haptic feedback
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (hapticError) {
          console.log('Haptic feedback not available');
        }
        
        // Dismiss keyboard after successful submission
        const currentInputRef = replyingToCommentId ? replyInputRef : commentInputRef;
        if (currentInputRef.current) {
          currentInputRef.current.blur();
        }
        
      } catch (error) {
        console.error('❌ Failed to add comment:', error);
        // Restore input on error
        setCommentInput(textToSubmit);
        
        // Show user-friendly error message
        console.log('Please try again - comment submission failed');
      }
    }
    
    setIsSubmitting(false);
  }, [isSubmitting, replyingToCommentId, currentUserProfile, addComment, CommentCountService, onCommentCountUpdate, commentInputRef, replyInputRef, sendButtonScaleAnim]);

  // Handle input content size change for better Android support
  const handleContentSizeChange = useCallback((event: any) => {
    const newHeight = Math.min(Math.max(24, event.nativeEvent.contentSize.height), Platform.OS === 'android' ? 40 : 100); // FIXED: Normal max height for Android
    setInputHeight(newHeight);
    
    // Update container height accordingly - normal sizing for Android
    if (isTyping) {
      const targetHeight = Platform.OS === 'android' 
        ? Math.min(60, newHeight + 12) // FIXED: Normal height for Android
        : Math.max(120, newHeight + 60);
        
      Animated.timing(containerHeightAnim, {
        toValue: targetHeight,
        duration: Platform.OS === 'android' ? 50 : 150, // Much faster on Android
        useNativeDriver: false,
      }).start();
    }
  }, [isTyping, containerHeightAnim]);

  // Enhanced focus handling - much better Android keyboard management
  const handleInputFocus = useCallback(() => {
    console.log('📝 Input focused');
    setCommentInputFocused(true);
    setIsTyping(true);
    
    if (Platform.OS === 'android') {
      setShowAndroidTypeBar(true);
      
      // Simplified Android keyboard handling - less aggressive
      const ensureKeyboardVisible = () => {
        setIsKeyboardVisible(true);
        // Use very conservative height for Android to prevent issues
        Animated.timing(containerHeightAnim, {
          toValue: 70, // Very conservative height for Android
          duration: 100, // Fast animation
          useNativeDriver: false,
        }).start();
      };
      
      // Single timing attempt for better reliability
      setTimeout(ensureKeyboardVisible, 100);
    } else {
      // iOS handling remains the same
      Animated.timing(containerHeightAnim, {
        toValue: Math.max(120, inputHeight + 60),
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [setCommentInputFocused, setIsTyping, setShowAndroidTypeBar, setIsKeyboardVisible, containerHeightAnim, inputHeight]);

  const handleInputBlur = useCallback(() => {
    console.log('📝 Input blurred');
    setCommentInputFocused(false);
    
    if (Platform.OS === 'android') {
      setShowAndroidTypeBar(false);
    }
    
    // Immediate state changes for Android, delayed for iOS
    if (Platform.OS === 'android') {
      // Android: Immediate response
      setTimeout(() => {
        setIsTyping(false);
        Animated.timing(containerHeightAnim, {
          toValue: 80, // Same height for both platforms - FIXED
          duration: 100,
          useNativeDriver: false,
        }).start();
      }, 50);
    } else {
      // iOS: Delayed for smooth transitions
      setTimeout(() => {
        if (!isKeyboardVisible) {
          setIsTyping(false);
        }
      }, 100);
    }
  }, [setCommentInputFocused, setShowAndroidTypeBar, setIsTyping, isKeyboardVisible, containerHeightAnim]);

  // Calculate dynamic padding for better keyboard avoidance
  const dynamicPaddingBottom = Platform.OS === 'ios' 
    ? Math.max(insets.bottom, 8) 
    : Math.max(insets.bottom, 8);

  return (
    <Animated.View style={{
      backgroundColor: '#fff',
      borderTopWidth: 0,
      borderTopColor: 'transparent',
      paddingHorizontal: 16,
      paddingVertical: 6,
      paddingBottom: 6,
      // Enhanced shadow with better Android support
      ...Platform.select({
        ios: {
          shadowColor: isTyping ? '#000' : 'transparent',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isTyping ? 0.1 : 0,
          shadowRadius: 8,
        },
        android: {
          elevation: isTyping ? 2 : 0,
        },
      }),
      // Dynamic height based on content and state - Universal compatibility
      height: containerHeightAnim,
      maxHeight: Platform.OS === 'android' ? (isTyping ? 120 : 80) : (isTyping ? 140 : 100),
      minHeight: Platform.OS === 'android' ? 60 : 70,
      position: 'relative',
      zIndex: Platform.OS === 'android' ? 1000 : 1,
    }}>

      {/* Display username above input if available */}
      {currentUserProfile?.username && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 4,
          paddingLeft: 48, // Align with input text
        }}>
          <Text style={{
            fontSize: 12,
            color: '#666',
            fontWeight: '500',
          }}>
            Commenting as {currentUserProfile.username}
          </Text>
        </View>
      )}
      {/* Enhanced reply indicator with better animations and positioning */}
      {replyingToCommentId && (
        <Animated.View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#f8f9fa',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 12,
          marginBottom: 8,
          marginHorizontal: 4,
          opacity: 1,
          borderLeftWidth: 3,
          borderLeftColor: '#065fd4',
          // Enhanced shadow for visibility
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
            },
            android: {
              elevation: 2,
            },
          }),
        }}>
          <Ionicons 
            name="return-down-forward" 
            size={14} 
            color="#065fd4" 
            style={{ marginRight: 8 }}
          />
          <Text style={{
            fontSize: 13,
            color: '#065fd4',
            flex: 1,
            fontWeight: '600',
          }}>
            Replying to comment
          </Text>
          <TouchableOpacity 
            onPress={() => {
              setReplyingToCommentId(null);
              setReplyInput('');
              // Enhanced haptic feedback
              if (Platform.OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            style={{ 
              padding: 6,
              borderRadius: 12,
              backgroundColor: 'rgba(6, 95, 212, 0.1)'
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={16} color="#065fd4" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Enhanced input row with better cross-platform support - Normal sizing for Android */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: '#f9f9f9',
        borderRadius: isTyping ? 24 : 20,
        paddingHorizontal: 16,
        paddingVertical: Platform.OS === 'android' ? 8 : 8, // Normal Android padding
        minHeight: Platform.OS === 'android' ? 48 : 40, // Normal Android height
        maxHeight: Platform.OS === 'android' ? 60 : 120, // Normal Android limit
        borderWidth: isTyping ? 2 : 1,
        borderColor: isTyping ? '#065fd4' : '#e5e5e5',
        // Better Android shadow support
        ...Platform.select({
          android: {
            elevation: isTyping ? 1 : 0, // Minimal elevation
          },
          ios: {
            shadowColor: isTyping ? '#065fd4' : 'transparent',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
          },
        }),
      }}>
        {/* Enhanced user avatar with better fallback and profile visibility */}
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          marginRight: 12,
          alignSelf: 'flex-end',
          marginBottom: 2,
          // Ensure avatar is always visible with enhanced styling
          backgroundColor: '#4ECDC4',
          borderWidth: 2,
          borderColor: commentInputFocused || isTyping ? '#065fd4' : '#e5e5e5',
          overflow: 'hidden',
          // Add subtle shadow for better visual prominence
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
            },
            android: {
              elevation: 2,
            },
          }),
        }}>
          <Image
            source={{ 
              uri: enhancedUserProfile.avatar,
              cache: 'force-cache'
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#4ECDC4',
            }}
            defaultSource={{ 
              uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(enhancedUserProfile.username)}&size=36&background=4ECDC4&color=ffffff&format=png`
            }}
            resizeMode="cover"
          />
        </View>

        {/* User info and input container */}
        <View style={{ flex: 1 }}>
          {/* Always show username - improved visibility */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 2,
            paddingLeft: 2,
          }}>
            <Text style={{
              fontSize: (commentInputFocused || isTyping || (replyingToCommentId && replyInput.length > 0) || (!replyingToCommentId && commentInput.length > 0)) ? 12 : 11,
              fontWeight: (commentInputFocused || isTyping || (replyingToCommentId && replyInput.length > 0) || (!replyingToCommentId && commentInput.length > 0)) ? '600' : '500',
              color: (commentInputFocused || isTyping || (replyingToCommentId && replyInput.length > 0) || (!replyingToCommentId && commentInput.length > 0)) ? '#065fd4' : '#666',
              opacity: (commentInputFocused || isTyping || (replyingToCommentId && replyInput.length > 0) || (!replyingToCommentId && commentInput.length > 0)) ? 1 : 0.8,
            }}>
              {(commentInputFocused || isTyping || (replyingToCommentId && replyInput.length > 0) || (!replyingToCommentId && commentInput.length > 0)) 
                ? `@${enhancedUserProfile.username}` 
                : `${enhancedUserProfile.username}`
              }
            </Text>
            {/* Show status indicator */}
            {(commentInputFocused || isTyping) && (
              <View style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#065fd4',
                marginLeft: 6,
                opacity: 0.7,
              }} />
            )}
          </View>
          
          {/* Enhanced text input with comprehensive cross-platform support */}
          <TextInput
            ref={replyingToCommentId ? replyInputRef : commentInputRef}
            style={{
              fontSize: 14,
              lineHeight: Platform.OS === 'android' ? 20 : 20, // Normal Android line height
              maxHeight: Platform.OS === 'android' ? 60 : 80, // Normal Android height
              paddingVertical: Platform.OS === 'android' ? 8 : 8, // Normal Android padding
              paddingHorizontal: 0,
              color: '#000',
              textAlignVertical: 'center',
            }}
            placeholder={replyingToCommentId ? "Write a reply..." : "Add a comment..."}
            value={replyingToCommentId ? replyInput : commentInput}
            onChangeText={replyingToCommentId ? setReplyInput : setCommentInput}
            multiline
            textAlignVertical="center"
            autoCorrect={false}
            spellCheck={false}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            blurOnSubmit={false}
            returnKeyType="send"
            onSubmitEditing={async () => {
              const text = replyingToCommentId ? replyInput : commentInput;
              if (text.trim() && !isSubmitting) {
                await handleSubmitComment(text, !!replyingToCommentId);
              }
            }}
            editable={!isSubmitting}
            onContentSizeChange={handleContentSizeChange}
            inputAccessoryViewID={replyingToCommentId ? replyInputAccessoryViewID : inputAccessoryViewID}
          />
        </View>

        {/* Enhanced send button with better feedback */}
        <Animated.View style={{
          transform: [{ scale: sendButtonScaleAnim }],
          marginLeft: 8,
          alignSelf: 'flex-end',
          marginBottom: 2,
        }}>
          <TouchableOpacity
            onPress={async () => {
              console.log('🚀 ENHANCED SEND: Starting comment submission');
              const text = replyingToCommentId ? replyInput : commentInput;
              if (text.trim() && !isSubmitting) {
                await handleSubmitComment(text, !!replyingToCommentId);
              }
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: (replyingToCommentId ? replyInput : commentInput).trim() && !isSubmitting
                ? '#065fd4' 
                : '#cccccc',
              justifyContent: 'center',
              alignItems: 'center',
              // Better shadow for visual feedback
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                },
                android: {
                  elevation: 4,
                },
              }),
            }}
            activeOpacity={0.8}
            disabled={!(replyingToCommentId ? replyInput : commentInput).trim() || isSubmitting}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isSubmitting ? (
              <Animated.View style={{
                transform: [{
                  rotate: '0deg' // Could add rotation animation for loading state
                }]
              }}>
                <Ionicons
                  name="hourglass-outline"
                  size={16}
                  color="#fff"
                />
              </Animated.View>
            ) : (
              <Ionicons
                name="send"
                size={16}
                color="#fff"
              />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
