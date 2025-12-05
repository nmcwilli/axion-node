// app/2fa.tsx
import { KeyboardAvoidingView, TouchableWithoutFeedback, Platform, Keyboard, TouchableOpacity, ScrollView, StyleSheet, View, Text, TextInput, Button, RefreshControl } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/auth';
import { useRouter, Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import * as Updates from 'expo-updates';
// import { logEvent } from '../../components/analytics';

export default function TwoFAScreen() {
  const [otpCode, setOtpCode] = useState('');
  const { pending2FAUsername, setPending2FAUsername } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState('');

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //   logEvent('screen_view', { screen_name: 'TwoFAScreen' });
  // }, []);
  
  // Automatically sign the user in if they already have tokens
  useEffect(() => {
    const checkExistingTokens = async () => {
      const token = await AsyncStorage.getItem('token');
      const refreshToken = await AsyncStorage.getItem('refreshToken');
  
      if (token && refreshToken) {
        const isValid = await validateToken(token);
        if (isValid) {
          setPending2FAUsername(null);
          await AsyncStorage.removeItem('pending2FAUsername');
          console.log('🔐 Redirecting to root for pending user:');
          router.replace('/');
          return;
        }
      }
      setLoading(false);
    };
  
    checkExistingTokens();
  }, []);

  // Token validation
  const validateToken = async (token: string): Promise<boolean> => {
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/auth/validate-token/`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      return res.status === 200;
    } catch (err) {
      console.error('Token validation error:', err);
      return false;
    }
  };

  // Verify the OTP 
  const verifyOTP = async () => {
    setErrorMessage(''); // Clear previous error
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/auth/verify-otp/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 
        },
        body: JSON.stringify({
          username: pending2FAUsername,
          otp: otpCode, 
        }),
      });
  
      const data = await response.json();
  
      if (response.ok && data.token && data.refreshToken) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('refreshToken', data.refreshToken);
  
        setPending2FAUsername(null);
        await AsyncStorage.removeItem('pending2FAUsername');
  
        if (Platform.OS === 'web') {
          window.location.reload();
        } else {
          // Native workaround: navigate to a blank screen then root
          await Updates.reloadAsync(); // 👈 hard reloads the app
        }
      } else {
        setErrorMessage(data?.detail || 'Invalid OTP code. Please try again.');
      }
    } catch (error) {
      console.log('Error verifying OTP. Please try again.');
      setErrorMessage('Something went wrong. Please try again.');
    }
  };

  const isDarkMode = theme === 'dark';
  
  const styles = StyleSheet.create({
    container: {
      padding: 20,
      backgroundColor: isDarkMode ? '#121212' : '#fff',
    },
    darkContainer: {
      padding: 10,
      backgroundColor: "#121212",
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 20,
      color: isDarkMode ? '#fff' : '#121212',
    },
    text: {
      fontSize: 14,
      textAlign: 'center',
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
    inputPwd: {
      flex: 1,
      height: 40,
      paddingHorizontal: 10,
      color: isDarkMode ? '#fff' : '#121212',
    },
    errorText: {
      color: 'red',
      textAlign: 'center',
      marginBottom: 10,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 8,
      borderColor: isDarkMode ? '#fff' : '#121212',
      backgroundColor: isDarkMode ? '#333' : '#fff',
      marginBottom: 12,
    },
    toggleButton: {
      padding: 10,
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
  });

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
          contentContainerStyle={[
            { paddingBottom: 500, paddingTop: 80, flexGrow: 1 },
            isDarkMode ? styles.darkContainer : styles.container,
          ]}
        >
          <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
            <Text style={styles.title}>Two-factor authentication (2FA)</Text>
            <Text style={styles.text}>Enter your two-factor authentication/OTP code below to login.</Text>

            {errorMessage !== '' && <Text style={styles.errorText}>{errorMessage}</Text>}
            
            <TextInput
              placeholder="Enter 6-digit code with no spaces"
              placeholderTextColor={isDarkMode ? '#aaa' : '#555'}
              keyboardType="number-pad"
              style={{
                borderWidth: 1,
                padding: 10,
                marginTop: 20,
                marginBottom: 20,
                color: isDarkMode ? '#fff' : '#000', // Text color
                borderColor: isDarkMode ? '#888' : '#121212', // Lighter border for dark mode
                backgroundColor: isDarkMode ? '#333' : '#fff', // Optional: background color
                borderRadius: 8,
              }}
              value={otpCode}
              maxLength={6}
              autoFocus
              onChangeText={(text) => {
                setOtpCode(text);
                if (errorMessage) setErrorMessage('');
              }}
              onSubmitEditing={verifyOTP}
              returnKeyType="done"
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
                  verifyOTP();
                }, 100); // Give the keyboard a moment to close
              }}
            >
              <Text style={styles.buttonText}>Verify OTP</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}