import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useProfile } from '../store/ProfileContext';
import { router } from 'expo-router';

export default function EditProfileScreen() {
  const { profile, updateProfile } = useProfile();
  const [name, setName] = useState(profile?.name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        email: email.trim(),
      });
      router.back();
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <TextInput
          label="Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
          mode="outlined"
        />
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={isSaving}
          disabled={!name.trim() || isSaving}
          style={styles.button}
        >
          Save Changes
        </Button>
        <Button
          mode="outlined"
          onPress={() => router.back()}
          style={styles.button}
        >
          Cancel
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
  form: {
    padding: 20,
  },
  input: {
    marginBottom: 16,
  },
  buttonContainer: {
    padding: 20,
  },
  button: {
    marginTop: 10,
  },
}); 