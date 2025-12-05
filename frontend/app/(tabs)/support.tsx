import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
// import { logEvent } from '../../components/analytics';

export default function SupportScreen() {
  const { theme } = useTheme();

  const isDark = theme === 'dark';

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //     logEvent('screen_view', { screen_name: 'SupportScreen' });
  // }, []);

  // Function to handle email link press
  const handleEmailPress = () => {
    Linking.openURL('mailto:support@axionnode.com');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: isDark ? '#121212' : '#fff',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'left',
      marginBottom: 20,
      color: isDark ? '#fff' : '#121212',
      fontFamily: isDark ? 'Arial' : 'Helvetica',
    },
    text: {
      fontSize: 16,
      lineHeight: 24,
      marginBottom: 10,
      color: isDark ? '#ddd' : '#333',
      fontFamily: isDark ? 'Arial' : 'Helvetica',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 20,
      color: isDark ? '#fff' : '#121212',
      fontFamily: isDark ? 'Arial' : 'Helvetica',
    },
    linkStyle: {
        color: 'red', 
        marginBottom: -4,
        marginLeft: 5,
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ justifyContent: 'center' }}>
      <Text style={styles.title}>Support</Text>

      <Text style={styles.text}>
      If you require technical support or wish to report a bug, please email us at: 
        <TouchableOpacity onPress={handleEmailPress}>
          <Text style={styles.linkStyle}>support@axionnode.com</Text>
        </TouchableOpacity>
      </Text> 
      
      <Text style={styles.text}>
      If you are interested in having us add a new feature, please post under the community called "SocialBook Product Updates". 
      </Text>

    </ScrollView>
  );
}