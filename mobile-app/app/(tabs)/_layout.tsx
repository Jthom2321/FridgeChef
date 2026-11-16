import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { Colors, Fonts } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.muted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.divider,
          borderTopWidth: 1,
          height: 76 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 12,
        },
        tabBarLabelStyle: { fontFamily: Fonts.bold, fontSize: 11, lineHeight: 14 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Fridge',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons size={24} name="fridge-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Recipes',
          tabBarIcon: ({ color }) => <Ionicons size={22} name="book-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="swaps"
        options={{
          title: 'Swaps',
          tabBarIcon: ({ color }) => <Ionicons size={22} name="swap-horizontal" color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color }) => <Ionicons size={22} name="heart-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
