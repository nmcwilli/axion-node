import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, TouchableWithoutFeedback, Platform, Keyboard, TouchableOpacity, View, Text, TextInput, Button, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
// import { logEvent } from '../../components/analytics';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const { theme } = useTheme();
  
  const isDarkMode = theme === 'dark';

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //   logEvent('screen_view', { screen_name: 'ForgotPasswordScreen' });
  // }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      paddingBottom: 400, 
      paddingTop: 160,
      padding: 30,
      backgroundColor: isDarkMode ? '#000000' : '#fff',
      marginHorizontal: 'auto',
    },
    // DARK MODE STYLES
    darkContainer: {
      backgroundColor: '#000000',
      marginHorizontal: 'auto',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 20,
      color: isDarkMode ? '#fff' : '#121212',
    },
    paragraph: {
      fontSize: 14,
      color: 'grey',
      paddingBottom: 20,
    },
    paragraphSubtext: {
      fontSize: 14,
      color: 'grey',
      paddingTop: 20,
    },
    input: {
      height: 50,  // Increased height
      borderWidth: 1,
      marginBottom: 12,
      paddingHorizontal: 15, // More padding for better spacing
      paddingVertical: 10,  // Ensures text isn’t squished
      borderRadius: 8, // Slightly more rounded
      borderColor: isDarkMode ? '#fff' : '#121212',
      backgroundColor: isDarkMode ? '#333' : '#fff',
      color: isDarkMode ? '#fff' : '#121212',
      fontSize: 16,  // Bigger text for better readability
    },
    darkInput: {
      color: '#FFF'
    }, 
    message: {
      marginTop: 10,
      textAlign: 'center',
      color: isDarkMode ? '#66FF66' : 'green',
    },
    formWrapper: {
      width: '100%',
      maxWidth: 600,
    },
    formWrapperDark: {
      width: '100%',
      maxWidth: 600,
      backgroundColor: '#000000'
    },
    buttonStyle: {
      backgroundColor: "#4C37FF",
      padding: 10,
      borderRadius: 8,
    }, 
    darkButtonStyle: {
      backgroundColor: '#4C37FF',
      padding: 10,
    }, 
    buttonText: {
      color: '#FFF',
      textAlign: "center", 
    }, 
    centerWrapper: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 180, 
      paddingBottom: 400,
      backgroundColor: '#FFF',
    },
    centerWrapperDark: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 180, 
      paddingBottom: 400,
      backgroundColor: '#000000',
    },
  });

  const handlePasswordResetRequest = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/password-reset-request/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
  
      if (!response.ok) {
        throw new Error('Problem sending the reset email.');
      }
  
      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setMessage('Error: Problem sending the reset email.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback
        onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}
        accessible={false}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={isDarkMode ? styles.centerWrapperDark : styles.centerWrapper}
        >
          <View style={isDarkMode ? styles.formWrapperDark : styles.formWrapper}>
            <Text style={styles.title}>Forgot Password?</Text>

            <Text style={styles.paragraph}>If you have forgotten your password (or it is not working) simply submit your email here and then we will send you instructions on how to reset it.</Text>

            <TextInput 
              style={[styles.input, isDarkMode && styles.darkInput]}
              placeholder="Enter your email address"
              placeholderTextColor={isDarkMode ? '#BBB' : '#888'}
              value={email}
              onChangeText={(text) => {
                if (text.length <= 254) {
                  setEmail(text);
                }
              }}
              keyboardType="email-address"
            />

            <TouchableOpacity
              style={[
                styles.buttonStyle,
                isDarkMode && styles.darkButtonStyle,
                { paddingVertical: 15, paddingHorizontal: 30, borderRadius: 8 }, // Adjust padding and border radius
              ]}
              onPress={() => {
                Keyboard.dismiss();
                setTimeout(() => {
                  handlePasswordResetRequest();
                }, 100); // Give the keyboard a moment to close
              }}
            >
              <Text style={styles.buttonText}>Send Reset Link</Text>

            </TouchableOpacity>

            <Text style={styles.paragraphSubtext}>* If problems persist, then email our team at support@axionnode.com</Text>
            
            {/* Render message back */}
            {message !== '' ? (
              <Text style={[styles.message, message.includes('Error') && { color: 'red' }]}>
                {String(message)}
              </Text>
            ) : null}
          </View>
        </ScrollView>
        
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}