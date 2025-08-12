# Glint Comment System Integration Guide

## 📱 What We Created

1. **GlintCommentModal.tsx** - A reusable comment modal component
2. **useGlintCommentModal.ts** - A custom hook for managing comment state
3. **Integration examples** - How to use them across different screens

## 🚀 How to Use in Your Screens

### 1. Home Screen Integration

```tsx
import GlintCommentModal from '../components/GlintCommentModal';
import { useGlintCommentModal } from '../hooks/useGlintCommentModal';

function HomeScreen() {
  // Your existing comment hooks and state
  const { comments, addComment, deleteComment, ... } = useComments({...});
  
  // New Glint modal state
  const [commentModalState, commentModalActions] = useGlintCommentModal();
  
  return (
    <View>
      {/* Your existing home content */}
      
      {/* Comment button */}
      <TouchableOpacity onPress={commentModalActions.openModal}>
        <Ionicons name="chatbubble-outline" size={24} color="#fff" />
      </TouchableOpacity>
      
      {/* Glint Comment Modal */}
      <GlintCommentModal
        visible={commentModalState.visible}
        onClose={commentModalActions.closeModal}
        postId={currentPostId}
        comments={comments}
        addComment={addComment}
        deleteComment={deleteComment}
        // ... other props
      />
    </View>
  );
}
```

### 2. Profile Screen Integration

```tsx
function ProfileScreen() {
  const [commentModalState, commentModalActions] = useGlintCommentModal();
  
  return (
    <View>
      {/* Profile content */}
      
      <GlintCommentModal
        visible={commentModalState.visible}
        onClose={commentModalActions.closeModal}
        // Same props, different postId
      />
    </View>
  );
}
```

## ✨ Benefits

1. **DRY Code** - No more duplicating comment UI logic
2. **Consistent UX** - Same Instagram-style experience everywhere
3. **Easy Customization** - Pass different props for different screens
4. **Maintainable** - Update once, works everywhere

## 🔧 Migration Steps

1. Import the new components
2. Replace your existing comment modal with `GlintCommentModal`
3. Replace comment state management with `useGlintCommentModal`
4. Update your comment button to use `commentModalActions.openModal`

## 📦 Files Created

- `/components/GlintCommentModal.tsx` - Main reusable component
- `/hooks/useGlintCommentModal.ts` - State management hook
- `/examples/CommentModalUsage.tsx` - Usage examples

The component handles all the Glint-style features:
- Comment threading (replies)
- Like animations
- User avatars
- Timestamp formatting
- Options menu (edit, delete, report)
- Responsive design
- Smooth animations

Just plug it in and you're good to go! 🚀
