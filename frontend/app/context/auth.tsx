import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { useTheme } from './ThemeContext';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

interface UserProfile {
  username: string;
  profile_photo?: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  author: User;
  chain: number;
}

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author: User;
  messages?: Message[];
}

interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  profile_photo?: string;
  profile: UserProfile;
}

interface Community {
  id: number;
  title: string;
  description: string;
  moderator: number;
  created_at: string;
  posts?: Post[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  communities: Community[];
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  refreshAccessToken: () => Promise<string | null>;
  pending2FAUsername: string | null;
  setPending2FAUsername: React.Dispatch<React.SetStateAction<string | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const router = useRouter();
  const segments = useSegments() as string[];
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Set the theme context because we are going to alter it below after the user logs in
  const { setTheme } = useTheme();

  // 2FA state tracking
  const [pending2FAUsername, setPending2FAUsername] = useState<string | null>(null);

  const refreshAuthLogic = async (failedRequest: any) => {
    try {
      if (failedRequest.response) {
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          failedRequest.response.config.headers['Authorization'] = `Bearer ${newAccessToken}`;
          return Promise.resolve();
        } else {
          return Promise.reject('Failed to refresh access token');
        }
      } else {
        return Promise.reject('No response from failed request');
      }
    } catch (error) {
      console.error('Error refreshing access token', error);
      logout();
      return Promise.reject(error);
    }
  };

  // Load the users profile setting 
  const loadUser = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch user data");

      const userData = await response.json();
      setUser(userData);
      
      // Sync preferred theme to AsyncStorage
      if (userData.preferred_theme === 'light' || userData.preferred_theme === 'dark') {
        await AsyncStorage.setItem('preferred_theme', userData.preferred_theme);
        setTheme(userData.preferred_theme);
      }

      const communitiesResponse = await fetch(`${API_BASE_URL}/communities/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!communitiesResponse.ok) throw new Error("Failed to fetch communities");

      const communitiesData = await communitiesResponse.json();
      setCommunities(communitiesData.results);
    } catch (error) {
      console.log("Error fetching user or communities:", error);
      logout();
    }
  };

  // Used to track/store the pending 2fa username so that we can pass it to the 2fa page 
  useEffect(() => {
    const restorePending2FA = async () => {
      const storedUsername = await AsyncStorage.getItem('pending2FAUsername');
      if (storedUsername) {
        setPending2FAUsername(storedUsername);
      }
    };
  
    restorePending2FA();
  }, []);

  useEffect(() => {
    const loadTokenAndUser = async () => {
      // Get token from AsyncStorage or localStorage
      const storedToken = await AsyncStorage.getItem("token");
      const refreshToken = await AsyncStorage.getItem("refreshToken");
  
      if (!storedToken && refreshToken) {
        // If no access token, try to refresh using refresh token
        await refreshAccessToken();
      } else if (storedToken) {
        // Token exists, check its validity
        setToken(storedToken);
      }
  
      // Optionally load the user and communities (after loading the token)
      loadUser();
    };
  
    loadTokenAndUser();
    
    // Automatic token refresh
    const tokenRefreshInterval = setInterval(() => {
      // Refresh token every 3 hours (if valid)
      if (token) {
        refreshAccessToken();
      }
    }, 3 * 60 * 60 * 1000); // 3 hours -- PROD
  
    return () => clearInterval(tokenRefreshInterval); // Cleanup on component unmount
  }, [token]);

  // Core Login code for frontend
  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth-login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) throw new Error("Login failed");

      const data = await response.json();
      
      if (data.token && data.refreshToken) {
        const { token, refreshToken } = data;
        await AsyncStorage.setItem('token', token);
        await AsyncStorage.setItem('refreshToken', refreshToken);
        setToken(token);
        await loadUser();
      } else if (data?.['2fa_required']) {
        const username = data.username;
        await AsyncStorage.setItem('pending2FAUsername', username);
        setPending2FAUsername(username);
      } else {
        console.log('❌ Unexpected login response.');
        throw new Error('Unexpected login response');
      }
    } catch (error) {
      console.log('❌ Login request failed. Please try again later.');
      throw error;
    }
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (!refreshToken) return null;
  
      const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) throw new Error("Failed to refresh token");

      const { access, refresh } = await response.json();
      await AsyncStorage.setItem('token', access);
      await AsyncStorage.setItem('refreshToken', refresh);
      setToken(access);
      
      return access;
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      return null;
    }
  };

  // Logout function
  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('preferred_theme');
    await AsyncStorage.clear();
    setUser(null);
    setUserProfile(null);
    setToken(null);
    setCommunities([]);
  };

  return (
    <AuthContext.Provider value={{ user, token, communities, login, userProfile, setUserProfile, logout, refreshAccessToken, pending2FAUsername, setPending2FAUsername }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;