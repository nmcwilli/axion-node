import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
    KeyboardAvoidingView, TouchableWithoutFeedback, Platform, Keyboard, View, Text, Button, TextInput, ScrollView, StyleSheet, Image, TouchableOpacity, Alert 
} from 'react-native';
import { useAuth } from '../context/auth';
import { useTheme } from '../context/ThemeContext';
import Colors from '@/constants/Colors';
import * as ImagePicker from "expo-image-picker";
import 'react-native-get-random-values'; // Needs to be before uuid
// import { v4 as uuidv4 } from 'uuid'; 
import { useRouter, useNavigationContainerRef, useFocusEffect } from 'expo-router';
import { jwtDecode } from "jwt-decode";
// import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from "expo-image-manipulator";
import mime from "mime";
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
// import { logEvent } from '../../components/analytics';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export type User = {
    id: number;
    username: string;
    email: string;
    profile_photo?: string;
};

const ProfileScreen = () => {
    const { user, token, refreshAccessToken } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';
    const router = useRouter();
    const navigationRef = useNavigationContainerRef();
    const [username, setUsername] = useState(user?.username || '');
    const [email, setEmail] = useState(user?.email || '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [profilePhoto, setProfilePhoto] = useState<string | null>(user?.profile_photo ?? null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [image, setImage] = useState<string | null>(null);

    // Two factor authentication state tracking
    const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
    const [twoFactorCode, setTwoFactorCode] = useState('');
    // Setting up 2FA
    const [setupQRCodeUrl, setSetupQRCodeUrl] = useState<string | null>(null);
    const [setupKey, setSetupKey] = useState<string | null>(null);
    const [isSettingUpTwoFactor, setIsSettingUpTwoFactor] = useState(false);

    // Notification preferences 
    const [notifyOnPostResponse, setNotifyOnPostResponse] = useState(true); // default true

    // Inside your component
    const scrollViewRef = useRef<ScrollView>(null);

    // Firebase Analytics
    // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
    // useEffect(() => {
    //     logEvent('screen_view', { screen_name: 'ProfileScreen' });
    // }, []);

    // Toggles Notification preferences for a user
    const updateUserPreferences = async (
        updates: Partial<{ notify_on_reply: boolean; preferred_theme: 'light' | 'dark' }>
        ) => {
        if (!token) return;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/me/`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updates),
            });

            if (!response.ok) {
            const errorText = await response.text();
            console.error("Failed to update user preferences:", errorText);
            throw new Error(`Failed to update preferences: ${response.status}`);
            }

            const data = await response.json();

            if (data.notify_on_reply !== undefined) {
            setNotifyOnPostResponse(data.notify_on_reply);
            }

            if (data.preferred_theme) {
            // 💾 Save new theme to AsyncStorage so it's persisted on reload
            await AsyncStorage.setItem('preferred_theme', data.preferred_theme);

            if (data.preferred_theme !== theme) {
                toggleTheme(); // Switch visual theme after storing
            }
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Toggle notification preference
    const onToggleNotify = () => {
        const newValue = !notifyOnPostResponse;
        setNotifyOnPostResponse(newValue);
        updateUserPreferences({ notify_on_reply: newValue });
    };

    // Toggle theme preference
    const onToggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light"; 
        updateUserPreferences({ preferred_theme: newTheme });
        toggleTheme(); // Flip theme visually *after* updating preference
    };

    // Start the 2fa process
    const startTwoFactorSetup = async () => {
        if (!token) return;
    
        setLoading(true);
        setError(null);
    
        try {
            const response = await fetch(`${API_BASE_URL}/auth/generate-totp/`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                console.log('Error starting 2FA setup:', errorText);
                throw new Error(`Failed to start 2FA setup: ${response.status}`);
            }
    
            const responseData = await response.json();
            setSetupQRCodeUrl(`data:image/png;base64,${responseData.qr_code_b64}`);
            setSetupKey(responseData.secret_key); // If you include it in the backend response
            setIsSettingUpTwoFactor(true);
    
        } catch (error: any) {
            console.error(error);
            if (error instanceof Error) {
                setError(error.message);
            } else {
                setError('Failed to start 2FA setup. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Confirm the 2fa 
    const confirmTwoFactor = async () => {
        if (!token || !twoFactorCode) {
            Alert.alert("Error", "Please enter a valid 2FA code.");
            return;
        }
    
        try {
            const response = await fetch(`${API_BASE_URL}/auth/confirm-2fa/`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ otp_token: twoFactorCode }),
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                console.log('Error confirming 2FA:', errorText);
                throw new Error(`Failed to confirm 2FA: ${response.status}`);
            }
    
            const responseData = await response.json();
            setIsTwoFactorEnabled(true);
            setTwoFactorCode('');
            setSuccessMessage("Two-Factor Authentication has been enabled!");
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        } catch (error: any) {
            console.error(error);
            if (error instanceof Error) {
                setError(error.message);
            } else {
                setError("Failed to confirm 2FA. Please try again.");
            }
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }
    };
    
    // Disable two factor auth
    const disableTwoFactor = async () => {
        if (!token) return;
    
        try {
            const response = await fetch(`${API_BASE_URL}/auth/disable-2fa/`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                console.log('Error disabling 2FA:', errorText);
                throw new Error(`Failed to disable 2FA: ${response.status}`);
            }
    
            const responseData = await response.json();
            setIsTwoFactorEnabled(false);
            setSuccessMessage("Two-Factor Authentication has been disabled!");
            // Scroll to top
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        } catch (error: any) {
            console.error(error);
            if (error instanceof Error) {
                setError(error.message);
            } else {
                setError("Failed to disable 2FA. Please try again.");
            }
            // Scroll to top
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }
    };

    // const checkTokenExpiration = (token: string | null) => {
    //     if (!token) return false;
        
    //     try {
    //         // Decode the token to get its payload
    //         const decoded: any = jwtDecode(token);
    //         const currentTime = Date.now() / 1000; // Get the current time in seconds
        
    //         // Check if the token is expired (expiration is in 'exp' field)
    //         return decoded.exp < currentTime;
    //     } catch (error) {
    //         console.error('Invalid token:', error);
    //         return false;
    //     }
    // };
    
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
            
            // Fetch the users profile data after token refresh
            fetchUserProfile();

            // If the user exists, then set their details 
            if (user) {
                setUsername(user.username);
                setEmail(user.email || '');
                setProfilePhoto(user.profile_photo || null);
            }
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

    // useFocusEffect(
    //     useCallback(() => {
    //       const checkAndRefreshToken = async () => {
    //         if (!token) return;
      
    //         // Check if the token has expired
    //         const tokenExpired = checkTokenExpiration(token);
    //         if (tokenExpired) {
    //           // console.log('Token expired. Refreshing...');
    //           const refreshedToken = await refreshAccessToken();
    //           if (user) {
    //             // Re-fetch updated data
    //             fetchUserProfile();

    //             setUsername(user.username);
    //             setEmail(user.email || '');
    //             setProfilePhoto(user.profile_photo || null);
    //           }
    //         } else {
    //           // If token is still valid, proceed directly with fetching
    //           if (user) {
    //             // Re-fetch updated data
    //             fetchUserProfile();
                
    //             setUsername(user.username);
    //             setEmail(user.email || '');
    //             setProfilePhoto(user.profile_photo || null);
    //           }
    //         }
    //       };
      
    //       checkAndRefreshToken();
    //     }, [token, user]) // Add user to dependency array to trigger update on user change
    // );

    // 2FA Status check
    // useEffect(() => {
    //     const fetch2FAStatus = async () => {
    //         try {
    //         const response = await axios.get(`${API_BASE_URL}/auth/2fa-status/`, {
    //             headers: { Authorization: `Bearer ${token}` },
    //         });
    //         setIsTwoFactorEnabled(response.data.is_two_factor_enabled);
    //         } catch (err) {
    //         console.error("Failed to fetch 2FA status", err);
    //         }
    //     };
        
    //     fetch2FAStatus();
    // }, [token]);

    // Load the initial user details 
    useEffect(() => {
        if (!token) return;

        if (user) {
            // Re-fetch updated data
            fetchUserProfile();

            setUsername(user.username);
            setEmail(user.email || '');
            setProfilePhoto(user.profile_photo || null);
        }
    }, [user]);

    // Fetch the user Profile data and profile photo
    const fetchUserProfile = async () => {
        if (!token) return;
    
        try {
            const response = await fetch(`${API_BASE_URL}/auth/me/`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                console.log('Failed to fetch user profile:', errorText);
                throw new Error(`Failed to fetch user profile: ${response.status}`);
            }
    
            const responseData = await response.json();
            setUsername(responseData.username);
            setEmail(responseData.email);
            setProfilePhoto(responseData.profile_photo || null);
    
            // Fetch the user's 2FA status
            setIsTwoFactorEnabled(responseData.is_two_factor_enabled || false);
            
            // User Preferences
            if (typeof responseData.notify_on_post_response === "boolean") {
                setNotifyOnPostResponse(responseData.notify_on_post_response);
            }
            if (responseData.theme_preference && responseData.theme_preference !== theme) {
                toggleTheme(); // only toggle if the current theme doesn't match
            }

            // console.log("👤 User profile data:", responseData);
        } catch (error: any) {
            console.error(error);
            setError("Failed to fetch user profile. Please try again.");
        }
    };

    // Automatically clear messages after 3 seconds
    useEffect(() => {
        if (successMessage || error) {
            const timer = setTimeout(() => {
                setSuccessMessage(null);
                setError(null);
            }, 5000); // Clears message after 3 seconds

            return () => clearTimeout(timer); // Cleanup function
        }
    }, [successMessage, error]);

    // ✅ Pick an image from the user's gallery
    const pickImageWeb = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
        if (status !== "granted") {
            Alert.alert("Permission Required", "Please allow access to your photo gallery so that SocialBook can allow you to select a photo to update your profile.");
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
        const mimeType = image.mimeType || image.type || "image/jpeg";
        const fileName = image.fileName || `profile_${Date.now()}.jpg`;
    
        // console.log("📸 Picked Image:", { uri: image.uri, mimeType, fileName });
    
        setProfilePhoto(image.uri);
        handleProfilePhotoUploadWeb(image.uri, mimeType, fileName);
    };
    
    // Profile photo uploader
    const handleProfilePhotoUploadWeb = async (imageUri: string, mimeType: string, fileName: string) => {
        if (!token) return;
    
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
    
        try {
            // Use the original image URI instead of resizedImage.uri
            const response = await fetch(imageUri);
            const blob = await response.blob();

            // console.log("📏 Image Size:", blob.size, "bytes");  // Check the size of the resized image
    
            // Validate file size (max 5MB)
            if (blob.size > 50 * 1024 * 1024) {
                setError("Profile photo must be under 50 MB.");
                // Scroll to top
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                setLoading(false);
                return;
            }
    
            // Fallback for mimeType
            const mimeTypeResolved = mime.getType(fileName) || "application/octet-stream";

            // ✅ Correct FormData usage
            const formData = new FormData();
            formData.append("profile_photo", blob, fileName);
    
            // ✅ Debugging Log
            // console.log("📤 Uploading Image:", { uri: resizedImage.uri, name: fileName, type: mimeTypeResolved });
    
            // ✅ Upload using fetch
            const uploadResponse = await fetch(`${API_BASE_URL}/auth/me/photo/`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: formData,
            });
    
            if (!uploadResponse.ok) {
                throw new Error(`Upload failed with status ${uploadResponse.status}`);
            }
    
            const data = await uploadResponse.json();
            setSuccessMessage("Profile photo updated successfully!");
            // Scroll to top
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            setProfilePhoto(data.profile_photo);
            fetchUserProfile();
        } catch (error) {
            console.error("❌ Upload error:", error);
            setError("Upload failed. Please try again later.");
            // Scroll to top
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        } finally {
            setLoading(false);
        }
    };

    // ✅ Pick an image from the user's gallery
    const pickImageMobile = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert(
                "Permission Required",
                "SocialBook requires access to your photos to allow you to select and update your profile photo."
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
    
            setImage(selectedImage.uri);
            handleProfilePhotoUploadMobile(selectedImage.uri, selectedImage.mimeType || "image/jpeg");
        }
    };

    // Upload profile photo
    const handleProfilePhotoUploadMobile = async (imageUri: string, mimeType: string) => {
        if (!imageUri || !token) return;
    
        try {
            const response = await fetch(imageUri);
            const blob = await response.blob();
    
            if (blob.size > 50 * 1024 * 1024) { // 50 MB per photo limit
                Alert.alert("Error", "Profile photo must be under 50 MB.");
                return;
            }
    
            // Prepare FormData
            const formData = new FormData();
            formData.append("profile_photo", {
                uri: imageUri,
                name: `profile_${Date.now()}.jpg`,
                type: mimeType,
            } as any); // `as any` is needed for TypeScript
    
            // Fix: Ensure 'Content-Type' header is NOT set manually for multipart requests
            const uploadResponse = await fetch(`${API_BASE_URL}/auth/me/photo/`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });
    
            if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.status}`);
    
            const data = await uploadResponse.json();
            setProfilePhoto(data.profile_photo);
            Alert.alert("Success", "Profile photo updated!");
        } catch (error) {
            console.error("❌ Upload Error:", error);
            Alert.alert("Upload Failed", "Something went wrong. Please try again.");
        }
    };

    // Handles Email and Username updates
    const handleProfileUpdate = async () => {
        if (!token) return;
    
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
    
        try {
            const response = await fetch(`${API_BASE_URL}/auth/me/`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email }),
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                console.log('Failed to update profile:', errorText);
                throw new Error(`Failed to update profile: ${response.status}`);
            }
    
            const responseData = await response.json();
            setSuccessMessage('Profile updated successfully');
            
            // Scroll to top
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    
            // Update user context directly with new username and email
            if (user) {
                setUsername(responseData.username); // Updated username
                setEmail(responseData.email); // Updated email
            }
    
            // Re-fetch updated data
            fetchUserProfile();
    
        } catch (error: any) {
            console.error(error);
            setError('Failed to update profile. Please try again.');
            
            // Scroll to top
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async () => {
        if (!token) return;
    
        // Validate password length
        if (newPassword.length < 8 || newPassword.length > 32) {
            setError('Password must be between 8 and 32 characters.');
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            return;
        }
    
        // Validate matching passwords
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            return;
        }
    
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
    
        try {
            const response = await fetch(`${API_BASE_URL}/auth/me/password-change/`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ new_password: newPassword }),
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                console.log('Failed to update password:', errorText);
                throw new Error(`Failed to update password: ${response.status}`);
            }
    
            setSuccessMessage('Password updated successfully');
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            setNewPassword('');
            setConfirmPassword('');
    
            // Re-fetch the user profile to update the session state
            fetchUserProfile();
    
        } catch (error: any) {
            console.error(error);
            setError('Failed to update password. Please try again.');
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        } finally {
            setLoading(false);
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
                    ref={scrollViewRef} 
                    contentContainerStyle={[styles.container, { backgroundColor: isDark ? '#121212' : '#FFF' }]}
                >
                    <Text style={[styles.title, { color: isDark ? Colors.dark.text : Colors.light.text }]}>Edit Your Profile</Text>
                    <Text style={[styles.titleSubP, { color: isDark ? Colors.dark.text : Colors.light.text }]}>Below you can update data elements associated to your profile on SocialBook.</Text>

                    {error && (
                        <View style={styles.errorBanner}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}
                        {successMessage && (
                        <View style={styles.successBanner}>
                            <Text style={styles.successText}>{successMessage}</Text>
                        </View>
                    )}

                    <View
                    style={{
                        marginBottom: 30,  // Space above and below
                        marginTop: 30,
                    }}
                    />

                    {/* ✅ Profile Image */}
                    <Text style={[styles.titleSub, { color: isDark ? Colors.dark.text : Colors.light.text }]}>Profile Photo</Text>
                    <Text style={[styles.titleSubP, { color: isDark ? Colors.dark.text : Colors.light.text }]}>Upload a profile photo in the format of JPG/JPEG, PNG or HEIC. Note that if you are on a mobile device, you must grant access to your photos for the purpose of uploading a profile photo.</Text>
                    <View style={styles.profilePhotoContainer}>
                        {profilePhoto ? (
                            <Image source={{ uri: profilePhoto }} style={styles.profilePhoto} />
                        ) : (
                            <View style={styles.placeholderPhoto}>
                                <Text style={{ color: "#aaa" }}>No Image</Text>
                            </View>
                        )}
                        {Platform.OS === "web" ? (
                            <TouchableOpacity onPress={pickImageWeb} style={styles.uploadButton}>
                                <Text style={styles.uploadButtonText}>Change Image</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={pickImageMobile} style={styles.uploadButton}>
                                <Text style={styles.uploadButtonText}>Change Image</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View
                    style={{
                        borderBottomColor: isDark ? '#555' : '#ccc',  // Light grey line
                        // borderBottomWidth: StyleSheet.hairlineWidth,  // Thinnest visible line
                        marginBottom: 30,  // Space above and below
                        marginTop: 20,
                    }}
                    />
                    <Text style={[styles.titleSub, { color: isDark ? Colors.dark.text : Colors.light.text }]}>Profile Details</Text>
                    <Text style={[styles.titleSubP, { color: isDark ? Colors.dark.text : Colors.light.text }]}>In this section you can update your profile username and email address.</Text>

                    <Text style={[styles.label, { color: isDark ? Colors.dark.text : Colors.light.text }]}>Username:</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: isDark ? '#333' : '#fff', color: isDark ? '#fff' : '#000' }]}
                        value={username}
                        onChangeText={(text) => {
                            if (text.length <= 150) {
                                setUsername(text.toLowerCase());
                            }
                        }}
                        placeholder="Enter your username"
                        placeholderTextColor={isDark ? '#bbb' : '#666'}
                    />

                    <Text style={[styles.label, { color: isDark ? Colors.dark.text : Colors.light.text }]}>Email:</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: isDark ? '#333' : '#fff', color: isDark ? '#fff' : '#000' }]}
                        value={email}
                        onChangeText={(text) => {
                            if (text.length <= 254) {
                                setEmail(text.toLowerCase());
                            }
                        }}
                        placeholder="Enter your email"
                        keyboardType="email-address"
                        placeholderTextColor={isDark ? '#bbb' : '#666'}
                    />

                    {/* Update Profile Button */}
                    <TouchableOpacity
                    style={[styles.buttonStyle, { alignSelf: 'flex-start', marginBottom: 10 }]}
                    onPress={() => {
                        Keyboard.dismiss();
                        setTimeout(() => {
                            handleProfileUpdate();
                        }, 100); // Give the keyboard a moment to close
                    }}
                    disabled={loading}
                    >
                    <Text style={styles.buttonText}>
                        {loading ? "Saving..." : "Save Profile Details"}
                    </Text>
                    </TouchableOpacity>
                    
                    <View
                    style={{
                        borderBottomColor: isDark ? '#555' : '#ccc',  // Light grey line
                        // borderBottomWidth: StyleSheet.hairlineWidth,  // Thinnest visible line
                        marginBottom: 30,  // Space above and below
                        marginTop: 20,
                    }}
                    />
                    <Text style={[styles.titleSub, { color: isDark ? Colors.dark.text : Colors.light.text }]}>Password Reset</Text>
                    <Text style={[styles.titleSubP2, { color: isDark ? Colors.dark.text : Colors.light.text }]}>Choose a new password for your account if needed.</Text>

                    <Text style={[styles.labelSection, { color: isDark ? Colors.dark.text : Colors.light.text }]}>Set a new password:</Text>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: isDark ? '#333' : '#fff',
                                color: isDark ? '#fff' : '#000',
                            },
                        ]}
                        value={newPassword}
                        onChangeText={(text) => {
                            if (text.length <= 32) {
                                setNewPassword(text);
                            }
                        }}
                        placeholder="Enter a new password"
                        secureTextEntry
                        placeholderTextColor={isDark ? '#bbb' : '#666'}
                    />

                    {newPassword.length > 0 && newPassword.length < 8 && (
                        <Text style={{ color: 'red', marginTop: 4 }}>
                            Password must be at least 8 characters long.
                        </Text>
                    )}

                    {newPassword.length > 32 && (
                        <Text style={{ color: 'red', marginTop: 4 }}>
                            Password must be no more than 32 characters long.
                        </Text>
                    )}

                    <Text style={[styles.labelSection, { color: isDark ? Colors.dark.text : Colors.light.text, marginTop: 0 }]}>
                        Confirm your new password:
                    </Text>

                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: isDark ? '#333' : '#fff',
                                color: isDark ? '#fff' : '#000',
                            },
                        ]}
                        value={confirmPassword}
                        onChangeText={(text) => {
                            if (text.length <= 32) {
                                setConfirmPassword(text);
                            }
                        }}
                        placeholder="Re-enter new password"
                        secureTextEntry
                        placeholderTextColor={isDark ? '#bbb' : '#666'}
                    />

                    {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                        <Text style={{ color: 'red', marginTop: 4 }}>
                            Passwords do not match.
                        </Text>
                    )}

                    {/* Password Change Button */}
                    <TouchableOpacity
                    style={[styles.buttonStyle, { alignSelf: 'flex-start', marginBottom: 10 }]}
                    onPress={() => {
                        Keyboard.dismiss();
                        setTimeout(() => {
                            handlePasswordChange();
                        }, 100); // Give the keyboard a moment to close
                    }}
                    disabled={loading}
                    >
                    <Text style={styles.buttonText}>
                        {loading ? "Changing..." : "Change Password"}
                    </Text>
                    </TouchableOpacity>

                    {/* Preferences */}
                    <View
                    style={{
                        borderBottomColor: isDark ? '#555' : '#ccc',  // Light grey line
                        // borderBottomWidth: StyleSheet.hairlineWidth,  // Thinnest visible line
                        marginBottom: 30,  // Space above and below
                        marginTop: 20,
                    }}
                    />
                    <Text style={[styles.titleSub, { color: isDark ? Colors.dark.text : Colors.light.text }]}>Account Preferences</Text>
                    <Text style={[styles.titleSubP3, { color: isDark ? Colors.dark.text : Colors.light.text }]}>In this section you can control your account preferences, like if you want to toggle on Dark mode all the time, or if you want emails sent to you when someone responds to a post you create.</Text>

                    {/* Email Notification Toggle */}
                    <View style={[styles.preferenceItem, isDark && styles.preferenceItemDark]}>
                        <Text style={{ color: isDark ? '#fff' : '#000' }}>Post Response Email Alerts: </Text>
                        <TouchableOpacity
                        onPress={onToggleNotify}
                        style={[
                            styles.toggleButton,
                            notifyOnPostResponse ? styles.toggleOn : styles.toggleOff,
                        ]}
                        >
                            <Text style={{ color: '#fff' }}>
                                {notifyOnPostResponse ? 'Email Me (Default)' : 'Do Not Email Me'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Theme Toggle */}
                    <View style={[styles.preferenceItem, isDark && styles.preferenceItemDark]}>
                        <Text style={{ color: isDark ? '#fff' : '#000' }}>Dark mode or light mode:</Text>
                        <TouchableOpacity
                        onPress={onToggleTheme}
                        style={[
                            styles.toggleButton,
                            theme === 'dark' ? styles.toggleOff : styles.toggleOn,
                        ]}
                        >
                            <Text style={{ color: '#fff' }}>
                                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View
                    style={{
                        borderBottomColor: isDark ? '#555' : '#ccc',  // Light grey line
                        // borderBottomWidth: StyleSheet.hairlineWidth,  // Thinnest visible line
                        marginBottom: 30,  // Space above and below
                        marginTop: 20,
                    }}
                    />
                    <Text style={[styles.titleSub, { color: isDark ? Colors.dark.text : Colors.light.text }]}>Two-Factor Authentication (2FA)</Text>
                    <Text style={[styles.titleSubP3, { color: isDark ? Colors.dark.text : Colors.light.text }]}>In this section you can register and add two-factor authentication to your account for greater security. By using 2FA, you will be forced to use an authenticator app like Google Authenticator, Twilio's Authy, Bitwarden, Proton Pass, etc. to provide the code upon every new login. Note that this will only apply for new logins where your session has expired.</Text>

                    {isTwoFactorEnabled ? (
                        <>
                            <Text style={{ color: isDark ? Colors.dark.text : Colors.light.text }}>✅ 2FA is enabled on your account.</Text>
                            <TouchableOpacity 
                                style={styles.buttonStyle}
                                onPress={disableTwoFactor}
                            >
                                <Text style={styles.buttonText}>Disable 2FA</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            {!isSettingUpTwoFactor ? (
                                <>
                                    <TouchableOpacity 
                                        style={styles.buttonStyle}
                                        onPress={startTwoFactorSetup}
                                    >
                                        <Text style={styles.buttonText}>Register for 2FA</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    {setupQRCodeUrl && (
                                        <Image 
                                            source={{ uri: setupQRCodeUrl }} 
                                            style={{ width: 200, height: 200, alignSelf: 'center', marginBottom: 20 }} 
                                        />
                                    )}
                                    {setupKey && (
                                        <Text style={{ color: isDark ? Colors.dark.text : Colors.light.text, textAlign: 'center', marginBottom: 10 }}>
                                            Secret Key: {setupKey}
                                        </Text>
                                    )}

                                    <TextInput
                                        placeholder="Enter 2FA code to enable"
                                        placeholderTextColor="gray"
                                        style={styles.input}
                                        value={twoFactorCode}
                                        onChangeText={setTwoFactorCode}
                                    />

                                    <TouchableOpacity 
                                        style={styles.buttonStyle}
                                        onPress={() => {
                                            Keyboard.dismiss();
                                            setTimeout(() => {
                                                confirmTwoFactor();
                                            }, 100); // Give the keyboard a moment to close
                                        }}
                                    >
                                        <Text style={styles.buttonText}>Enable 2FA</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </>
                    )}

                    <View
                    style={{
                        borderBottomColor: isDark ? '#555' : '#ccc',  // Light grey line
                        // borderBottomWidth: StyleSheet.hairlineWidth,  // Thinnest visible line
                        marginBottom: 30,  // Space above and below
                        marginTop: 20,
                    }}
                    />

                    <Text style={[styles.titleSub, { color: isDark ? Colors.dark.text : Colors.light.text }]}>Account deletion</Text>
                    <Text onPress={() => router.push('/delete-account')} style={[styles.deleteAccountText, { color: isDark ? '#fff' : '#000' }]}>Learn how to delete your account</Text>

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
        backgroundColor: '#121212',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'left',
        marginBottom: 20,
    },
    titleSub: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'left',
        marginBottom: 10, 
    },
    titleSubP: {
        fontSize: 14,
        fontWeight: 'normal',
        textAlign: 'left',
    },
    titleSubP2: {
        fontSize: 14,
        fontWeight: 'normal',
        textAlign: 'left',
        marginBottom: -20,
    },
    titleSubP3: {
        fontSize: 14,
        fontWeight: 'normal',
        textAlign: 'left',
        marginBottom: 10,
    },
    profilePhotoContainer: {
        alignItems: 'flex-start',
        marginBottom: 30,
        marginTop: 20,
    },
    profilePhoto: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    placeholderPhoto: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#ddd',
        justifyContent: 'center',
        alignItems: 'center',
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
    label: {
        fontSize: 16,
        marginBottom: 8,
        marginTop: 12,
    },
    labelSection: {
        fontSize: 16,
        marginBottom: 8,
        marginTop: 40,
    },
    input: {
        height: 40,
        borderWidth: 1,
        borderColor: '#ccc',
        marginBottom: 12,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    buttonContainer: {
        marginTop: 10,
    },
    deleteAccountButton: {
        marginTop: 10,
        marginBottom: 40,
        padding: 10,
        alignItems: 'center',
    },
    deleteAccountText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
    buttonStyle: {
        backgroundColor: "#4C37FF",
        padding: 10,
        borderRadius: 8,
        marginTop: 6,
        marginBottom: 10,
        alignSelf: 'flex-start',
    }, 
    buttonText: {
        color: '#fff',
        textAlign: 'center',
    },
    errorBanner: {
        backgroundColor: '#ffcccc', // Light red background
        padding: 12,
        borderRadius: 8,
        marginVertical: 10,
        alignItems: 'center',
    },
    successBanner: {
        backgroundColor: '#ccffcc', // Light green background
        padding: 12,
        borderRadius: 8,
        marginVertical: 10,
        alignItems: 'center',
    },
    errorText: {
        color: '#cc0000', // Darker red text
        fontWeight: 'bold',
        textAlign: 'center',
    },
    successText: {
        color: '#006600', // Dark green text
        fontWeight: 'bold',
        textAlign: 'center',
    },
    preferenceItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 10,
        backgroundColor: '#ececec',
        padding: 10,
        borderRadius: 8,
    },
    preferenceItemDark: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 10,
        backgroundColor: '#333333',
        padding: 10,
        borderRadius: 8,
    },
    toggleButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    toggleOn: {
        backgroundColor: '#4caf50',
    },
    toggleOff: {
        backgroundColor: '#f44336',
    },
});

export default ProfileScreen;