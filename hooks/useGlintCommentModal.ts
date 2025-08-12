/**
 * Custom hook for managing Glint comment functionality
 * 
 * This hook provides a consistent interface for comment functionality
 * that can be reused across home, profile, and other screens
 */

import { useState, useRef, useCallback } from 'react';
import { Animated, TextInput } from 'react-native';

export interface CommentModalState {
  // Modal visibility
  visible: boolean;
  
  // Comment input states
  commentInput: string;
  replyInput: string;
  replyingToCommentId: string | null;
  selectedCommentId: string | null;
  showCommentOptions: boolean;
  
  // UI states
  commentInputFocused: boolean;
  isTyping: boolean;
  isKeyboardVisible: boolean;
  showAndroidTypeBar: boolean;
  expandedReplies: { [commentId: string]: boolean };
  
  // Refs
  commentInputRef: React.RefObject<TextInput | null>;
  replyInputRef: React.RefObject<TextInput | null>;
  
  // Animation values
  commentBoxOpacity: Animated.Value;
  commentListOffset: Animated.Value;
}

export interface CommentModalActions {
  // Modal controls
  openModal: () => void;
  closeModal: () => void;
  
  // Input controls
  setCommentInput: (text: string) => void;
  setReplyInput: (text: string) => void;
  setReplyingToCommentId: (id: string | null) => void;
  setSelectedCommentId: (id: string | null) => void;
  setShowCommentOptions: (show: boolean) => void;
  
  // UI controls
  setCommentInputFocused: (focused: boolean) => void;
  setIsTyping: (typing: boolean) => void;
  setIsKeyboardVisible: (visible: boolean) => void;
  setShowAndroidTypeBar: (show: boolean) => void;
  toggleReplies: (commentId: string) => void;
  
  // Reset functions
  resetCommentState: () => void;
  clearInputs: () => void;
}

export function useGlintCommentModal(): [CommentModalState, CommentModalActions] {
  // Modal visibility
  const [visible, setVisible] = useState(false);
  
  // Comment input states
  const [commentInput, setCommentInput] = useState('');
  const [replyInput, setReplyInput] = useState('');
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [showCommentOptions, setShowCommentOptions] = useState(false);
  
  // UI states
  const [commentInputFocused, setCommentInputFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showAndroidTypeBar, setShowAndroidTypeBar] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<{ [commentId: string]: boolean }>({});
  
  // Refs
  const commentInputRef = useRef<TextInput>(null);
  const replyInputRef = useRef<TextInput>(null);
  
  // Animation values
  const commentBoxOpacity = useRef(new Animated.Value(0)).current;
  const commentListOffset = useRef(new Animated.Value(0)).current;
  
  // Actions
  const openModal = useCallback(() => {
    setVisible(true);
  }, []);
  
  const closeModal = useCallback(() => {
    setVisible(false);
    // Auto-reset typing state when modal closes
    setIsTyping(false);
    setCommentInputFocused(false);
    // Reset animation values
    commentBoxOpacity.setValue(0);
    commentListOffset.setValue(0);
  }, [commentBoxOpacity, commentListOffset]);
  
  const toggleReplies = useCallback((commentId: string) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  }, []);
  
  const resetCommentState = useCallback(() => {
    setReplyingToCommentId(null);
    setSelectedCommentId(null);
    setShowCommentOptions(false);
    setCommentInputFocused(false);
    setIsTyping(false);
    setExpandedReplies({});
  }, []);
  
  const clearInputs = useCallback(() => {
    setCommentInput('');
    setReplyInput('');
  }, []);
  
  const state: CommentModalState = {
    visible,
    commentInput,
    replyInput,
    replyingToCommentId,
    selectedCommentId,
    showCommentOptions,
    commentInputFocused,
    isTyping,
    isKeyboardVisible,
    showAndroidTypeBar,
    expandedReplies,
    commentInputRef,
    replyInputRef,
    commentBoxOpacity,
    commentListOffset,
  };
  
  const actions: CommentModalActions = {
    openModal,
    closeModal,
    setCommentInput,
    setReplyInput,
    setReplyingToCommentId,
    setSelectedCommentId,
    setShowCommentOptions,
    setCommentInputFocused,
    setIsTyping,
    setIsKeyboardVisible,
    setShowAndroidTypeBar,
    toggleReplies,
    resetCommentState,
    clearInputs,
  };
  
  return [state, actions];
}
