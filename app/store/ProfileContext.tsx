import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Profile {
  name: string;
  email: string;
  avatar?: string;
  preferences: {
    notifications: boolean;
    darkMode: boolean;
    language: string;
  };
}

interface ProfileContextType {
  profile: Profile | null;
  updateProfile: (newProfile: Partial<Profile>) => Promise<void>;
  loading: boolean;
}

const defaultProfile: Profile = {
  name: '',
  email: '',
  preferences: {
    notifications: true,
    darkMode: false,
    language: 'en',
  },
};

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  updateProfile: async () => {},
  loading: true,
});

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem('profile');
      if (storedProfile) {
        setProfile(JSON.parse(storedProfile));
      } else {
        setProfile(defaultProfile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (newProfile: Partial<Profile>) => {
    try {
      const updatedProfile = { ...profile, ...newProfile };
      await AsyncStorage.setItem('profile', JSON.stringify(updatedProfile));
      setProfile(updatedProfile as Profile);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, loading }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext); 