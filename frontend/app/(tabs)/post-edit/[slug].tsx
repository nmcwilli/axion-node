import React, { useEffect, useState, useCallback } from 'react';
import { KeyboardAvoidingView, TouchableWithoutFeedback, Platform, Keyboard, View, Text, TextInput, Button, Alert, ActivityIndicator, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/auth';
import { useTheme } from '../../context/ThemeContext';
import { jwtDecode } from "jwt-decode";
import * as ImagePicker from 'expo-image-picker'; // ✅ Import Image Picker
import * as ImageManipulator from "expo-image-manipulator";
// import { logEvent } from '../../../components/analytics';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const EditPostScreen = () => {
  const { slug } = useLocalSearchParams();
  const { token, refreshAccessToken } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  // const [photo, setPhoto] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");  // ✅ State to track errors
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [imageWidth, setImageWidth] = useState<number>(0);
  const [imageHeight, setImageHeight] = useState<number>(0);

  const [postPhoto, setPostPhoto] = useState<string | null>(null);
  const [postPhotoURI, setPostPhotoURI] = useState<string | null>(null); // ✅ URI
  const [postPhotoMimeType, setPostPhotoMimeType] = useState<string | null>(null);
  const [postPhotoFileName, setPostPhotoFileName] = useState<string | null>(null);

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //   logEvent('screen_view', { screen_name: 'EditPostScreen' });
  // }, []);

  // Refresh expired token when applicable
  useFocusEffect(
    useCallback(() => {
        const checkAndRefreshToken = async () => {
            if (!token) return;
            // Check if the token has expired
            const tokenExpired = checkTokenExpiration(token);
            if (tokenExpired) {
                console.log('Token expired. Refreshing...');
                const refreshedToken = await refreshAccessToken();
            } 
        };
        
        checkAndRefreshToken();
    }, [token])
  );
  const checkTokenExpiration = (token: string | null) => {
      if (!token) return false;
      
      try {
          // Decode the token to get its payload
          const decoded: any = jwtDecode(token);
          const currentTime = Date.now() / 1000; // Get the current time in seconds
      
          // Check if the token is expired (expiration is in 'exp' field)
          return decoded.exp < currentTime;
      } catch (error) {
          console.error('Invalid token:', error);
          return false;
      }
  };

  useEffect(() => {
    if (!token || !slug) return;
  
    const fetchPost = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/post/${slug}/`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
  
        if (!response.ok) {
          throw new Error("Failed to fetch post details");
        }
  
        const data = await response.json();
  
        setTitle(data.title);
        setContent(data.content);
        setPostPhoto(data.post_photo);
  
      } catch (error) {
        console.error("Failed to fetch post:", error);
        // Optional: alert user on failure or handle the error accordingly
      } finally {
        setLoading(false);
      }
    };
  
    fetchPost();
  }, [slug, token]);
  
  // Watch for changes to postPhoto and update dimensions accordingly
  useEffect(() => {
    if (postPhoto) {
      Image.getSize(
        postPhoto,
        (width, height) => {
          const maxWidth = 400;
          const scaleFactor = width > maxWidth ? maxWidth / width : 1;
  
          setImageWidth(width * scaleFactor);
          setImageHeight(height * scaleFactor);
        },
        (error) => {
          console.log("❌ Failed to load image dimensions:", error);
        }
      );
    }
  }, [postPhoto]);

  // Core post update logic 
  const handleUpdatePost = async () => {
    if (!token) return;
  
    setErrorMessage("");  // ✅ Reset error message before validation
    setSuccessMessage(""); // ✅ Reset success message before validation
    setUpdating(true);
  
    if (!title.trim()) {
      setErrorMessage("Post title cannot be empty.");
      setUpdating(false);  // Make sure to reset updating state
      Alert.alert("Error", "Post title cannot be empty.");
      return;
    }
    if (!content.trim()) {
      setErrorMessage("Post content cannot be empty.");
      setUpdating(false);  // Make sure to reset updating state
      Alert.alert("Error", "Post content cannot be empty.");
      return;
    }
  
    // Prepare FormData
    const formData = new FormData();
    formData.append("title", title);
    formData.append("content", content);
  
    // If the user has uploaded a photo then append it to the formData
    // Mobile version
    if (Platform.OS !== "web" && postPhoto && postPhotoURI && postPhotoMimeType && postPhotoFileName) {
      try {
        const response = await fetch(postPhotoURI); 
        const blob = await response.blob();
    
        if (blob.size > 50 * 1024 * 1024) {
          Alert.alert("Error", "Image is too large. It must be under 50 MB.");
          return;
        }
    
        const file = {
          uri: postPhotoURI,
          name: postPhotoFileName,
          type: postPhotoMimeType,
        };
    
        formData.append("post_photo", file as any); 
      } catch (error) {
        console.log("We experienced an error uploading the image. Please try again later.");
        setLoading(false);
        return;
      }
    }
  
    // Web version
    if (Platform.OS === "web" && postPhoto && postPhotoURI && postPhotoFileName) {
      try {
        const response = await fetch(postPhotoURI); 
        const blob = await response.blob();
    
        if (blob.size > 50 * 1024 * 1024) {
          Alert.alert("Error", "Image is too large. It must be under 50 MB.");
          return;
        }
        
        // Use File object for web uploads
        const file = new File([blob], postPhotoFileName, {
          type: blob.type || postPhotoMimeType || "image/png",
        });
  
        formData.append("post_photo", file);
  
      } catch (error) {
        console.log("We experienced an error uploading the image. Please try again later.");
        setLoading(false);
        return;
      }
    }
  
    try {
      const response = await fetch(`${API_BASE_URL}/post-edit/${slug}/`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
  
      if (!response.ok) {
        throw new Error("Failed to update post.");
      }
  
      Alert.alert('Success', 'Post updated successfully.');
      router.push(`/post/${slug}`); // Redirect back to post details
    } catch (error) {
      Alert.alert('Error', 'Failed to update post.');
      setErrorMessage("Failed to edit the post. Please try again later.");
    } finally {
      setUpdating(false);
    }
  };

  // ✅ Pick an image from the user's gallery
  const pickImageWeb = async () => {

      // console.log("📸 pickImageWeb was called");

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
      if (status !== "granted") {
          Alert.alert(
              "Permission Required", 
              "Please allow access to your photo gallery so that SocialBook can allow you to select a photo to add it to your post."
          );
          return;
      }
  
      let result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1], // Square crop
          quality: 1,
      });
  
      if (result.canceled) return;
  
      const image = result.assets[0];
      if (!image) {
          Alert.alert("Error", "Failed to retrieve image.");
          return;
      }
  
      // Ensure MIME type and file name
      // Set file metadata safely
      const mimeType = image.mimeType || image.type || "image/png";
      const ext = mimeType.split("/")[1] || "png";
      const fileName = `postimage_${Date.now()}.${ext}`;
      
      // console.log("📸 Picked Image:", { uri: image.uri, mimeType, fileName });
      
      // Sets the selected image
      if (!result.canceled && result.assets.length > 0) {
          const selectedImage = result.assets[0].uri;
          setPostPhoto(selectedImage);

          // Get the image's dimensions
          Image.getSize(selectedImage, (width, height) => {
              const maxWidth = 400;
              const scaleFactor = width > maxWidth ? maxWidth / width : 1;
            
              setImageWidth(width * scaleFactor);
              setImageHeight(height * scaleFactor);
          });
      }

      // Logging to console for testing
      // console.log("Image Picker Result:", image);
      // console.log("Setting photo state with:", {
      //     uri: image.uri,
      //     mimeType,
      //     fileName
      // });

      // Set the state variables for the image being uploaded
      setPostPhotoURI(image.uri);
      setPostPhotoMimeType(mimeType || "image/jpeg");
      setPostPhotoFileName(fileName || `postimage_${Date.now()}.jpg`);
  };

  // ✅ Pick an image from the user's gallery
  const pickImageMobile = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
          Alert.alert(
              "Permission Required",
              "SocialBook requires access to your photos to allow you to add photos to posts."
          );
          return;
      }
  
      let result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 1,
      });
  
      if (!result.canceled) {
          let selectedImage = result.assets[0];
  
          // Convert HEIC/HEIF to JPEG
          if (selectedImage.uri.endsWith(".heic") || selectedImage.uri.endsWith(".HEIC") || selectedImage.uri.endsWith(".heif") || selectedImage.uri.endsWith(".HEIF")) {
              const convertedImage = await ImageManipulator.manipulateAsync(
                  selectedImage.uri,
                  [], // No modifications, just format change
                  { format: ImageManipulator.SaveFormat.JPEG }
              );
  
              selectedImage = { ...selectedImage, uri: convertedImage.uri, mimeType: "image/jpeg" };
          }
          
          // Sets the selected image
          if (!result.canceled && result.assets.length > 0) {
              const selectedImage = result.assets[0].uri;
              setPostPhoto(selectedImage);
  
              // Get the image's dimensions
              Image.getSize(selectedImage, (width, height) => {
                  const maxWidth = 400;
                  const scaleFactor = width > maxWidth ? maxWidth / width : 1;
              
                  setImageWidth(width * scaleFactor);
                  setImageHeight(height * scaleFactor);
              });
          }

          // Set the state variables for the image being uploaded
          setPostPhotoURI(selectedImage.uri);
          setPostPhotoMimeType(selectedImage.mimeType || "image/jpeg");
          setPostPhotoFileName(selectedImage.fileName || `postimage_${Date.now()}.jpg`);
      }
  };

  // Cancel action: Navigate back to the post page
  const handleCancel = () => {
    router.push(`/post/${slug}`);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4C37FF" />
      </View>
    );
  }

  // console.log("Photo URI:", photo);
  // console.log("Image width:", imageWidth, "Image height:", imageHeight);

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
                styles.container, 
                theme === 'dark' && styles.darkContainer
            ]}
        >

          <Text style={[styles.title, theme === 'dark' && styles.darkText]}>Edit your Post</Text>
          
          {/* Error Messages */}
          {typeof errorMessage === "string" && errorMessage !== "" && (
              <Text style={[styles.errorMessage, theme === 'dark' && styles.errorMessage]}>
                  {errorMessage}
              </Text>
          )}

          {/* Success Message */}
          {typeof successMessage === "string" && successMessage !== "" && (
              <Text style={[styles.successMessage, theme === 'dark' && styles.successMessage]}>
                  {successMessage}
              </Text>
          )}

          <Text style={[styles.label, theme === 'dark' && styles.darkText]}>Post Title:</Text>
          <TextInput
            style={[styles.input, theme === 'dark' && styles.darkInput]}
            value={title}
            placeholder="Write your post title"
            onChangeText={(text) => {
              if (text.length <= 255) setTitle(text);
            }}
          />
          {/* ✅ Character Counter */}
          <Text style={{ color: title.length > 240 ? '#4C37FF' : 'gray', textAlign: 'left', marginBottom: 15 }}>
              {title.length}/255
          </Text>

          <Text style={[styles.label, theme === 'dark' && styles.darkText]}>Post Content:</Text>
          <TextInput
            style={[
              styles.input, 
              styles.textArea, 
              theme === 'dark' && styles.darkInput
            ]}
            value={content}
            onChangeText={(text) => {
              if (text.length <= 2000) setContent(text);
            }}
            placeholder={
              "Write your post content here - 2000 characters max.\n\n" + // 👈 Adds a blank line for spacing
              "Post content can include:\n" + 
              "- YouTube links. i.e. https://youtu.be/ZbZSe6N_BXs\n" + 
              "- IMGUR images/videos. i.e. https://i.imgur.com/gbwPEpo.mp4"
            }
            multiline
            numberOfLines={8}
            textAlignVertical="top" // Align text to the top
          />
          {/* ✅ Character Counter */}
          <Text style={{ color: content.length > 7800 ? '#4C37FF' : 'gray', textAlign: 'left', marginBottom: 15 }}>
              {content.length}/2000
          </Text>

          {/* ✅ Image Picker */}
          <View style={styles.postPhotoContainer}>
              {typeof postPhoto === "string" && postPhoto.trim() !== "" ? (
                  <Image 
                      source={{ uri: postPhoto }} 
                      style={[styles.postPhoto, { width: imageWidth, height: imageHeight }]} 
                  />
              ) : (
                  <View style={styles.placeholderPhoto}>
                      <Text style={{ color: "#aaa" }}>No Photo</Text>
                  </View>
              )}
              {Platform.OS === "web" ? (
                  <TouchableOpacity onPress={pickImageWeb} style={styles.uploadButton}>
                      <Text style={styles.uploadButtonText}>Add an Image</Text>
                  </TouchableOpacity>
              ) : (
                  <TouchableOpacity onPress={pickImageMobile} style={styles.uploadButton}>
                      <Text style={styles.uploadButtonText}>Add an Image</Text>
                  </TouchableOpacity>
              )}
          </View>

          {/* Update Post Button */}
          <TouchableOpacity 
            style={[styles.buttonStyle, theme === 'dark' && styles.buttonStyle]} 
            onPress={() => {
              Keyboard.dismiss();
              setTimeout(() => {
                handleUpdatePost();
              }, 100); // Give the keyboard a moment to close
            }}
            disabled={updating}
          >
            <Text style={[styles.buttonText, updating && styles.disabledButtonText]}>
              {updating ? 'Updating...' : 'Update Post'}
            </Text>
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity 
            style={[styles.buttonStyleCancel, styles.cancelButton, theme === 'dark' && styles.buttonStyleCancel]} 
            onPress={handleCancel}
          >
            <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel Edit</Text>
          </TouchableOpacity>

        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

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
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  input: { 
    borderWidth: 1, 
    borderColor: '#ccc', 
    padding: 10, 
    borderRadius: 8, 
    marginBottom: 15 
  },
  textArea: {
    height: 150, // Adjust this to make the input larger
    textAlignVertical: 'top', // Align text to the top
  },
  darkText: { color: '#fff' },
  darkInput: { backgroundColor: '#333', color: '#fff' },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000', // Default text color for light mode
  },
  errorMessage: {
    color: 'red',
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 10,
    marginTop: -10,
    textAlign: 'center',
  },
  successMessage: {
      marginTop: -10,
      color: 'green',
      fontSize: 16,
      fontWeight: '600',
      marginVertical: 10,
      textAlign: 'center',
  },
  buttonStyle: {
    backgroundColor: '#4C37FF',
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  buttonStyleCancel: {
    backgroundColor: '#333',
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  cancelButtonText: {
    color: '#FFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#888',
  },
  // Styles remain unchanged
  imagePicker: { padding: 10, backgroundColor: '#ddd', marginVertical: 10, alignItems: 'center', marginBottom: 20 },
  imagePickerText: { fontSize: 16, color: '#000' },
  imagePreview: { width: 200, height: 200, alignSelf: 'center', marginVertical: 10 },
  postPhotoContainer: {
      alignItems: 'flex-start',
      marginBottom: 20,
      paddingVertical: 0, // 🚫 Remove vertical padding
      paddingTop: 0,
      paddingBottom: 0,
  },
  profilePhoto: {
      width: 100,
      height: 100,
      borderRadius: 50,
  },
  placeholderPhoto: {
      width: 109,
      height: 109,
      borderRadius: 8,
      backgroundColor: '#ddd',
      justifyContent: 'center',
      alignItems: 'center',
  },
  postPhoto: {
    maxWidth: '100%',
    resizeMode: 'cover', // 🔄 swap from 'contain'
    borderRadius: 8,
  },
  uploadButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#4C37FF',
    borderRadius: 8,
  },
  uploadButtonText: {
    color: '#fff',
  },
});

export default EditPostScreen;