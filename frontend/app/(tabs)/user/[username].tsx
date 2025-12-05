import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, View, Text, Image, Button, FlatList, Platform, ActivityIndicator, StyleSheet, Pressable, RefreshControl, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/auth';
import { useTheme } from '../../context/ThemeContext';
import { jwtDecode } from "jwt-decode";
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import Hyperlink from 'react-native-hyperlink';
import YoutubePlayer from 'react-native-youtube-iframe';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { BannerAdWrapper } from '../../../components/bannerAd';
// import { logEvent } from '../../../components/analytics';

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

// type UserProfile = {
//   username: string;
//   profile_photo: string | null;
// };

type Post = {
  id: number;
  title: string;
  content_snippet: string; 
  created_at: string;
  slug: string; // Added slug for navigation
  post_photo?: string | null;
  community: {
    status: string;  // Add the approved status here
  };
};

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

// Regex patterns
const imgurRegex = /(https?:\/\/i\.imgur\.com\/\w+\.(mp4|png|jpg|gif))/g;
const youtubeRegex = /(https?:\/\/(www\.)?youtube\.com\/watch\?v=|https?:\/\/youtu\.be\/)([\w-]+)/g;

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams();
  const { token, refreshAccessToken, user } = useAuth();
  const { theme } = useTheme();
  // const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { userProfile, setUserProfile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // New error state
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false); // New refreshing state

  const isDarkMode = theme === 'dark';

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //   logEvent('screen_view', { screen_name: 'UserProfileScreen' });
  // }, []);

  // Fetches the users profile details
  const fetchUserProfile = async () => {
    if (!token || !username) return;
  
    setRefreshing(true); // Start refreshing
    try {
      const response = await fetch(`${API_BASE_URL}/user/${username}/`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (!response.ok) {
        throw new Error('Failed to fetch user profile.');
      }
  
      const data = await response.json();
      setUserProfile(data);
  
      // Filter out posts from unapproved communities
      const filteredPosts = data.posts.filter(
        (post: Post) => post.community.status === 'approved'
      );
  
      setPosts(filteredPosts);  // Set only approved posts
    } catch (error: any) {
      if (error.message === 'Failed to fetch user profile.') {
        console.log("User not found. Fetching authenticated user's profile...");
  
        try {
          const authResponse = await fetch(`${API_BASE_URL}/auth/me/`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
  
          if (!authResponse.ok) {
            throw new Error('Failed to fetch authenticated user.');
          }
  
          const authData = await authResponse.json();
          console.log("Redirecting to authenticated user's profile:", authData.username);
          router.replace(`/user/${authData.username}`);
        } catch (authError) {
          console.log("Error fetching authenticated user:", authError);
          setError('User not found, and could not fetch authenticated user.');
        }
      } else {
        setError('Failed to load user profile. Please try again later.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false); // Stop refreshing
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
              height="250"
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
            fontSize: 16, // ← Add this line
          }}
          onPress={(url) => Linking.openURL(url)}
        >
          <View>
            <Text style={[styles.content, isDarkMode && styles.darkText]}>
              {part}
            </Text>
          </View>
        </Hyperlink>
      );
    });
  };

  // Link replacer 
  const replaceLinksWithPlaceholder = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const links = text.match(urlRegex) || [];
  
    return text.split(urlRegex).map((part, index) => {
      if (urlRegex.test(part)) {
        let color = "grey";
        let placeholder = "🔗 Link";
  
        if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(part)) {
          color = "grey";
          placeholder = "📹 Video link";
        } else if (/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(part)) {
          color = "grey";
          placeholder = "🖼️ Image link";
        } else if (/\.(mp4|mov|avi|wmv|flv|mkv)$/i.test(part)) {
          color = "grey";
          placeholder = "📹 Video link";
        }
  
        return (
          <Text key={index} style={{ color }}>
            {placeholder}
          </Text>
        );
      }
      return part;
    }).concat(links.length > 1 ? " ..." : "");
  };

  // Fetch user profile on initial load 
  useEffect(() => {
    setUserProfile(null); // Reset user profile
    setPosts([]); // Reset posts
    setLoading(true);
    fetchUserProfile();
  }, [username, token]);

  // Reload on focus 
  useFocusEffect(
    useCallback(() => {
      setUserProfile(null); // Ensure previous data is wiped
      fetchUserProfile();
    }, [username])
  );

  // Refresh expired token when applicable
  useFocusEffect(
    useCallback(() => {
      const checkAndRefreshToken = async () => {
        if (!token) return;
  
        const tokenExpired = checkTokenExpiration(token);
        if (tokenExpired) {
          console.log("Token expired. Refreshing...");
          await refreshAccessToken(); // Ensure the refresh completes before fetching profile
        }
  
        fetchUserProfile();
      };
  
      checkAndRefreshToken();
    }, [username, token])
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

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={styles.container}>
        <Text style={[styles.errorText, theme === 'dark' && styles.darkText]}>Loading ...</Text>
      </View>
    );
  }

  // Return the profile content for the user
  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id.toString()}
      ListHeaderComponent={
        <View
          style={{
            width: '100%',
            maxWidth: 1000,
            alignSelf: 'center',
            paddingTop: 20,
          }}
        >
          <Image
            source={{ uri: userProfile.profile_photo || 'https://axionnode.com/profile_icon.png' }}
            style={styles.profilePhoto}
          />
          <Text style={[styles.username, theme === 'dark' && styles.darkText]}>
            {userProfile.username}
          </Text>

          {/* Optional AdMob Banner */}
          {/* {!isExpoGo && <BannerAdWrapper />} */}
        </View>
      }
      contentContainerStyle={[
        {
          flexGrow: 1, // Ensures full height even with few items
          paddingBottom: 300,
          paddingHorizontal: 20,
          // alignItems: 'center', // Center all items
        },
        !isDarkMode && styles.container, // 👈 apply only in light mode
        isDarkMode && styles.darkContainer, // 👈 apply only in dark mode
      ]}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/post/${item.slug}`)}
          style={[
            styles.postContainer,
            theme === 'dark' && styles.darkPostContainer,
            {
              width: '100%',
              maxWidth: 1000,
              alignSelf: 'center',
              paddingTop: 30,
              paddingBottom: 30,
            },
          ]}
        >
          <Text style={[styles.postTitle, theme === 'dark' && styles.postTitleDark]}>
            {item.title}
          </Text>

          <Text style={[styles.postDate, theme === 'dark' && styles.postDate]}>
            {new Date(item.created_at).toLocaleString('en-CA', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>

          {/* Post Image */}
          {item?.post_photo && (
            <Pressable onPress={() => router.push(`/post/${item.slug}`)}>
              <Image
                source={{ uri: item.post_photo }}
                style={
                  Platform.OS === 'web'
                    ? styles.fullWidthMedia
                    : {
                        width: '100%',
                        aspectRatio: 1.2, // Adjust based on your average image shape (e.g., 4:3 = 1.33, 16:9 = 1.77)
                        resizeMode: 'cover',
                        maxHeight: 700,
                        maxWidth: 1000,
                        borderRadius: 8,
                        marginBottom: 20,
                      }
                }
              />
            </Pressable>
          )}

          {/* Content snippet */}
          <View style={{ marginTop: 10 }}>
            <ContentRenderer content={item.content_snippet} isDarkMode={isDarkMode} />
          </View>

          <Text
            onPress={() => router.push(`/post/${item.slug}`)}
            style={[
              { textDecorationLine: 'underline' },
              isDarkMode ? styles.readMoreTextDark : styles.readMoreTextLight,
            ]}
          >
            Read More
          </Text>
        </Pressable>
      )}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={fetchUserProfile}
          colors={['#2196f3']}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFF', 
    borderRadius: 8,
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  containerUnAuth: {
    flex: 1,                    
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
    backgroundColor: '#FFFFFF', 
  },
  profilePhoto: {
    width: 100,
    alignItems: 'center', 
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  username: {
    fontSize: 22,
    alignItems: 'center', 
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  postContainer: {
    width: '100%',
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  postContainerDark: {
    width: '100%',
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#444', // Adjust color based on theme
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
  postContent: {
    fontSize: 14,
    marginVertical: 5,
    marginTop: 10,
  },
  postDate: {
    marginTop: 4,
    paddingBottom:10,
    fontSize: 12,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: '#4C37FF',
  },
  darkText: {
    color: '#b8c5c9',
  },
  buttonContainer: {
    width: '60%',
    marginVertical: 10,
  }, 
  button: {
    backgroundColor: '#2196f3',
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
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
  title: {
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 10, 
    textAlign: 'center',       
    color: '#000', // Default light mode text color
  },
  item: {
    fontSize: 18, 
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 0,
    paddingRight: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    color: '#000', // Default text color
  },
  readMoreButton: {
    backgroundColor: "#F00",
    padding: 10,
    borderRadius: 8,
    marginBottom: 5,
    marginTop: 12,
    width: 100,
    color: '#FFF',
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
  iframe: {
    marginVertical: 0,
    padding: 0,
    marginTop: 4,
    marginBottom: -10,
    maxWidth: 1000,
  },
  fullWidthMedia: {
    width: "100%", // Full width
    aspectRatio: 1.2, // Adjust dynamically
    resizeMode: "cover", // Ensures full image is visible
    maxHeight: 700, 
    maxWidth: 1000,
    borderRadius: 8,
  },
  youtubeContainer: {
    width: '100%', 
    maxWidth: 1000,
    marginVertical: -20,
    padding: 0,
  },
  content: { fontSize: 16, marginVertical: 0, color: '#000' }, // ✅ Post content style
});