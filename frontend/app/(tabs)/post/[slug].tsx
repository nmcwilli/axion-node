import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  Dimensions, KeyboardAvoidingView, Button, View, Text, TextInput, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, Platform, Image, Modal, Pressable, ScrollView, RefreshControl, Linking
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import Head from 'expo-router/head';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/auth';
import { useRouter } from 'expo-router'; 
import Hyperlink from 'react-native-hyperlink';
import { jwtDecode } from "jwt-decode";
import YoutubePlayer from 'react-native-youtube-iframe';
import WebView from 'react-native-webview'; // For native platforms
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { Ionicons } from '@expo/vector-icons'; // for close icon
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { BannerAdWrapper } from '../../../components/bannerAd';
// import { logEvent } from '../../../components/analytics';

// Are we running in Expo GO? If so, don't use AdMob: 
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// For meta tags
export const prerender = true;

// Define the types for the props
interface MyModalProps {
  visible: boolean;
  hideModal: () => void;
}

type YoutubePlayerState =
  | 'unstarted'
  | 'ended'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'cued';

interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  content_snippet: string;
  created_at: string;
  vote_count: number;
  post_photo?: string | null;
  author: { 
    id: number; 
    username: string 
  };
  community: { 
    id: number; 
    title: string; 
    slug: string, 
    status: string; 
  };
  isHidden?: boolean;  // Add isHidden property here
  isBlocked?: boolean;  // Add isHidden property here
}

// Interface for HiddenPosts
interface HiddenPost {
  slug: string;
}

// Define a type for the Open Graph response data
interface OpenGraphData {
  title: string;
  description: string;
  image: string;
  // Add other properties as needed
}

interface Message {
  id: number;
  content: string;
  created_at: string;
  author: { id: number; username: string };
  chain: number;
  vote_count: number;
  user_vote: "upvote" | "downvote" | undefined | null; // Add null here
  [key: string]: any;
}

type Chain = {
    chain_id: number;
    messages: Message[]; // Now this is an array, not an object
}

// Youtube content extractor 
// const extractYouTubeID = (url: string) => {
//   const match = url.match(
//     /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/
//   );
//   return match ? match[1] : null;
// };
const extractYouTubeID = (url: string) => {
  const match = url.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:.*[?&]v=|(?:v|embed|shorts|live)\/)|youtu\.be\/)([^"&?/ ]{11})/
  );
  return match ? match[1] : null;
};

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
// const extractImgurID = (url: string) => {
//   const match = url.match(/(?:imgur\.com\/(?:gallery\/|a\/|)([\w\d]+))/);
//   return match ? match[1] : null;
// };
const extractImgurMedia = (url: string) => {
  const match = url.match(/(?:imgur\.com\/(?:gallery\/|a\/|i\/)?([\w\d]+)(\.\w+)?)/);
  if (!match) return null;

  const id = match[1];
  const extension = match[2] || ''; // Capture file extension if present

  return { id, extension };
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

const PostDetailScreen = () => {
  const { slug } = useLocalSearchParams();
  const { token, user, refreshAccessToken } = useAuth();
  const { theme } = useTheme();
  const [post, setPost] = useState<Post | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [voteCount, setVoteCount] = useState<number | null>(null);
  const [responseText, setResponseText] = useState('');
  const [postingResponse, setPostingResponse] = useState(false);
  const [postNotFound, setPostNotFound] = useState(false);
  const isDarkMode = theme === 'dark';
  const router = useRouter();
  // const [groupedMessages, setGroupedMessages] = useState<{ [chainNumber: number]: Message[] }>({}); // Corrected state initialization
  const [openReplyBoxes, setOpenReplyBoxes] = useState<{ [chainId: number]: boolean }>({});
  const [replyTexts, setReplyTexts] = useState<{ [key: number]: string }>({});
  const [deleting, setDeleting] = useState(false);

  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editedContent, setEditedContent] = useState("");

  // const [voteMessageCount, setMessageVoteCount] = useState<number | null>(null);
  
  const [refreshing, setRefreshing] = useState(false);

  // Tracks the post vote state (single vote for a post)
  const [userVote, setUserVote] = useState<"upvote" | "downvote" | null>(null);
  // Tracks message votes (multiple votes, one per message)
  const [userVotes, setUserVotes] = useState<{ [key: number]: string | null }>({});

  // Hidden and Blocked posts states 
  const [hiddenPosts, setHiddenPosts] = useState<string[]>([]); // Track hidden post slugs
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);  // Ensure it's an array of strings

  // Youtube const
  const [playing, setPlaying] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  // Declaring OpenGraph data const
  const [openGraphData, setOpenGraphData] = useState(null);

  // Video content
  const [mediaInfo, setMediaInfo] = useState<{ id: string; extension: string } | null>(null);
  // const [mediaInfo, setMediaInfo] = useState(null);

  // Image modal zooming and centering const
  const [isImageModalVisible, setImageModalVisible] = useState(false);
  const [shouldRenderZoomView, setShouldRenderZoomView] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;
  const [scrollKey, setScrollKey] = useState(0);

  // Modal settings
  const [visible, setVisible] = useState(false);
  const showSignupModal = () => setVisible(true);
  const hideSignupModal = () => setVisible(false);
  // Modals only used for web image viewing:
  const [webImageModalVisible, setWebImageModalVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // Android item
  const [AndroidGallery, setAndroidGallery] = useState<any>(null);

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //   logEvent('screen_view', { screen_name: 'PostDetailScreen' });
  // }, []);

  // Scroll to the top
  useFocusEffect(
    useCallback(() => {
      // Scroll to top when the screen is focused
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, [])
  );

  useEffect(() => {
    if (Platform.OS === 'android') {
      import('react-native-awesome-gallery')
        .then((mod) => setAndroidGallery(() => mod.default))
        .catch((err) => console.error('Failed to load Android Gallery:', err));
    }
  }, []);

  // Image modal WEB ONLY settings
  const openWebImageModal = (uri: string) => {
    // ("Opening image modal with URL:", uri); // <-- Debug log
    setSelectedImageUrl(uri);
    setWebImageModalVisible(true);
  };

  const closeWebImageModal = () => {
    setWebImageModalVisible(false);
    setSelectedImageUrl(null);
  };

  // Image model open settings
  const openImageModal = () => {
    setScrollKey((prev) => prev + 1); // Force remount to reset zoom
    setImageModalVisible(true);
  };
  
  // Image modal close settings
  const closeImageModal = () => {
  if (Platform.OS === "ios") {
    scrollViewRef.current?.scrollResponderZoomTo({
      x: 0,
      y: 0,
      width: windowWidth,
      height: windowHeight,
      animated: false,
    });
    scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    setImageDimensions({ width: 0, height: 0 });
  }

  setImageModalVisible(false);
};

  // Setting the video source
  const videoSource =
    mediaInfo?.extension === ".mp4"
      ? `https://i.imgur.com/${mediaInfo.id}.mp4`
      : "";

  // ✅ Always define hooks at the top level
  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = true;
    if (videoSource) {
      player.play();
    }
  });

  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  // This is the core content renderer that renders Youtube videos, Imgur images and videos and text based content
  const renderContent = (content: string, isDarkMode: boolean) => {
    // // Fetch OpenGraph data for URLs
    // useEffect(() => {
    //   const fetchAndSetOpenGraphData = async () => {
    //     const urlParts = content.split(/(https?:\/\/[^\s]+)/g);
    //     const urls = urlParts.filter(part => part.startsWith('http'));
      
    //     if (urls.length > 0) {
    //       // Ensure you're passing both the URL and the token
    //       const data = await fetchOpenGraphData(urls[0], token);
    //       if (data) {
    //         setOpenGraphData(data);
    //       }
    //     }
    //   };

    //   fetchAndSetOpenGraphData();
    // }, [content]); // Re-run whenever content changes

    return content.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
      const youtubeID = extractYouTubeID(part);
      const imgurMatch = part.match(imgurRegex);
      const mediaInfo = extractImgurMedia(part);
  
      if (youtubeID) {
        return (
          // For web users
          Platform.OS === 'web' ? (
            <iframe
              key={index}
              width="100%"
              height="350"
              src={`https://www.youtube.com/embed/${youtubeID}`}
              frameBorder="0"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={styles.iframe}
            />
          ) : (
            // For mobile users (native), render YoutubePlayer for YouTube
            youtubeID && WebViewComponent ? (
              <View key={index} style={styles.youtubeContainer}>
                <YoutubePlayer
                  height={250}
                  play={playing}
                  videoId={youtubeID}
                  onChangeState={(state: YoutubePlayerState) => {
                    if (state === 'playing') {
                      setPlayingVideoId(youtubeID);
                    } else if (state === 'paused' || state === 'ended') {
                      setPlayingVideoId(null);
                    }
                  }}
                />
              </View>
            ) : null
          )
        );
      }
  
      // if (imgurMatch) {
      //   return (
      //     <View key={index} style={{ marginVertical: 5 }}>
      //       <VideoView
      //         style={styles.fullWidthMedia}
      //         player={player}
      //         allowsFullscreen
      //         allowsPictureInPicture
      //       />
      //     </View>
      //   );
      // }
  
      if (mediaInfo) {
        return (
          <View key={index} style={{ marginVertical: 0 }}>
            {mediaInfo.extension === '.mp4' ? (
              <>
                <VideoView
                  style={styles.fullWidthMedia}
                  player={player}
                  allowsFullscreen
                  allowsPictureInPicture
                />
                <View style={styles.controls}>
                  <TouchableOpacity
                    style={[styles.buttonStyleSecondary, isDarkMode && styles.darkButtonStyleSecondary]}
                    onPress={() => {
                      if (isPlaying) {
                        player.pause();  // Pause if it's playing
                      } else {
                        player.play();   // Play if it's paused
                      }
                      setPlaying(!isPlaying);  // Toggle the play/pause state
                    }}
                  >
                    <Text style={styles.buttonTextSecondary}>
                      {isPlaying ? '⏸ Pause Video' : '▶ Play Video'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
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

      // OpenGraph integration - Display data if available
      // if (openGraphData && part.startsWith('http')) {
      //   return (
      //     <View key={index} style={{ marginVertical: 5 }}>
      //       <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{openGraphData.title}</Text>
      //       <Text>{openGraphData.description}</Text>
      //       {openGraphData.image && (
      //         <Image
      //           source={{ uri: openGraphData.image }}
      //           style={{ width: '100%', height: 200, marginVertical: 10 }}
      //         />
      //       )}
      //     </View>
      //   );
      // }
  
      // Wrap non-URL text parts inside <Text> component to avoid the error
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

  // Refresh expired token when applicable
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

      const fetchPostAndVoteCount = async () => {
        if (!slug) return;
      
        try {
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          };
      
          // Include token in header only if it exists
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
      
          const response = await fetch(`${API_BASE_URL}/post/${slug}/`, {
            method: 'GET',
            headers,
          });
      
          if (response.status === 404) {
            setPostNotFound(true);
            return;
          }
      
          if (!response.ok) {
            throw new Error('Failed to fetch post data');
          }
      
          const postData = await response.json();
          setPost(postData);
          setVoteCount(postData.vote_count);
          setUserVote(postData.user_vote);
        } catch (error) {
          console.log('Error fetching post data. Please try again later.');
        } finally {
          setLoading(false);
        }
      };

      checkAndRefreshToken();
      fetchPostAndVoteCount(); // Fetch post data when screen is focused

    }, [token, slug])
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

  // UseEffect for Video Media
  useEffect(() => {
    if (post?.content) {
      const media = extractImgurMedia(post.content);
      setMediaInfo(media);
    }
  }, [post]); // ✅ Runs only when `post` updates

  // UseEffect for other Post Data 
  // Onload of the post 
  useEffect(() => {
    // Redirect the user if they are not signed in
    // if (!token || !slug) return;
    // if (!token) {
    //   const timer = setTimeout(() => {
    //     if (!token) {
    //       router.replace('/login'); 
    //     }
    //   }, 100); // Small delay to allow navigation to mount
  
    //   return () => clearTimeout(timer); // Cleanup
    // }
  
    // If there is no slug then redirect them to the Home screen
    if (!slug) {
      const timer = setTimeout(() => {
        if (!token) {
          router.replace('/'); 
        }
      }, 100); // Small delay to allow navigation to mount
  
      return () => clearTimeout(timer); // Cleanup
    }
  
    // Only run if the post content exists
    // if (post?.content) {
    //   const media = extractImgurMedia(post.content);
    //   setMediaInfo(media);
    // }
  
    const fetchPostAndMessages = async (isRefreshing = false) => {
      if (isRefreshing) setRefreshing(true); // Indicate refreshing UI
  
      try {
        const headers: Record<string, string> = token
          ? { Authorization: `Bearer ${token}` }
          : {};
  
        const [postRes, messagesRes, hiddenPostsRes, blockedUsersRes] = await Promise.all([
          fetch(`${API_BASE_URL}/post/${slug}/`, { headers }),
          fetch(`${API_BASE_URL}/post/${slug}/messages/`, { headers }),
          token ? fetch(`${API_BASE_URL}/user-hidden-posts/`, { headers }) : Promise.resolve({ ok: true, json: () => [] }),
          token ? fetch(`${API_BASE_URL}/user-blocked-users/`, { headers }) : Promise.resolve({ ok: true, json: () => [] }),
        ]);
  
        if (!postRes.ok) throw { response: { status: postRes.status } };
        if (!messagesRes.ok) throw { response: { status: messagesRes.status } };
  
        const postData = await postRes.json();
        const messagesDataRaw = await messagesRes.json();
  
        setPost(postData);
        setVoteCount(postData.vote_count);
        setUserVote(postData.user_vote); // Store post vote
        setPostNotFound(false); // Reset if post is found
  
        // Ensure messagesDataRaw is an array
        const messagesData = Array.isArray(messagesDataRaw) ? messagesDataRaw : [];
  
        // Check if the community is approved
        if (postData.community.status !== 'approved') {
          Alert.alert('Not Approved', 'This post is part of a community that is not activated.');
          router.push('/');  // Redirect to the home page or another page
          return;  // Exit the function early
        }
  
        const flattenedMessages = messagesData.flatMap((chain: Chain) => {
          return chain.messages.map((msg: Message) => ({
            ...msg,
            chain: chain.chain_id,
          }));
        });
  
        setMessages(
          flattenedMessages.sort((a: Message, b: Message) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        );
      } catch (error: any) {
        // console.log('Error fetching post/messages:', error);
        console.log('Error fetching post/messages. Please try again later.');
        if (error.response?.status === 404) {
          setPostNotFound(true);
        }
      } finally {
        setRefreshing(false);
        setLoading(false); // Ensure this is always called
      }
    };
  
    fetchPostAndMessages();
  }, [slug, token]);

  // Another variant of fetchPostAndMessages
  // Accessible outside of UseEffect 
  const fetchPostAndMessages = async () => {
  
    setRefreshing(true);
  
    try {
      const headers = { Authorization: `Bearer ${token}` };
  
      const [postRes, messagesRes, hiddenPostsRes, blockedUsersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/post/${slug}/`, { headers }),
        fetch(`${API_BASE_URL}/post/${slug}/messages/`, { headers }),
        fetch(`${API_BASE_URL}/user-hidden-posts/`, { headers }),
        fetch(`${API_BASE_URL}/user-blocked-users/`, { headers }),
      ]);
  
      if (!postRes.ok || !messagesRes.ok || !hiddenPostsRes.ok || !blockedUsersRes.ok) {
        throw new Error("Failed to fetch one or more resources");
      }
  
      const postData = await postRes.json();

      // const messagesData = Array.isArray(await messagesRes.json()) ? await messagesRes.json() : []; deprecated
      const rawMessages = await messagesRes.json();
      const messagesData = Array.isArray(rawMessages) ? rawMessages : [];

      const hiddenPostsRaw = await hiddenPostsRes.json();
      const blockedUsersRaw = await blockedUsersRes.json();
  
      const hiddenPostSlugs = hiddenPostsRaw.map((post: string | HiddenPost) =>
        typeof post === "string" ? post : post.slug
      );
  
      const blockedUsers = blockedUsersRaw.map((username: string) =>
        username.trim().toLowerCase()
      );
  
      setBlockedUsers(blockedUsers);
  
      const isBlocked = blockedUsers.includes(postData.author.username.trim().toLowerCase());
      const isHidden = hiddenPostSlugs.includes(postData.slug);
  
      // Always set the post, but add isBlocked and isHidden properties
      setPost({
        ...postData,
        isBlocked,
        isHidden,
      });
  
      // Process messages, filtering out those from blocked users
      const flattenedMessages = messagesData.flatMap((chain: Chain) =>
        chain.messages.map((msg: Message) => ({
          ...msg,
          chain: chain.chain_id,
          isBlocked: blockedUsers.includes(msg.author.username.trim().toLowerCase()),
        }))
      );
  
      setMessages(
        flattenedMessages
        .filter((msg: Message) => !msg.isBlocked) // Remove messages from blocked users
        .sort((a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      );
    } catch (error: any) {
      console.log("❌ Full error object:", error);
    
      if (error instanceof Response) {
        const errorText = await error.text();
        console.error(`❌ Response error (${error.status}):`, errorText);
      }
    
      if (error?.response?.status === 404) {
        setPostNotFound(true);
      } else {
        console.log("Error fetching post/messages. Please try again later.");
      }
    }
  };

  // Grab Youtube & Pinterest links from post content
  const youtubeID = post?.content ? extractYouTubeID(post.content) : null;
  // const pinterestID = post?.content ? extractPinterestID(post.content) : null;

  // Message Voting 
  const handleMessageVote = async (messageId: number, voteType: "upvote" | "downvote") => {
    if (!token) return;
  
    // Find the message that we're going to vote on
    const message = messages.find((msg) => msg.id === messageId);
  
    if (!message) return;
  
    // If the user has already voted the same way, remove the vote
    if (message.user_vote === voteType) {
      await handleRemoveMessageVote(messageId);
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId ? { ...msg, user_vote: null } : msg
        )
      );
      return;
    }
  
    try {
      // If there was a previous vote that is *not* the same as the new vote, remove it first.
      if (message.user_vote) {
        await handleRemoveMessageVote(messageId);
      }
  
      // Send the new vote to the server
      const res = await fetch(`${API_BASE_URL}/messages/${messageId}/${voteType}/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // match axios POST with empty body
      });
  
      if (!res.ok) {
        throw new Error('Failed to vote');
      }
  
      const data = await res.json();
  
      // Update the message's vote count and user vote in the state
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId
            ? { ...msg, vote_count: data.vote_count, user_vote: voteType }
            : msg
        )
      );
    } catch (error) {
      console.log("Voting issue. Please try again later and ensure you haven't already voted for this item.");
    }
  };

  // Message Vote Removal
  const handleRemoveMessageVote = async (messageId: number) => {
    if (!token) return;
  
    try {
      const res = await fetch(`${API_BASE_URL}/messages-remove-vote/${messageId}/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Empty body, like with axios
      });
  
      if (!res.ok) {
        throw new Error('Failed to remove vote');
      }
  
      const data = await res.json();
  
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId ? { ...msg, vote_count: data.vote_count } : msg
        )
      );
  
      setUserVotes((prev) => ({ ...prev, [messageId]: null })); // Ensure UI resets correctly
    } catch (error) {
      console.log("Your vote removal on a message has experienced a problem. Please try again later.");
    }
  };

  // Post Voting 
  const handleVote = async (voteType: "upvote" | "downvote") => {

    // If the user is not authenticated, then render the modal
    if (!token) {
      showSignupModal();
      return;
    }

    if (userVote === voteType) {
      // Remove vote if the user clicks the same vote type again
      await handleRemoveVote();
      return;
    }
  
    try {
      const res = await fetch(`${API_BASE_URL}/post/${slug}/${voteType}/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Empty body, like with axios
      });
  
      if (!res.ok) {
        throw new Error('Failed to vote');
      }
  
      const data = await res.json();
  
      setVoteCount(data.vote_count);
      setUserVote(voteType);
    } catch (error) {
      console.log("There was a voting error. Please try again later.");
    }
  };

  // Post Vote Removal
  const handleRemoveVote = async () => {
    if (!token) return;
  
    try {
      const res = await fetch(`${API_BASE_URL}/post-remove-vote/${post?.id}/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Empty body, like with axios
      });
  
      if (!res.ok) {
        throw new Error('Failed to remove vote');
      }
  
      const data = await res.json();
  
      setVoteCount(data.vote_count);
      setUserVote(null);
    } catch (error) {
      console.log("There was a voting error. Please try again later.");
    }
  };

  // Delete Post logic
  const handleDeletePost = async () => {
    if (!token) {
      // console.error("No token found.");
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed = window.confirm("Are you sure you want to delete this post?");
      if (!confirmed) return;
    } else {
      Alert.alert(
        "Delete Post",
        "Are you sure you want to delete this post?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Delete", 
            style: "destructive", 
            onPress: async () => {
              await deletePost();
            }
          }
        ]
      );
      return;
    }
    await deletePost();
  };

  /* Delete a Post function */
  const deletePost = async () => {
    if (!token) return;

    setDeleting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/post-delete/${slug}/`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        Alert.alert("Success", "Post deleted successfully.");
        router.push("/"); // Redirect to home page
      } else {
        const errorText = await res.text(); // Optional: helpful for debugging
        console.log("❌ Failed to delete post. Please try again later.");
      }
    } catch (error: unknown) {
      console.log("Deleting error. Please try again later.");

      if (error instanceof Error) {
        console.log("Error details:", error.message);
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    if (!token) {
      // console.error("No token found.");
      return;
    }

    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  // Detect when the post is not found
  if (!post) {
    if (!token) {
      // console.error("No token found.");
      return;
    }

    return (
      <View style={styles.container}>
        <Text style={[styles.errorText, isDarkMode && styles.whiteText]}>Post not found.</Text>
      </View>
    );
  }

  // Core Handle Edit Message functionality 
  const handleEditMessage = (message: Message) => {
    if (!token) {
      // console.error("No token found.");
      return;
    }

    setEditingMessageId(message.id);
    setEditedContent(message.content);
  };
  
  // Save an Edit to a Message
  const handleSaveEdit = async () => {
    if (!token) {
      return;
    }
  
    try {
      const response = await fetch(`${API_BASE_URL}/message-edit/${editingMessageId}/`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: editedContent }),
      });
  
      // Check if the message was updated (status 200)
      if (response.status === 200) {
        setEditingMessageId(null);
        fetchPostAndMessages(); // Fetch updated messages
      } else {
        console.error("Failed to update message.");
      }
    } catch (error) {
      console.error("Error updating message:", error);
      fetchPostAndMessages();
    }
  };
  
  // Core Delete a Message functionality 
  const handleDeleteMessage = async (messageId: number) => {
    if (!token) {
      return;
    }
  
    try {
      const response = await fetch(`${API_BASE_URL}/message-delete/${messageId}/`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      // Check if the message was deleted (status 204)
      if (response.ok) {
        console.log(`✅ Message deleted. Status: ${response.status}`);
        fetchPostAndMessages();
      } else {
        const errorText = await response.text(); // Read the body for more context
        console.log(`❌ Failed to delete message. Please try again later.`);
      }
    } catch (error) {
      console.log("We have experienced a challenge deleting a message. Please try again later.");
      fetchPostAndMessages();
    }
  };

  // Handle community presses
  const handleCommunityPress = (communitySlug: string) => {
    if (!token) {
      showSignupModal();
      return;
    }

    router.push(`/community/${communitySlug}`);
  };

  // Hide a Post 
  const handleHide = async (postSlug: string) => {

    // If the user is not authenticated, then render the modal
    if (!token) {
      showSignupModal();
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/post/${postSlug}/hide/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      setHiddenPosts((prev) => [...prev, postSlug]); // Add the slug to the hidden posts array
      await fetchPostAndMessages();  // Fetch the updated post
    } catch (error) {
      console.log('Sorry, we experienced an issue hiding this post. Please try again later.');
    }
  };

  // Re-Show the Post
  const handleReShow = async (postSlug: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/post/${postSlug}/show/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      setHiddenPosts((prev) => prev.filter((hiddenSlug) => hiddenSlug !== postSlug)); // Remove the slug from the hidden posts array
      await fetchPostAndMessages();  // Fetch the updated post
    } catch (error) {
      console.log('Sorry, we experienced an issue re-showing this post. Please try again later.');
    }
  };

  // Handles blocking of users 
  const handleBlock = async (username: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/blocked-new-user/${username}/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (response.status === 200) {
        setBlockedUsers((prev) => [...prev, username]);  // Add the blocked user to the list
        alert(`${username} has been blocked.`);
        await fetchPostAndMessages();  // Fetch the updated post
      }
    } catch (error) {
      console.error('Sorry, we experienced an issue blocking this user. Please try again later.');
    }
  };

  // Handle unblocking the user
  const handleUnblock = async (username: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/unblock-user/${username}/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (response.status === 200) {
        alert(`${username} has been unblocked.`);
        await fetchPostAndMessages();  // Refresh post and messages after unblocking
      }
    } catch (error) {
      console.error('Error unblocking user', error);
    }
  };

  // Report a post
  const handleReportPost = async (slug: string) => {

    // If the user is not authenticated, then render the modal
    if (!token) {
      showSignupModal();
      return;
    }

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
  
  // If the username is pressed
  const handleUsernamePress = (username: string) => {
    if (!token) {
      showSignupModal();
      return;
    }

    router.push(`/user/${username}`);
  };

  // Handles username presses
  const handleUsernamePressMessage = (username: string) => {
    if (!token) {
      showSignupModal(); // Show modal if not logged in
      return;
    }
    router.push(`/user/${username}`);
  };


  // Submit a response
  const handleSubmitResponse = async (chainId?: number) => {

    // If the user is not authenticated, then render the modal
    if (!token) {
      showSignupModal();
      return;
    }

    const text = chainId ? replyTexts[chainId] : responseText;
    if (!text.trim()) return;
  
    setPostingResponse(true);
  
    try {
      const endpoint = chainId
        ? `${API_BASE_URL}/post/${slug}/chain/${chainId}/respond/`
        : `${API_BASE_URL}/post/${slug}/respond/`;
  
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: text }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to post response');
      }
  
      // Clear the input fields after submission
      if (chainId) {
        setReplyTexts((prev) => ({ ...prev, [chainId]: '' }));
        setOpenReplyBoxes((prev) => ({ ...prev, [chainId]: false }));
      } else {
        setResponseText('');
      }
  
      // Fetch updated messages
      const messagesResponse = await fetch(`${API_BASE_URL}/post/${slug}/messages/`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (!messagesResponse.ok) {
        throw new Error('Failed to fetch updated messages');
      }
  
      const updatedMessages = await messagesResponse.json();
  
      // Ensure messagesResponse.data is an array
      const messagesData = Array.isArray(updatedMessages) ? updatedMessages : [];
  
      // Flatten the messages array and add the chain_id to each message
      const flattenedMessages = messagesData.flatMap((chain: Chain) => {
        return chain.messages.map((msg: Message) => ({
          ...msg,
          chain: chain.chain_id,
        }));
      });
  
      // Sort messages by created_at date
      setMessages(
        flattenedMessages.sort((a: Message, b: Message) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      );
    } catch (error) {
      console.error('Response Error:', error);
      Alert.alert('Error', 'Failed to post response.');
    } finally {
      setPostingResponse(false);
    }
  };

  // Group messages by chain
  const groupedMessages = messages.reduce((acc: { [chain: number]: Message[] }, message: Message) => {
    if (!acc[message.chain]) {
      acc[message.chain] = [];
    }
    acc[message.chain].push(message);
    return acc;
  }, {});

  return (
    <>
      <Head>
        <title>AxionNode.com - {post?.title}</title>
        <meta name="description" content="AxionNode - An open-source social platform" />

        {/* Open Graph tags */}
        <meta property="og:title" content={`AxionNode.com - ${post?.title}`} />
        <meta property="og:description" content={`${post?.content_snippet}`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://axionnode.com/" />
        <meta property="og:image" content={`${post?.post_photo}`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="AxionNode.com" />

        {/* Twitter Card tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`AxionNode.com - ${post?.title}`} />
        <meta name="twitter:description" content={`${post?.content_snippet}`} />
        {/* <meta name="twitter:description" content="https://axionnode.com/opengraph.png" /> */}
        <meta name="twitter:image" content={`${post?.post_photo}`} />
      </Head>

      <ScrollView
        contentContainerStyle={[
          { 
            paddingBottom: 300, 
            paddingTop: 20, 
            paddingLeft: 20, 
            paddingRight: 20, 
            flexGrow: 1, 
            alignItems: 'center' 

          },
          isDarkMode ? styles.darkContainer : styles.container,
        ]}
        ref={scrollViewRef}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchPostAndMessages} />
        }
      >
        {/* Check if the post is hidden or blocked */}
        {post.isHidden || post.isBlocked ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={[styles.title, isDarkMode && styles.titleDark]}>
              {post.isBlocked
                ? '[Blocked] This post is from a blocked user and therefore we have hidden it.'
                : '[Hidden] This post has been hidden'}
            </Text>
        
            {/* "Unhide Post" Link */}
            {post.isHidden && (
              <Text
                onPress={() => handleReShow(post.slug)}
                style={[
                  { textDecorationLine: 'underline', marginTop: 10 },
                  isDarkMode ? styles.hidePostText : styles.hidePostText,
                ]}
              >
                Unhide this post to view it
              </Text>
            )}
        
            {/* "Unblock User" Link */}
            {post.isBlocked && (
              <Text
                onPress={() => handleUnblock(post.author.username)}
                style={[
                  { textDecorationLine: 'underline', marginTop: 10 },
                  isDarkMode ? styles.hidePostText : styles.hidePostText,
                ]}
              >
                Post hidden because you have blocked this user. Click here to unblock the user to view the post.
              </Text>
            )}
          </View>
        ) : (
          <>
            {/* Modal Popup for Register and Login */}
            <Modal
              animationType="slide"
              transparent={true}
              visible={visible}
              onRequestClose={hideSignupModal} // Close the modal when back button is pressed on Android
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>

                  <View style={styles.modalHeader}>
                    <Text style={styles.modalText}>
                      You need to register and log in to perform this functionality.
                    </Text>
                    <TouchableOpacity onPress={hideSignupModal} style={styles.closeButtonModal}>
                      <Ionicons name="close" size={24} color="black" />
                    </TouchableOpacity>
                  </View>

                  {/* Register Button */}
                  <TouchableOpacity 
                    style={styles.authButton} 
                    onPress={() => {
                      hideSignupModal();
                      router.push('/register');
                    }}
                  >
                    <Text style={styles.authButtonText}>Register</Text>
                  </TouchableOpacity>

                  {/* Login Button */}
                  <TouchableOpacity 
                    style={styles.authButton} 
                    onPress={() => {
                      hideSignupModal();
                      router.push('/login');
                    }}
                  >
                    <Text style={styles.authButtonText}>Log In</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
            
            <View style={{ width: '100%', maxWidth: 1000 }}>
              <View style={styles.titleContainer}>
                <Text style={[styles.title, isDarkMode && styles.titleDark]}>{post?.title}</Text>
              </View>

              <View style={styles.authorContainer}>
                <Text style={[styles.author, isDarkMode && styles.darkText]}>By </Text>
                <TouchableOpacity onPress={() => handleUsernamePress(post.author.username)}>
                  <Text style={[styles.username, isDarkMode && styles.username]}>
                    {post.author.username}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.author, isDarkMode && styles.darkText]}>
                  {" "}in{" "}
                </Text>
                <TouchableOpacity onPress={() => handleCommunityPress(post.community.slug)}>
                  <Text style={[styles.username, isDarkMode && styles.username]}>
                    {post.community.title}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dateContainer}>
                <Text style={[styles.date, isDarkMode && styles.date]}>
                  Posted on {post && new Date(post.created_at).toLocaleString('en-CA', {
                    weekday: 'short', // "Mon"
                    year: 'numeric', // "2025"
                    month: 'short', // "Feb"
                    day: 'numeric', // "12"
                    hour: '2-digit', // "12"
                    minute: '2-digit', // "30"
                    })}
                </Text>
              </View>

              {/* Post Image -- if one exists */}
              {post?.post_photo && typeof post.post_photo === "string" && (
                <>
                  {Platform.OS === 'web' ? (
                    <View style={styles.photoContainer}>
                      <Pressable onPress={() => openWebImageModal(post.post_photo!)}>
                        <Image
                          source={{ uri: post.post_photo }}
                          // Adjust based on your average image shape (e.g., 4:3 = 1.33, 16:9 = 1.77)
                          style={{
                            width: '100%',
                            aspectRatio: 1.2,
                            resizeMode: 'cover',
                            maxHeight: 1000,
                            borderRadius: 8,
                            marginBottom: 20,
                            maxWidth: 1000,
                          }}
                        />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.photoContainer}>
                      <Pressable onPress={openImageModal}>
                        <Image
                          source={{ uri: post.post_photo }}
                          style={{
                            width: '100%',
                            maxHeight: 1000,
                            aspectRatio: 1.2, 
                            resizeMode: 'cover',
                            borderRadius: 8,
                            marginBottom: 10,
                          }}
                        />
                      </Pressable>
                    </View>
                  )}

                  {/* Web only image modal */}
                  {Platform.OS === 'web' && webImageModalVisible && selectedImageUrl && (
                    <Modal
                      animationType="fade"
                      transparent={true}
                      visible={webImageModalVisible}
                      onRequestClose={closeWebImageModal}
                    >
                      <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                          <TouchableOpacity onPress={closeWebImageModal} style={styles.closeButtonModal}>
                            <Ionicons name="close" size={28} color="black" />
                          </TouchableOpacity>

                          {selectedImageUrl && (
                            Platform.OS === 'web' ? (
                              <img
                                src={selectedImageUrl}
                                style={{
                                  maxWidth: '96%',
                                  maxHeight: '96%',
                                  objectFit: 'contain',
                                  borderRadius: 10,
                                }}
                                alt="Full Size"
                              />
                            ) : (
                              <Image
                                source={{ uri: selectedImageUrl }}
                                style={{
                                  width: '100%',
                                  maxWidth: 800,
                                  maxHeight: '80%',
                                  resizeMode: 'contain',
                                  borderRadius: 10,
                                }}
                              />
                            )
                          )}
                        </View>
                      </View>
                    </Modal>
                  )}

                  {/* Only show modal on native platforms */}
                  {Platform.OS !== 'web' && (
                    <>
                      {/* iOS: Keep existing ScrollView zoom modal */}
                      {Platform.OS === 'ios' && (
                        <Modal key={scrollKey} visible={isImageModalVisible} transparent={true}>
                          <View style={styles.modalOverlay}>
                            <TouchableOpacity
                              style={styles.closeButton}
                              onPress={closeImageModal}
                            >
                              <Ionicons name="close-circle" size={36} color="white" />
                            </TouchableOpacity>

                            <ScrollView
                              key={scrollKey} 
                              ref={scrollViewRef}
                              style={{ flex: 1 }}
                              contentContainerStyle={{
                                flexGrow: 1,
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                              maximumZoomScale={5}
                              minimumZoomScale={1}
                              showsHorizontalScrollIndicator={false}
                              showsVerticalScrollIndicator={false}
                              bouncesZoom={true}
                              centerContent={true}
                              horizontal={true}
                            >
                              <Image
                                source={{ uri: post.post_photo }}
                                style={styles.fullImage}
                                resizeMode="contain"
                                onLoad={(e) => {
                                  const { width, height } = e.nativeEvent.source;
                                  setImageDimensions({ width, height });

                                  setTimeout(() => {
                                    if (scrollViewRef.current) {
                                      const offsetX = Math.max(0, (width - windowWidth) / 2 || 0);
                                      const offsetY = Math.max(0, (height - windowHeight) / 2 || 0);

                                      scrollViewRef.current.scrollTo({
                                        x: offsetX,
                                        y: offsetY,
                                        animated: false,
                                      });
                                    }
                                  }, 100);
                                }}
                              />
                            </ScrollView>
                          </View>
                        </Modal>
                      )}

                      {/* Android: Use react-native-image-viewing */}
                      {Platform.OS === 'android' && AndroidGallery && (
                        <Modal
                        visible={isImageModalVisible}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={closeImageModal}
                      >
                        <View style={{ flex: 1, backgroundColor: 'black' }}>
                          {/* Close Button */}
                          <TouchableOpacity
                            onPress={closeImageModal}
                            style={{
                              position: 'absolute',
                              top: 40,
                              right: 20,
                              zIndex: 10,
                            }}
                          >
                            <Ionicons name="close-circle" size={36} color="white" />
                          </TouchableOpacity>
                      
                          {/* Gallery Viewer */}
                          <AndroidGallery
                            data={[post.post_photo]}
                            initialIndex={0}
                            keyExtractor={(item: string, index: number) => `${item}_${index}`}
                            renderItem={({ item }: { item: string }) => (
                              <Image
                                source={{ uri: item }}
                                style={{
                                  width: windowWidth,
                                  height: windowHeight,
                                  resizeMode: 'contain',
                                }}
                              />
                            )}
                            onSwipeToClose={closeImageModal}
                            numToRender={1}
                          />
                        </View>
                      </Modal>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Post Content */}
              {renderContent(post.content, isDarkMode)}
            
              {/* Post Voting Section */}
              <View style={styles.voteContainer}>

                {/* Upvote Button */}
                <TouchableOpacity
                  onPress={() => {
                    if (!token) {
                      showSignupModal(); // or Alert.alert("Please sign in to vote.");
                      return;
                    }
                    handleVote("upvote");
                  }}
                  style={styles.voteButton}
                >
                  <Text style={[styles.voteText, userVote === "upvote" && { color: "red" }]}>
                    {userVote === "upvote" ? "👍" : "👍🏽"}
                  </Text>
                </TouchableOpacity>

                {/* Vote Count */}
                <Text style={[styles.voteCount, isDarkMode && styles.whiteText]}>
                  {voteCount ?? post.vote_count}
                </Text>

                {/* Downvote Button */}
                <TouchableOpacity
                  onPress={() => {
                    if (!token) {
                      showSignupModal(); // Or Alert.alert("Please sign in to vote.");
                      return;
                    }
                    handleVote("downvote");
                  }}
                  style={styles.voteButton}
                >
                  <Text style={[styles.voteText, userVote === "downvote" && { color: "red" }]}>
                    {userVote === "downvote" ? "👎" : "👎🏽"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, paddingTop: 10, justifyContent: 'flex-end' }}>
                <Text
                  onPress={() => handleHide(post.slug)}
                  style={[
                    { textDecorationLine: 'underline' }, 
                    isDarkMode ? styles.hidePostText : styles.hidePostText,
                  ]}
                >
                  Hide post
                </Text>

                {user?.username && post?.author?.username !== user.username && (
                  <Text
                    onPress={() => handleBlock(post.author.username)}
                    style={[
                      { textDecorationLine: 'underline' },
                      isDarkMode ? styles.hidePostText : styles.hidePostText,
                    ]}
                  >
                    Block user
                  </Text>
                )}

                <Text
                  onPress={() => handleReportPost(post.slug)}
                  style={[
                    { textDecorationLine: 'underline' },
                    isDarkMode ? styles.hidePostText : styles.hidePostText,
                  ]}
                >
                  Report Post
                </Text>
              </View>

              <TextInput
                style={[styles.input, isDarkMode && styles.darkInput]}
                placeholder="Write a response..."
                placeholderTextColor={isDarkMode ? "#ccc" : "#666"}
                value={responseText}
                onChangeText={setResponseText}
                multiline
                maxLength={1000}
              />

              <TouchableOpacity 
                style={styles.submitButton} 
                onPress={() => handleSubmitResponse()} 
                disabled={postingResponse}
              >
                <Text style={styles.submitButtonText}>{postingResponse ? "Posting..." : "Respond"}</Text>
              </TouchableOpacity>

              {/* Show Delete and Edit Buttons if the user is the author */}
              {user?.username === post.author.username && (
                <View style={styles.buttonRow}>

                    {/* Edit Button */}
                    <TouchableOpacity 
                    style={styles.editButton} 
                    onPress={() => router.push(`/post-edit/${slug}`)}
                    >
                    <Text style={styles.buttonText}>Edit Post</Text>
                    </TouchableOpacity>

                    {/* Delete Button */}
                    <TouchableOpacity 
                    style={styles.deleteButton} 
                    onPress={handleDeletePost} 
                    disabled={deleting}
                    >
                    <Text style={styles.deleteButtonText}>
                        {deleting ? "Deleting..." : "Delete Post"}
                    </Text>
                    </TouchableOpacity>

                </View>
              )}

              {/* AdMob Ad */}
              {/* {!isExpoGo && (
                <View style={{ marginTop: 20, marginBottom: 10 }}>
                  <BannerAdWrapper />
                </View>
              )} */}
            
              {/* Chain content */}
              {Object.keys(groupedMessages).map((chainKey) => {
                const chainMessages = groupedMessages[Number(chainKey)];
                return (
                  <View key={chainKey} style={styles.chainContainer}>
                    {chainMessages.map((message, index) => (
                      <View
                        key={message.id}
                        style={[
                          styles.messageContainer,
                          index > 0 && styles.indentedMessage, // Indent replies
                          isDarkMode && styles.messageContainerDark, // Apply dark mode style if isDarkMode is true
                        ]}
                      >
                        {/* Message Username */}
                        <TouchableOpacity onPress={() => handleUsernamePressMessage(message.author.username)}>
                          <Text style={[styles.username, isDarkMode && styles.username]}>
                            {message.author.username}
                          </Text>
                        </TouchableOpacity>

                        {/* Message Edit Mode: If editing, show input field */}
                        {editingMessageId === message.id ? (
                          <TextInput
                            style={[styles.editInput, isDarkMode && styles.whiteText]}
                            value={editedContent}
                            onChangeText={setEditedContent}
                            autoFocus
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            maxLength={1000}
                          />
                        ) : (
                          <Hyperlink
                            linkStyle={{
                              color: isDarkMode ? 'white' : 'black',
                              textDecorationLine: 'underline',
                            }}
                            onPress={(url) => Linking.openURL(url)}
                          >
                            <Text
                              style={[
                                styles.messageContent,
                                isDarkMode && styles.whiteText,
                                index === 0 && styles.boldText, 
                              ]}
                            >
                              {message.content}
                            </Text>
                          </Hyperlink>
                        )}

                        {/* Message Date */}
                        <Text style={[styles.messageDate, isDarkMode && styles.messageDate]}>
                          {new Date(message.created_at).toLocaleString('en-CA', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                        
                        {/* Message Vote Buttons */}
                        <View style={styles.voteContainer}>

                          {/* Upvote Button */}
                          <TouchableOpacity
                            onPress={() => {
                              if (!token) {
                                showSignupModal(); // Prompt sign-in/signup
                                return;
                              }
                              handleMessageVote(message.id, "upvote");
                            }}
                          >
                            <Text
                              style={[
                                styles.voteButtonUp,
                                message.user_vote === "upvote" ? { color: "red" } : {},
                              ]}
                            >
                              {message.user_vote === "upvote" ? "👍" : "👍🏽"}
                            </Text>
                          </TouchableOpacity>

                          {/* Vote Count */}
                          <Text style={[styles.voteCount, isDarkMode && styles.whiteText]}>
                            {message.vote_count}
                          </Text>

                          {/* Downvote Button */}
                          <TouchableOpacity
                            onPress={() => {
                              if (!token) {
                                showSignupModal(); // Prompt unauthenticated users
                                return;
                              }
                              handleMessageVote(message.id, "downvote");
                            }}
                          >
                            <Text
                              style={[
                                styles.voteButtonDown,
                                message.user_vote === "downvote" ? { color: "red" } : {},
                              ]}
                            >
                              {message.user_vote === "downvote" ? "👎" : "👎🏽"}
                            </Text>
                          </TouchableOpacity>

                        </View>

                        {/* Message Edit & Delete Buttons - Only show if user is the author */}
                        {message.author.username === user?.username && (
                          <View style={styles.buttonContainer}>
                            {editingMessageId === message.id ? (
                              <>
                                <TouchableOpacity onPress={handleSaveEdit}>
                                  <Text style={styles.saveButton}>Save</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setEditingMessageId(null)}>
                                  <Text style={styles.cancelButton}>Cancel</Text>
                                </TouchableOpacity>
                              </>
                            ) : (
                              <>
                                <TouchableOpacity onPress={() => handleEditMessage(message)}>
                                  <Text style={styles.editButtonMessage}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteMessage(message.id)}>
                                  <Text style={styles.deleteButtonMessage}>Delete</Text>
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    ))}

                    <TouchableOpacity 
                      onPress={() => {
                        if (!token) {
                          showSignupModal(); // or show a toast / alert if you prefer
                          return;
                        }
                        setOpenReplyBoxes(prev => ({ ...prev, [Number(chainKey)]: !prev[Number(chainKey)] }));
                      }}
                    >
                      <Text style={styles.replyButton}>Reply to thread</Text>
                    </TouchableOpacity>

                    {openReplyBoxes[Number(chainKey)] && (
                      <>
                        <TextInput
                          style={[styles.inputChainReply, isDarkMode && styles.darkInput]}
                          placeholder="Write a reply..."
                          placeholderTextColor={isDarkMode ? "#ccc" : "#666"}
                          value={replyTexts[Number(chainKey)] || ''}
                          onChangeText={(text) => setReplyTexts(prev => ({ ...prev, [Number(chainKey)]: text }))}
                          multiline
                          maxLength={1000}
                        />
                        <TouchableOpacity 
                          style={styles.submitButtonChainReply} 
                          onPress={() => handleSubmitResponse(Number(chainKey))} 
                          disabled={postingResponse}
                        >
                          <Text style={styles.submitButtonText}>Reply</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: { 
    padding: 16, 
    backgroundColor: '#fff', 
  },
  darkContainer: { 
    backgroundColor: '#121212', 
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 10, 
    marginTop: 10,
    color: '#000',
  },
  titleDark: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 10, 
    color: '#FFF',
  },
  whiteText: { color: 'white' },
  input: { 
    backgroundColor: '#f5f5f5', 
    padding: 10, 
    borderRadius: 8, 
    marginBottom: 10, 
    marginTop: 20 
  },
  inputChainReply: { 
    backgroundColor: '#f5f5f5', 
    padding: 10, 
    borderRadius: 8, 
    marginBottom: 10, 
    marginTop: 5, 
    marginLeft: 25,
  },
  buttonContainer: { 
    flexDirection: 'row', 
    justifyContent: 'flex-start', 
    alignItems: 'center', 
    marginTop: 10,
  },
  darkInput: { backgroundColor: '#222', color: 'white' },
  submitButton: { 
    backgroundColor: '#4C37FF', 
    padding: 10, 
    borderRadius: 8,
  },
  submitButtonChainReply: { 
    backgroundColor: '#4C37FF', 
    padding: 10, 
    borderRadius: 8,
    marginLeft: 25,
  },
  submitButtonText: { color: 'white', textAlign: 'center' },
  voteContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  voteButton: { padding: 10 },
  voteButtonUp: { padding: 10 },
  voteButtonDown: { padding: 10 },
  voteText: { fontSize: 18 },
  voteCount: { fontSize: 16, marginHorizontal: 10 },
  chainTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, color: '#f00' },
  messageContainer: { 
    padding: 10, 
    borderBottomWidth: 1, 
    borderColor: '#ddd'
  },
  messageContainerDark: { 
    padding: 10, 
    borderBottomWidth: 1, 
    borderColor: '#282828'
  },
  messageAuthor: { fontWeight: 'bold' },
  messageContent: { marginTop: 5 },
  errorText: { fontSize: 16, color: 'red', textAlign: 'center', marginTop: 20 }, // Add this
  authorContainer: { 
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  author: { fontSize: 14, color: '#666' }, 
  date: { fontSize: 12, color: '#999', marginBottom: 18 }, // ✅ Missing date style
  postImage: { width: '100%', height: 200, borderRadius: 10, marginVertical: 10 }, // ✅ Image style
  content: { fontSize: 16, marginVertical: 0, color: '#000' }, // ✅ Post content style
  chainLabel: { fontSize: 16, fontWeight: 'bold', marginVertical: 5, color: '#444' }, // ✅ Chain label style
  // Add these styles
  chainContainer: { 
    marginTop: 20, 
  }, // Style for grouping chains
  darkText: {
    color: '#b8c5c9',
  },
  username: {
    color: '#2196f3',  // Make the username blue and clickable
    marginTop: 0,
  },
  replyButton: {
    // backgroundColor: "#007bff", // Blue button
    padding: 8,
    borderRadius: 8,
    marginTop: 5,
    marginLeft: 20,
    alignItems: "center",
    alignContent: "center", 
    maxWidth: 200,
    color: "#4C37FF",
  },
  replyButtonText: {
    color: "red",
    fontWeight: "bold",
  },
  deleteButton: {
    marginTop: 0,
    padding: 10,
    backgroundColor: 'grey',
    borderRadius: 8,
    alignItems: 'center',
    maxWidth: 100,
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  editButton: {
    marginTop: 0,
    padding: 10,
    backgroundColor: 'grey',
    borderRadius: 8,
    alignItems: 'center',
    maxWidth: 100,
    marginRight: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  darkPostContainer: {
    borderBottomColor: '#444',
  },
  messageDate: {
    color: 'grey',
    marginTop: 10,
  },
  indentedMessage: {
    marginLeft: 20, // Indent replies
  },
  boldText: {
    fontWeight: "bold", // Bold first message
  },
  editButtonMessage: {
    color: "grey",
    marginRight: 10,
    fontSize: 10,
  },
  deleteButtonMessage: {
    color: "grey",
    fontSize: 10,
  },
  saveButton: {
    color: "green",
    marginRight: 10,
  },
  cancelButton: {
    color: "gray",
  },
  editInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 5,
    borderRadius: 8,
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
  youtubeContainer: {
    marginVertical: -20,
    padding: 0,
    margin: 0,
  },
  iframe: {
    marginVertical: 0,
    padding: 0,
    marginTop: -4,
    marginBottom: 0,
    maxWidth: 1000,
  },
  hidePostText: {
    color: 'grey',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  }, 
  fullImage: {
    width: '90%',
    height: '70%',
    resizeMode: 'contain',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  closeButtonModal: {
    padding: 8,
  },
  titleContainer: {
  },
  dateContainer: {
  },
  photoContainer: {
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    position: 'relative',
    maxWidth: '90%',
    maxHeight: '90%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingRight: 10, // space between text and the X
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },
  authButton: {
    backgroundColor: '#4C37FF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 5,
    width: '100%',
    alignItems: 'center',
  },
  authButtonText: {
    color: 'white',
    fontSize: 16,
  },
});

export default PostDetailScreen;