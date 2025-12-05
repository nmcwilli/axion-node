import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, TouchableWithoutFeedback, Platform, Keyboard, TouchableOpacity, View, Text, TextInput, Button, StyleSheet, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
// import { logEvent } from '../../components/analytics';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function ResetPasswordScreen() {
  const { email, token } = useLocalSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const { theme } = useTheme();

  const isValidRequest = email && token;
  
  const isDarkMode = theme === 'dark';

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //     logEvent('screen_view', { screen_name: 'ResetPasswordScreen' });
  // }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: 20,
      backgroundColor: isDarkMode ? '#121212' : '#fff',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 20,
      color: isDarkMode ? '#fff' : '#121212',
    },
    input: {
      height: 40,
      borderWidth: 1,
      marginBottom: 12,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderColor: isDarkMode ? '#fff' : '#121212',
      backgroundColor: isDarkMode ? '#333' : '#fff',
      color: isDarkMode ? '#fff' : '#121212',
    },
    message: {
      marginTop: 10,
      textAlign: 'center',
      color: isDarkMode ? '#66FF66' : 'green',
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
    formWrapper: {
      width: '100%',
      maxWidth: 600,
    },
    formWrapperDark: {
      width: '100%',
      maxWidth: 600,
      backgroundColor: '#000000'
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
    paragraph: {
      fontSize: 14,
      color: 'grey',
      paddingBottom: 20,
    },
  });

  const handleResetPassword = async () => {
    if (!email || !token || !newPassword) {
        setMessage('All fields are required.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/password-reset/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                token,
                new_password: newPassword,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.log('Error resetting password:', errorText);
            setMessage('Error resetting password.');
            return;
        }

        const data = await response.json();
        setMessage(data.message);
        
        setTimeout(() => router.replace('/login'), 2000);
    } catch (error: any) {
        console.error(error);
        setMessage('An unexpected error occurred. Please try again later.');
    }
  };

  // If it is not a valid request with a token and an encoded email then fail
  if (!isValidRequest) {
    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[isDarkMode ? styles.centerWrapperDark : styles.centerWrapper,
          { paddingTop: 240 }, // Add excess padding here
        ]}
      >
        <View style={[styles.centerWrapper, isDarkMode && styles.centerWrapperDark]}>
          <Text style={[styles.title, { color: '#E21C56', textAlign: 'center' }]}>
            Invalid password reset link
          </Text>
          <Text style={styles.paragraph}>
            This link may have expired or is missing required information. If you continue to experience difficulties, contact your technical support team for assistance.
          </Text>
          <TouchableOpacity
            style={[styles.buttonStyle, { marginTop: 20 }]}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.buttonText}>Return to Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

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

            <Text style={styles.title}>Reset Password</Text>

            <Text style={styles.paragraph}>Create a new password for your account and then click Reset Password.</Text>

            <TextInput 
              style={styles.input} 
              placeholder="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            {/* <Button 
              title="Reset Password" 
              onPress={() => {
                Keyboard.dismiss();
                setTimeout(() => {
                  handleResetPassword();
                }, 100); // Give the keyboard a moment to close
              }}
              color="#4C37FF" 
            /> */}

            <TouchableOpacity
              style={[
                styles.buttonStyle,
                isDarkMode && styles.darkButtonStyle,
                { paddingVertical: 15, paddingHorizontal: 30, borderRadius: 8 }, // Adjust padding and border radius
              ]}
              onPress={() => {
                Keyboard.dismiss();
                setTimeout(() => {
                  handleResetPassword();
                }, 100); // Give the keyboard a moment to close
              }}
            >
              <Text style={styles.buttonText}>Reset Password</Text>
            </TouchableOpacity>

            {message !== '' ? <Text style={styles.message}>{String(message)}</Text> : null}
          
          </View>

        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}