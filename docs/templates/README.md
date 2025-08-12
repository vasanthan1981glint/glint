# Template Files

This directory contains template/reference files that are not meant to be compiled directly.

## Files:

- `SIMPLE-handleDelete-final.ts` - Final working version of the simplified comment deletion function
- `SIMPLE-handleDelete-replacement.ts` - Complete replacement template for the handleDelete function
- `fixed_handleDelete.js` - JavaScript version of the fixed deletion logic
- `temp_handleDelete.js` - Temporary handleDelete implementation

## Usage:

These files contain code snippets that should be copied into your React components where you have access to the required context (state, props, hooks, imports, etc.).

**Do not import these files directly** - they contain template code that references variables and functions that only exist within React component contexts.

## Template Variables Required:

When copying template code, ensure your component has access to:

- `selectedCommentId` - Currently selected comment ID
- `comments` - Array of comments
- `currentUserProfile` - Current user's profile
- `deleteComment` - Function from useComments hook
- `refreshComments` - Function from useComments hook
- `Alert`, `Haptics` - React Native imports
- Various state setters like `setSelectedCommentId`, `setShowCommentOptions`, etc.
