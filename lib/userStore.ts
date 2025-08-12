// lib/userStore.ts
import { create } from 'zustand';

interface UserStore {
  avatar: string;
  username: string;
  bio: string;
  setAvatar: (url: string) => void;
  setUsername: (name: string) => void;
  setBio: (bio: string) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  avatar: 'https://randomuser.me/api/portraits/men/32.jpg', // Better default
  username: 'glint_user_demo', // Better default username
  bio: 'Welcome to Glint ✨',
  setAvatar: (url) => {
    console.log('🔄 UserStore: Setting avatar to:', url);
    set({ avatar: url });
  },
  setUsername: (name) => {
    console.log('🔄 UserStore: Setting username to:', name);
    set({ username: name });
  },
  setBio: (bio) => {
    console.log('🔄 UserStore: Setting bio to:', bio);
    set({ bio });
  },
}));
