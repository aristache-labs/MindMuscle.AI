import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import { validationService } from '../services/validationService';

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
        // Validate the stored profile data using Zod
        const validationResult = await validationService.validateProfileContext(
          JSON.parse(storedProfile),
        );

        if (validationResult.success) {
          setProfile(validationResult.data);
        } else {
          logger.warn('Invalid profile data found in storage, using default profile', {
            context: { errors: validationResult.errors },
          });
          setProfile(defaultProfile);
          // Store the default profile to fix the corrupted data
          await AsyncStorage.setItem('profile', JSON.stringify(defaultProfile));
        }
      } else {
        setProfile(defaultProfile);
      }
    } catch (error) {
      logger.error('Error loading profile', error as Error);
      setProfile(defaultProfile);
      // Try to store default profile
      try {
        await AsyncStorage.setItem('profile', JSON.stringify(defaultProfile));
      } catch (storeError) {
        logger.error('Error storing default profile', storeError as Error);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (newProfile: Partial<Profile>) => {
    try {
      const updatedProfile = { ...profile, ...newProfile } as Profile;

      // Validate the updated profile before storing
      const validationResult = await validationService.validateProfileContext(updatedProfile);

      if (!validationResult.success) {
        const errorMessage = `Invalid profile data: ${validationResult.errors.map((e) => e.message).join(', ')}`;
        logger.error('Cannot update profile with invalid data', new Error(errorMessage), {
          context: { updatedProfile, errors: validationResult.errors },
        });
        throw new Error(errorMessage);
      }

      await AsyncStorage.setItem('profile', JSON.stringify(validationResult.data));
      setProfile(validationResult.data);
    } catch (error) {
      logger.error('Error updating profile', error as Error, {
        context: { newProfile },
      });
      throw error;
    }
  };

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, loading }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);

export default ProfileProvider;
