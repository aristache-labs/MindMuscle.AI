import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Avatar, List, Switch, Text, Button } from 'react-native-paper';
import { useProfile } from '../store/ProfileContext';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { profile, updateProfile, loading } = useProfile();

  if (loading || !profile) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const handlePreferenceChange = (key: keyof typeof profile.preferences, value: boolean | string) => {
    updateProfile({
      preferences: {
        ...profile.preferences,
        [key]: value,
      },
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Avatar.Text
          size={80}
          label={profile.name ? profile.name.charAt(0).toUpperCase() : '?'}
        />
        <Text style={styles.name}>{profile.name || 'Anonymous'}</Text>
        <Text style={styles.email}>{profile.email || 'No email set'}</Text>
      </View>

      <List.Section>
        <List.Subheader>Preferences</List.Subheader>
        <List.Item
          title="Notifications"
          right={() => (
            <Switch
              value={profile.preferences.notifications}
              onValueChange={(value) => handlePreferenceChange('notifications', value)}
            />
          )}
        />
        <List.Item
          title="Dark Mode"
          right={() => (
            <Switch
              value={profile.preferences.darkMode}
              onValueChange={(value) => handlePreferenceChange('darkMode', value)}
            />
          )}
        />
      </List.Section>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={() => router.push('/profile/edit')}
          style={styles.button}
        >
          Edit Profile
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  buttonContainer: {
    padding: 20,
  },
  button: {
    marginTop: 10,
  },
}); 