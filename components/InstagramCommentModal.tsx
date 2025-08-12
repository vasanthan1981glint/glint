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
import { useCallback, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
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
  modalHeight = 0.85,
  backgroundColor = '#fff',
}: GlintCommentModalProps) {
  const insets = useSafeAreaInsets();
  
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
  
  // Refs
  const flatListRef = useRef<FlatList<Comment>>(null);
  const commentInputRef = useRef<TextInput>(null);
  const replyInputRef = useRef<TextInput>(null);
  const commentScaleAnim = useRef<{ [key: string]: Animated.Value }>({});
  
  // Animation values
  const commentBoxOpacity = useRef(new Animated.Value(0)).current;
  const commentListOffset = useRef(new Animated.Value(0)).current;
  
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
    setReplyingToCommentId(commentId);
    
    // Focus input
    if (Platform.OS === 'ios') {
      requestAnimationFrame(() => {
        replyInputRef.current?.focus();
      });
    } else {
      replyInputRef.current?.focus();
      setTimeout(() => {
        replyInputRef.current?.focus();
      }, 100);
    }
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
  
  // Comment renderer
  const renderComment = useCallback((item: Comment) => {
    return (
      <View style={styles.commentContainer}>
        {/* Avatar */}
        <TouchableOpacity onPress={() => navigateToUser(item.user)}>
          <Image
            source={{ 
              uri: item.avatar || `https://ui-avatars.com/api/?name=${item.user}&size=40&background=f0f0f0&color=999999&format=png`,
              cache: 'force-cache'
            }}
            style={styles.avatar}
            defaultSource={{ uri: `https://ui-avatars.com/api/?name=${item.user}&size=40&background=f0f0f0&color=999999&format=png` }}
            resizeMode="cover"
          />
        </TouchableOpacity>

        {/* Comment Content */}
        <View style={styles.commentContent}>
          {/* Username and timestamp */}
          <View style={styles.userInfo}>
            <TouchableOpacity onPress={() => navigateToUser(item.user)}>
              <Text style={styles.username}>@{item.user}</Text>
            </TouchableOpacity>
            <Text style={styles.timestamp}>
              {item.timestamp ? dayjs(item.timestamp).fromNow() : 'just now'}
            </Text>
          </View>

          {/* Comment text */}
          <Text style={styles.commentText}>{item.text}</Text>

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            {/* Heart button */}
            <TouchableOpacity
              onPress={() => toggleCommentLike(item.id)}
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
                            uri: reply.avatar || `https://ui-avatars.com/api/?name=${reply.user}&size=40&background=f0f0f0&color=999999&format=png`,
                            cache: 'force-cache'
                          }}
                          style={styles.replyAvatar}
                          defaultSource={{ uri: `https://ui-avatars.com/api/?name=${reply.user}&size=40&background=f0f0f0&color=999999&format=png` }}
                          resizeMode="cover"
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
      animationType="slide" 
      transparent 
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContent, { height: `${modalHeight * 100}%` }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              Comments ({totalComments})
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          <FlatList
            ref={flatListRef}
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderComment(item)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.commentsList}
            onEndReached={() => {
              if (hasMoreComments && !commentsLoading) {
                loadMoreComments();
              }
            }}
            onEndReachedThreshold={0.3}
            refreshing={commentsLoading}
            onRefresh={refreshComments}
          />

          {/* Comment Input */}
          <CommentBox
            currentUserProfile={currentUserProfile}
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
            addComment={addComment}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Comment Options Modal */}
      <Modal visible={showCommentOptions} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.optionsOverlay} 
          activeOpacity={1} 
          onPress={closeCommentOptions}
        >
          <View style={styles.optionsModal}>
            <TouchableOpacity 
              style={styles.optionButton} 
              onPress={handleDeleteComment}
            >
              <Ionicons name="trash-outline" size={20} color="#ff3333" />
              <Text style={[styles.optionText, { color: '#ff3333' }]}>Delete</Text>
            </TouchableOpacity>
            
            {onReportComment && (
              <TouchableOpacity 
                style={styles.optionButton} 
                onPress={() => handleReportComment('Inappropriate content')}
              >
                <Ionicons name="flag-outline" size={20} color="#ff6600" />
                <Text style={[styles.optionText, { color: '#ff6600' }]}>Report</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.optionButton} 
              onPress={closeCommentOptions}
            >
              <Text style={styles.optionText}>Cancel</Text>
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
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  commentsList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    position: 'relative',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
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
  },
  timestamp: {
    fontSize: 12,
    color: '#606060',
  },
  commentText: {
    fontSize: 14,
    color: '#0f0f23',
    lineHeight: 20,
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: -12,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  likeCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  replyButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  replyText: {
    fontSize: 12,
    color: '#606060',
    fontWeight: '500',
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
  },
  showRepliesText: {
    fontSize: 12,
    color: '#065fd4',
    fontWeight: '600',
    marginLeft: 6,
  },
  repliesList: {
    borderLeftWidth: 2,
    borderLeftColor: '#e5e5e5',
    paddingLeft: 12,
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
  },
  replyTimestamp: {
    fontSize: 11,
    color: '#606060',
  },
  replyCommentText: {
    fontSize: 13,
    color: '#0f0f23',
    lineHeight: 18,
    marginBottom: 8,
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
  },
  replyLikeCount: {
    fontSize: 11,
    fontWeight: '500',
  },
  replyToReplyButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  replyToReplyText: {
    fontSize: 11,
    color: '#606060',
    fontWeight: '500',
  },
  replyOptionsButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 8,
    zIndex: 999,
  },
  optionsButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 12,
    zIndex: 999,
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
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
    color: '#000',
  },
});
