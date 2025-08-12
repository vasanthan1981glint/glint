// Advanced Comment Hook - YouTube/Glint-style performance
import { useCallback, useEffect, useRef, useState } from 'react';
import { Comment, commentService, PaginatedComments } from '../lib/commentService';

interface UseCommentsOptions {
  postId: string;
  userId?: string;
  enableRealtime?: boolean;
  pageSize?: number;
}

interface UseCommentsReturn {
  // Data
  comments: Comment[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;

  // Actions
  addComment: (text: string, parentId?: string, userProfile?: { username: string; avatar: string }) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  loadMoreComments: () => Promise<void>;
  refreshComments: () => Promise<void>;
  
  // Optimistic updates
  optimisticComments: Comment[];
}

export function useComments({
  postId,
  userId,
  enableRealtime = true,
  pageSize = 20
}: UseCommentsOptions): UseCommentsReturn {
  
  // State management
  const [comments, setComments] = useState<Comment[]>([]);
  const [optimisticComments, setOptimisticComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  // Refs for pagination and cleanup
  const lastDocRef = useRef<any>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isInitialLoadRef = useRef(true);

  // 1. INITIAL LOAD WITH CACHING
  const loadComments = useCallback(async (isRefresh = false) => {
    if (!postId) return;
    
    try {
      setError(null);
      
      if (isRefresh) {
        setLoading(true);
        lastDocRef.current = null;
        isInitialLoadRef.current = true;
      } else if (isInitialLoadRef.current) {
        setLoading(true);
      }

      console.log(`📚 Loading comments for post ${postId}${isRefresh ? ' (refresh)' : ''}`);
      
      const result: PaginatedComments = await commentService.getComments(
        postId,
        pageSize,
        isRefresh ? null : lastDocRef.current,
        isRefresh // Pass bypassCache = true when refreshing
      );

      if (isRefresh || isInitialLoadRef.current) {
        setComments(result.comments);
        isInitialLoadRef.current = false;
      } else {
        setComments(prev => [...prev, ...result.comments]);
      }

      setHasMore(result.hasMore);
      setTotalCount(result.totalCount);
      lastDocRef.current = result.lastDoc;

      console.log(`✅ Loaded ${result.comments.length} comments, hasMore: ${result.hasMore}`);

    } catch (err) {
      console.error('❌ Error loading comments:', err);
      
      // Fallback: provide sample comments if Firebase fails
      if (isInitialLoadRef.current) {
        console.log('🔄 Using fallback sample comments due to Firebase error');
        console.log('⚠️ WARNING: You are now working with SAMPLE DATA. Comments cannot be permanently deleted.');
        const fallbackComments: Comment[] = [
          {
            id: 'fallback1',
            user: 'sample_user',
            userId: 'sample123',
            text: 'Great video! 🔥',
            avatar: 'https://i.pravatar.cc/150?img=1',
            timestamp: new Date(),
            postId,
            parentCommentId: null
          },
          {
            id: 'fallback2',
            user: 'demo_user',
            userId: 'demo456',
            text: 'Amazing content! Keep it up 👍',
            avatar: 'https://i.pravatar.cc/150?img=2',
            timestamp: new Date(),
            postId,
            parentCommentId: null
          }
        ];
        setComments(fallbackComments);
        setTotalCount(fallbackComments.length);
        console.log(`📋 Set ${fallbackComments.length} fallback comments`);
        isInitialLoadRef.current = false;
      }
      
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [postId, pageSize]);

  // 2. PAGINATION - Load more comments
  const loadMoreComments = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDocRef.current) return;
    
    setLoadingMore(true);
    await loadComments();
  }, [loadComments, loadingMore, hasMore]);

  // 3. REFRESH - Reload from beginning
  const refreshComments = useCallback(async () => {
    await loadComments(true);
  }, [loadComments]);

  // 4. OPTIMISTIC COMMENT ADDING
  const addComment = useCallback(async (text: string, parentId?: string, userProfile?: { username: string; avatar: string }) => {
    if (!text.trim() || !userId) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Use provided user profile or fallback to defaults
    const username = userProfile?.username || 'You';
    const avatar = userProfile?.avatar || 'https://via.placeholder.com/40';
    
    // Create optimistic comment for instant UI feedback
    const optimisticComment: Comment = {
      id: tempId,
      user: username,
      userId,
      text: text.trim(),
      avatar: avatar,
      timestamp: new Date(),
      postId,
      parentCommentId: parentId || null,
      likes: 0,
      replies: []
    };

    try {
      // Add to optimistic state immediately
      if (parentId) {
        // Handle reply optimistically
        setComments(prev => prev.map(comment => 
          comment.id === parentId 
            ? { ...comment, replies: [...(comment.replies || []), optimisticComment] }
            : comment
        ));
      } else {
        // Add new top-level comment optimistically
        setOptimisticComments(prev => [optimisticComment, ...prev]);
      }

      console.log('⚡ Optimistic comment added to UI');

      // Background save
      const realComment = await commentService.addComment(
        postId,
        text,
        userId,
        { username, avatar }, // Use actual user profile data
        parentId
      );

      // Replace optimistic comment with real one
      if (parentId) {
        setComments(prev => prev.map(comment =>
          comment.id === parentId
            ? {
                ...comment,
                replies: comment.replies?.map((reply: Comment) =>
                  reply.id === tempId ? realComment : reply
                ) || []
              }
            : comment
        ));
      } else {
        setOptimisticComments(prev => prev.filter(c => c.id !== tempId));
        setComments(prev => [realComment, ...prev]);
      }

      console.log('✅ Comment successfully saved and UI updated');

    } catch (err) {
      console.error('❌ Failed to add comment:', err);
      
      // Remove optimistic comment on error
      if (parentId) {
        setComments(prev => prev.map(comment =>
          comment.id === parentId
            ? { ...comment, replies: comment.replies?.filter((r: Comment) => r.id !== tempId) || [] }
            : comment
        ));
      } else {
        setOptimisticComments(prev => prev.filter(c => c.id !== tempId));
      }
      
      setError('Failed to post comment. Please try again.');
    }
  }, [postId, userId]);

  // 5. SIMPLIFIED FIREBASE COMMENT DELETION - Direct Firebase deletion only
  const deleteComment = useCallback(async (commentId: string) => {
    if (!postId) {
      console.log('❌ No postId for comment deletion');
      return;
    }

    console.log('🗑️ Starting simplified deletion for comment:', commentId);

    try {
      // STEP 1: Delete from Firebase using the service
      await commentService.deleteComment(commentId, postId);
      console.log('✅ Firebase deletion completed via commentService');
      
      // STEP 2: Immediately refresh comments from Firebase to verify deletion
      console.log('🔄 Refreshing comments to verify deletion...');
      await loadComments(true); // Force fresh data from Firebase
      console.log('✅ Comments refreshed after deletion');

    } catch (error) {
      console.error('❌ Failed to delete comment:', error);
      throw error; // Let the calling function handle the error
    }
  }, [postId, loadComments]);

  // 6. REALTIME UPDATES - New comments from other users and handle deletions
  useEffect(() => {
    if (!enableRealtime || !postId) return;

    console.log('🔴 Setting up realtime comments for post:', postId);
    
    const unsubscribe = commentService.subscribeToNewComments(
      postId,
      (newComment: Comment) => {
        // Only add if it's not from current user (avoid duplicates with optimistic updates)
        if (newComment.userId !== userId) {
          setComments(prev => {
            // Check if comment already exists
            const exists = prev.some(c => c.id === newComment.id);
            if (exists) return prev;
            
            console.log('🔴 LIVE: Adding new comment from another user');
            return [newComment, ...prev];
          });
        }
      },
      (deletedCommentId: string) => {
        // Handle real-time comment deletions
        console.log('🔴 LIVE: Removing deleted comment:', deletedCommentId);
        setComments(prev => prev.filter(c => c.id !== deletedCommentId));
        setOptimisticComments(prev => prev.filter(c => c.id !== deletedCommentId));
        setTotalCount(prev => Math.max(0, prev - 1));
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [postId, userId, enableRealtime]);

  // 7. INITIAL LOAD
  useEffect(() => {
    if (postId && isInitialLoadRef.current) {
      loadComments(true);
    }
  }, [postId, loadComments]); // Include loadComments in dependencies

  // 8. CLEANUP
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Combine real comments with optimistic ones for display
  const displayComments = [...optimisticComments, ...comments];

  return {
    // Data
    comments: displayComments,
    loading,
    loadingMore,
    error,
    hasMore,
    totalCount,

    // Actions
    addComment,
    deleteComment,
    loadMoreComments,
    refreshComments,
    
    // Optimistic state for advanced UIs
    optimisticComments
  };
}

// Default export
export default useComments;
