import React, { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { FontAwesome } from '@expo/vector-icons';
import { ThemeProvider } from './context/ThemeContext';  // Import the ThemeProvider
import { AuthProvider } from './context/auth'; // Import AuthProvider
import MainTabs from './(tabs)/_layout'; // Import MainTabs component
import { Slot } from 'expo-router';
import { View, Text } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import './global.css';

export default function AppLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,  // Load FontAwesome icons
  });

  // ✅ Handle error outside of useEffect
  if (error) {
    return (
      <View>
        <Text>Error loading fonts: {error.message}</Text>
      </View>
    );
  }

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync(); // Hide splash screen once fonts are loaded
    }
  }, [loaded]);

  if (!loaded) {
    SplashScreen.preventAutoHideAsync(); // Keep splash screen visible until fonts are ready
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <PaperProvider>
          <Slot />
        </PaperProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}