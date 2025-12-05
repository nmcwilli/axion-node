import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, View, Text, FlatList, StyleSheet, Button, TouchableOpacity, Alert, Pressable, Platform, RefreshControl, Image, Linking } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/auth';
import { useTheme } from '../../context/ThemeContext';
import { FontAwesome } from '@expo/vector-icons';
import { jwtDecode } from "jwt-decode";
import YoutubePlayer from 'react-native-youtube-iframe';
import WebView from 'react-native-webview'; // For native platforms
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import Hyperlink from 'react-native-hyperlink';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { BannerAdWrapper } from '../../../components/bannerAd';
// import { logEvent } from '../../../components/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

interface Post {
  id: number;
  title: string;
  content_snippet: string; 
  created_at: string;
  vote_count: number;
  slug: string;
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

interface Community {
  title: string;
  description: string;
  slug: string;
  status: string;
  follower_count: number;
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

export default function ViewCommunityScreen() {
  const { token, refreshAccessToken } = useAuth();
  const { user } = useAuth();
  const { slug } = useLocalSearchParams(); // Get the slug from the URL
  const { theme } = useTheme(); // Access the theme from the context
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [following, setFollowing] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false); // New refreshing state
  const [showDetails, setShowDetails] = useState<boolean>(false); // State to toggle the visibility of the title and description
  const router = useRouter(); // Initialize the router for navigation

  // Try to grab the username information
  const [profileData, setProfileData] = useState({
    username: user?.username || 'Guest', // fallback username if not logged in
  });

  // Hidden and Blocked posts states 
  const [hiddenPosts, setHiddenPosts] = useState<string[]>([]); // Track hidden post slugs
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);  // Ensure it's an array of strings

  // Update scrollbars 
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem('preferred_theme');

      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    };

    loadTheme();
  }, []);

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //   logEvent('screen_view', { screen_name: 'ViewCommunityScreen' });
  // }, []);

  // Automatically refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        setLoading(true);
        if (!token) return;
  
        const tokenExpired = checkTokenExpiration(token);
        if (tokenExpired) {
          console.log('Token expired. Refreshing...');
          const refreshedToken = await refreshAccessToken();
          await refreshPosts();
        } else {
          await refreshPosts();
        }
  
        setLoading(false);
      };
  
      fetchData();
    }, [token, slug]) // 👈 Add slug here
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

  // Run again when screen refocuses
  useFocusEffect(
    useCallback(() => {
      fetchCommunityDetails();
    }, [slug, token])
  );

  // Run on mount
  useEffect(() => {
    fetchCommunityDetails();
  }, [slug, token]);

  // useEffect(() => {
  //   const fetchCommunityDetails = async () => {
  //     try {
  //       const [communityRes, followRes, hiddenPostsRes, blockedUsersRes] = await Promise.all([
  //         fetch(`${API_BASE_URL}/communities/${slug}/`, {
  //           headers: { Authorization: `Bearer ${token}` },
  //         }),
  //         fetch(`${API_BASE_URL}/communities/${slug}/follow-status/`, {
  //           headers: { Authorization: `Bearer ${token}` },
  //         }),
  //         fetch(`${API_BASE_URL}/user-hidden-posts/`, {
  //           headers: { Authorization: `Bearer ${token}` },
  //         }),
  //         fetch(`${API_BASE_URL}/user-blocked-users/`, {
  //           headers: { Authorization: `Bearer ${token}` },
  //         }),
  //       ]);
    
  //       // Check if any of the responses failed
  //       if (!communityRes.ok || !followRes.ok || !hiddenPostsRes.ok || !blockedUsersRes.ok) {
  //         throw new Error("Failed to fetch one or more resources.");
  //       }
    
  //       // Parse responses once and store them in variables
  //       const communityDataRaw = await communityRes.json();
  //       const followData = await followRes.json();
  //       const hiddenPostsData: Array<string | HiddenPost> = await hiddenPostsRes.json();
  //       const blockedUsersData: Array<string> = await blockedUsersRes.json();
    
  //       // Extract necessary data from the responses
  //       const communityData = communityDataRaw.community;
  //       const postsData = Array.isArray(communityDataRaw.posts) ? communityDataRaw.posts : [];
    
  //       // If community is not approved, show an alert and redirect
  //       if (communityData.status !== 'approved') {
  //         Alert.alert('Not Approved', 'This community has not been approved yet.');
  //         router.push('/');
  //         return;
  //       }
    
  //       // Process hidden and blocked posts data
  //       const hiddenPostSlugs = hiddenPostsData.map(post =>
  //         typeof post === 'string' ? post : post.slug
  //       );
    
  //       const blockedUsers = blockedUsersData.map(username => username.trim().toLowerCase());
    
  //       // Filter posts based on visibility and user blocking status
  //       const filteredPosts = postsData.map((post: Post) => ({
  //         ...post,
  //         isHidden: hiddenPostSlugs.includes(post.slug),
  //         isBlocked: blockedUsers.includes(post.author.username.trim().toLowerCase()),
  //       }));
    
  //       // Update state
  //       setCommunity(communityData);
  //       setPosts(filteredPosts);
  //       setFollowing(followData.following);
  //     } catch (error) {
  //       console.log("Error fetching community details. Please try again later.");
  //     } finally {
  //       setLoading(false);
  //     }
  //   };
  
  //   fetchCommunityDetails();
  // }, [slug, token]);

  // Fetch community details (outside of useEffect)
  const fetchCommunityDetails = async () => {
    try {
      const [communityRes, followRes, hiddenPostsRes, blockedUsersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/communities/${slug}/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/communities/${slug}/follow-status/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/user-hidden-posts/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/user-blocked-users/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
  
      if (!communityRes.ok || !followRes.ok || !hiddenPostsRes.ok || !blockedUsersRes.ok) {
        throw new Error("Failed to fetch one or more resources.");
      }
  
      const communityDataRaw = await communityRes.json();
      const followData = await followRes.json();
      const hiddenPostsData: Array<string | HiddenPost> = await hiddenPostsRes.json();
      const blockedUsersData: Array<string> = await blockedUsersRes.json();
  
      const communityData = communityDataRaw.community;
      const postsData = Array.isArray(communityDataRaw.posts) ? communityDataRaw.posts : [];
  
      if (communityData.status !== 'approved') {
        Alert.alert('Not Approved', 'This community has not been approved yet.');
        router.push('/');
        return;
      }
  
      const hiddenPostSlugs = hiddenPostsData.map(post =>
        typeof post === 'string' ? post : post.slug
      );
  
      const blockedUsers = blockedUsersData.map(username => username.trim().toLowerCase());
  
      const filteredPosts = postsData.map((post: Post) => ({
        ...post,
        isHidden: hiddenPostSlugs.includes(post.slug),
        isBlocked: blockedUsers.includes(post.author.username.trim().toLowerCase()),
      }));
  
      setCommunity(communityData);
      setPosts(filteredPosts);
      setFollowing(followData.following);
    } catch (error) {
      console.log("Error fetching community details. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Hide a Post 
  const handleHide = async (postSlug: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/post/${postSlug}/hide/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
  
      if (!response.ok) throw new Error('Failed to hide post.');
  
      setHiddenPosts((prev) => [...prev, postSlug]);
      await fetchCommunityDetails();
    } catch (error) {
      console.log('Sorry, we experienced an issue hiding this post. Please try again later.');
    }
  };

  // Handles blocking of users 
  const handleBlock = async (username: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/blocked-new-user/${username}/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
  
      if (response.ok) {
        setBlockedUsers((prev) => [...prev, username]);
        alert(`${username} has been blocked.`);
        console.log(`${username} has been blocked.`);
        await fetchCommunityDetails();
      } else {
        throw new Error('Block request failed');
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
        headers: { Authorization: `Bearer ${token}` },
      });
  
      if (response.ok) {
        alert(`${username} has been unblocked.`);
        await fetchCommunityDetails();
      } else {
        throw new Error('Unblock request failed');
      }
    } catch (error) {
      console.error('Error unblocking user', error);
    }
  };
  
  // Re-Show the Post
  const handleReShow = async (postSlug: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/post/${postSlug}/show/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
  
      if (!response.ok) throw new Error('Failed to re-show post.');
  
      setHiddenPosts((prev) => prev.filter((hiddenSlug) => hiddenSlug !== postSlug));
      await fetchCommunityDetails();
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

  // Follow a Community 
  const handleFollow = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/communities/${slug}/follow/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
  
      if (!response.ok) throw new Error('Follow request failed');
  
      setFollowing(true);
      Alert.alert("Success", "You are now following this community.");
    } catch (error) {
      Alert.alert("Error", "Failed to follow community.");
    }
  };
  
  // Unfollow a Community 
  const handleUnfollow = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/communities/${slug}/unfollow/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
  
      if (!response.ok) throw new Error('Unfollow request failed');
  
      setFollowing(false);
      Alert.alert("Success", "You have unfollowed this community.");
    } catch (error) {
      Alert.alert("Error", "Failed to unfollow community.");
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
              width="90%"
              height="400"
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

  const toggleDetails = () => {
    setShowDetails((prev) => !prev); // Toggle visibility
  };

  const navigateToPostDetail = (postSlug: string) => {
    // Navigate to the post details page using the slug
    router.push(`/post/${postSlug}`);  // Directly include the slug in the URL path
  };

  const isDarkMode = theme === 'dark';

  // Function to handle refreshing the posts
  const refreshPosts = async () => {
    setRefreshing(true); // Trigger pull-to-refresh
    try {
      const response = await fetch(`${API_BASE_URL}/communities/${slug}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      if (!response.ok) throw new Error('Failed to fetch posts');
  
      const data = await response.json();
      setPosts(data.posts);
    } catch (error) {
      console.log("Error", "Failed to refresh posts");
    } finally {
      setRefreshing(false); // Reset refreshing state
    }
  };

  const handleUsernamePress = (username: string) => {
    router.push(`/user/${username}`); // Navigate to the user's profile page
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#1c1c1c' : '#fff' }]}>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 1200, flex: 1 }}>
          {loading ? (
            <Text style={[styles.loadingText, { color: isDarkMode ? '#fff' : '#000' }]}>Loading...</Text>
          ) : community ? (
            <FlatList
              data={posts}
              keyExtractor={(item) => item.id.toString()}
              ListHeaderComponent={
                <View style={styles.centeredContainer}>
                  <View style={[styles.titleContainer, { flexDirection: 'row', alignItems: 'center' }]}>
                    <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>{community.title}</Text>
                    <Text style={[styles.followerCount, { color: isDarkMode ? 'white' : 'black' }]}>
                      {community.follower_count} followers
                    </Text>
                  </View>

                  <View style={styles.buttonContainerToggle}>
                    <TouchableOpacity onPress={toggleDetails} style={styles.buttonContainerToggle}>
                      <Text style={styles.toggleText}>
                        {showDetails ? "Hide Description" : "Show Description"}
                      </Text>
                      <FontAwesome
                        name={showDetails ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={theme === 'dark' ? 'white' : 'black'}
                        style={styles.icon}
                      />
                    </TouchableOpacity>
                  </View>

                  {showDetails && (
                    <Text style={[styles.description, { color: isDarkMode ? '#ddd' : '#333' }]}>{community.description}</Text>
                  )}

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[styles.buttonStyle, isDarkMode && styles.darkButtonStyle]}
                      onPress={following ? handleUnfollow : handleFollow}
                    >
                      <Text style={styles.buttonText}>{following ? 'Unfollow' : 'Follow'}</Text>
                    </TouchableOpacity>
                  </View>

                  {posts.length === 0 && (
                    <Text style={[styles.noPostsText, { color: isDarkMode ? '#aaa' : 'gray', textAlign: 'center', marginTop: 20 }]}>
                      No posts are currently in this community. Be the first!
                    </Text>
                  )}
                </View>
              }
              renderItem={({ item }) =>
                posts.length === 0 ? null : (
                  <View
                    style={[
                      styles.postItem,
                      { borderBottomColor: isDarkMode ? '#555' : '#ddd', paddingTop: 30, paddingBottom: 30 },
                    ]}
                  >
                    {item.isBlocked ? (
                      <View style={{ paddingTop: 20, paddingBottom: 20 }}>
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
                          <Text onPress={() => router.push(`/post/${item.slug}`)} style={[styles.postTitle, { color: isDarkMode ? '#fff' : '#000' }]}>{item.title}</Text>

                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                            <Text style={[styles.postMeta, isDarkMode && styles.darkText]}>
                              By{' '}
                            </Text>
                            <TouchableOpacity onPress={() => handleUsernamePress(item.author.username)}>
                              <Text style={[styles.bluePostMetaAuthor, isDarkMode && styles.bluePostMetaAuthor]}>
                                {item.author.username}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* <Text style={[styles.postDate, { color: isDarkMode ? '#bbb' : 'gray' }]}>{new Date(item.created_at).toLocaleString()}</Text> */}
                          <Text style={[styles.postDate, isDarkMode && styles.postDate]}>
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
                                      width: '90%',
                                      aspectRatio: 1.2, // Adjust based on your average image shape (e.g., 4:3 = 1.33, 16:9 = 1.77)
                                      resizeMode: 'cover',
                                      maxHeight: 700,
                                      borderRadius: 8,
                                      marginBottom: 20,
                                      maxWidth: 1200,
                                    }}
                                  />
                                </Pressable>
                              ) : (
                                <Pressable onPress={() => router.push(`/post/${item.slug}`)}>
                                  <Image
                                    source={{ uri: item.post_photo }}
                                    style={{
                                      width: '90%',
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

                          {/* Render the Content */}
                          <ContentRenderer content={item.content_snippet} isDarkMode={isDarkMode} />

                          <Text 
                            onPress={() => router.push(`/post/${item.slug}`)}
                            style={[
                              { textDecorationLine: 'underline' }, // Underline the text
                              isDarkMode ? styles.readMoreTextDark : styles.readMoreTextLight
                            ]}
                          >
                            Read More
                          </Text>

                          {/* ✅ Display Current Post Score */}
                          <Text style={[styles.postScoreGrey, isDarkMode && styles.postScoreGrey]}>
                          👍 {item.vote_count}
                          </Text>

                          <View style={{ flexDirection: 'row', gap: 10, paddingTop: 10, paddingRight:10, justifyContent: 'flex-end' }}>
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
                )
              }
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refreshPosts} />
              }
              contentContainerStyle={{ paddingBottom: 80 }}
            />
          ) : (
            <Text style={styles.errorText}>Community Loading ...</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  description: { fontSize: 14, marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 20 },
  noPostsText: { fontSize: 16, fontStyle: 'italic', color: 'gray' },
  postItem: { 
    paddingLeft: 0, 
    paddingRight: 0, 
    paddingTop: 20, 
    paddingBottom: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#ddd' 
  },
  centeredContainer: {
    width: '98%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 0, // Optional: add some padding for smaller screens
  },
  postTitle: { 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  postTitleDark: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#eef1f3',
  },
  postContent: { 
    fontSize: 16,
    marginTop: 6, 
  },
  postDate: { fontSize: 14, color: 'gray', paddingBottom: 10, },
  loadingText: { textAlign: 'center', fontSize: 18, marginTop: 50 },
  errorText: { textAlign: 'center', fontSize: 18, marginTop: 50, color: '#4C37FF' },
  followerCount: {
    color: 'grey',
    paddingBottom: 10,
    paddingRight: 10,
  },
  buttonContainer: {
    width: '60%',
    maxWidth: 200, 
    marginVertical: 10,
  },
  buttonContainerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  toggleText: {
    fontSize: 14,
    marginRight: 10, // Space between text and icon
    marginTop:-30,
    color:"grey"
  },
  icon: {
    marginTop: -30,
    marginLeft: 5,
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
  darkText: {
    color: 'white',
  },
  postMeta: {
    fontSize: 14,
    color: '#777',
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
    marginBottom: 3,
  },
  readMoreButton: {
    backgroundColor: "#F00",
    padding: 10,
    borderRadius: 8,
    marginBottom: 5,
    marginTop: 12,
    width: 100,
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
  hidePostText: {
    color: 'grey',
  }, 
  content: { 
    fontSize: 16, 
    marginVertical: 0, 
    color: '#000' 
  }, // ✅ Post content style
  youtubeContainer: {
    marginVertical: -20,
    padding: 0,
    margin: 0,
  },
  iframe: {
    marginVertical: 0,
    padding: 0,
    marginTop: 0,
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // You can adjust space if needed
  },
});