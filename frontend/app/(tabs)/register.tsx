import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, TouchableWithoutFeedback, Platform, Keyboard, ScrollView, View, Text, TextInput, Button, Image, Alert, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../context/ThemeContext"; // Import theme context
import { Ionicons } from "@expo/vector-icons"; // Import icon library
// import { logEvent } from '../../components/analytics';

export default function RegisterScreen() {
  const router = useRouter();
  const { theme } = useTheme(); // Get current theme
  const isDarkMode = theme === "dark";
  const [showPassword, setShowPassword] = useState(false); // New state for password visibility
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Loading state
  const [message, setMessage] = useState(""); // Message state
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //     logEvent('screen_view', { screen_name: 'RegisterScreen' });
  // }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setProfilePhoto(result.assets[0].uri);
    }
  };

  const handleRegister = async () => {
    if (!agreedToTerms) {
      Alert.alert("Error", "You must agree to the User Agreement.");
      setMessage('Error: You must agree to the User Agreement.');
      return;
    }

    setIsLoading(true); // Start loading
    let formData = new FormData();
    formData.append("username", username);
    formData.append("email", email);
    formData.append("password", password);

    if (profilePhoto) {
      const filename = profilePhoto.split("/").pop();
      const match = /\.(\w+)$/.exec(filename || "");
      const ext = match?.[1] || "jpg";
      formData.append("profile_photo", {
        uri: profilePhoto,
        name: `profile.${ext}`,
        type: `image/${ext}`,
      } as any);
    }
  
    try {
      let response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/register/`, {
        method: "POST",
        body: formData,
        // headers: {
        //   "Content-Type": "multipart/form-data",
        // },
      });
  
      let data = await response.json();
  
      // Check if response is successful
      if (response.ok) {
        Alert.alert('Registration successful!', 'You can now log in.', [{ text: 'OK' }]);
        setMessage('Registration successful! You can now login.');
        setUsername('');
        setEmail('');
        setPassword('');
        setProfilePhoto(null); // Reset form
      } else {
        // Handle errors for email and username
        let errorMessages = [];
  
        if (data.email) {
          errorMessages.push(data.email[0]); // Display email error
        }
  
        if (data.username) {
          errorMessages.push(data.username[0]); // Display username error
        }

        if (data.password) {
          errorMessages.push(data.password[0]); // Display password error
        }
  
        // Show the error message(s)
        setMessage(errorMessages.join('\n')); // Join multiple errors with a line break
        Alert.alert('Registration failed', errorMessages.join('\n'), [{ text: 'OK' }]);
      }
    } catch (error) {
      Alert.alert("Error", "Network error.");
      setMessage('Network error. Please try again later.');
    } finally {
      setIsLoading(false); // Stop loading
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback
          onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}
          accessible={false}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            isDarkMode ? styles.centerWrapperDark : styles.centerWrapper,
            { flexGrow: 1 }
          ]}
        >
          <View style={isDarkMode ? styles.formWrapperDark : styles.formWrapper}>

            <Text style={[styles.title, isDarkMode && styles.darkText]}>Register</Text>

            <Text style={[styles.subtitleText, isDarkMode && styles.darkTextSubtitle]}>Provide a username, your email, and password to create an account.</Text>

            {/* Message Display */}
            <Text style={[styles.message, isDarkMode && styles.darkText, message.includes("Error") || message.includes("failed") ? styles.errorText : styles.successText]}>
              {message}
            </Text>

            {/* Username */}
            <TextInput
              placeholder="Username"
              placeholderTextColor={isDarkMode ? "#bbb" : "#666"}
              style={[styles.input, isDarkMode && styles.darkInput]}
              value={username}
              onChangeText={(text) => {
                // Remove all spaces and convert to lowercase
                const sanitized = text.replace(/\s+/g, '').toLowerCase();
                if (sanitized.length <= 150) {
                  setUsername(sanitized);
                }
              }}
              autoCapitalize="none"
            />

            {/* Email */}
            <TextInput 
              placeholder="Email"
              placeholderTextColor={isDarkMode ? "#bbb" : "#666"}
              style={[styles.input, isDarkMode && styles.darkInput]}
              value={email}
              onChangeText={(text) => {
                // Remove all spaces and convert to lowercase
                const sanitized = text.replace(/\s+/g, '').toLowerCase();
                if (sanitized.length <= 254) {
                  setEmail(sanitized);
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Password Input with Toggle Visibility */}
            <View style={[styles.passwordContainer, isDarkMode && styles.darkInput]}>
              <TextInput
                placeholder="Password"
                placeholderTextColor={isDarkMode ? "#bbb" : "#666"}
                value={password}
                onChangeText={(text) => {
                  if (text.length <= 32) {
                    setPassword(text);
                  }
                }}
                secureTextEntry={!showPassword} // Toggle password visibility
                style={[styles.passwordInput, isDarkMode && styles.darkInput]}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={24} 
                  color={isDarkMode ? "#bbb" : "#666"} 
                />
              </TouchableOpacity>
            </View>

            {/* Terms Checkbox */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
            >
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]} />
              <Text style={[styles.checkboxText, isDarkMode && styles.darkText]}>
                <Text>I Consent to the </Text>
                <Text
                  style={[styles.linkText, isDarkMode && styles.darkLinkText]}
                  onPress={() => router.push("/user-agreement")}
                >
                User Agreement
                </Text>
                <Text> and</Text>
                {"\n"} 
                <Text>I have read the </Text>
                <Text
                  style={[styles.linkText, isDarkMode && styles.darkLinkText]}
                  onPress={() => router.push("/privacy-policy")}
                >
                Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.buttonStyle, isDarkMode && styles.darkButtonStyle]}
              onPress={() => {
                Keyboard.dismiss();
                setTimeout(() => {
                  handleRegister();
                }, 100); // Give the keyboard a moment to close
              }}
            >
              <Text style={styles.buttonText}>Register</Text>
            </TouchableOpacity>
            
            {isLoading && (
              <ActivityIndicator size="large" color={isDarkMode ? "#fff" : "#000"} style={styles.loadingIndicator} />
            )}
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: "#fff",
  },
  darkContainer: {
    padding: 10,
    backgroundColor: "#121212",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#000",
  },
  darkText: {
    color: "#fff",
  },
  buttonStyle: {
    backgroundColor: "#4C37FF",
    padding: 16,
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
  input: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
    color: "#000",
    backgroundColor: "#fff",
  },
  subtitleText: {
    fontSize: 16,
    color: 'grey', 
    textAlign: 'center',
  }, 
  darkTextSubtitle: {
    textAlign: 'center',
    color: '#cdcdcd'
  }, 
  darkInput: {
    borderColor: "#444",
    backgroundColor: "#222",
    color: "#fff",
  },
  imagePicker: {
    width: 150,
    height: 150,
    alignSelf: "center",
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 75,
    marginBottom: 20,
  },
  darkImagePicker: {
    backgroundColor: "#333",
  },
  imagePickerText: {
    color: "#888",
  },
  image: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  loadingIndicator: {
    marginTop: 20,
  },
  message: {
    fontSize: 16,
    fontWeight: "normal",
    color: "#d9534f", // Red for error message, change color for success
    marginBottom: 20,
    textAlign: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#999",
    borderRadius: 4,
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#4C37FF",
    borderColor: "#4C37FF",
  },
  checkboxText: {
    fontSize: 14,
    color: "#333",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  darkLinkText: {
    color: "#4C37FF",
  },
  linkText: {
    color: "#4C37FF",
    textDecorationLine: "underline",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 50,
    marginBottom: 15,
  },
  passwordInput: {
    flex: 1,
    color: "#000",
  },
  darkPasswordInput: {
    color: "#fff", // White text in dark mode
  },
  errorText: {
    color: "red",
  },
  successText: {
    color: "green",
  },
  centerWrapper: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 100,  // ↓ Adjust if content appears too low or high
    paddingBottom: 220,
    backgroundColor: '#FFF',
  },
  centerWrapperDark: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 100,
    paddingBottom: 220,
    backgroundColor: '#000',
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