import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useWindowDimensions, Image, ScrollView, View, Text, FlatList, TouchableOpacity, Button, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/auth';
import { useTheme } from '../context/ThemeContext';
import { useFocusEffect } from 'expo-router';
// import { jwtDecode } from "jwt-decode";
import { Ionicons } from '@expo/vector-icons';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { BannerAdWrapper } from '../../components/bannerAd';
// import { logEvent } from '../../components/analytics';

// Are we running in Expo GO? If so, don't use AdMob: 
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

interface Community {
  id: number;
  title: string;
  description: string;
  slug: string; 
  status: string;
  follower_count: number;
}

export default function CommunityScreen() {
  const { token, refreshAccessToken } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState<boolean>(true);  // Track loading state
  const router = useRouter();
  const { theme } = useTheme();

  const isDarkMode = theme === 'dark';

  const { width } = useWindowDimensions();
  const isWideScreen = Platform.OS === 'web' && width > 600; // Adjust threshold as needed

  // Scrolling functionality const
  const flatListRef = useRef<FlatList>(null);

  // Redirect to index page if not logged in and no token
  useFocusEffect(
    useCallback(() => {
      if (!token) {
        router.replace('/login'); // Redirects to root
      }
    }, [token])
  );

  // Scroll to the top of the page on first focus
  // useFocusEffect(
  //   useCallback(() => {
  //     if (communities.length > 0) {
  //       flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  //     }
  //   }, [communities])
  // );

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //   logEvent('screen_view', { screen_name: 'CommunityScreen' });
  // }, []);

  // Fetch the communities 
  const fetchCommunities = async () => {
    if (!token) return;
  
    try {
      const response = await fetch(`${API_BASE_URL}/communities/`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.log('Error', `Failed to load communities: ${errorData?.detail || response.statusText}`);
        return;
      }
  
      const data = await response.json();
  
      // Filter and sort the communities
      const approvedCommunities = data
        .filter((community: Community) => community.status === 'approved')
        .sort((a: Community, b: Community) => a.title.localeCompare(b.title));
  
      setCommunities(approvedCommunities);
    } catch (error) {
      console.log('Error', 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Automatically refresh when screen comes into focus
  useEffect(() => {
    if (!token) return;
    setLoading(true); // Start loading when the component is mounted
    fetchCommunities();  // Fetch the communities initially
  }, [token]);

  // Automatically refresh when screen comes into focus
  // useFocusEffect(
  //   useCallback(() => {
  //     const fetchData = async () => {
  //       setLoading(true); // Start loading when navigating to this screen
  
  //       if (!token) return;
  
  //       const tokenExpired = checkTokenExpiration(token);
  //       if (tokenExpired) {
  //         console.log('Token expired. Refreshing...');
  //         const refreshedToken = await refreshAccessToken();
  //         await fetchCommunities();
  //       } else {
  //         await fetchCommunities();
  //       }
  
  //       setLoading(false); // Stop loading after data fetch
  //     };
  
  //     fetchData();
  //   }, [token])
  // );

  // Automatically refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setLoading(true);  // Start loading again when navigating to this screen
      fetchCommunities();  // Fetch communities when the screen is focused
    }, [token]) // Ensure fetchCommunities runs only when the token changes
  );

  const handleAddCommunity = () => {
    router.push('/add-community');  // Redirect to a screen for adding a new community
  };

  if (!token) {
    // Removed to simplify code - Previously rendered login and register buttons here
  }

  // Now only rendering community page content after signed in and have token
  return (
    <View style={[styles.container, theme === 'dark' && styles.darkContainer]}>
      <FlatList
        ref={flatListRef}
        data={communities}
        keyExtractor={(item) => item.slug}
        ListHeaderComponent={
          <View style={styles.innerContainer}>
            <Text style={[styles.title, theme === 'dark' && styles.darkTextTitle]}>
              Communities
            </Text>

            {loading ? (
              <Text style={[styles.loadingText, theme === 'dark' && styles.darkText]}>
                Loading...{'\n'}{'\n'}
              </Text>
            ) : communities.length === 0 ? (
              <Text style={[styles.noCommunitiesText, theme === 'dark' && styles.darkText]}>
                There are currently no communities that exist.
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/community/${item.slug}`)}>
            <View style={styles.innerContainer}>
              <View style={styles.communityItem}>
                <Text style={[styles.itemTitle, theme === 'dark' && styles.darkItemTitle]}>
                  {item.title}
                </Text>
                <Text style={[styles.description, theme === 'dark' && styles.darkText]}>
                  {item.description.length > 200
                    ? item.description.slice(0, 200) + '...'
                    : item.description}
                </Text>
                <Text style={[styles.followersStyle, theme === 'dark' && styles.darkText]}>
                  Followers: {item.follower_count}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <View style={[styles.innerContainer, { marginTop: 24 }]}>
            <TouchableOpacity
              style={[styles.buttonStyle, isDarkMode && styles.darkButtonStyle]}
              onPress={handleAddCommunity}
            >
              <Text style={styles.buttonText}>Add New Community</Text>
            </TouchableOpacity>

            {/* AdMob Banner */}
            {/* {!isExpoGo && <BannerAdWrapper />} */}
          </View>
        }
        contentContainerStyle={styles.scrollContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    width: '100%',
    backgroundColor: '#FFF',
    // Add these:
    overflow: 'hidden',  // prevent accidental overflow
    // maxWidth: '100vw',   // on web, limit width to viewport width
  },
  innerContainer: {
    width: '100%',
    maxWidth: 700,
    paddingHorizontal: 0,
    alignSelf: 'center',
    // optionally add:
    boxSizing: 'border-box', // For web, to ensure padding counted inside width
  },
  scrollContainer: {
    paddingVertical: 24,
    paddingHorizontal: 0,
    // no extra horizontal padding here
  },
  containerUnAuth: {
    flex: 1,                    
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
    backgroundColor: '#FFFFFF', 
  },
  buttonContainerUnAuth: {
    width: 400,
    marginVertical: 10,
    padding: 10,
  },
  darkContainer: {
    backgroundColor: '#121212',  // Dark mode background color
    maxWidth: '100%', 
  },
  lightContainer: {
    backgroundColor: '#FFF', 
  }, 
  itemTitle: {
    color: '#181c1f',
    paddingBottom: 5,
    paddingTop: 5,
    fontSize: 16,
    fontWeight: 'bold', 
  }, 
  darkItemTitle: {
    color: '#eef1f3', 
    paddingBottom: 5,
    paddingTop: 5,
    fontSize: 16,
    fontWeight: 'bold', 
  }, 
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    paddingBottom: 12,
    color: '#000', // Default text color for light mode
  },
  darkTextTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#fff', // Default text color for light mode
  },
  darkText: {
    color: '#b8c5c9',  // Dark mode text color
  },
  item: {
    fontSize: 18,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',  // Default border color for light mode
    color: '#4C37FF',
  },
  darkItem: {
    color: '#4C37FF',  // Dark mode text color for list items
    borderBottomColor: '#444',  // Dark mode border color for list items
  },
  buttonStyle: {
    backgroundColor: "#4C37FF",
    padding: 14,
    borderRadius: 8,
    marginBottom: Platform.OS === "web" ? 0 : 10, // Apply -10 only on mobile
  }, 
  darkButtonStyle: {
    backgroundColor: '#4C37FF',
    padding: 10,
  }, 
  buttonText: {
    color: '#FFF',
    textAlign: "center", 
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
    width: '50%',
    marginVertical: 10,
  }, 
  containerButtonsUnAuth: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginVertical: 0,
  },
  subtitle: {
    fontSize: 16, 
    marginBottom: 20,
    marginLeft: 4,
    marginRight: 2,
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
  touchable: {
    paddingVertical: 10, 
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    width: '100%',
  },
  communityItem: {
    width: '100%',              // 👈 Ensures it spans full width of innerContainer
    marginBottom: 20,
    padding: 0,                // Optional: Add inner padding for visual spacing
    borderRadius: 8,            // Optional: Gives a nice card feel
  },
  followersStyle: {
    paddingTop: 4,
    color: 'grey',
  },
  description: {
    fontSize: 14,
    color: '#555',
    marginLeft: 0,
    flexWrap: 'wrap',      // allow text to wrap
    flexShrink: 1,         // allow shrinking if needed
    // wordBreak: 'break-word', // for web only
    // overflowWrap: 'break-word',
  },
  titleIntro: {
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 10, 
    textAlign: 'center',       
    color: '#000', // Default light mode text color
  },
  darkTextIntro: {
    color: '#FFF',
    marginBottom: 20,
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
});