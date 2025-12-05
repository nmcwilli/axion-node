import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, TouchableWithoutFeedback, Platform, Keyboard, ScrollView, View, Text, TextInput, Button, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/auth';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; 
// import { logEvent } from '../../components/analytics';

export default function LoginScreen() {
  const { login } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false); // State for password visibility

  const isWeb = Platform.OS === 'web';

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //     logEvent('screen_view', { screen_name: 'LoginScreen' });
  // }, []);

  const handleLogin = async () => {
    setErrorMessage(null); // Clear previous errors

    // console.log('🔄 Attempting to log in with:', username);
    try {
      await login(username, password);
      // console.log('✅ Login successful, redirecting...');
      router.replace('/');
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail;
  
      if (errorDetail === "No active account found with the given credentials") {
        setErrorMessage("We couldn't find any active accounts using those credentials. Please try again.");
      } else {
        setErrorMessage(errorDetail || "Login failed. Please try again.");
      }
    }
  };

  const isDarkMode = theme === 'dark';

  const styles = StyleSheet.create({
    container: {
      padding: 20,
      backgroundColor: isDarkMode ? '#000' : '#fff',
      borderRadius: 15,
      marginTop: 40,
    },
    darkContainer: {
      padding: 10,
      backgroundColor: "#000",
      borderRadius: 15,
      marginTop: 40,
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
    inputPwd: {
      flex: 1,
      height: 40,
      paddingHorizontal: 10,
      color: isDarkMode ? '#fff' : '#121212',
    },
    subtitleText: {
      fontSize: 16,
      marginBottom: 20,
      color: 'grey', 
      textAlign: 'center',
    }, 
    darkTextSubtitle: {
      textAlign: 'center',
      color: '#cdcdcd'
    }, 
    errorText: {
      color: '#4C37FF',
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
    centerWrapper: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      backgroundColor: '#FFF',
      paddingTop: 100,
      paddingBottom: 300,
    },
    centerWrapperDark: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      backgroundColor: '#000',
      paddingTop: 100,
      paddingBottom: 300,
    },
    toggleButton: {
      padding: 10,
    },
    buttonStyle: {
      backgroundColor: "#4C37FF",
      padding: 10,
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
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <TouchableWithoutFeedback
        onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}
        accessible={false}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          // keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={[
            isDarkMode ? styles.centerWrapperDark : styles.centerWrapper,
          ]}
        >
          <View style={isDarkMode ? styles.formWrapperDark : styles.formWrapper}>
            
            <Text style={styles.title}>Login</Text>

            <Text style={[styles.subtitleText, isDarkMode && styles.darkTextSubtitle]}>Login with your email/password or username/password.</Text>

            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

            {/* Email or Username */}
            <TextInput
              style={styles.input}
              placeholder="Username or Email Address"
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase())} // Convert to lowercase
              autoCapitalize="none" // Prevent automatic capitalization
              placeholderTextColor={isDarkMode ? '#bbb' : '#aaa'}
              onSubmitEditing={handleLogin} // <- Allows user to submit by pressing enter
              textContentType="username"       // 🟢 iOS + Android
              autoComplete="email"             // 🟢 Android + Web
              importantForAutofill="yes"       // 🟢 Android
              {...(Platform.OS === 'web' ? { name: 'email', type: 'email' } : {})} // Web only
            />

            {/* Password Input with Toggle */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.inputPwd}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword} // Toggle secure entry
                placeholderTextColor={isDarkMode ? '#bbb' : '#aaa'}
                onSubmitEditing={handleLogin} // <- Allows user to submit by pressing enter
                returnKeyType="go" // (optional) shows "Go" on the keyboard
                textContentType="password"       // 🟢 iOS + Android
                autoComplete="password"          // 🟢 Android + Web
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.toggleButton}>
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={24}
                  color={isDarkMode ? '#fff' : '#555'}
                />
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.buttonStyle,
                isDarkMode && styles.darkButtonStyle,
                { paddingVertical: 15, paddingHorizontal: 30, borderRadius: 8 }, // Adjust padding and border radius
              ]}
              onPress={() => {
                Keyboard.dismiss();
                setTimeout(() => {
                  handleLogin();
                }, 100); // Give the keyboard a moment to close
              }}
            >
              <Text style={styles.buttonText}>LOGIN</Text>
            </TouchableOpacity>

            <Text
              style={{ color: 'grey', textAlign: 'center', marginTop: 10 }}
              onPress={() => router.push('/forgot-password')}
            >
              Forgot Password?
            </Text>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}