import React, { useEffect } from 'react';
import { Linking, View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from "expo-router";
// import { logEvent } from '../../components/analytics';

export default function UserAgreementScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const isDarkMode = theme === 'dark';

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //     logEvent('screen_view', { screen_name: 'UserAgreementScreen' });
  // }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingVertical: 40,
      paddingHorizontal: 20,
      backgroundColor: isDarkMode ? '#121212' : '#fff',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'left',
      marginBottom: 20,
      color: isDarkMode ? '#fff' : '#121212',
      fontFamily: isDarkMode ? 'Arial' : 'Helvetica',
    },
    text: {
      fontSize: 16,
      lineHeight: 24,
      marginBottom: 10,
      color: isDarkMode ? '#ddd' : '#333',
      fontFamily: isDarkMode ? 'Arial' : 'Helvetica',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 20,
      color: isDarkMode ? '#fff' : '#121212',
      fontFamily: isDarkMode ? 'Arial' : 'Helvetica',
    },
    linkText: {
      color: "#4C37FF", // iOS-style blue link color
      textDecorationLine: "underline", // Underline to indicate a clickable link
    },
    darkLinkText: {
      color: "#4C37FF", // Lighter blue for better visibility in dark mode
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ justifyContent: 'center' }}>

      <Text style={styles.title}>User Agreement</Text>

      <Text style={styles.text}>Here is where you can have a user agreement.</Text>

    </ScrollView>
  );
}