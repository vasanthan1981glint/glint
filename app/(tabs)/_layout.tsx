import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#fff',
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopWidth: 0,
          height: 60,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ color }) => (
            <Ionicons name="home-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plus"
        options={{
          tabBarIcon: ({ color }) => (
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: color,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="star" size={16} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          tabBarIcon: () => (
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                borderWidth: 1.5,
                borderColor: '#fff',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 18,
              }}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
          },
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ color }) => (
            <Ionicons name="search-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          tabBarIcon: ({ color }) => (
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: color,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <FontAwesome name="user" size={16} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
