// Simple script to fix the duplicate deletion issue
// Run this in the app to replace the handleDelete function

const fixedHandleDelete = async () => {
  if (!selectedCommentId) {
    console.log('❌ No selectedCommentId');
    return;
  }
  
  const comment = comments.find(c => c.id === selectedCommentId);
  if (!comment) {
    console.log('❌ Comment not found:', selectedCommentId);
    return;
  }

  console.log('🔍 Found comment to delete:', {
    id: comment.id,
    user: comment.user,
    text: comment.text?.substring(0, 50) + '...'
  });

  // Permission check - only allow users to delete their own comments
  const canDelete = comment.user === currentUserProfile.username;

  console.log('🔍 Delete permission check:', {
    commentUser: comment.user,
    currentUsername: currentUserProfile.username,
    canDelete
  });

  if (!canDelete) {
    Alert.alert('Not Authorized', 'You can only delete your own comments.');
    return;
  }

  Alert.alert(
    'Delete Comment', 
    'Are you sure you want to delete this comment?', 
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          console.log('🗑️ Starting SIMPLE deletion flow...');
          
          // Close options modal immediately
          closeCommentOptions();
          
          try {
            // Use ONLY the useComments deleteComment function
            await deleteComment(selectedCommentId);
            
            // Update comment count
            setRealCommentCount(prev => Math.max(0, prev - 1));
            
            // Provide haptic feedback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            console.log('✅ Comment deletion completed');
            
          } catch (error) {
            console.error('❌ Deletion failed:', error);
            
            // Show error and refresh
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete comment';
            Alert.alert('Delete Failed', errorMessage);
            await refreshComments();
            
          } finally {
            setSelectedCommentId(null);
            setShowCommentOptions(false);
          }
        },
      },
    ]
  );
};
