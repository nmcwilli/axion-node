import React, { useEffect, useState, useCallback } from 'react';
import { useWindowDimensions, ScrollView, View, Text, FlatList, TouchableOpacity, Pressable, Button, StyleSheet, ActivityIndicator, RefreshControl, Platform, Image, Linking, Dimensions } from 'react-native';
import { useAuth } from '../context/auth';
import { Redirect, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useTheme } from '../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';
import { jwtDecode } from "jwt-decode";
import YoutubePlayer from 'react-native-youtube-iframe';
import WebView from 'react-native-webview'; // For native platforms
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
// import ImageViewer from 'react-native-image-zoom-viewer';
import Hyperlink from 'react-native-hyperlink';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { BannerAdWrapper } from '../../components/bannerAd';
// import { logEvent } from '../../components/analytics';

// Are we running in Expo GO? If so, don't use AdMob: 
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

type YoutubePlayerState =
  | 'unstarted'
  | 'ended'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'cued';

// Posts with slugs 
interface Post {
  id: number;
  slug: string;
  title: string;
  content: string;
  content_snippet: string; 
  created_at: string;
  vote_count: number;
  post_photo?: string | null;
  community: {
    id: number;
    title: string;
    slug: string;
    description: string;
    status: string;
  };
  author: {
    id: number;
    username: string;
  };
  isHidden?: boolean;  // Add isHidden property here
  isBlocked?: boolean;  // Add isHidden property here
}

// Messages interface 
interface Message {
  id: number;
  content: string;
  created_at: string;
  post_slug: string;
  post_title: string;
  author_username: string;
  hidden_by_user: boolean; // Add this field to track if the message is hidden by the current user
}

// Interface for HiddenPosts
interface HiddenPost {
  slug: string;
}

// Youtube content extractor 
const extractYouTubeID = (url: string) => {
  const match = url.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:.*[?&]v=|(?:v|embed|shorts|live)\/)|youtu\.be\/)([^"&?/ ]{11})/
  );
  return match ? match[1] : null;
};

// For meta tags
export const prerender = true;

// OpenGraph Loader
// Function to fetch OpenGraph data
// const fetchOpenGraphData = async (url: string, token: string): Promise<void> => {
//   try {
//     const response = await axios.get(`${API_BASE_URL}/opengraph?url=${encodeURIComponent(url)}`, {
//       headers: { Authorization: `Bearer ${token}` },
//     });

//     // Assuming the response contains OpenGraph data
//     const opengraphData = response.data;
//     console.log(opengraphData);  // Use this data as needed in your app
//   } catch (error: unknown) {  // 'error' is typed as 'unknown' here
//     if (axios.isAxiosError(error)) {  // Check if it's an AxiosError
//       console.error('Error fetching OpenGraph data:', error.response?.data || error.message);
//     } else {
//       console.error('An unexpected error occurred:', error);  // Handle other error types
//     }
//   }
// };

// Imgur content extractor
const extractImgurMedia = (url: string) => {
  // console.log("Extracting media from:", url);

  const match = url.match(/imgur\.com\/(.*?)(\.(jpg|png|gif|mp4))/);
  if (match) {
      // console.log("Imgur media matched:", match);
      return { id: match[1], extension: match[2] };
  }
  return null;
};

// Regex patterns
const imgurRegex = /(https?:\/\/i\.imgur\.com\/\w+\.(mp4|png|jpg|gif))/g;
const youtubeRegex = /(https?:\/\/(www\.)?youtube\.com\/watch\?v=|https?:\/\/youtu\.be\/)([\w-]+)/g;

// // Pinterest content extractor 
// const extractPinterestID = async (url: string): Promise<string | null> => {
//   try {
//     // Check if it's a shortened pin.it link
//     if (url.includes("pin.it")) {
//       // Fetch the URL using a GET request to follow the redirect
//       const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      
//       // Get the final URL after redirection
//       const finalUrl = response.url;

//       console.log("Final resolved URL:", response.url);

//       // Extract the Pinterest ID from the final URL (e.g., pinterest.com/pin/{id})
//       const match = finalUrl.match(/pinterest\.com\/pin\/([a-zA-Z0-9]+)/);
//       return match ? match[1] : null;
//     } else {
//       // Handle the case where the URL is already a full Pinterest URL
//       const match = url.match(/pinterest\.com\/pin\/([a-zA-Z0-9]+)/);
//       return match ? match[1] : null;
//     }
//   } catch (error) {
//     console.error("Error resolving Pinterest URL:", error);
//     return null;
//   }
// };

// For web, use an alternative or skip rendering WebView
const WebViewComponent = Platform.OS === 'web' ? null : WebView;
const isWeb = Platform.OS === 'web';
const isExpandedWeb = isWeb; // always expanded on web
// Get screen width
const screenWidth = Dimensions.get('window').width;
// Condition for wide web layout
const isWideWeb = isWeb && screenWidth > 720;

const HomeScreen = () => {
  const { token, refreshAccessToken } = useAuth();
  //const [user, setUser] = useState<{ username: string } | null>(null);
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false); // Ensure this hook is at the top level
  const router = useRouter();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [messages, setMessages] = useState<Message[]>([]);

  const { width } = useWindowDimensions();
  const isWideScreen = Platform.OS === 'web' && width > 1200; // Adjust threshold as needed

  const [expandedSection, setExpandedSection] = useState<'posts' | 'messages' | null>('posts'); // Track the expanded section
  const [postsExpanded, setPostsExpanded] = useState(isWideWeb ? true : false);
  const [commentsExpanded, setCommentsExpanded] = useState(isWideWeb ? true : false);

  // Try to grab the username information
  const [profileData, setProfileData] = useState({
    username: user?.username || 'Guest', // fallback username if not logged in
  });

  // Youtube const
  const [playing, setPlaying] = useState(false);

  // Declaring OpenGraph data const
  const [openGraphData, setOpenGraphData] = useState(null);

  // Video content
  const [mediaInfo, setMediaInfo] = useState<{ id: string; extension: string } | null>(null);
  const [mediaInfoMap, setMediaInfoMap] = useState<{ [key: string]: { id: string; extension: string } | null }>({});

  // Hidden and Blocked posts states 
  const [hiddenPosts, setHiddenPosts] = useState<string[]>([]); // Track hidden post slugs
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);  // Ensure it's an array of strings

  // 2FA state tracking
  const [pending2FAUsername, setPending2FAUsername] = useState<string | null>(null);

  // AdMob select correct ID based on platform
  // const [BannerAdComponent, setBannerAdComponent] = useState<React.ReactNode | null>(null);
  const [BannerAdView, setBannerAdView] = useState<React.FC | null>(null);

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //   logEvent('screen_view', { screen_name: 'HomeScreen' });
  // }, []);

  // Used to track/store the pending 2fa username so that we can pass it to the 2fa page 
  useFocusEffect(
    useCallback(() => {
      const checkPending2FA = async () => {
        const storedUsername = await AsyncStorage.getItem('pending2FAUsername');
        if (storedUsername) {
          console.log('🔐 Redirecting to /2fa for pending user:', storedUsername);
          router.replace('/2fa'); // Or use `router.push('/2fa')` if you want them to be able to go back
        }
      };

      checkPending2FA();
    }, [])
  );

  // Fetch posts for unauthenticated users
  const fetchPostsUnauthenticated = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/public-posts/`);
      const postsData: Post[] = await response.json();

      // You can optionally filter for only approved community posts here:
      const publicPosts = postsData.filter(post => post.community.status === 'approved');

      // Set posts without needing enrichment
      setPosts(publicPosts);
    } catch (error) {
      console.log('❌ Error fetching public posts.', error);
    } finally {
      setLoading(false);
    }
  };

  // Hide a Post 
  const handleHide = async (postSlug: string) => {
    if (!token) return;
  
    try {
      const response = await fetch(`${API_BASE_URL}/post/${postSlug}/hide/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Send an empty object 
      });
  
      if (!response.ok) {
        console.log('Sorry, we experienced an issue hiding this post. Please try again later.');
        return;
      }
  
      setHiddenPosts((prev) => [...prev, postSlug]);
  
      // Refresh posts and messages
      await fetchPosts();
      await fetchMessages();
    } catch (error) {
      console.log('Sorry, we experienced an issue hiding this post. Please try again later.');
    }
  };

  // Handles blocking of users 
  const handleBlock = async (username: string) => {
    if (!token) return;
  
    try {
      const response = await fetch(`${API_BASE_URL}/blocked-new-user/${username}/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Send an empty object to match 
      });
  
      if (response.ok) {
        setBlockedUsers((prev) => [...prev, username]);
        alert(`${username} has been blocked.`);
        console.log(`${username} has been blocked.`);
  
        // Refresh posts and messages
        await fetchPosts();
        await fetchMessages();
      } else {
        console.error('Failed to block user:', await response.text());
      }
    } catch (error) {
      console.error('Sorry, we experienced an issue blocking this user. Please try again later.');
    }
  };

  // Handle unblocking the user
  const handleUnblock = async (username: string) => {
    if (!token) return;
  
    try {
      const response = await fetch(`${API_BASE_URL}/unblock-user/${username}/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
  
      if (response.ok) {
        alert(`${username} has been unblocked.`);
        fetchPosts(); // Refresh posts after unblocking
      } else {
        console.error('Failed to unblock user:', await response.text());
      }
    } catch (error) {
      console.error('Error unblocking user', error);
    }
  };
  
  // Re-Show the Post
  const handleReShow = async (postSlug: string) => {
    if (!token) return;
  
    try {
      const response = await fetch(`${API_BASE_URL}/post/${postSlug}/show/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
  
      if (response.ok) {
        setHiddenPosts((prev) => prev.filter((slug) => slug !== postSlug));
  
        // Refresh posts and messages
        await fetchPosts();
        await fetchMessages();
      } else {
        console.log('Failed to re-show post:', await response.text());
      }
    } catch (error) {
      console.log('Sorry, we experienced an issue re-showing this post. Please try again later.');
    }
  };

  // Report a post
  const handleReportPost = async (slug: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/post-report/${slug}/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      const data = await response.json();
      alert(data.message); // Show success or error message
    } catch (error) {
      console.error("Error reporting post:", error);
    }
  };

  // This is the core content renderer that renders Youtube videos, Imgur images and videos and text based content
  const ContentRenderer = ({ content, isDarkMode }: { content: string, isDarkMode: boolean }) => {
    // console.log("Rendering content: ", content);  // Log content to check it's passed properly
    const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
    
    return content.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
      const youtubeID = extractYouTubeID(part);
      const mediaInfo = extractImgurMedia(part);
      // console.log("mediaInfo detected as: ", mediaInfo);  // Log mediaInfo
  
      if (youtubeID) {
        return (
          Platform.OS === 'web' ? (
            <iframe
              key={index}
              width="100%"
              height="450"
              src={`https://www.youtube.com/embed/${youtubeID}?autoplay=0`}
              frameBorder="0"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={styles.iframe}
            />
          ) : (
            <View key={index} style={styles.youtubeContainer}>
              <YoutubePlayer
                height={250}
                videoId={youtubeID}
                play={playingVideoId === youtubeID}
                onChangeState={(state: YoutubePlayerState) => {
                  if (state === 'playing') {
                    setPlayingVideoId(youtubeID);
                  } else if (state === 'paused' || state === 'ended') {
                    setPlayingVideoId(null);
                  }
                }}
              />
            </View>
          )
        );
      }
  
      // If mediaInfo is found
      if (mediaInfo) {
        // console.log("We found mediaInfo with the following" + mediaInfo.id + "and extension: ", mediaInfo.extension);
  
        const videoSource =
          mediaInfo?.extension === ".mp4"
            ? `https://i.imgur.com/${mediaInfo.id}.mp4`
            : "";
  
        // UseState and VideoPlayer logic should be inside a functional component now
        const [playing, setPlaying] = useState(false);
        const player = useVideoPlayer(videoSource, (player) => {
          player.loop = true;
          player.play();
        });
  
        const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  
        return (
          <View key={index} style={{ marginVertical: 0 }}>
            {mediaInfo.extension === '.mp4' ? (
              <View>
                {/* VideoView for MP4 media */}
                <VideoView
                  style={styles.fullWidthMedia}
                  player={player}
                  allowsFullscreen
                  allowsPictureInPicture
                />
                {/* <View style={styles.controls}>
                  <Button
                    title={isPlaying ? 'Pause' : 'Play'}
                    onPress={() => {
                      if (isPlaying) {
                        player.pause();
                      } else {
                        player.play();
                      }
                    }}
                  />
                </View> */}
              </View>
            ) : (
              <Image
                source={{
                  uri: `https://i.imgur.com/${mediaInfo.id}${mediaInfo.extension || '.png'}`,
                }}
                style={[styles.fullWidthMedia, { marginVertical: 0 }]}
              />
            )}
          </View>
        );
      }
  
      // If no match for media or URL, just display part as text
      return (
        <Hyperlink
          key={index}
          linkStyle={{
            color: isDarkMode ? 'white' : 'black',
            textDecorationLine: 'underline',
            marginVertical: 0,
          }}
          onPress={(url) => Linking.openURL(url)}
        >
          <Text style={[styles.content, isDarkMode && styles.darkText]}>
            {part}
          </Text>
        </Hyperlink>
      );
    });
  };

  // Fetch Posts function
  const fetchPosts = async () => {
    if (!token) return;
  
    setLoading(true);
    try {
      // Fetch posts
      const postsResponse = await fetch(`${API_BASE_URL}/home/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      const postsData: Post[] = await postsResponse.json();
  
      // Fetch hidden posts
      const hiddenResponse = await fetch(`${API_BASE_URL}/user-hidden-posts/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const hiddenData: Array<string | HiddenPost> = await hiddenResponse.json();
  
      // Fetch blocked users
      const blockedResponse = await fetch(`${API_BASE_URL}/user-blocked-users/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const blockedUsers: string[] = await blockedResponse.json();
      setBlockedUsers(blockedUsers);
  
      // Extract hidden slugs
      const hiddenPostSlugs = hiddenData.map((post) =>
        typeof post === 'string' ? post : post.slug
      );
  
      // Annotate posts
      const enrichedPosts = postsData.map((post) => {
        const isCommunityApproved = post.community.status === 'approved';
        const isBlocked = blockedUsers.includes(post.author.username.trim().toLowerCase());
        const isHidden = hiddenPostSlugs.includes(post.slug);
  
        return {
          ...post,
          isBlocked,
          isHidden,
        };
      });
  
      setPosts(enrichedPosts);
    } catch (error) {
      console.log('❌ Error fetching home posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // FetchMessages
  const fetchMessages = async () => {
    if (!token) return;
  
    try {
      const response = await fetch(`${API_BASE_URL}/recent-messages/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (!response.ok) {
        console.log('We had some trouble fetching the recent messages. Try again later.');
        return;
      }
  
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.log('We had some trouble fetching the recent messages. Try again later.');
    }
  };

  // Auto expand the sections on web
  useEffect(() => {
    if (isWideWeb) {
      setExpandedSection(null); // web ignores accordion
    }
  }, [isWideWeb]);

  // Fetch posts on first load and ask permission to track
  useEffect(() => {
    // If they have a token then fetch posts
    // Otherwise fetch unauthenticated posts 
    if (token) {
      fetchPosts();
    } else {
      fetchPostsUnauthenticated();
    }
  
    const init = async () => {
      // 🔒 Only ask for tracking permission on iOS
      if (Platform.OS === 'ios') {
        const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
        const { status } = await requestTrackingPermissionsAsync();
        // if (status === 'granted') {
        //   console.log('iOS: User has granted permission to track data');
        // }
      }
  
      // ✅ Set profile data if user is available
      if (user) {
        setProfileData({
          username: user.username || '',
        });
      }
  
      // 🔄 Fetch posts and messages
      fetchPosts();
      fetchMessages();
    };
  
    init();
  }, [token]);

  const handleUsernamePress = (username: string) => {
    router.push(`/user/${username}`); // Navigate to the user's profile page
  };

  // Refresh expired token when applicable
  useFocusEffect(
    useCallback(() => {
      const checkAndRefreshToken = async () => {
        if (!token) return; // Don't try to refresh if there's no token
  
        const tokenExpired = checkTokenExpiration(token);
        if (tokenExpired) {
          console.log('Token expired. Refreshing...');
          await refreshAccessToken(); // Simply await, no need for truthiness check
        }
  
        // After refreshing or confirming token, fetch posts and messages
        fetchPosts();
        fetchMessages();
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

  // Refresh function
  const onRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    await fetchPosts();
    await fetchMessages();
    setRefreshing(false);
  };

  // Accordion Toggler
  const toggleSection = (section: 'posts' | 'messages') => {
    if (isWideWeb) return; // On Web, both sections always stay expanded

    setExpandedSection(prev => {
      if (prev === section) return null; // collapse
      return section; // expand requested section
    });
  };
  // const toggleMessages = () => setIsMessagesExpanded(!isMessagesExpanded);
  // const togglePosts = () => setIsPostsExpanded(!isPostsExpanded);

  const styles = StyleSheet.create({
    container: {
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',       
      padding: 10,
      backgroundColor: '#FFFFFF', // Default light mode
    },
    containerHome: { 
      flex: 1,  // ✅ Takes full height
      maxWidth: 1500,
      width: '100%',  // ✅ Makes width 100% of the screen
      justifyContent: 'center', 
      // alignItems: 'center',       
      padding: 0,
      backgroundColor: '#FFFFFF', // Default light mode
      // alignSelf: 'stretch', // ✅ Ensures it stretches inside FlatList
    }, 
    titleHeader: {
      fontSize: 26, 
      fontWeight: '300',
      marginBottom: 20,
      textAlign: 'left',       
      color: '#000', // Default light mode text color
    },
    title: {
      fontSize: 24, 
      fontWeight: '400',
      paddingLeft: 30,
      paddingRight: 30,
      marginBottom: 20,
      textAlign: 'center',       
      color: '#000', // Default light mode text color
    },
    subtitleFooter: {
      fontSize: 16, 
      marginBottom: 20,
      marginRight: 2,
      marginLeft: 4,
      textAlign: 'center',       
      color: 'grey',
    },
    subtitle: {
      fontSize: 16, 
      marginBottom: 20,
      marginRight: 2,
      marginLeft: 4,
      paddingLeft: 20,
      paddingRight: 20,
      textAlign: 'center',       
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
    item: {
      fontSize: 18, 
      padding: 10, 
      borderBottomWidth: 1,
      borderBottomColor: '#ddd',
      color: '#000', // Default text color
    },
    touchable: {
      paddingVertical: 10, 
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#ddd',
      width: '100%',
    },
    // DARK MODE STYLES
    darkContainer: {
      backgroundColor: '#121212',
    },
    lightContainer: {
      backgroundColor: '#FFF',
    },
    darkText: {
      color: '#b8c5c9',
    },
    darkTextCredits: {
      color: '#fff',
    }, 
    darkTouchable: {
      borderBottomColor: '#333',
    },
    postContainer: {
      flex: 1,  // ✅ Takes full height
      width: '100%',  // ✅ Makes width 100% of the screen
      paddingLeft: 20,
      paddingRight: 20,
      paddingTop: 20,
      paddingBottom: 20, 
      borderBottomWidth: 1,
      borderBottomColor: '#ddd',
      alignSelf: 'stretch', // ✅ Ensures it stretches inside FlatList
    },
    darkContainerHome: {
      flex: 1,  // ✅ Takes full height
      width: '100%',  // ✅ Makes width 100% of the screen
      // alignSelf: 'stretch', // ✅ Ensures it stretches inside FlatList
      backgroundColor: '#121212',
    },
    darkPostContainer: {
      borderBottomColor: '#444',
    },
    postTitle: {
      fontSize: 16,
      paddingBottom: 5,
      fontWeight: 'bold',
      color: '#181c1f',
    },
    postTitleDark: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#eef1f3',
    },
    postSummary: {
      fontSize: 14,
      marginTop: 4,
      color: '#666',
    },
    postCommunity: {
      fontSize: 14,
      color: '#777',
    },
    noPostsText: {
      fontSize: 18,
      textAlign: 'left',
      paddingTop: 20,
      paddingBottom: 20,
    },
    button: {
      backgroundColor: '#2196f3',
      padding: 10,
      marginVertical: 5,
      borderRadius: 8,
    },
    postMeta: {
      fontSize: 14,
      color: '#777',
    },
    postMetaUnAuth: {
      fontSize: 14,
      color: '#777',
      marginBottom: 12,
    }, 
    darkTextUnAuth: {
      fontSize: 14,
      color: 'grey',
      marginBottom: 12,
    },
    postSnippet: {
      fontSize: 14,
      color: '#444',
      marginTop: 5,
    },
    date: {
      fontSize: 14,
      color: '#999',
      marginTop: 3,
      paddingBottom: 10,
    },
    postVotes: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '600',
      color: '#666',
    },
    content: { fontSize: 16, marginVertical: 0, color: '#000' }, // ✅ Post content style
    messageContainer: {
      padding: 19,
      borderBottomWidth: 1,
      borderBottomColor: '#ddd',
      marginVertical: 5,
    },
    darkMessageContainer: {
      borderBottomColor: '#444',
    },
    messageContent: {
      fontSize: 14,
      fontWeight: 'normal', 
      color: '#000',
    },
    buttonStyle: {
      backgroundColor: "#4C37FF",
      padding: 14,
      borderRadius: 8,
      minWidth: Platform.OS === 'web' ? 200 : 100,
      alignSelf: 'center',
      marginHorizontal: isWideScreen ? -10 : 0,
      marginVertical: Platform.OS === 'web' ? 0 : -10,
    }, 
    darkButtonStyle: {
      backgroundColor: '#4C37FF',
      padding: 10,
    }, 
    readMoreButton: {
      backgroundColor: "#4C37FF",
      padding: 10,
      borderRadius: 8,
      marginBottom: 5,
      marginTop: 12,
      width: 100,
    }, 
    buttonText: {
      color: '#FFF',
      textAlign: "center", 
    }, 
    messageContentDark: {
      fontSize: 14,
      fontWeight: 'normal', 
      color: '#b8c5c9',
    },
    messageMeta: {
      fontSize: 12,
      color: '#777',
    },
    accordionHeader: {
      marginTop: Platform.OS === 'web' ? 0 : 0,
      marginBottom: Platform.OS === 'web' ? 0 : 0,
      paddingVertical: 10,
      paddingHorizontal: 10,
      backgroundColor: '#f0f0f0',
      borderBottomWidth: 0,
      fontSize: 18,
      fontWeight: 'bold',
      borderRadius: 0,
      paddingLeft: 18,
      borderTopWidth: 0
    },
    accordionHeaderDark: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      backgroundColor: 'rgb(0 0 0)',
      borderBottomWidth: 0,
      fontSize: 18,
      fontWeight: 'bold',
      /* borderRadius: 8, */
      paddingLeft: 18,
      marginTop: Platform.OS === 'web' ? 0 : 0,
      marginBottom: Platform.OS === 'web' ? 0 : 0,
      borderTopWidth: 1
    },
    postScoreGreen: {
      fontSize: 14,
      fontWeight: 'bold',
      color: 'green', // Orange color for score visibility
      marginTop: 5,
    },
    postScoreOrange: {
      fontSize: 14,
      fontWeight: 'bold',
      color: 'orange', // Orange color for score visibility
      marginTop: 5,
    },
    postScoreGrey: {
      fontSize: 14,
      fontWeight: 'bold',
      color: 'grey', // Orange color for score visibility
      marginTop: 5,
    },
    readMoreButtonLight: {
      color: '#FFF', // Light grey text for light mode
    },
    readMoreButtonDark: {
      color: '#FFF', // Light grey text for light mode
    },
    bluePostMetaAuthor: {
      color: '#2196f3',
    },
    bluePostMetaCommunity: {
      color: '#2196f3',
    },
    readMoreTextDark: {
      marginTop: 10,
      marginBottom: 2,
      color: '#FFF',
    },
    readMoreTextLight: {
      marginTop: 10,
      marginBottom: 2,
      color: '#000',
    },
    youtubeContainer: {
      marginTop: -20,
      marginBottom: -30,
      padding: 0,
      marginRight: 0,
      marginLeft: 0,
    },
    iframe: {
      marginVertical: 0,
      padding: 0,
      marginTop: 4,
      marginBottom: 0,
      maxWidth: 1200,
    },
    mediaContainer: {
      width: "100%", 
      alignItems: "center", // Ensures the content is centered
    },
    fullWidthMedia: {
      width: "100%", // Full width
      height: undefined, // Let height adjust automatically
      aspectRatio: 1, // Adjust dynamically
      resizeMode: "contain", // Ensures full image is visible
      maxHeight: 600, 
      maxWidth: 1200,
    },
    controls: {
      marginTop: 10,
    },
    buttonStyleSecondary: {
      backgroundColor: '#808080',
      padding: 10,
      borderRadius: 8,
      maxWidth: 140,
      alignSelf: "center",
    }, 
    darkButtonStyleSecondary: {
        backgroundColor: '#808080',
        padding: 10,
        alignSelf: "center",
    }, 
    buttonTextSecondary: {
        color: '#FFF',
        fontWeight: 'bold', 
        textAlign: "center", 
    }, 
    hidePostText: {
      color: 'grey',
    },
    darkTextIntro: {
      color: '#FFF',
      paddingLeft: 20,
      paddingRight: 20,
      marginBottom: 20,
      fontWeight: '400',
    },
    containerUnAuth: {
      flex: 1,                    
      justifyContent: 'center', 
      alignItems: 'center', 
      paddingTop: 20,
      paddingBottom: 20,
      backgroundColor: '#FFFFFF', 
    },
    containerUnAuthSection: {
      alignItems: 'center',
      width: '98%',
      marginVertical: 10,
    },
    containerButtonsUnAuth: {
      flexDirection: isWideScreen ? 'row' : 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: isWideScreen ? 16 : 0, // Optional if using modern React Native
      width: '100%',
      marginVertical: 0,
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
      marginTop: 10,
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
      marginTop: 10,
      maxWidth: 260,
    },
    contentWrapper: {
      width: '100%',
      maxWidth: 1200,
    },
    contentWrapperDark: {
      width: '100%',
      maxWidth: 1200,
      backgroundColor: '#121212'
    },
    authBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',       // Spread the buttons
      alignItems: 'center',
      backgroundColor: '#e5e5e5',            // Light grey bar
      padding: 12,
      borderRadius: 0,
      width: '100%',
      marginTop: -20
    },
    authBarDark: {
      flexDirection: 'row',
      justifyContent: 'space-between',       // Spread the buttons
      alignItems: 'center',
      backgroundColor: '#2e2e2eff',            // Light grey bar
      padding: 12,
      borderRadius: 0,
      width: '100%',
      marginTop: -20
    },
    authButton: {
      flex: 1,                                // Make both same width
      paddingVertical: 12,
      marginHorizontal: 6,
      backgroundColor: '#ffffff',
      borderRadius: 6,
      alignItems: 'center',
    },
    darkAuthButton: {
      backgroundColor: '#FFF',
    },
    authButtonText: {
      fontWeight: 'bold',
    },
    webColumnsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      maxWidth: 1500,
      gap: 20,
      height: '100%',       // Full viewport height
    },
    postsColumn: {
      flex: 2,               // 2/3 of width
      minWidth: 0,
      height: '100%',        // Fill parent height
      display: 'flex',
      flexDirection: 'column',
    },
    commentsColumn: {
      flex: 1,               // 1/3 of width
      minWidth: 0,
      height: '100%',        // Fill parent height
      display: 'flex',
      flexDirection: 'column',
    },
  });

  // Render the Comments Section
  const renderCommentsSection = () => {
    // Compute expanded state before returning JSX
    const isExpanded = isWideWeb || expandedSection === 'messages';

    return (
      <View style={{ flexShrink: 1 }}>
        {!loading && (
          <TouchableOpacity onPress={() => toggleSection('messages')} style={[styles.accordionHeader, theme === 'dark' && styles.accordionHeaderDark]}>
            <Text style={isDarkMode ? styles.darkText : {}}>
              {!isWideWeb && (
                <FontAwesome 
                  name={expandedSection === 'messages' ? "caret-down" : "caret-right"} 
                  size={18} 
                  color={isDarkMode ? "white" : "black"} 
                  style={{ marginRight: 5 }} 
                />
              )}{' '}
              Recent Comments
            </Text>
          </TouchableOpacity>
        )}
    
        {isExpanded ? (
        messages.length === 0 ? (
          <Text style={[styles.noPostsText, isDarkMode && styles.darkText]}>
            There are no recent comments on posts from Communities that you follow.
          </Text>
          ) : (
            <>
              <FlatList
                data={messages}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 20, width: '100%' }}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View style={[styles.messageContainer, isDarkMode && styles.darkMessageContainer]}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingBottom: 6, width: '100%' }}>
                      <Text style={[styles.postMeta, isDarkMode && styles.darkText]}>
                        Comment by{' '}
                      </Text>
                      <TouchableOpacity onPress={() => handleUsernamePress(item.author_username)}>
                        <Text style={[styles.bluePostMetaAuthor, isDarkMode && styles.bluePostMetaAuthor]}>
                          {item.author_username}{' '}
                        </Text>
                      </TouchableOpacity>
                      <Text style={[styles.postMeta, isDarkMode && styles.darkText]}>
                        in post:{' '}
                      </Text>
                      <TouchableOpacity 
                        onPress={() => router.push(`/post/${item.post_slug}`)}
                        style={{ 
                          flexShrink: 1, 
                          flexWrap: 'wrap'
                        }}
                      >
                        <Text style={[
                          styles.bluePostMetaAuthor, 
                          isDarkMode && styles.bluePostMetaAuthor
                          ]}>
                          {item.post_title}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  
                    <Text style={[styles.messageContent, isDarkMode && styles.messageContentDark]}>
                      {item.content}
                    </Text>

                    <Text
                      onPress={() => router.push(`/post/${item.post_slug}`)}
                      style={[
                        { textDecorationLine: 'underline', paddingBottom: 6 }, // Underline the text
                        isDarkMode ? styles.readMoreTextDark : styles.readMoreTextLight,
                      ]}
                    >
                      Read the full post
                    </Text>

                    <Text style={[styles.postMeta, isDarkMode && styles.darkText]}>
                      {new Date(item.created_at).toLocaleString('en-CA', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                    </Text>
                  </View>
                )}
              />

              {/* AdMob after FlatList */}
              {/* {!isExpoGo && (
                <>
                  <BannerAdWrapper />
                </>
              )} */}
            </>
          )
        ) : null}
      </View>
    );
  };

  // Render the Posts Section
  const renderPostsSection = () => (
    <View style={{ flexShrink: 1 }}>
      {!loading && (
        <TouchableOpacity onPress={() => toggleSection('posts')} style={[styles.accordionHeader, theme === 'dark' && styles.accordionHeaderDark]}>
          <Text style={isDarkMode ? styles.darkText : {}}>Recent Posts</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#2196f3" />
      ) : posts.length === 0 ? (
        <>
          <Text style={[styles.noPostsText, isDarkMode && styles.darkText]}>
            This is your home screen where you will see posts as they come in for Communities that you follow.{'\n'} {'\n'}Please click the Community section and follow communities that you may be interested in. {'\n'}
          </Text>

          {/* AdMob Ad */}
          {/* {!isExpoGo && (
            <>
              <BannerAdWrapper />
            </>
          )} */}
        </>
      ) : (
        <>
          <Head>
            <title>AxionNode.com</title>
            <meta name="description" content="AxionNode - An open source social platform" />

            {/* Open Graph tags */}
            <meta property="og:title" content="AxionNode.com" />
            <meta property="og:description" content="AxionNode - An open source social platform" />
            <meta property="og:type" content="website" />
            <meta property="og:url" content="https://axionnode.com/" />
            <meta property="og:image" content="https://axionnode.com/assets/?unstable_path=.%2Fassets%2Fimages/opengraph.png" />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:site_name" content="AxionNode" />

            {/* Twitter Card tags */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content="AxionNode.com" />
            <meta name="twitter:description" content="AxionNode - An open source social platform" />
            <meta name="twitter:image" content="https://axionnode.com/assets/?unstable_path=.%2Fassets%2Fimages/opengraph.png" />
          </Head>
          
          {/* Posts List Authenticated */}
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 20, width: '100%' }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <View style={[styles.postContainer, isDarkMode && styles.darkPostContainer]}>
                {item.isBlocked ? (
                  <View style={{ paddingTop: 10, paddingBottom: 10 }}>
                    <Text
                      style={[styles.postTitle, isDarkMode && styles.postTitleDark]}
                    >
                      {item.isBlocked ? '[Blocked] This post has been blocked' : item.title}
                    </Text>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                      <Text style={[styles.postMeta, isDarkMode && styles.darkText]}>
                        By{' '}
                      </Text>
                      <TouchableOpacity onPress={() => handleUsernamePress(item.author.username)}>
                        <Text style={[styles.bluePostMetaAuthor, isDarkMode && styles.bluePostMetaAuthor]}>
                          {item.author.username}{' '}
                        </Text>
                      </TouchableOpacity>
                      <Text style={[styles.postMeta, isDarkMode && styles.darkText]}>
                        in{' '}
                      </Text>
                      <TouchableOpacity onPress={() => router.push(`/community/${item.community.slug}`)}>
                        <Text style={[styles.bluePostMetaCommunity, isDarkMode && styles.bluePostMetaCommunity]}>
                          {item.community.title}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.date, isDarkMode && styles.date]}>
                      {new Date(item.created_at).toLocaleString('en-CA', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>

                    <Text
                      onPress={() => handleUnblock(item.author.username)}  // Handler to unblock user
                      style={[
                        { textDecorationLine: 'underline' },
                        isDarkMode ? styles.hidePostText : styles.hidePostText,
                      ]}
                    >
                      Post hidden because you have blocked this user. Click here to unblock the user to view the post.
                    </Text>
                  </View>
                ) : (
                  // If the post is not blocked and not hidden, render the full post content
                  !item.isHidden ? (
                    <>
                      <Text
                        onPress={() => router.push(`/post/${item.slug}`)}
                        style={[styles.postTitle, isDarkMode && styles.postTitleDark]}
                      >
                        {item.title}
                      </Text>

                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                        <Text style={[styles.postMeta, isDarkMode && styles.darkText]}>
                          By{' '}
                        </Text>
                        <TouchableOpacity onPress={() => handleUsernamePress(item.author.username)}>
                          <Text style={[styles.bluePostMetaAuthor, isDarkMode && styles.bluePostMetaAuthor]}>
                            {item.author.username}{' '}
                          </Text>
                        </TouchableOpacity>
                        <Text style={[styles.postMeta, isDarkMode && styles.darkText]}>
                          in{' '}
                        </Text>
                        <TouchableOpacity onPress={() => router.push(`/community/${item.community.slug}`)}>
                          <Text style={[styles.bluePostMetaCommunity, isDarkMode && styles.bluePostMetaCommunity]}>
                            {item.community.title}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={[styles.date, isDarkMode && styles.date]}>
                        {new Date(item.created_at).toLocaleString('en-CA', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>

                      {/* Post Image -- if one exists */}
                      {item?.post_photo && (
                        <>
                          {Platform.OS === 'web' ? (
                            <Pressable onPress={() => router.push(`/post/${item.slug}`)}>
                              <Image
                                source={{ uri: item.post_photo }}
                                style={{
                                  width: '100%',
                                  aspectRatio: 1.2, // Adjust based on your average image shape (e.g., 4:3 = 1.33, 16:9 = 1.77)
                                  resizeMode: 'cover',
                                  maxHeight: 700,
                                  maxWidth: 1200,
                                  borderRadius: 8,
                                  marginBottom: 20,
                                }}
                              />
                            </Pressable>
                          ) : (
                            <Pressable onPress={() => router.push(`/post/${item.slug}`)}>
                              <Image
                                source={{ uri: item.post_photo }}
                                style={{
                                  width: '100%',
                                  maxHeight: 700,
                                  aspectRatio: 1.2,
                                  resizeMode: 'cover',
                                  borderRadius: 8,
                                  marginBottom: 10,
                                }}
                              />
                            </Pressable>
                          )}
                        </>
                      )}

                      <ContentRenderer content={item.content_snippet} isDarkMode={isDarkMode} />

                      <Text
                        onPress={() => router.push(`/post/${item.slug}`)}
                        style={[
                          { textDecorationLine: 'underline' }, // Underline the text
                          isDarkMode ? styles.readMoreTextDark : styles.readMoreTextLight,
                        ]}
                      >
                        Read More
                      </Text>

                      <Text style={[styles.postScoreGrey, isDarkMode && styles.postScoreGrey]}>
                        👍 {item.vote_count}
                      </Text>

                      <View style={{ flexDirection: 'row', gap: 10, paddingTop: 10, justifyContent: 'flex-end' }}>
                        <Text
                          onPress={() => handleHide(item.slug)}
                          style={[
                            { textDecorationLine: 'underline' }, // Underline the text
                            isDarkMode ? styles.hidePostText : styles.hidePostText,
                          ]}
                        >
                          Hide post
                        </Text>

                        {user?.username && item?.author?.username !== user.username && (
                          <Text
                            onPress={() => handleBlock(item.author.username)}
                            style={[
                              { textDecorationLine: 'underline' },
                              isDarkMode ? styles.hidePostText : styles.hidePostText,
                            ]}
                          >
                            Block user
                          </Text>
                        )}

                        <Text
                          onPress={() => handleReportPost(item.slug)}
                          style={[
                            { textDecorationLine: 'underline' },
                            isDarkMode ? styles.hidePostText : styles.hidePostText,
                          ]}
                        >
                          Report Post
                        </Text>
                      </View>
                    </>
                
                  ) : (
                    // Render simple view with "Unhide this post" when the post is hidden
                    <View style={{ paddingTop: 10, paddingBottom: 10 }}>
                      <Text
                        style={[styles.postTitle, isDarkMode && styles.postTitleDark]}
                      >
                        {item.isHidden ? '[Hidden] This post has been hidden' : item.title}
                      </Text>

                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                        <Text style={[styles.postMeta, isDarkMode && styles.darkText]}>
                          By{' '}
                        </Text>
                        <TouchableOpacity onPress={() => handleUsernamePress(item.author.username)}>
                          <Text style={[styles.bluePostMetaAuthor, isDarkMode && styles.bluePostMetaAuthor]}>
                            {item.author.username}{' '}
                          </Text>
                        </TouchableOpacity>
                        <Text style={[styles.postMeta, isDarkMode && styles.darkText]}>
                          in{' '}
                        </Text>
                        <TouchableOpacity onPress={() => router.push(`/community/${item.community.slug}`)}>
                          <Text style={[styles.bluePostMetaCommunity, isDarkMode && styles.bluePostMetaCommunity]}>
                            {item.community.title}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={[styles.date, isDarkMode && styles.date]}>
                        {new Date(item.created_at).toLocaleString('en-CA', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>

                      <Text
                        onPress={() => handleReShow(item.slug)}
                        style={[
                          { textDecorationLine: 'underline' },
                          isDarkMode ? styles.hidePostText : styles.hidePostText,
                        ]}
                      >
                        Unhide this post to view it
                      </Text>
                    </View>
                  )
                )}
              </View>
            )}
          />

          {/* AdMob after FlatList */}
          {/* {!isExpoGo && (
            <>
              <BannerAdWrapper />
            </>
          )} */}

        </>
      )}
    </View>
  );

  // If there is no valid token, then send them to the intro page
  if (!token) {
    return (
      <>
        <Head>
          <title>AxionNode.com</title>
          <meta name="description" content="AxionNode - An open source social platform" />

          {/* Open Graph tags */}
          <meta property="og:title" content="AxionNode.com" />
          <meta property="og:description" content="AxionNode - An open source social platform" />
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://axionnode.com/" />
          <meta property="og:image" content="https://axionnode.com/opengraph.png" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:site_name" content="AxionNode" />

          {/* Twitter Card tags */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="AxionNode.com" />
          <meta name="twitter:description" content="AxionNode - An open source social platform" />
          <meta name="twitter:image" content="https://axionnode.com/opengraph.png" />
        </Head>
        
        <ScrollView
          contentContainerStyle={[
            { paddingBottom: 300, paddingTop: 0, flexGrow: 1 },
            isDarkMode ? styles.darkContainer : styles.lightContainer,
          ]}
        >
          <View style={[styles.containerUnAuth, theme === 'dark' && styles.darkContainer]}>

            {/* TOP FULL-WIDTH AUTH BAR */}
            <View style={[styles.authBar, theme === 'dark' && styles.authBarDark]}>
              <TouchableOpacity
                style={[styles.authButton, isDarkMode && styles.darkAuthButton]}
                onPress={() => router.push('/register')}
              >
                <Text style={styles.authButtonText}>REGISTER</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.authButton, isDarkMode && styles.darkAuthButton]}
                onPress={() => router.push('/login')}
              >
                <Text style={styles.authButtonText}>LOGIN</Text>
              </TouchableOpacity>
            </View>

            {/* Spacer — now BELOW the bar */}
            <View style={{ height: 20 }} />

            <View style={styles.containerUnAuthSection}>

              {/* AdMob Ad */}
              {/* {!isExpoGo && (
                <>
                  <BannerAdWrapper />
                </>
              )} */}

              {loading ? (
                <Text style={[styles.subtitle, theme === 'dark' && styles.darkText]}>Loading recent posts...</Text>
              ) : (
                posts.length > 0 && (
                  <View style={isDarkMode ? styles.contentWrapperDark : styles.contentWrapper}>
                    <Text style={[styles.titleHeader, theme === 'dark' && styles.darkTextIntro, { marginBottom: 10, paddingLeft: 20 }]}>
                      Recent Posts
                    </Text>
                    {posts.map((post) => (
                      <TouchableOpacity
                        key={post.slug}
                        onPress={() => router.push(`/post/${post.slug}`)}
                        style={{
                          // backgroundColor: isDarkMode ? '#1e1e1e' : '#f2f2f2',
                          padding: 20,
                          marginBottom: 16,
                          borderBottomWidth: 1,
                          borderBottomColor: isDarkMode ? '#555' : '#ddd', 
                        }}
                      >
                        <Text style={[styles.postTitle, theme === 'dark' && styles.darkText]}>
                          {post.title}
                        </Text>
                        <Text style={[styles.postMetaUnAuth, theme === 'dark' && styles.darkTextUnAuth]}>
                          Posted by {post.author.username} in {post.community.title} • {new Date(post.created_at).toLocaleDateString()}
                        </Text>
                        
                        {/* Post Image -- if one exists */}
                        {post?.post_photo && (
                          <>
                            {Platform.OS === 'web' ? (
                              <Pressable onPress={() => router.push(`/post/${post.slug}`)}>
                                <Image
                                  source={{ uri: post.post_photo }}
                                  style={{
                                    width: '100%',
                                    aspectRatio: 1.2, // Adjust based on your average image shape (e.g., 4:3 = 1.33, 16:9 = 1.77)
                                    resizeMode: 'cover',
                                    maxHeight: 700,
                                    maxWidth: 1200,
                                    borderRadius: 8,
                                    marginBottom: 20,
                                  }}
                                />
                              </Pressable>
                            ) : (
                              <Pressable onPress={() => router.push(`/post/${post.slug}`)}>
                                <Image
                                  source={{ uri: post.post_photo }}
                                  style={{
                                    width: '100%',
                                    maxHeight: 700,
                                    aspectRatio: 1.2,
                                    resizeMode: 'cover',
                                    borderRadius: 8,
                                    marginBottom: 10,
                                  }}
                                />
                              </Pressable>
                            )}
                          </>
                        )}

                        <ContentRenderer content={post.content_snippet} isDarkMode={isDarkMode} />

                        {/* <Text
                          numberOfLines={3}
                          style={[styles.postSummary, theme === 'dark' && styles.darkText]}
                        >
                          {post.content_snippet}
                        </Text> */}
                        <Text style={[styles.postVotes, theme === 'dark' && styles.darkText]}>
                          👍 {post.vote_count} votes
                        </Text>

                        <Text style={{ marginVertical: 3 }} />

                      </TouchableOpacity>
                    ))}
                  </View>
                )
              )}

              <Text style={{ marginVertical: 15 }} />

              {/* AdMob Ad */}
              {/* {!isExpoGo && (
                <>
                  <BannerAdWrapper />
                </>
              )} */}

              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, paddingHorizontal: 16 }}>
                <Text onPress={() => router.push('/user-agreement')} style={[styles.subtitleFooter, theme === 'dark' && styles.darkText]}>
                User agreement
                </Text>
                <Text style={[styles.subtitleFooter, theme === 'dark' && styles.darkText]}>
                {' '}|{' '}
                </Text>
                <Text onPress={() => router.push('/privacy-policy')} style={[styles.subtitleFooter, theme === 'dark' && styles.darkText]}>
                Privacy policy
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 0, paddingHorizontal: 16 }}>
                <Text style={[styles.subtitleFooter, theme === 'dark' && styles.darkText]}>
                {'\n'}{'\n'}{'\n'}{'\n'}{'\n'}{'\n'}{'\n'}{'\n'}
                </Text>
                <Text style={[styles.subtitleCompany, theme === 'dark' && styles.darkTextCompany]}>
                Clockwork Venture, Inc.
                </Text>
              </View>

            </View>

          </View>
        </ScrollView>
      </>
    );
  }

  // AUTHENTICATED
  // Otherwise, return the authenticated view 
  return (
    <View
      style={[
        {
          flex: 1,
          // maxWidth: 600,
          width: '100%', 
          alignItems: 'center',      // Centers horizontally
          justifyContent: 'center',  // Optional: center vertically
          backgroundColor: isDarkMode ? '#121212' : '#fff', // Or use your styles
        },
      ]}
    >
      <View
        style={[
          {
            width: '100%',
            maxWidth: 1500,
          },
          styles.containerHome,
          theme === 'dark' && styles.darkContainerHome,
        ]}
      >

        {/* Render the authenticated view on Web if screen larger than 720 pixels width */}
        {isWideWeb ? (
          <View style={styles.webColumnsContainer}>
            <View style={styles.postsColumn}>
              {/* Recent Posts section */}
              {renderPostsSection()}
            </View>
            <View style={styles.commentsColumn}>
              {/* Recent Comments section */}
              {renderCommentsSection()}
            </View>
          </View>
        // Render the authenticated view on Mobile
        ) : (
          <>
            {renderPostsSection()}
            {renderCommentsSection()}
          </>
        )}

      </View>
    </View>
  );
};

export default HomeScreen;