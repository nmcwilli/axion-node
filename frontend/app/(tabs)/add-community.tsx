import React, { useRef, useEffect, useState } from 'react';
import { KeyboardAvoidingView, TouchableWithoutFeedback, Platform, Keyboard, TouchableOpacity, View, Text, TextInput, Button, StyleSheet, Alert, useColorScheme, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/auth';
import { useTheme } from '../context/ThemeContext';
// import { logEvent } from '../../components/analytics';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function AddCommunityScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const { theme } = useTheme();
  const [errorMessage, setErrorMessage] = useState('');  // New state for error message

  const isDarkMode = theme === 'dark';

  // Scrolling functionality const
  const scrollRef = useRef<ScrollView>(null);

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //   logEvent('screen_view', { screen_name: 'AddCommunityScreen' });
  // }, []);

  // Redirect the user to the login if no storedToken
  useEffect(() => {
      const timer = setTimeout(() => {
          if (!token) {
              router.replace('/login'); 
          }
      }, 100); // Small delay to allow navigation to mount
  
      return () => clearTimeout(timer); // Cleanup
  }, [token]);

  // Adding a new Community
  const handleAddCommunity = async () => {
    if (!token) return;

    // Scroll to top
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  
    try {
      // Step 1: Create the community
      const createResponse = await fetch(`${API_BASE_URL}/communities/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, description }),
      });
  
      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        if (errorData?.title) {
          setErrorMessage(errorData.title);
        } else if (errorData?.detail) {
          setErrorMessage(errorData.detail);
        } else {
          setErrorMessage('We were unable to create this new community. Please ensure that all fields are completed and then try again later. If issues persist, please contact us at support@axionnode.com');
        }
        return;
      }
  
      const createdCommunity = await createResponse.json();
  
      // Step 2: Notify admins
      const notifyResponse = await fetch(`${API_BASE_URL}/approve-community-request/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          communityId: createdCommunity.id,
          title,
          description,
        }),
      });
  
      if (!notifyResponse.ok) {
        const errorData = await notifyResponse.json();
        if (errorData?.detail) {
          setErrorMessage(errorData.detail);
        } else {
          setErrorMessage('Failed to notify admins. Please try again later.');
        }
        return;
      }
  
      // Success!
      Alert.alert('Success', 'We have submitted a new Community request. It will be added shortly if approved.');
      setTitle('');
      setDescription('');
      router.push('/community');
    } catch (error) {
      console.error('Unexpected error:', error);
      setErrorMessage('An unexpected error occurred');
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
        <View style={{ backgroundColor: isDarkMode ? '#1c1c1c' : '#fff', flex: 1, alignItems: 'center' }}>
          <View style={{ width: '100%', maxWidth: 600, flex: 1 }}>
            <ScrollView 
                ref={scrollRef} // ✅ Attach ref here so we can scroll to the top
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                    styles.container, 
                    theme === 'dark' && styles.darkContainer
                ]}
            >
              <Text style={[styles.title, theme === 'dark' && styles.darkText]}>Create a New Community</Text>

              {/* Display the error message */}
              {errorMessage ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <TextInput
                style={[styles.input, theme === 'dark' && styles.darkInput]}
                placeholder="Enter a Community Title"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor={theme === 'dark' ? '#fff' : '#000'}
                maxLength={255}
              />
              {/* ✅ Character Counter */}
              <Text style={{ color: title.length > 240 ? 'red' : 'gray', textAlign: 'left', marginBottom: 15 }}>
                  {title.length}/255
              </Text>

              <TextInput
                style={[styles.input, styles.descriptionInput, theme === 'dark' && styles.darkInput]}
                placeholder="Enter a Community Description"
                value={description}
                multiline={true}
                numberOfLines={4}
                onChangeText={setDescription}
                textAlignVertical="top"
                placeholderTextColor={theme === 'dark' ? '#fff' : '#000'}
                maxLength={500}
              />
              {/* ✅ Character Counter */}
              <Text style={{ color: description.length > 400 ? 'red' : 'gray', textAlign: 'left', marginBottom: 15 }}>
                  {description.length}/500
              </Text>

              {/* Alert Text Box */}
              <View style={[styles.alertBox, theme === 'dark' && styles.darkAlertBox]}>
                <Text style={[styles.alertText, theme === 'dark' && styles.darkAlertText]}>
                  Warning: To ensure the community remains safe, new communities must be reviewed and approved by the administrators before they will appear.
                </Text>
              </View>
              
              {/* Button */}
              <TouchableOpacity
                style={[styles.buttonStyle, isDarkMode && styles.darkButtonStyle]}
                onPress={() => {
                  Keyboard.dismiss();
                  setTimeout(() => {
                    handleAddCommunity();
                  }, 100); // Give the keyboard a moment to close
                }}
              >
                <Text style={styles.buttonText}>Create Community</Text>
              </TouchableOpacity>

            </ScrollView>
          
          </View>
        </View>

      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    paddingTop: 40,
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 400, 
    backgroundColor: '#fff',
  },
  darkContainer: { 
    backgroundColor: '#121212' 
  },
  containerUnAuth: {
    flex: 1,                    
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
    backgroundColor: '#FFFFFF', 
  },
  buttonStyle: {
    backgroundColor: "#4C37FF",
    padding: 14,
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
  buttonContainerUnAuth: {
    width: '60%',
    marginVertical: 10,
  },
  descriptionInput: {
    height: 100, // Adjust the height for multi-line input
    paddingTop: 10, // Add some padding for better readability
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000', // Default text color for light mode
  },
  darkText: {
    color: '#fff',  // Dark mode text color
  },
  item: {
    fontSize: 18,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',  // Default border color for light mode
  },
  darkItem: {
    color: '#fff',  // Dark mode text color for list items
    borderBottomColor: '#444',  // Dark mode border color for list items
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#000',
  },
  noCommunitiesText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#000',
  },
  buttonContainer: {
    width: '60%',
    marginVertical: 10,
  }, 
  subtitle: {
    fontSize: 16, 
    marginBottom: 20,
    textAlign: 'center',       
    color: '#333',
  },
  touchable: {
    paddingVertical: 10, 
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    width: '100%',
  },
  input: { height: 40, borderColor: '#ccc', borderWidth: 1, borderRadius: 8, marginBottom: 15, paddingLeft: 8, color: '#000' },
  darkInput: { borderColor: '#777', color: '#fff' },
  alertBox: {
    backgroundColor: '#fffae6',
    padding: 10,
    marginBottom: 20,
    borderRadius: 8,
  },
  darkAlertBox: {
    backgroundColor: '#333', // Dark mode background color for alert box
  },
  alertText: {
    color: '#555',
    fontSize: 14,
  },
  darkAlertText: {
    color: '#fff', // Dark mode text color for the alert
  },
  errorContainer: {
    backgroundColor: '#f8d7da',  // Light red background for errors
    padding: 10,
    marginBottom: 20,
    borderRadius: 8,
  },
  errorText: {
    color: '#721c24',  // Dark red text for errors
    fontSize: 14,
  },
});