import React, { useEffect } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
// import { logEvent } from '../../components/analytics';

export default function PrivacyPolicyScreen() {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  // Firebase Analytics
  // useEffect(() => {
  //     logEvent('screen_view', { screen_name: 'PrivacyPolicyScreen' });
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
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 20,
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
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ justifyContent: 'center' }}>
      <Text style={styles.title}>Privacy Policy</Text>

      <Text style={styles.text}>
      Here is where you can have a Privacy Policy.
      </Text>

    </ScrollView>
  );
}