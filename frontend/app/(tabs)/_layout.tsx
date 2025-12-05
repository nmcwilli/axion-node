import React, { useState, useEffect } from 'react';
import { FontAwesome } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
// import { useColorScheme } from '@/components/useColorScheme';
import { BackHandler, Platform, Image, Pressable, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Colors from '@/constants/Colors';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useAuth } from '../context/auth';
import { useRouter } from 'expo-router';
import { Drawer } from 'react-native-paper';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string }) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

interface SocialBookLogoProps {
  toggleTheme: () => void;
  theme: string;
}

// Main Logo 
function SocialBookLogo({ toggleTheme, theme }: SocialBookLogoProps) {
  const isDarkMode = theme === 'dark';

  const router = useRouter();
  return (
    <Pressable onPress={() => router.push('/')} style={styles.logoContainer}>
      <Text 
        style={[
          styles.logoText,
          { color: isDarkMode ? "#FFF" : "#000" },
        ]}
      >
        {/* Conditionally load the dark or light logo based on the theme */}
        <Image 
          source={isDarkMode 
            ? require('../../assets/images/dark-logo.png') 
            : require('../../assets/images/light-logo.png')} 
          style={styles.logoImage}
        />
        AxionNode
      </Text>
    </Pressable>
  );
}

// Header Title back function for Community 
function HeaderTitleBackCommunity({ title }: { title: string }) {
  const router = useRouter();

  const handleBackPressCommunity = () => {
    // Manually navigate to the parent community page
    router.back();
  };

  return (
    <View style={styles.headerTitleContainer}>
      <TouchableOpacity onPress={handleBackPressCommunity}>
        <Text style={styles.headerTitleText}>{title}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Header Title Back function for Posts
function HeaderTitleBackPost({ title }: { title: string }) {
  const router = useRouter();

  const handleBackPressPost = () => {
    // Manually navigate to the parent community page
    router.back();
  };

  return (
    <View style={styles.headerTitleContainer}>
      <TouchableOpacity onPress={handleBackPressPost}>
        <Text style={styles.headerTitleText}>{title}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Right header function
function RightHeaderActions({ toggleTheme, theme }: { toggleTheme: () => void; theme: string }) {
  const { logout, user } = useAuth();
  const router = useRouter();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const isDarkMode = theme === 'dark';

  const handleProfilePress = () => {
    if (!user) {
      router.push('/login'); // Redirect to login if not authenticated
    } else {
      setDrawerVisible((prev) => !prev); // Toggle drawer visibility
    }
  };

  // Handles logout 
  const handleLogout = async () => {
    setDrawerVisible(false);
    await logout();
    router.replace('/login');
  };

  // Handles the Profile Edit functionality 
  const handleViewProfile = () => {
    setDrawerVisible(false); // Close the drawer when navigating to the profile page
    router.push('/profile'); // Navigate to Profile screen (ensure this path matches your setup)
  };

  // Handle User Agreement
  const handleUserAgreement = () => {
    setDrawerVisible(false); // Close the drawer when navigating to the profile page
    router.push('/user-agreement'); // Navigate to Profile screen (ensure this path matches your setup)
  };

  // Handle Privacy Policy
  const handlePrivacyPolicy = () => {
    setDrawerVisible(false); // Close the drawer when navigating to the profile page
    router.push('/privacy-policy'); // Navigate to Profile screen (ensure this path matches your setup)
  };

  // Handle Support
  const handleSupport = () => {
    setDrawerVisible(false); // Close the drawer when navigating to the profile page
    router.push('/support'); // Navigate to Profile screen (ensure this path matches your setup)
  };

  // Handles the Profile View functionality 
  const handleViewProfileLink = () => {
    setDrawerVisible(false); // Close the drawer when navigating to the profile page
  
    // Ensure that the username is up-to-date when navigating
    const username = user?.username; // Fetch the username from the context
  
    // If there's no username, it means the user is not logged in
    if (!username) {
      router.push('/login'); // Navigate to login if no username is found
    } else {
      // Navigate to the correct profile URL
      router.push(`/user/${username}`);
    }
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 15 }}>
      {/* Theme Toggle Button */}
      <Pressable onPress={toggleTheme} style={{ marginRight: 15 }}>
        <FontAwesome
          name={isDarkMode ? 'sun-o' : 'moon-o'}
          size={24}
          color={isDarkMode ? Colors.dark.text : Colors.light.text} // Use theme colors for the icons
        />
      </Pressable>

      {/* Profile Icon */}
      <Pressable onPress={handleProfilePress}>
        <FontAwesome 
          name="user-circle-o" 
          size={24} 
          color={isDarkMode ? Colors.dark.text : Colors.light.text} // Use theme colors for the icons
        />
      </Pressable>

      {/* Drawer Menu */}
      {drawerVisible ? (
        <View style={[styles.drawerContainer, { backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background }]}>
          {/* Drawer Items */}
          <Drawer.Section>

            {/* View Profile */}
            <TouchableOpacity
              style={[styles.drawerItem, { backgroundColor: '#fff' }]}
              onPress={handleViewProfileLink}
            >
              <Text style={[styles.drawerText, { color: '#000' }]}>View Profile</Text>
            </TouchableOpacity>

            {/* Edit Profile */}
            <TouchableOpacity
              style={[styles.drawerItem, { backgroundColor: '#fff' }]}
              onPress={handleViewProfile}
            >
              <Text style={[styles.drawerText, { color: '#000' }]}>Edit Profile</Text>
            </TouchableOpacity>

            {/* User Agreement */}
            <TouchableOpacity
              style={[styles.drawerItem, { backgroundColor: '#fff' }]}
              onPress={handleUserAgreement}
            >
              <Text style={[styles.drawerText, { color: '#000' }]}>User Agreement</Text>
            </TouchableOpacity>

            {/* Privacy Policy */}
            <TouchableOpacity
              style={[styles.drawerItem, { backgroundColor: '#fff' }]}
              onPress={handlePrivacyPolicy}
            >
              <Text style={[styles.drawerText, { color: '#000' }]}>Privacy Policy</Text>
            </TouchableOpacity>

            {/* Support */}
            <TouchableOpacity
              style={[styles.drawerItem, { backgroundColor: '#fff' }]}
              onPress={handleSupport}
            >
              <Text style={[styles.drawerText, { color: '#000' }]}>Support</Text>
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity
              style={[styles.drawerItem, { backgroundColor: '#fff' }]}
              onPress={handleLogout}
            >
              <Text style={[styles.drawerText, { color: '#000' }]}>Logout</Text>
            </TouchableOpacity>
          </Drawer.Section>
        </View>
      ) : null}
    </View>
  );
}

// Main Tabs function
export default function MainTabs() {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const { user } = useAuth();
  const router = useRouter(); // Access route parameters

  // Try to grab the username information
  const [profileData, setProfileData] = useState({
    username: user?.username || 'Guest', // fallback username if not logged in
  });
  
  useEffect(() => {
    // console.log("Theme on first render:", theme);
    if (!theme) {
      toggleTheme(); // This forces a theme switch if it's undefined
    }
    if (user) {
      // console.log('Username detected as: ', user.username); // Log username here
      setProfileData({
        username: user.username || '', // Update profile data when user changes
      });
    }
  }, [user]);  // Re-run effect when `user` changes
  
  return (
    <Tabs 
      backBehavior='history'
      screenOptions={{
        tabBarActiveTintColor: '#4C37FF',
        tabBarStyle: {
          backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background,
          borderTopWidth: 1, // Adds a border on top of the tab bar
          borderTopColor: isDarkMode ? '#555' : '#ddd', // Adjust color as needed
        },
        headerStyle: {
          backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background,
          borderBottomWidth: 1, // Adds a border at the bottom of the header
          borderBottomColor: isDarkMode ? '#555' : '#ddd', // Adjust color as needed
        },
        headerTintColor: isDarkMode ? Colors.dark.text : Colors.light.text,
        headerShown: useClientOnlyValue(false, true),
        headerLeft: () =>  <SocialBookLogo toggleTheme={toggleTheme} theme={theme} />, // Add clickable logo in header
        headerRight: () => <RightHeaderActions toggleTheme={toggleTheme} theme={theme} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Home',  // <-- Shows "Home" in the tab
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          headerTitle: () => null, // Hides the title
        }}
      />
      {/* Community tab */}
      <Tabs.Screen
        name="community"
        options={{
          tabBarLabel: 'Community',  // <-- Shows "Community" in the tab
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
          headerTitle: () => null, // Hides the title
        }}
      />

      {/* Post tab */}
      <Tabs.Screen
        name="post"
        options={{
          tabBarLabel: 'Post',  // <-- Shows "Post" in the tab
          tabBarIcon: ({ color }) => <TabBarIcon name="plus" color={color} />,
          headerTitle: () => null, // Hides the title
        }}
      />
      <Tabs.Screen name={`user/[username]`}
        options={{
          tabBarLabel: 'Profile',  // <-- Shows "Profile" in the tab
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
          headerTitle: () => null, // Hides the title
          href: user?.username ? `/user/${user.username}` : '/login',  // Navigate based on the user
        }}
      />

      {/* Hidden Screens */}
      <Tabs.Screen name="login" 
        options={{ 
          title: 'AxionNode', 
          href: null, 
          headerTitle: () => null, // Hides the title
        }} 
      />
      <Tabs.Screen name="profile" 
        options={{ 
          title: 'AxionNode', 
          href: null,
          headerTitle: () => null, // Hides the title
        }} 
      />
      <Tabs.Screen name="register" 
        options={{ 
          title: 'Register', 
          href: null,
          headerTitle: () => null, // Hides the title
        }} 
      />
      <Tabs.Screen name="add-community" 
        options={{ 
          title: 'Add a Community', 
          href: null,
          headerTitle: () => <HeaderTitleBackCommunity title="<" />
        }} 
      />
      <Tabs.Screen name="community/[slug]" 
        options={{ 
          title: '<', 
          href: null,
          headerTitle: () => <HeaderTitleBackCommunity title="<" />
        }} 
      />
      <Tabs.Screen name="post/[slug]" 
        options={{ 
          title: '<', 
          href: null,
          headerTitle: () => <HeaderTitleBackPost title="<" />
        }} 
      />
      <Tabs.Screen name="post-edit/[slug]" 
        options={{ 
          title: '<', 
          href: null,
          headerTitle: () => <HeaderTitleBackPost title="" />
        }} 
      />
      <Tabs.Screen name="reset-password" 
        options={{ 
          title: '<', 
          href: null,
          headerTitle: () => <HeaderTitleBackPost title="" />
        }} 
      />
      <Tabs.Screen name="forgot-password" 
        options={{ 
          title: '<', 
          href: null,
          headerTitle: () => <HeaderTitleBackPost title="" />
        }} 
      />
      <Tabs.Screen name="user-agreement" 
        options={{ 
          title: '<', 
          href: null,
          headerTitle: () => <HeaderTitleBackPost title="" />
        }} 
      />
      <Tabs.Screen name="privacy-policy" 
        options={{ 
          title: '<', 
          href: null,
          headerTitle: () => <HeaderTitleBackPost title="" />
        }} 
      />
      <Tabs.Screen name="2fa" 
        options={{ 
          title: '<', 
          href: null,
          headerTitle: () => <HeaderTitleBackPost title="" />
        }} 
      />
      <Tabs.Screen name="support" 
        options={{ 
          title: '<', 
          href: null,
          headerTitle: () => <HeaderTitleBackPost title="" />
        }} 
      />
      <Tabs.Screen name="delete-account" 
        options={{ 
          title: '<', 
          href: null,
          headerTitle: () => <HeaderTitleBackPost title="" />
        }} 
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    position: 'absolute',
    top: 40, // Adjusted to ensure it appears under the header
    right: 0,
    width: 200, // Set a fixed width for the drawer
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Optional: Add transparency for overlay effect
    marginTop: 0, 
    paddingTop: 3,
    zIndex: 1000, // Ensure the drawer is on top of other content
  },
  closeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000', // Ensure close button is black
  },
  drawerItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff', // Set item background to white or adjust as needed
  },
  drawerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000', // Set the text color to black
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.tint, // Adjust color based on theme if needed
  },
  logoContainer: {
    flexDirection: 'row', // Arrange logo and text in a row
    paddingHorizontal: 15,
    paddingVertical: 0,
    alignItems: 'center', // Ensures items are vertically centered
    justifyContent: 'center', // Centers the content horizontally
    marginTop: Platform.select({
      ios: 0,        // iOS-specific value
      android: 10,    // Android-specific value
      web: 0,       // Web-specific value
    }), 
  },
  logoText: {
    fontSize: 22,
    fontWeight: '500',
    color: '#000', // Adjust based on theme
    lineHeight: 18, // Ensure it matches the image height
    marginTop: Platform.select({
      ios: 0,        // iOS-specific value
      android: 6,    // Android-specific value
      web: 10,       // Web-specific value
    }), 
    paddingBottom: Platform.select({
      ios: 10,        // iOS-specific value
      android: 6,    // Android-specific value
      web: -3,       // Web-specific value
    }),
  },
  logoImage: {
    width: 30,
    height: 30,
    marginRight: 6,
    alignSelf: 'center', // Ensures the image aligns properly in the row
    verticalAlign: 'middle',
    paddingTop: Platform.select({
      ios: 10,        // iOS-specific value
      android: 0,    // Android-specific value
      web: -3,       // Web-specific value
    }),
    marginTop: Platform.select({
      ios: 12,        // iOS-specific value
      android: 2,    // Android-specific value
      web: -3,       // Web-specific value
    }),
  },
});
