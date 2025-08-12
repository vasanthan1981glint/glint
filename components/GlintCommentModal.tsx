/**
 * Glint Comment Modal Component
 * 
 * Reusable across home, profile, and other screens
 * Features:
 * - Full comment list with replies
 * - Like/reply functionality
 * - Comment options (edit, delete, report)
 * - Responsive design
 * - Smooth animations
 */

import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CommentBox from './CommentBox';

dayjs.extend(relativeTime);

export interface Comment {
  id: string;
  text: string;
  user: string;
  avatar?: string;
  timestamp?: any;
  likes?: number;
  replies?: Comment[];
}

interface GlintCommentModalProps {
  // Modal visibility
  visible: boolean;
  onClose: () => void;
  
  // Post data
  postId: string;
  
  // Comments data
  comments: Comment[];
  commentsLoading: boolean;
  hasMoreComments: boolean;
  totalComments: number;
  
  // Comment functions
  addComment: (text: string, parentId?: string, userProfile?: any) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  loadMoreComments: () => Promise<void>;
  refreshComments: () => Promise<void>;
  
  // Like functions
  commentLikes: { [id: string]: boolean };
  commentLikeCounts: { [id: string]: number };
  toggleCommentLike: (commentId: string) => Promise<void>;
  
  // User profile
  currentUserProfile: {
    avatar: string;
    username: string;
  };
  
  // Navigation
  navigateToUser: (username: string) => void;
  
  // Comment options
  onReportComment?: (commentId: string, reason: string, details?: string) => Promise<void>;
  
  // Style overrides
  modalHeight?: number;
  backgroundColor?: string;
}

export default function GlintCommentModal({
  visible,
  onClose,
  postId,
  comments,
  commentsLoading,
  hasMoreComments,
  totalComments,
  addComment,
  deleteComment,
  loadMoreComments,
  refreshComments,
  commentLikes,
  commentLikeCounts,
  toggleCommentLike,
  currentUserProfile,
  navigateToUser,
  onReportComment,
  modalHeight = 0.8, // Changed to 80% as requested
  backgroundColor = '#fff',
}: GlintCommentModalProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
  const safeBottom = Math.max(insets.bottom, 0);
  
  // Local state
  const [expandedReplies, setExpandedReplies] = useState<{ [commentId: string]: boolean }>({});
  const [commentInput, setCommentInput] = useState('');
  const [replyInput, setReplyInput] = useState('');
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [showCommentOptions, setShowCommentOptions] = useState(false);
  const [commentInputFocused, setCommentInputFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showAndroidTypeBar, setShowAndroidTypeBar] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputBarHeight, setInputBarHeight] = useState(0);
  
  // Refs
  const flatListRef = useRef<FlatList<Comment>>(null);
  const commentInputRef = useRef<TextInput>(null);
  const replyInputRef = useRef<TextInput>(null);
  const commentScaleAnim = useRef<{ [key: string]: Animated.Value }>({});
  
  // Animation values
  const commentBoxOpacity = useRef(new Animated.Value(0)).current;
  const commentListOffset = useRef(new Animated.Value(0)).current;
  const modalTransformAnim = useRef(new Animated.Value(screenHeight)).current;
  
  // Enhanced keyboard handling for better cross-platform support
  useEffect(() => {
    if (!visible) return;
    
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        console.log('⌨️ Modal keyboard showing:', event.endCoordinates.height);
        setKeyboardHeight(event.endCoordinates.height);
        setIsKeyboardVisible(true);
        // Do not shift list; input bar is absolutely positioned
        Animated.timing(commentListOffset, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        console.log('⌨️ Modal keyboard hiding');
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
        // Clear reply state when keyboard hides to prevent stuck reply mode
        if (replyingToCommentId) {
          setTimeout(() => {
            setReplyingToCommentId(null);
            setReplyInput('');
          }, 100);
        }
        // Keep list position stable
        Animated.timing(commentListOffset, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [visible, commentListOffset, replyingToCommentId, setReplyingToCommentId, setReplyInput]);

  // FIXED: Enhanced comment like animation effect - triggers when like states change
  const previousCommentLikes = useRef<{ [key: string]: boolean }>({});
  
  useEffect(() => {
    // Function to trigger like animation for a comment
    const triggerLikeAnimation = (commentId: string) => {
      if (!commentScaleAnim.current[commentId]) {
        commentScaleAnim.current[commentId] = new Animated.Value(1);
      }
      
      // Same animation as video likes - bounce effect
      Animated.sequence([
        Animated.spring(commentScaleAnim.current[commentId], {
          toValue: 1.3,
          tension: 500,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.spring(commentScaleAnim.current[commentId], {
          toValue: 1,
          tension: 500,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    };

    // Check for changes in comment likes and trigger animations only for new likes
    Object.keys(commentLikes).forEach(commentId => {
      const isLiked = commentLikes[commentId];
      const wasLiked = previousCommentLikes.current[commentId];
      
      // Only animate when going from not liked to liked (not when unliked or no change)
      if (isLiked && !wasLiked) {
        triggerLikeAnimation(commentId);
      }
    });
    
    // Update previous state for next comparison
    previousCommentLikes.current = { ...commentLikes };
  }, [commentLikes]); // Trigger when commentLikes state changes
  
  // Enhanced modal entrance animation
  useEffect(() => {
    if (visible) {
      Animated.spring(modalTransformAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalTransformAnim, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, modalTransformAnim, screenHeight]);
  
  // Helper functions
  const formatLikeCount = (count: number) => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(count % 1000000 === 0 ? 0 : 1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(count % 1000 === 0 ? 0 : 1) + 'K';
    } else {
      return count.toString();
    }
  };
  
  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };
  
  const startReplying = (commentId: string, username: string) => {
    console.log(`💬 Starting reply to comment ${commentId} by ${username}`);
    setReplyingToCommentId(commentId);
    
    // Enhanced focus handling for better cross-platform support
    if (Platform.OS === 'ios') {
      // Use requestAnimationFrame for smoother iOS transitions
      requestAnimationFrame(() => {
        if (replyInputRef.current) {
          replyInputRef.current.focus();
        }
      });
    } else {
      // Android-specific focus handling with retry
      const focusInput = () => {
        if (replyInputRef.current) {
          replyInputRef.current.focus();
        }
      };
      
      focusInput();
      // Backup focus attempt for Android
      setTimeout(focusInput, 100);
      setTimeout(focusInput, 300);
    }
    
    // Scroll to comment being replied to for better UX - Enhanced for keyboard visibility
    setTimeout(() => {
      if (flatListRef.current) {
        const commentIndex = comments.findIndex(c => c.id === commentId);
        if (commentIndex >= 0) {
          flatListRef.current.scrollToIndex({
            index: commentIndex,
            animated: true,
            viewPosition: 0.3, // Scroll higher to account for keyboard
          });
        }
      }
    }, Platform.OS === 'android' ? 600 : 400); // Longer delay for Android to allow keyboard animation
  };
  
  const openCommentOptions = (commentId: string) => {
    setSelectedCommentId(commentId);
    setShowCommentOptions(true);
  };
  
  const closeCommentOptions = () => {
    setSelectedCommentId(null);
    setShowCommentOptions(false);
  };
  
  const handleDeleteComment = async () => {
    if (!selectedCommentId) return;
    
    // Find comment (check both main comments and replies)
    let comment = comments.find(c => c.id === selectedCommentId);
    let isReply = false;
    
    if (!comment) {
      for (const mainComment of comments) {
        if (mainComment.replies) {
          const foundReply = mainComment.replies.find(r => r.id === selectedCommentId);
          if (foundReply) {
            comment = foundReply;
            isReply = true;
            break;
          }
        }
      }
    }
    
    if (!comment) return;
    
    // Permission check
    const canDelete = comment.user === currentUserProfile.username;
    
    if (!canDelete) {
      Alert.alert('Not Authorized', `You can only delete your own ${isReply ? 'replies' : 'comments'}.`);
      return;
    }
    
    Alert.alert(
      `Delete ${isReply ? 'Reply' : 'Comment'}`,
      `Are you sure you want to delete this ${isReply ? 'reply' : 'comment'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            closeCommentOptions();
            try {
              await deleteComment(selectedCommentId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error("❌ Deletion failed:", error);
              Alert.alert("Delete Failed", "Failed to delete comment");
            }
          },
        },
      ]
    );
  };
  
  const handleReportComment = async (reason: string, details?: string) => {
    if (!selectedCommentId || !onReportComment) return;
    
    try {
      await onReportComment(selectedCommentId, reason, details);
      closeCommentOptions();
      Alert.alert(
        'Report Submitted',
        'Thank you for your report. We\'ll review this comment and take appropriate action if needed.'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };
  
  // Comment renderer - FIXED: Added proper memoization to prevent unnecessary re-renders
  const renderComment = useCallback((item: Comment) => {
    console.log('🎨 Rendering comment:', {
      id: item.id,
      user: item.user,
      avatar: item.avatar,
      text: item.text,
      timestamp: item.timestamp
    });
    
    return (
      <View style={styles.commentContainer} key={`comment-${item.id}`}>
        {/* Avatar */}
        <TouchableOpacity onPress={() => navigateToUser(item.user)}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#4ECDC4',
            borderWidth: 1,
            borderColor: '#e0e0e0',
            overflow: 'hidden',
          }}>
            <Image
              source={{ 
                uri: item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user || 'User')}&size=40&background=4ECDC4&color=ffffff&format=png`,
                cache: 'force-cache'
              }}
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#4ECDC4',
              }}
              defaultSource={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user || 'User')}&size=40&background=4ECDC4&color=ffffff&format=png` }}
              resizeMode="cover"
              onLoad={() => console.log('✅ Comment avatar loaded for:', item.user)}
              onError={(error) => {
                console.log('⚠️ Comment avatar failed for:', item.user, 'using fallback');
              }}
            />
          </View>
        </TouchableOpacity>

        {/* Comment Content */}
        <View style={styles.commentContent}>
          {/* Username and timestamp */}
          <View style={styles.userInfo}>
            <TouchableOpacity onPress={() => navigateToUser(item.user)}>
              <Text style={[styles.username, { 
                color: '#1a1a1a',
                fontWeight: '700',
                fontSize: 14,
              }]}>
                @{item.user || 'User'}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.timestamp, {
              marginLeft: 8,
              fontSize: 12,
            }]}>
              {item.timestamp ? dayjs(item.timestamp).fromNow() : 'just now'}
            </Text>
          </View>

          {/* Comment text */}
          <Text style={[styles.commentText, {
            fontSize: 15,
            lineHeight: 22,
            color: '#1a1a1a',
            marginTop: 4,
            marginBottom: 12,
          }]}>
            {item.text}
          </Text>

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            {/* Heart button */}
            <TouchableOpacity
              onPress={async () => {
                try {
                  console.log('💗 Toggling like for comment:', item.id);
                  await toggleCommentLike(item.id);
                  // Add haptic feedback for better UX
                  try {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (hapticError) {
                    console.log('Haptic feedback not available');
                  }
                } catch (error) {
                  console.error('❌ Failed to toggle like:', error);
                }
              }}
              style={styles.likeButton}
              hitSlop={{ top: 24, bottom: 24, left: 24, right: 24 }}
              activeOpacity={0.7}
            >
              <Animated.View style={{ 
                transform: [{ scale: commentScaleAnim.current[item.id] || 1 }] 
              }}>
                <Ionicons
                  name={commentLikes[item.id] ? 'heart' : 'heart-outline'}
                  size={16}
                  color={commentLikes[item.id] ? '#ff0000' : '#606060'}
                  style={{ marginRight: 6 }}
                />
              </Animated.View>
              <Text style={[
                styles.likeCount,
                { color: commentLikes[item.id] ? '#ff0000' : '#606060' }
              ]}>
                {formatLikeCount(commentLikeCounts[item.id] || 0)}
              </Text>
            </TouchableOpacity>

            {/* Reply button */}
            <TouchableOpacity
              onPress={() => startReplying(item.id, item.user)}
              style={styles.replyButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.replyText}>Reply</Text>
            </TouchableOpacity>
          </View>

          {/* Replies */}
          {item.replies && item.replies.length > 0 && (
            <View style={styles.repliesContainer}>
              <TouchableOpacity
                style={styles.showRepliesButton}
                onPress={() => toggleReplies(item.id)}
              >
                <Ionicons 
                  name={expandedReplies[item.id] ? 'chevron-up' : 'chevron-down'} 
                  size={14} 
                  color="#065fd4" 
                />
                <Text style={styles.showRepliesText}>
                  {expandedReplies[item.id] ? 'Hide' : 'Show'} {item.replies.length} {item.replies.length === 1 ? 'reply' : 'replies'}
                </Text>
              </TouchableOpacity>
              
              {expandedReplies[item.id] && (
                <View style={styles.repliesList}>
                  {item.replies
                    .slice()
                    .reverse()
                    .map((reply) => (
                    <View key={reply.id} style={styles.replyContainer}>
                      <TouchableOpacity onPress={() => navigateToUser(reply.user)}>
                        <Image
                          source={{ 
                            uri: reply.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.user)}&size=32&background=4ECDC4&color=ffffff&format=png`,
                            cache: 'force-cache'
                          }}
                          style={styles.replyAvatar}
                          defaultSource={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.user)}&size=32&background=4ECDC4&color=ffffff&format=png` }}
                          resizeMode="cover"
                          onLoad={() => console.log('✅ Reply avatar loaded for:', reply.user)}
                          onError={() => console.log('⚠️ Reply avatar failed for:', reply.user)}
                        />
                      </TouchableOpacity>
                      
                      <View style={styles.replyContent}>
                        <View style={styles.replyUserInfo}>
                          <TouchableOpacity onPress={() => navigateToUser(reply.user)}>
                            <Text style={styles.replyUsername}>@{reply.user}</Text>
                          </TouchableOpacity>
                          <Text style={styles.replyTimestamp}>
                            {reply.timestamp ? dayjs(reply.timestamp).fromNow() : 'just now'}
                          </Text>
                        </View>
                        
                        <Text style={styles.replyCommentText}>{reply.text}</Text>
                        
                        {/* Reply action buttons */}
                        <View style={styles.replyActionButtons}>
                          <TouchableOpacity
                            onPress={() => toggleCommentLike(reply.id)}
                            style={styles.replyLikeButton}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            activeOpacity={0.7}
                          >
                            <Animated.View style={{ 
                              transform: [{ scale: commentScaleAnim.current[reply.id] || 1 }] 
                            }}>
                              <Ionicons
                                name={commentLikes[reply.id] ? 'heart' : 'heart-outline'}
                                size={14}
                                color={commentLikes[reply.id] ? '#ff0000' : '#606060'}
                                style={{ marginRight: 4 }}
                              />
                            </Animated.View>
                            <Text style={[
                              styles.replyLikeCount,
                              { color: commentLikes[reply.id] ? '#ff0000' : '#606060' }
                            ]}>
                              {formatLikeCount(commentLikeCounts[reply.id] || 0)}
                            </Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity 
                            onPress={() => startReplying(item.id, reply.user)}
                            style={styles.replyToReplyButton}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.replyToReplyText}>Reply</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      {/* Reply options button */}
                      <TouchableOpacity
                        style={styles.replyOptionsButton}
                        onPress={() => openCommentOptions(reply.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="ellipsis-vertical" size={16} color="#666" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
        
        {/* Comment options button */}
        <TouchableOpacity
          style={styles.optionsButton}
          onPress={() => openCommentOptions(item.id)}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          activeOpacity={0.6}
        >
          <Ionicons name="ellipsis-vertical" size={18} color="#666" />
        </TouchableOpacity>
      </View>
    );
  }, [commentLikes, commentLikeCounts, expandedReplies, toggleCommentLike, navigateToUser, startReplying, openCommentOptions]);

  return (
    <Modal 
      visible={visible} 
      animationType="none" // We'll handle our own animation
      transparent 
      statusBarTranslucent
      onRequestClose={onClose}
      supportedOrientations={['portrait']} // Lock to portrait for consistency
    >
      <View style={styles.modalContainer}>
        <Animated.View 
          style={[
            styles.modalWrapper,
            {
              transform: [{ translateY: modalTransformAnim }]
            }
          ]}
        >
          <KeyboardAvoidingView 
            behavior={undefined}
            style={[
              styles.modalContent, 
              { 
                // Dynamic height based on keyboard state for universal compatibility
                height: isKeyboardVisible 
                  ? `${Math.min(95, modalHeight * 100 + 15)}%` // Expand when typing
                  : `${modalHeight * 100}%`, // 80% when not typing
                backgroundColor: backgroundColor,
                maxHeight: screenHeight - (Platform.OS === 'android' ? 30 : 40),
                // Universal phone compatibility
                minHeight: screenHeight * 0.6, // Minimum 60% for small phones
              }
            ]}
            keyboardVerticalOffset={0}
          >
            {/* Enhanced Header with better Android support */}
            <View style={[
              styles.header,
              {
                paddingTop: insets.top > 0 ? insets.top + 20 : 30
              }
            ]}>
              <Text style={styles.headerTitle}>
                Comments ({totalComments})
              </Text>
              <TouchableOpacity 
                onPress={onClose} 
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            {/* Enhanced Comments List with better performance */}
            <Animated.View 
              style={[
                { flex: 1 },
                {
                  transform: [{ translateY: commentListOffset }]
                }
                // Apply animation for both platforms to ensure proper keyboard handling
              ]}
            >
              <FlatList
                ref={flatListRef}
                data={comments}
                keyExtractor={(item, index) => `comment-${item.id}-${index}`} // FIXED: More stable key
                renderItem={({ item }) => renderComment(item)}
                showsVerticalScrollIndicator={false}
                getItemLayout={undefined} // Disable for dynamic heights
                removeClippedSubviews={Platform.OS === 'android'} // FIXED: Platform-specific optimization
                contentContainerStyle={[
                  styles.commentsList,
                  {
                    // Ensure list content isn't hidden behind the input bar or keyboard
                    // Account for reply mode which makes input bar taller
                    paddingBottom: (replyingToCommentId ? inputBarHeight + 40 : inputBarHeight + 20) + (isKeyboardVisible ? 20 : safeBottom + 20),
                    paddingTop: 10, // Ensure first comment is visible
                  }
                ]}
                onEndReached={() => {
                  if (hasMoreComments && !commentsLoading) {
                    loadMoreComments();
                  }
                }}
                onEndReachedThreshold={0.3}
                refreshing={commentsLoading}
                onRefresh={refreshComments}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                maxToRenderPerBatch={10} // Limit rendering for better performance
                initialNumToRender={8} // Show fewer comments initially
                windowSize={10} // Smaller window for better memory usage
                updateCellsBatchingPeriod={50}
              />
            </Animated.View>

            {/* Enhanced Comment Input anchored above keyboard */}
            <View
              onLayout={(e) => setInputBarHeight(Math.max(48, e.nativeEvent.layout.height))}
              style={{
                backgroundColor: backgroundColor,
                minHeight: replyingToCommentId ? 90 : 50, // Extra height when replying
                paddingTop: 8,
                paddingBottom: Math.max(safeBottom, 8),
                paddingHorizontal: 0,
                position: 'absolute',
                left: 0,
                right: 0,
                // Fix positioning to always stay above keyboard properly - adjusted for reply mode
                bottom: isKeyboardVisible 
                  ? (Platform.OS === 'ios' ? keyboardHeight : keyboardHeight) 
                  : 0,
                zIndex: 1000,
                // Add border to separate from content
                borderTopWidth: 1,
                borderTopColor: '#e5e5e5',
                // Add extra elevation for Android to ensure it stays on top
                ...Platform.select({
                  android: {
                    elevation: 1001,
                  },
                }),
              }}
            >
              <CommentBox
                currentUserProfile={{
                  ...currentUserProfile,
                  // Ensure we always have fallback values for better profile display
                  username: currentUserProfile.username || 'User',
                  avatar: currentUserProfile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserProfile.username || 'User')}&size=34&background=4ECDC4&color=ffffff&format=png`,
                }}
                commentInput={commentInput}
                setCommentInput={setCommentInput}
                replyInput={replyInput}
                setReplyInput={setReplyInput}
                replyingToCommentId={replyingToCommentId}
                setReplyingToCommentId={setReplyingToCommentId}
                commentInputFocused={commentInputFocused}
                setCommentInputFocused={setCommentInputFocused}
                isTyping={isTyping}
                setIsTyping={setIsTyping}
                isKeyboardVisible={isKeyboardVisible}
                setIsKeyboardVisible={setIsKeyboardVisible}
                showAndroidTypeBar={showAndroidTypeBar}
                setShowAndroidTypeBar={setShowAndroidTypeBar}
                commentInputRef={commentInputRef}
                replyInputRef={replyInputRef}
                commentBoxOpacity={commentBoxOpacity}
                commentListOffset={commentListOffset}
                addComment={async (text, parentId, userProfile) => {
                  console.log('📝 Modal addComment called with:', {
                    text,
                    parentId,
                    userProfile,
                    currentUser: currentUserProfile,
                    finalUserData: {
                      username: userProfile?.username || currentUserProfile?.username,
                      avatar: userProfile?.avatar || currentUserProfile?.avatar,
                    }
                  });
                  return await addComment(text, parentId, userProfile);
                }}
              />
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>

      {/* Enhanced Comment Options Modal with better Android support */}
      <Modal visible={showCommentOptions} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.optionsOverlay} 
          activeOpacity={1} 
          onPress={closeCommentOptions}
        >
          <View style={[
            styles.optionsModal,
            Platform.OS === 'android' && {
              elevation: 10,
              backgroundColor: '#fff',
            }
          ]}>
            <TouchableOpacity 
              style={styles.optionButton} 
              onPress={handleDeleteComment}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color="#ff3333" />
              <Text style={[styles.optionText, { color: '#ff3333' }]}>Delete</Text>
            </TouchableOpacity>
            
            {onReportComment && (
              <TouchableOpacity 
                style={styles.optionButton} 
                onPress={() => handleReportComment('Inappropriate content')}
                activeOpacity={0.7}
              >
                <Ionicons name="flag-outline" size={20} color="#ff6600" />
                <Text style={[styles.optionText, { color: '#ff6600' }]}>Report</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.optionButton, styles.cancelButton]} 
              onPress={closeCommentOptions}
              activeOpacity={0.7}
            >
              <Text style={[styles.optionText, { fontWeight: '600' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    flex: 1,
    // Enhanced Android shadow support
    ...Platform.select({
      android: {
        elevation: 20,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
    }),
    // Universal phone compatibility
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
    // Ensure header stays on top
    zIndex: 100,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  closeButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  commentsList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexGrow: 1,
  },
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    position: 'relative',
    marginBottom: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
    // Better image loading for Android
    ...Platform.select({
      android: {
        borderWidth: 0.5,
        borderColor: '#e0e0e0',
      },
    }),
  },
  commentContent: {
    flex: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f0f23',
    marginRight: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  timestamp: {
    fontSize: 12,
    color: '#606060',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  commentText: {
    fontSize: 14,
    color: '#0f0f23',
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 4,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: -12,
    borderRadius: 16,
    backgroundColor: 'transparent',
    // Better touch area for Android
    minHeight: 36,
  },
  likeCount: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  replyButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  replyText: {
    fontSize: 12,
    color: '#606060',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  repliesContainer: {
    marginTop: 12,
    marginLeft: 8,
  },
  showRepliesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(6, 95, 212, 0.05)',
  },
  showRepliesText: {
    fontSize: 12,
    color: '#065fd4',
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  repliesList: {
    borderLeftWidth: 2,
    borderLeftColor: '#e5e5e5',
    paddingLeft: 12,
    backgroundColor: 'rgba(245, 245, 245, 0.3)',
    borderRadius: 8,
    paddingVertical: 8,
  },
  replyContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    position: 'relative',
  },
  replyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
    ...Platform.select({
      android: {
        borderWidth: 0.5,
        borderColor: '#e0e0e0',
      },
    }),
  },
  replyContent: {
    flex: 1,
  },
  replyUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  replyUsername: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f0f23',
    marginRight: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  replyTimestamp: {
    fontSize: 11,
    color: '#606060',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  replyCommentText: {
    fontSize: 13,
    color: '#0f0f23',
    lineHeight: 18,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  replyActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  replyLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'transparent',
    minHeight: 28,
  },
  replyLikeCount: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  replyToReplyButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    minHeight: 28,
    justifyContent: 'center',
  },
  replyToReplyText: {
    fontSize: 11,
    color: '#606060',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  replyOptionsButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 8,
    zIndex: 999,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  optionsButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 12,
    zIndex: 999,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    minWidth: 200,
    maxWidth: 280,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  cancelButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginTop: 8,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
});
