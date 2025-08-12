import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as NavigationBar from 'expo-navigation-bar';
import { Tabs, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../lib/userStore';

export default function TabLayout() {
  const { avatar: userAvatar } = useUserStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('#000');
      NavigationBar.setButtonStyleAsync('light');
    }
  }, []);

  const segments = useSegments();
  const currentTab = segments[segments.length - 1] || 'home';
  const isHome = currentTab === 'home';

  const tabBarBg = isHome ? '#000' : '#fff';
  const iconColor = isHome ? '#fff' : '#111';

  const getSize = (focused: boolean, normal: number, active: number) =>
    focused ? active : normal;

  const GLINT_TABBAR_HEIGHT = 49 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: tabBarBg,
          height: GLINT_TABBAR_HEIGHT,
          paddingBottom: insets.bottom,
          paddingTop: 6,
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -3 },
          elevation: 10,
          width: '100%',
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Ionicons
              name="home-outline"
              size={getSize(focused, 24, 27)}
              color={iconColor}
              style={{ marginTop: 2 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="plus"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <View
              style={{
                width: getSize(focused, 26, 29),
                height: getSize(focused, 26, 29),
                borderRadius: 7,
                borderWidth: 1.5,
                borderColor: iconColor,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons
                name="star"
                size={getSize(focused, 16, 18)}
                color={iconColor}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <View
              style={{
                width: getSize(focused, 38, 42),
                height: getSize(focused, 38, 42),
                borderRadius: getSize(focused, 19, 21),
                borderWidth: 1.5,
                borderColor: iconColor,
                backgroundColor: tabBarBg,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <Ionicons
                name="add"
                size={getSize(focused, 24, 27)}
                color={iconColor}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <Ionicons
              name="search-outline"
              size={getSize(focused, 28, 32)}
              color={iconColor}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <View
              style={{
                width: getSize(focused, 28, 32),
                height: getSize(focused, 28, 32),
                borderRadius: getSize(focused, 14, 16),
                borderWidth: focused ? 2 : 0,
                borderColor: iconColor,
                backgroundColor: tabBarBg,
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              <Image
                source={{ uri: userAvatar && userAvatar.trim() !== '' ? userAvatar : 'https://via.placeholder.com/150' }}
                style={{
                  width: getSize(focused, 22, 26),
                  height: getSize(focused, 22, 26),
                  borderRadius: getSize(focused, 11, 13),
                }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
