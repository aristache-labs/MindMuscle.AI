import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import { validationService } from '../services/validationService';
import { setUser, setContext, setTag } from '../services/sentry';
import { captureError, addBreadcrumb } from '../services/sentry/simpleErrorHandler';

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
      addBreadcrumb('Loading user profile from storage', 'profile');

      setTag('profile.operation', 'load_profile');

      const storedProfile = await AsyncStorage.getItem('profile');

      if (storedProfile) {
        addBreadcrumb('Found stored profile data', 'profile');

        // Validate the stored profile data using Zod
        const validationResult = await validationService.validateProfileContext(
          JSON.parse(storedProfile),
        );

        if (validationResult.success) {
          const validatedProfile = validationResult.data as Profile;
          setProfile(validatedProfile);

          addBreadcrumb('Profile loaded and validated successfully', 'profile');

          // Set user context for Sentry
          setUser({
            id: validatedProfile.email || 'anonymous',
            email: validatedProfile.email || undefined,
            username: validatedProfile.name || undefined,
          });

          setContext('profile_context', {
            has_name: !!validatedProfile.name,
            has_email: !!validatedProfile.email,
            has_avatar: !!validatedProfile.avatar,
            notifications_enabled: validatedProfile.preferences.notifications,
            dark_mode: validatedProfile.preferences.darkMode,
            language: validatedProfile.preferences.language,
          });

          setTag('profile.load_status', 'success');
        } else {
          logger.warn('Invalid profile data found in storage, using default profile', {
            context: { errors: validationResult.errors },
          });

          addBreadcrumb('Invalid profile data found, using defaults', 'profile');

          captureError(new Error('Invalid profile data in storage'), {
            category: 'validation_error',
            component: 'ProfileContext',
            operation: 'load_profile_validation',
            validationErrors: validationResult.errors,
          });

          setProfile(defaultProfile);
          // Store the default profile to fix the corrupted data
          await AsyncStorage.setItem('profile', JSON.stringify(defaultProfile));

          addBreadcrumb('Default profile stored to fix corrupted data', 'profile');
          setTag('profile.load_status', 'validation_failed');
        }
      } else {
        addBreadcrumb('No stored profile found, using defaults', 'profile');
        setProfile(defaultProfile);
        setTag('profile.load_status', 'no_stored_data');
      }
    } catch (error) {
      const sentryError = error as Error;
      logger.error('Error loading profile', sentryError);

      addBreadcrumb('Error loading profile', 'profile');

      captureError(sentryError, {
        category: 'storage_error',
        component: 'ProfileContext',
        operation: 'load_profile',
      });

      setProfile(defaultProfile);

      // Try to store default profile
      try {
        await AsyncStorage.setItem('profile', JSON.stringify(defaultProfile));
        addBreadcrumb('Default profile stored after error', 'profile');
      } catch (storeError) {
        const sentryStoreError = storeError as Error;
        logger.error('Error storing default profile', sentryStoreError);

        captureError(sentryStoreError, {
          category: 'storage_error',
          component: 'ProfileContext',
          operation: 'store_default_profile',
        });
      }

      setTag('profile.load_status', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (newProfile: Partial<Profile>) => {
    try {
      addBreadcrumb('Updating user profile', 'profile');

      setTag('profile.operation', 'update_profile');
      setContext('profile_update', {
        fields_updated: Object.keys(newProfile),
        has_name_update: 'name' in newProfile,
        has_email_update: 'email' in newProfile,
        has_avatar_update: 'avatar' in newProfile,
        has_preferences_update: 'preferences' in newProfile,
      });

      const updatedProfile = { ...profile, ...newProfile } as Profile;

      // Validate the updated profile before storing
      const validationResult = await validationService.validateProfileContext(updatedProfile);

      if (!validationResult.success) {
        const errorMessage = `Invalid profile data: ${validationResult.errors.map((e) => e.message).join(', ')}`;
        const validationError = new Error(errorMessage);

        logger.error('Cannot update profile with invalid data', validationError, {
          context: { updatedProfile, errors: validationResult.errors },
        });

        addBreadcrumb('Profile validation failed during update', 'profile');

        captureError(validationError, {
          category: 'validation_error',
          component: 'ProfileContext',
          operation: 'update_profile_validation',
          updatedFields: Object.keys(newProfile),
          validationErrors: validationResult.errors,
        });

        setTag('profile.update_status', 'validation_failed');
        throw validationError;
      }

      const validatedProfile = validationResult.data as Profile;
      await AsyncStorage.setItem('profile', JSON.stringify(validatedProfile));
      setProfile(validatedProfile);

      addBreadcrumb('Profile updated successfully', 'profile');

      // Update user context
      setUser({
        id: validatedProfile.email || 'anonymous',
        email: validatedProfile.email || undefined,
        username: validatedProfile.name || undefined,
      });

      setContext('profile_update_success', {
        updated_fields: Object.keys(newProfile),
        new_name: validatedProfile.name,
        new_email: validatedProfile.email,
        preferences: validatedProfile.preferences,
      });

      setTag('profile.update_status', 'success');
    } catch (error) {
      const sentryError = error as Error;
      logger.error('Error updating profile', sentryError, {
        context: { newProfile },
      });

      addBreadcrumb('Error updating profile', 'profile');

      captureError(sentryError, {
        category: 'storage_error',
        component: 'ProfileContext',
        operation: 'update_profile',
        updateFields: Object.keys(newProfile),
      });

      setTag('profile.update_status', 'error');
      throw error;
    }
  };

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, loading }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    const error = new Error('useProfile must be used within a ProfileProvider');

    addBreadcrumb('useProfile hook used outside provider', 'profile');

    captureError(error, {
      category: 'ui_error',
      component: 'ProfileContext',
      operation: 'use_profile_hook',
    });

    throw error;
  }
  return context;
};

export default ProfileProvider;
