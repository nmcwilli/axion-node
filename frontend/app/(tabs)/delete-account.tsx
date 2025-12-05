import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
// import { logEvent } from '../../components/analytics';
import { useAuth } from '../context/auth';
import { useRouter } from "expo-router";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function DeleteScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { token, refreshAccessToken, logout } = useAuth(); // Add logout here

  const isDark = theme === 'dark';

  // Delete modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const showDeleteModal = () => setDeleteModalVisible(true);
  const hideDeleteModal = () => setDeleteModalVisible(false);

  // Firebase Analytics
  // REMOVED FOR NOW BECAUSE PREBUILD IS REQUIRED
  // useEffect(() => {
  //   logEvent('screen_view', { screen_name: 'DeleteScreen' });
  // }, []);

  // Handle Delete Account Model
  const handleAccountDelete = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/delete-account/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, 
        },
        body: JSON.stringify({ confirm: true }),
      });

      if (response.status === 204) {
        // Immediately log out the user
        Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
        logout(); // 🚨 THIS is what logs the user out
        router.replace('/');
      } else {
        const data = await response.json();
        Alert.alert('Error', data.detail || 'Something went wrong.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not delete account.');
    } finally {
      hideDeleteModal();
    }
  };

  // Function to handle email link press
  const handleEmailPress = () => {
    Linking.openURL('mailto:support@axionnode.com');
  };

  const styles = StyleSheet.create({
    container: {
      flexGrow: 1, 
      paddingTop: 40,
      paddingLeft: 20,
      paddingRight: 20,
      paddingBottom: 400, 
      backgroundColor: isDark ? '#121212' : '#fff',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'left',
      marginBottom: 20,
      color: isDark ? '#fff' : '#121212',
      fontFamily: isDark ? 'Arial' : 'Helvetica',
    },
    text: {
      fontSize: 16,
      lineHeight: 24,
      marginBottom: 10,
      color: isDark ? '#ddd' : '#333',
      fontFamily: isDark ? 'Arial' : 'Helvetica',
    },
    textBold: {
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 0,
        marginTop:10, 
        color: isDark ? '#ddd' : '#333',
        fontFamily: isDark ? 'Arial' : 'Helvetica',
        fontWeight: 'bold',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 20,
      color: isDark ? '#fff' : '#121212',
      fontFamily: isDark ? 'Arial' : 'Helvetica',
    },
    linkStyle: {
        color: '#4C37FF', 
        marginBottom: -4,
        marginLeft: 5,
    },
  });

  return (
    <>
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={hideDeleteModal}
      >
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}>
          <View style={{
            backgroundColor: isDark ? '#333' : '#fff',
            padding: 20,
            borderRadius: 10,
            width: '80%',
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: 'bold',
              color: isDark ? '#fff' : '#000',
              marginBottom: 10,
            }}>
              Are you sure?
            </Text>
            <Text style={{
              fontSize: 15,
              marginBottom: 20,
              color: isDark ? '#ddd' : '#333',
            }}>
              This will make your account permanently inaccessible and delete your account.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={hideDeleteModal} style={{ marginRight: 15 }}>
                <Text style={{ color: 'gray' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAccountDelete}>
                <Text style={{ color: 'red', fontWeight: 'bold' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <ScrollView style={styles.container} contentContainerStyle={{ justifyContent: 'center' }}>
        <Text style={styles.title}>Delete Account</Text>

        <Text style={styles.text}>
        Press the "Delete My Account" button below to confirm that you would like to remove all of your information from the SocialBook platform.
        </Text>

        <Text style={styles.text}>
        Please be warned that this will erase your information that is stored in our platform, including your: username, email, and password. There will also be NO way to recover your account after it is deleted. 
        </Text>

        <Text style={styles.text}>
        We will retain any comments or previous posts that you have created for platform continuity - this is public information as indicated in our User Agreement, but this information will be, into the future, associated to an anonymous account. If you would like to remove any posts or comments that you have created, do it in advance of deleting your account.
        </Text>

        <TouchableOpacity onPress={showDeleteModal} style={{ marginBottom: 50, backgroundColor: '#4C37FF', padding: 12, borderRadius: 8, maxWidth: 160 }}>
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>Delete My Account</Text>
        </TouchableOpacity>

        <Text style={styles.text}>
        If you experience any difficulty deleting your account, then please send our team an email: 
          <TouchableOpacity onPress={handleEmailPress}>
            <Text style={styles.linkStyle}>support@axionnode.com</Text>
          </TouchableOpacity>
        </Text>

      </ScrollView>
    </>
  );
}