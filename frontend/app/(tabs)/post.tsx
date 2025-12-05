import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
    useWindowDimensions, KeyboardAvoidingView, TouchableWithoutFeedback, Platform, Keyboard, StyleSheet, View, Text, TouchableOpacity, Image, TextInput, Button, ScrollView, Alert, RefreshControl } from 'react-native';
import { useAuth } from '../context/auth';
import { useTheme } from '../context/ThemeContext';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker'; // ✅ Import Image Picker
// import { v4 as uuidv4 } from 'uuid'; // ✅ Import UUID
// import RNPickerSelect from "react-native-picker-select";
import { Dropdown } from "react-native-element-dropdown";
import { jwtDecode } from "jwt-decode";
import * as ImageManipulator from "expo-image-manipulator";
// import mime from "mime";
import { Ionicons } from '@expo/vector-icons';
// import { logEvent } from '../../components/analytics';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// ✅ Define the Community and Post types
type Community = {
    id: number;
    title: string;
    description: string;
    slug: string; 
    status: string;
};

type Post = {
    id: number;
    community: number;
    title: string;  // ✅ Added title
    content: string;
    image?: string | null;  // ✅ Optional image URL
};

export default function PostScreen() {
    const { theme } = useTheme();  
    const { token, refreshAccessToken } = useAuth(); 
    const router = useRouter();
    const [communities, setCommunities] = useState<Community[]>([]);
    const [selectedCommunity, setSelectedCommunity] = useState<number | null>(null);
    const [postContent, setPostContent] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [postTitle, setPostTitle] = useState('');
    const [imageWidth, setImageWidth] = useState<number>(0);
    const [imageHeight, setImageHeight] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState("");  // ✅ State to track errors
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false); // New refreshing state

    const [postPhoto, setPostPhoto] = useState<string | null>(null);
    const [postPhotoURI, setPostPhotoURI] = useState<string | null>(null); // ✅ URI
    const [postPhotoMimeType, setPostPhotoMimeType] = useState<string | null>(null);
    const [postPhotoFileName, setPostPhotoFileName] = useState<string | null>(null);

    const isDarkMode = theme === 'dark';

    const { width } = useWindowDimensions();
    const isWideScreen = Platform.OS === 'web' && width > 600; // Adjust threshold as needed

    // Scrolling functionality const
    const scrollRef = useRef<ScrollView>(null);

    // Auto clear error messages after 10 seconds
    useEffect(() => {
        if (errorMessage || successMessage) {
            const timeout = setTimeout(() => {
                setErrorMessage("");
                setSuccessMessage("");
            }, 10000); // 10 seconds

            return () => clearTimeout(timeout); // Cleanup if unmounted or changed
        }
    }, [errorMessage, successMessage]);

    // Redirect to index page if not logged in and no token
    useFocusEffect(
        useCallback(() => {
            if (!token) {
            router.replace('/login'); // Redirects to root
            }
        }, [token])
    );

    // Firebase Analytics
    // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
    // useEffect(() => {
    //     logEvent('screen_view', { screen_name: 'PostScreen' });
    // }, []);

    // Handle pull-to-refresh
    const onRefresh = async () => {
        setRefreshing(true);
        await fetchCommunities(); // Refresh communities
        setRefreshing(false);
    };
    
    // ✅ Fetch Communities when screen is focused (auto-refresh)
    const fetchCommunities = useCallback(async () => {
        if (!token) return;
        
        setRefreshing(true); // Start refreshing
        
        try {
            const response = await fetch(`${API_BASE_URL}/communities-post/`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            });
        
            if (!response.ok) {
            console.log('We have experienced a challenge fetching the community list. Please try again later.');
            return;
            }
        
            const data: Community[] = await response.json();
        
            const approvedCommunities = data
            .filter((community) => community.status === 'approved')
            .sort((a, b) => a.title.localeCompare(b.title));
        
            setCommunities(approvedCommunities);
        } catch (error) {
            console.log('We have experienced a challenge fetching the community list. Please try again later.');
        } finally {
            setRefreshing(false); // Stop refreshing
            setLoading(false);   // Stop loading indicator
        }
    }, [token]);

    useFocusEffect(
        useCallback(() => {
            const checkAndRefreshToken = async () => {
                if (!token) return;
                const tokenExpired = checkTokenExpiration(token);
                if (tokenExpired) {
                    console.log('Token expired. Refreshing...');
                    await refreshAccessToken();
                }
            };
            checkAndRefreshToken(); // 🔄 Refresh token if expired
            fetchCommunities(); // 📌 Fetch communities when screen is focused
            setSuccessMessage(null); // ✅ Clear success message when screen is focused
        }, [token, fetchCommunities])
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

    // Remove image
    const handleRemoveImage = () => {
        setPostPhoto(null);
        setPostPhotoURI(null);
        setPostPhotoMimeType(null);
        setPostPhotoFileName(null);
    };

    // ✅ Handle Image Upload & Post Creation
    const handleCreatePost = async () => {
        if (!token) return;

        setErrorMessage("");  // ✅ Reset error message before validation
        setSuccessMessage(""); // ✅ Reset success message before validation

        // Scroll to top
        scrollRef.current?.scrollTo({ y: 0, animated: true });

        if (!selectedCommunity) {
            setErrorMessage("Please select a community.");
            Alert.alert("Error", "Please select a community.");
            return;
        }
        if (!postTitle.trim()) {
            setErrorMessage("Post title cannot be empty.");
            Alert.alert("Error", "Post title cannot be empty.");
            return;
        }
        if (!postContent.trim()) {
            setErrorMessage("Post content cannot be empty.");
            Alert.alert("Error", "Post content cannot be empty.");
            return;
        }
    
        setLoading(true);
        
        // Only on Web
        // Fallback for mimeType
        // let mimeTypeResolved = "application/octet-stream";
        // // ✅ Platform-specific logic using standard if-statement
        // if (Platform.OS === "web" && postPhotoFileName) {
        //     mimeTypeResolved = mime.getType(postPhotoFileName) || "application/octet-stream";
        // }

        // Prepare FormData
        const formData = new FormData();
        formData.append("community", selectedCommunity.toString());
        formData.append("title", postTitle);
        formData.append("content", postContent);
        
        setSuccessMessage("Processing your post. Please wait...");
        
        // If the user has uploaded a photo then append it to the formData
        // Mobile version
        if (Platform.OS !== "web" && postPhoto && postPhotoURI && postPhotoMimeType && postPhotoFileName) {
            try {
                // console.log("Processing mobile image")
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
                console.log("We experienced an error uploading the image. Pleaes try again later.");
                // Alert.alert("Error", "Failed to process the image. Please try again later.");
                setLoading(false);
                return;
            }
        }

        // Console debugging added 
        // console.log("🧪 Checking web upload condition:", {
        //     Platform: Platform.OS,
        //     postPhoto,
        //     postPhotoURI,
        //     postPhotoFileName
        // });

        // Web version
        if (Platform.OS === "web" && postPhoto && postPhotoURI && postPhotoFileName) {
            try {
                // console.log("Processing web image")

                const response = await fetch(postPhotoURI); 
                const blob = await response.blob();
        
                if (blob.size > 50 * 1024 * 1024) {
                    Alert.alert("Error", "Image is too large. It must be under 50 MB.");
                    return;
                }
                
                // ❌ This is the likely failing point:
                // formData.append("post_photo", blob, postPhotoFileName);

                // ✅ Use File object instead
                const file = new File([blob], postPhotoFileName, {
                    type: blob.type || "image/jpeg",
                });

                formData.append("post_photo", file);

            } catch (error) {
                console.log("We experienced an error uploading the image. Please try again later.");
                // Alert.alert("Error", "Failed to process the image. Please try again later.");
                setLoading(false);
                return;
            }
        }
    
        try {
            // console.log("Final Payload Before Sending:");
            // formData.forEach((value, key) => console.log(key, value));
            
            // Ensure 'Content-Type' header is NOT set manually for multipart requests
            const uploadResponse = await fetch(`${API_BASE_URL}/posts/`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.status}`);
            
            // ✅ Get the created post's data
            const createdPost = await uploadResponse.json();
            const slug = createdPost.slug;

            if (!slug) throw new Error("No slug returned from the server");

            // Show success message
            setSuccessMessage("Post created successfully!");
            Alert.alert("Success", "Post created successfully!");

            // Clear all existing states
            setPostTitle('');
            setPostContent('');
            setPostPhoto(null);
            setPostPhotoURI(null);
            setPostPhotoMimeType(null);
            setPostPhotoFileName(null);

            // ✅ Redirect to the new post page
            if (Platform.OS === "web") {
                window.location.href = `/post/${slug}`;
            } else {
                router.replace(`/post/${slug}`);  // Adjust this line if you're using React Navigation
            }

        } catch (error: any) {
            console.log('We have experienced a challenge with creating a post. Please try again later.');
            if (error instanceof Error) {
              setErrorMessage(error.message);
            } else {
              setErrorMessage("An unexpected issue occurred. Please try again later.");
            }
            Alert.alert('Error', 'We had some difficulty creating this post. Please try again later.');
          } finally {
            setLoading(false);
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
        const mimeType = image.mimeType || image.type || "image/jpeg";
        // const fileName = image.fileName || `postimage_${Date.now()}.jpg`;
        const fileName = `postimage_${Date.now()}.jpg`;
    
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

    if (!token) {
        // Removed to simplify code - Previously rendered login and register buttons here
    }

    // Now only rendering post page content after signed in and have token
    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <View style={{ backgroundColor: isDarkMode ? '#121212' : '#fff', flex: 1, alignItems: 'center' }}>
              <View
                style={{
                    width: Platform.OS === 'web' ? '100%' : '100%',
                    maxWidth: Platform.OS === 'web' ? 700 : undefined,
                    height: Platform.OS === 'web' ? '100%' : undefined,
                    flex: 1,
                }}
              >
                <ScrollView 
                    ref={scrollRef} // ✅ Attach ref here so we can scroll to the top
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    contentContainerStyle={[
                        styles.container,
                        { flexGrow: 1 },  // This is critical for scroll to work on iOS inside KeyboardAvoidingView
                        theme === 'dark' && styles.darkContainer
                    ]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    <Text style={[styles.title, theme === 'dark' && styles.darkText]}>Create a Post</Text>

                    {/* Error Messages */}
                    {errorMessage !== "" && (
                        <Text style={[styles.errorMessage, theme === 'dark' && styles.errorMessage]}>
                            {errorMessage}
                        </Text>
                    )}

                    {/* Success Message */}
                    {successMessage && (
                        <Text style={[styles.successMessage, theme === 'dark' && styles.successMessage]}>
                            {successMessage}
                        </Text>
                    )}

                    {/* ✅ Community Selection */}
                    <Text style={[styles.label, theme === 'dark' && styles.darkText]}>Post Community:</Text>
                    {/* <Text style={[styles.label, theme === 'dark' && styles.darkText]}>Select a Community:</Text> */}
                    {communities.length > 0 ? (
                        <Dropdown
                            style={{ 
                                height: 40, 
                                borderColor: "#ccc", 
                                borderWidth: 1, 
                                borderRadius: 8, 
                                paddingLeft: 10,
                                marginBottom: 12,
                                marginTop: 6,
                            }}
                            data={communities}
                            labelField="title"
                            valueField="id"
                            placeholder="Select a Community"
                            value={selectedCommunity}
                            onChange={(item) => setSelectedCommunity(item.id)}
                            placeholderStyle={{
                                color: theme === "dark" ? "#fff" : "#888", // Light text color for placeholder in dark mode
                            }}
                            selectedTextStyle={{
                                color: theme === "dark" ? "#fff" : "#888", // Text color of selected item
                            }}
                        />
                    ) : (
                        <Text style={[styles.noCommunityText, theme === 'dark' && styles.noCommunityText]}>
                            You must Follow a Community first before you can post!
                        </Text>
                    )}

                    {/* ✅ Post Title Input */}
                    <Text style={[styles.label, theme === 'dark' && styles.darkText]}>Post Title:</Text>
                    <TextInput
                        style={[styles.input, theme === 'dark' && styles.darkInput]}
                        value={postTitle}
                        onChangeText={(text) => {
                            if (text.length <= 255) setPostTitle(text);
                        }}
                        placeholder="Post Title"
                        placeholderTextColor={theme === 'dark' ? '#FFF' : '#666'}
                    />
                    {/* ✅ Character Counter */}
                    <Text style={{ color: postTitle.length > 240 ? 'red' : 'gray', textAlign: 'left', marginBottom: 15 }}>
                        {postTitle.length}/255
                    </Text>

                    {/* ✅ Post Content Input */}
                    <Text style={[styles.label, theme === 'dark' && styles.darkText]}>Post Content:</Text>
                    <View>
                        <TextInput
                            style={[
                            styles.inputPostContent, 
                            theme === 'dark' && styles.darkInput, 
                            { minHeight: 120 } 
                            ]}
                            value={postContent}
                            onChangeText={(text) => {
                                if (text.length <= 2000) setPostContent(text);
                            }}
                            placeholder={
                                "Write your post content here - 2000 characters max.\n\n" + 
                                "Post content can include:\n" + 
                                "- YouTube links. i.e. https://youtu.be/ZbZSe6N_BXs\n" + 
                                "- IMGUR images/videos. i.e. https://i.imgur.com/gbwPEpo.mp4"
                            }
                            multiline
                            numberOfLines={8}
                            placeholderTextColor={theme === 'dark' ? '#FFF' : '#666'}
                        />
                        {/* ✅ Character Counter */}
                        <Text style={{ color: postContent.length > 7800 ? 'red' : 'gray', textAlign: 'left', marginBottom: 25 }}>
                            {postContent.length}/2000
                        </Text>
                    </View>

                    {/* ✅ Image Picker */}
                    <Text style={[styles.label, theme === 'dark' && styles.darkText]}>Post Image:</Text>
                    <Text style={[styles.labelSmall, theme === 'dark' && styles.darkTextSmall]}>Note that only PNG, JPEG, HEIC and WEBP image formats are accepted.</Text>
                    <View style={styles.postPhotoContainer}>
                        {postPhotoURI ? (
                            <>
                                <Image 
                                    source={{ uri: postPhotoURI }} 
                                    style={[styles.postPhoto, { width: imageWidth, height: imageHeight }]} 
                                />
                                {/* ✅ Remove Button */}
                                <TouchableOpacity onPress={handleRemoveImage} style={styles.removeButton}>
                                    <Text style={styles.removeButtonText}>Remove Image</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <View style={styles.placeholderPhoto}>
                                <Text style={{ color: "#aaa" }}>No Photo</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={Platform.OS === "web" ? pickImageWeb : pickImageMobile}
                            style={styles.uploadButton}
                        >
                            <Text style={styles.uploadButtonText}>
                                {postPhotoURI ? "Change Image" : "Add an Image"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* ✅ Create Post Button */}
                    <TouchableOpacity
                        style={[styles.buttonStyle, isDarkMode && styles.darkButtonStyle]}
                        onPress={() => {
                            Keyboard.dismiss();
                            setTimeout(() => {
                                handleCreatePost();
                            }, 100); // Give the keyboard a moment to close
                        }}
                        disabled={loading}
                        >
                        <Text style={[styles.buttonText, loading && styles.disabledText]}>
                            {loading ? 'Posting...' : 'Create Post'}
                        </Text>
                    </TouchableOpacity>

                </ScrollView>
                </View>
            </View>
                
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
        backgroundColor: '#121212',
    },
    lightContainer: {
        backgroundColor: '#FFF', 
    },
    containerUnAuth: {
        flex: 1,                    
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 20,
        backgroundColor: '#FFFFFF', 
    },
    buttonContainerUnAuth: {
        width: '50%',
        marginVertical: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#000', // Default text color for light mode
    },
    darkText: {
        color: '#b8c5c9',  // Dark mode text color
    },
    darkTextSmall: {
        fontSize: 12,
        fontWeight: 'normal',
        color: '#FFF',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
        marginLeft: 4,
        marginRight: 2,
        color: 'grey',
    },
    subtitleCompany: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
        marginLeft: 4,
        marginRight: 2,
        color: '#b6b6b6',
    },
    darkTextCompany: {
        color: '#b6b6b6',
    },
    postPhoto: {
        maxWidth: '100%',
        resizeMode: 'cover', // 🔄 swap from 'contain'
        borderRadius: 8,
    },
    label: {
        fontSize: 16,
        marginTop: 10,
        marginBottom: 0,
        paddingBottom: 6,
        fontWeight: '600',
    },
    labelSmall: {
        fontSize: 12,
        marginTop: 10,
        marginBottom: 10,
        paddingBottom: 6,
        fontWeight: 'normal',
    },
    noCommunityText: {
        fontSize: 14,
        textAlign: 'left',
        marginVertical: 10,
        color: 'red',
        fontWeight: '600'
    },
    inputPostContent: {
        marginTop: 10, 
        height: 100,
        borderWidth: 1,
        borderColor: '#ccc',
        marginBottom: 12,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: '#fff',
        textAlignVertical: 'top',
        padding: 10,
    },
    input: {
        marginTop: 6, 
        height: 50,
        borderWidth: 1,
        borderColor: '#ccc',
        marginBottom: 12,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: '#fff',
        textAlignVertical: 'top',
    },
    darkInput: {
        backgroundColor: '#333',
        color: '#fff',
    },
    buttonContainer: {
        marginTop: 20,
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
    buttonStyle: {
        backgroundColor: "#4C37FF",
        padding: 14,
        borderRadius: 8,
        marginBottom: Platform.OS === "web" ? 0 : -10, // Apply -10 only on mobile
    }, 
    darkButtonStyle: {
        backgroundColor: '#4C37FF',
        padding: 10,
    }, 
    buttonText: {
        color: '#FFF',
        textAlign: "center", 
    }, 
    uploadButton: {
        marginTop: 10,
        marginBottom: 12,
        padding: 10,
        backgroundColor: '#4C37FF',
        borderRadius: 8,
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
    uploadButtonText: {
        color: '#fff',
    },
    picker: {
        height: 50,
        borderWidth: 1,
        borderColor: '#ccc',
        backgroundColor: '#fff',
        borderRadius: 8,
    },
    darkPicker: {
        backgroundColor: '#333',
        color: '#fff',
    },
    disabledText: {
        color: "#888", // Light gray color for disabled text
    },
    darkTextIntro: {
        color: '#FFF',
        marginBottom: 20,
    },
    appleStyleButtonDark: {
      backgroundColor: '#1c1c1e', // Dark grey
      borderColor: '#444',
    },
    appleStyleButtonText: {
      color: '#000',
      fontSize: 16,
      fontWeight: '500',
    },
    appleStyleButtonTextDark: {
      color: '#fff',
    },
    buttonContainerLimited: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    appleStyleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginTop: -10,
        marginBottom: 20,
        maxWidth: 190, // 👈 limits button width
        width: '100%', // fills parent only up to maxWidth
    },
    downloadButtonRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12, // If not supported, use marginRight manually
      flexWrap: 'wrap', // Optional for responsiveness
    },
    androidStyleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f1f1f1',
      borderColor: '#ccc',
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginTop: -10,
      maxWidth: 240,
      marginBottom: 20,
    },
    removeButton: {
        marginTop: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: "#e74c3c",
        borderRadius: 8,
        alignSelf: "flex-start",
    },
    removeButtonText: {
        color: "#fff",
        fontWeight: "bold",
    },
});