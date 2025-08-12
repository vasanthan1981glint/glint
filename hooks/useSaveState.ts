import { useCallback, useEffect, useState } from 'react';
import { savedVideosService } from '../lib/savedVideosService';

interface UseSaveStateProps {
  videoId: string;
  userId?: string;
}

interface SaveState {
  isSaved: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useSaveState = ({ videoId, userId }: UseSaveStateProps) => {
  const [saveState, setSaveState] = useState<SaveState>({
    isSaved: false,
    isLoading: false,
    error: null
  });

  // Load initial save status
  useEffect(() => {
    if (!videoId || !userId) return;

    const loadSaveStatus = async () => {
      setSaveState(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        const isSaved = await savedVideosService.isVideoSaved(videoId);
        setSaveState(prev => ({ 
          ...prev, 
          isSaved, 
          isLoading: false 
        }));
      } catch (error) {
        console.error('Failed to load save status:', error);
        setSaveState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: (error as Error).message 
        }));
      }
    };

    loadSaveStatus();
  }, [videoId, userId]);

  // Toggle save with optimistic updates
  const toggleSave = useCallback(async () => {
    if (!videoId || saveState.isLoading) return;

    // Optimistic update
    const previousState = saveState.isSaved;
    setSaveState(prev => ({ 
      ...prev, 
      isSaved: !prev.isSaved, 
      isLoading: true,
      error: null 
    }));

    try {
      const newSaveStatus = await savedVideosService.toggleSaveVideo(videoId);
      
      setSaveState(prev => ({ 
        ...prev, 
        isSaved: newSaveStatus, 
        isLoading: false 
      }));

      return newSaveStatus;
    } catch (error) {
      console.error('Save toggle failed:', error);
      
      // Revert optimistic update on error
      setSaveState(prev => ({ 
        ...prev, 
        isSaved: previousState, 
        isLoading: false,
        error: (error as Error).message 
      }));
      
      throw error;
    }
  }, [videoId, saveState.isSaved, saveState.isLoading]);

  // Manual refresh
  const refreshSaveStatus = useCallback(async () => {
    if (!videoId || !userId) return;

    try {
      const isSaved = await savedVideosService.isVideoSaved(videoId);
      setSaveState(prev => ({ 
        ...prev, 
        isSaved, 
        error: null 
      }));
    } catch (error) {
      console.error('Failed to refresh save status:', error);
      setSaveState(prev => ({ 
        ...prev, 
        error: (error as Error).message 
      }));
    }
  }, [videoId, userId]);

  return {
    ...saveState,
    toggleSave,
    refreshSaveStatus
  };
};
