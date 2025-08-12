import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { followService } from './followService';

interface FollowState {
  // Follow states for all users: userId -> isFollowing
  followStates: { [userId: string]: boolean };
  
  // Loading states for follow operations: userId -> isLoading
  followLoadingStates: { [userId: string]: boolean };
  
  // Actions
  setFollowState: (userId: string, isFollowing: boolean) => void;
  setFollowLoading: (userId: string, isLoading: boolean) => void;
  
  // Follow/unfollow operations
  toggleFollow: (currentUserId: string, targetUserId: string) => Promise<boolean>;
  loadFollowState: (currentUserId: string, targetUserId: string) => Promise<void>;
  
  // Batch operations
  loadMultipleFollowStates: (currentUserId: string, userIds: string[]) => Promise<void>;
  
  // Clear states (for logout etc.)
  clearFollowStates: () => void;
}

export const useFollowStore = create<FollowState>()(
  subscribeWithSelector((set, get) => ({
    followStates: {},
    followLoadingStates: {},
    
    setFollowState: (userId: string, isFollowing: boolean) => {
      console.log('📝 Global follow state updated:', userId, '→', isFollowing);
      set((state) => ({
        followStates: {
          ...state.followStates,
          [userId]: isFollowing,
        },
      }));
    },
    
    setFollowLoading: (userId: string, isLoading: boolean) => {
      set((state) => ({
        followLoadingStates: {
          ...state.followLoadingStates,
          [userId]: isLoading,
        },
      }));
    },
    
    toggleFollow: async (currentUserId: string, targetUserId: string): Promise<boolean> => {
      if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
        return false;
      }
      
      const { followStates, setFollowLoading, setFollowState } = get();
      const wasFollowing = followStates[targetUserId] || false;
      
      try {
        console.log('🔄 Global follow toggle:', targetUserId, wasFollowing ? 'unfollow' : 'follow');
        setFollowLoading(targetUserId, true);
        
        // Optimistic update for instant UI feedback
        setFollowState(targetUserId, !wasFollowing);
        
        let success = false;
        if (wasFollowing) {
          success = await followService.unfollowUser(currentUserId, targetUserId);
        } else {
          success = await followService.followUser(currentUserId, targetUserId);
        }
        
        if (!success) {
          // Revert optimistic update if operation failed
          console.warn('⚠️ Follow operation failed, reverting state');
          setFollowState(targetUserId, wasFollowing);
          return false;
        }
        
        console.log('✅ Global follow operation successful');
        return true;
        
      } catch (error) {
        console.error('❌ Global follow toggle error:', error);
        // Revert optimistic update
        setFollowState(targetUserId, wasFollowing);
        return false;
      } finally {
        setFollowLoading(targetUserId, false);
      }
    },
    
    loadFollowState: async (currentUserId: string, targetUserId: string) => {
      if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
        return;
      }
      
      try {
        const isFollowing = await followService.isFollowing(currentUserId, targetUserId);
        get().setFollowState(targetUserId, isFollowing);
      } catch (error) {
        console.error('❌ Error loading follow state:', error);
      }
    },
    
    loadMultipleFollowStates: async (currentUserId: string, userIds: string[]) => {
      if (!currentUserId || userIds.length === 0) {
        return;
      }
      
      try {
        console.log('📦 Loading multiple follow states for:', userIds.length, 'users');
        
        const promises = userIds
          .filter(userId => userId !== currentUserId)
          .map(async (userId) => {
            const isFollowing = await followService.isFollowing(currentUserId, userId);
            return { userId, isFollowing };
          });
        
        const results = await Promise.all(promises);
        
        // Batch update all states
        set((state) => {
          const newFollowStates = { ...state.followStates };
          results.forEach(({ userId, isFollowing }) => {
            newFollowStates[userId] = isFollowing;
          });
          return { followStates: newFollowStates };
        });
        
        console.log('✅ Loaded follow states for', results.length, 'users');
      } catch (error) {
        console.error('❌ Error loading multiple follow states:', error);
      }
    },
    
    clearFollowStates: () => {
      console.log('🧹 Clearing global follow states');
      set({
        followStates: {},
        followLoadingStates: {},
      });
    },
  }))
);

// Helper hooks for easy component usage
export const useFollowState = (userId: string) => {
  const isFollowing = useFollowStore((state) => state.followStates[userId] || false);
  const isLoading = useFollowStore((state) => state.followLoadingStates[userId] || false);
  
  return { isFollowing, isLoading };
};

export const useFollowActions = () => {
  const toggleFollow = useFollowStore((state) => state.toggleFollow);
  const loadFollowState = useFollowStore((state) => state.loadFollowState);
  const loadMultipleFollowStates = useFollowStore((state) => state.loadMultipleFollowStates);
  const setFollowState = useFollowStore((state) => state.setFollowState);
  
  return { toggleFollow, loadFollowState, loadMultipleFollowStates, setFollowState };
};

// Subscribe to follow state changes for debugging
if (__DEV__) {
  useFollowStore.subscribe(
    (state) => state.followStates,
    (followStates) => {
      console.log('🔄 Global follow states updated:', Object.keys(followStates).length, 'users tracked');
    }
  );
}
