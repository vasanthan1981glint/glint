/**
 * Example implementation showing how to use GlintCommentModal
 * in different screens (home, profile, etc.) 
 * 
 * This demonstrates the reusable nature of the component
 * with the reusable Glint-style component
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import GlintCommentModal from '../components/GlintCommentModal';
import { useAuth } from '../contexts/AuthContext';
import { useComments } from '../hooks/useComments';
import { useGlintCommentModal } from '../hooks/useGlintCommentModal';
import { useUserStore } from '../lib/userStore';

// Example usage in HomeScreen component
export function HomeScreenWithComments() {
  const { userProfile } = useAuth();
  const { avatar: userAvatar, username: userUsername } = useUserStore();
  
  // Current post data (replace with your actual post state)
  const currentPostId = 'post-1';
  
  // Comment modal state and actions
  const [commentModalState, commentModalActions] = useGlintCommentModal();
  
  // Comment functionality from your existing useComments hook
  const {
    comments,
    loading: commentsLoading,
    hasMore: hasMoreComments,
    totalCount: totalComments,
    addComment,
    deleteComment,
    loadMoreComments,
    refreshComments,
  } = useComments({
    postId: currentPostId,
    userId: userProfile?.uid,
    enableRealtime: true,
    pageSize: 20
  });
  
  // Your existing comment like functionality
  const [commentLikes, setCommentLikes] = React.useState<{ [id: string]: boolean }>({});
  const [commentLikeCounts, setCommentLikeCounts] = React.useState<{ [id: string]: number }>({});
  
  const toggleCommentLike = async (commentId: string) => {
    // Your existing like toggle logic here
    console.log('Toggling like for comment:', commentId);
  };
  
  // Navigation function
  const navigateToUser = (username: string) => {
    // Your navigation logic here
    console.log('Navigate to user:', username);
  };
  
  // Report comment function
  const handleReportComment = async (commentId: string, reason: string, details?: string) => {
    // Your report logic here
    console.log('Reporting comment:', commentId, 'Reason:', reason);
  };
  
  const currentUserProfile = {
    avatar: userAvatar || '',
    username: userUsername || '',
  };
  
  return (
    <>
      {/* Your existing home screen content */}
      
      {/* Comment button that opens the modal */}
      <TouchableOpacity
        onPress={commentModalActions.openModal}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
        }}
      >
        <Ionicons name="chatbubble-outline" size={24} color="#fff" />
        <Text style={{ color: '#fff', marginLeft: 4 }}>
          {totalComments}
        </Text>
      </TouchableOpacity>
      
      {/* Reusable Glint Comment Modal */}
      <GlintCommentModal
        visible={commentModalState.visible}
        onClose={commentModalActions.closeModal}
        postId={currentPostId}
        comments={comments}
        commentsLoading={commentsLoading}
        hasMoreComments={hasMoreComments}
        totalComments={totalComments}
        addComment={addComment}
        deleteComment={deleteComment}
        loadMoreComments={loadMoreComments}
        refreshComments={refreshComments}
        commentLikes={commentLikes}
        commentLikeCounts={commentLikeCounts}
        toggleCommentLike={toggleCommentLike}
        currentUserProfile={currentUserProfile}
        navigateToUser={navigateToUser}
        onReportComment={handleReportComment}
        modalHeight={0.85} // Optional: customize height
        backgroundColor="#fff" // Optional: customize background
      />
    </>
  );
}

// Example for Profile Screen
export function ProfileScreenWithComments() {
  // Similar implementation but for profile posts
  const { userProfile } = useAuth();
  const { avatar: userAvatar, username: userUsername } = useUserStore();
  
  // Current post data (replace with your actual post state)
  const currentPostId = 'profile-post-1';
  
  // Comment modal state and actions
  const [commentModalState, commentModalActions] = useGlintCommentModal();
  
  // Comment functionality from your existing useComments hook
  const {
    comments,
    loading: commentsLoading,
    loadingMore,
    hasMore: hasMoreComments,
    totalCount: totalComments,
    addComment,
    deleteComment,
    loadMoreComments,
    refreshComments,
  } = useComments({ postId: currentPostId });

  // Like state management (separate from useComments)
  const [commentLikes, setCommentLikes] = useState<{ [id: string]: boolean }>({});
  const [commentLikeCounts, setCommentLikeCounts] = useState<{ [id: string]: number }>({});

  // Like toggle function
  const toggleCommentLike = async (commentId: string) => {
    const currentLiked = commentLikes[commentId];
    const newLiked = !currentLiked;
    
    // Optimistic update
    setCommentLikes((prev) => ({ ...prev, [commentId]: newLiked }));
    setCommentLikeCounts((prev) => ({ 
      ...prev, 
      [commentId]: (prev[commentId] || 0) + (newLiked ? 1 : -1) 
    }));

    try {
      // Your actual like API call here
      console.log(`Toggle like for comment ${commentId}: ${newLiked}`);
    } catch (error) {
      // Revert on error
      setCommentLikes((prev) => ({ ...prev, [commentId]: currentLiked }));
      setCommentLikeCounts((prev) => ({ 
        ...prev, 
        [commentId]: (prev[commentId] || 0) + (currentLiked ? 1 : -1) 
      }));
    }
  };

  // Mock current user profile (replace with your actual user data)
  const currentUserProfile = {
    avatar: userAvatar || 'https://via.placeholder.com/40',
    username: userUsername || 'User',
  };

  // Navigation function (replace with your actual navigation)
  const navigateToUser = (username: string) => {
    console.log(`Navigate to user: ${username}`);
    // Your navigation logic here
  };

  // Report handling (replace with your actual implementation)
  const handleReportComment = async (commentId: string, reason: string, details?: string) => {
    console.log(`Report comment ${commentId}: ${reason}`, details);
    // Your report handling logic here
  };
  
  return (
    <>
      {/* Your profile content */}
      
      {/* Same GlintCommentModal component can be reused */}
      <GlintCommentModal
        visible={commentModalState.visible}
        onClose={commentModalActions.closeModal}
        postId={currentPostId}
        comments={comments}
        commentsLoading={commentsLoading}
        hasMoreComments={hasMoreComments}
        totalComments={totalComments}
        addComment={addComment}
        deleteComment={deleteComment}
        loadMoreComments={loadMoreComments}
        refreshComments={refreshComments}
        commentLikes={commentLikes}
        commentLikeCounts={commentLikeCounts}
        toggleCommentLike={toggleCommentLike}
        currentUserProfile={currentUserProfile}
        navigateToUser={navigateToUser}
        onReportComment={handleReportComment}
        modalHeight={0.85} // Optional: customize height
        backgroundColor="#fff" // Optional: customize background
      />
    </>
  );
}
