  const handleDelete = async () => {
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
            try {
              console.log('🗑️ Starting deletion for comment:', selectedCommentId);
              closeCommentOptions();
              
              // Step 1: Delete via optimistic deletion (removes from UI immediately)
              await deleteComment(selectedCommentId);
              console.log('✅ Optimistic deletion completed');
              
              // Step 2: Direct Firebase deletion for permanent removal
              const currentUser = auth.currentUser;
              if (!currentUser) {
                throw new Error('User not authenticated');
              }

              const commentRef = doc(db, 'comments', selectedCommentId);
              console.log('🔥 Executing direct Firebase deletion...');
              await deleteDoc(commentRef);
              console.log('✅ Firebase deletion successful');
              
              // Step 3: Clear cache only (no refresh to avoid reappearance)
              if (commentService && typeof commentService.clearAllCache === 'function') {
                commentService.clearAllCache();
                console.log('🧹 Cache cleared');
              }
              
              console.log('✅ Comment deleted successfully');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              
            } catch (error) {
              console.error('❌ Deletion failed:', error);
              const errorMessage = error instanceof Error ? error.message : 'Failed to delete comment';
              Alert.alert('Delete Failed', errorMessage);
              
              // Refresh to restore comment if deletion failed
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
