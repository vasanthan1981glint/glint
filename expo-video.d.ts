declare module 'expo-video' {
    import React from 'react';
    import { ViewProps } from 'react-native';
  
    export interface VideoProps extends ViewProps {
      source: { uri: string };
      resizeMode?: 'contain' | 'cover' | 'stretch';
      isLooping?: boolean;
      shouldPlay?: boolean;
      ref?: React.Ref<any>;
    }
  
    export default class Video extends React.Component<VideoProps> {
      playAsync(): Promise<void>;
      pauseAsync(): Promise<void>;
      getStatusAsync(): Promise<{ isPlaying: boolean }>;
    }
  }
  