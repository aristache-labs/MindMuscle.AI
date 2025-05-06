import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import progressPhotoService, { ProgressPhoto } from '../services/progressPhotos';
import { useAuth } from './AuthContext';
import { preloadSingleImage } from '../utils/imagePreloader';

interface ProgressPhotosContextType {
  beforeImage: string | null;
  afterImage: string | null;
  setBeforeImage: (uri: string) => Promise<void>;
  setAfterImage: (uri: string) => Promise<void>;
  loading: boolean;
  refreshPhotos: () => Promise<void>;
}

const ProgressPhotosContext = createContext<ProgressPhotosContextType>({
  beforeImage: null,
  afterImage: null,
  setBeforeImage: async () => {},
  setAfterImage: async () => {},
  loading: true,
  refreshPhotos: async () => {},
});

export const ProgressPhotosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [beforeImage, setBeforeImageState] = useState<string | null>(null);
  const [afterImage, setAfterImageState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  // Load photos whenever the session changes
  useEffect(() => {
    if (session?.user?.id) {
      loadPhotos();
    } else {
      // Reset state when user logs out
      setBeforeImageState(null);
      setAfterImageState(null);
      setLoading(false);
    }
  }, [session]);

  const loadPhotos = async () => {
    if (!session?.user?.id) return;
    
    setLoading(true);
    try {
      // Get latest photos from service
      const { before, after } = await progressPhotoService.getLatestPhotos(session.user.id);
      
      if (before) {
        setBeforeImageState(before.photo_url);
      }

      if (after) {
        setAfterImageState(after.photo_url);
      }
    } catch (error) {
      console.error('Error loading progress photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshPhotos = async () => {
    await loadPhotos();
  };

  const setBeforeImage = async (uri: string) => {
    if (!session?.user?.id) return;
    
    try {
      // Upload photo using service
      const photo = await progressPhotoService.uploadPhoto(
        session.user.id,
        'before',
        uri
      );
      
      // Update state with the new URL
      setBeforeImageState(photo.photo_url);
    } catch (error) {
      console.error('Error saving before image:', error);
    }
  };

  const setAfterImage = async (uri: string) => {
    if (!session?.user?.id) return;
    
    try {
      // Upload photo using service
      const photo = await progressPhotoService.uploadPhoto(
        session.user.id,
        'after',
        uri
      );
      
      // Update state with the new URL
      setAfterImageState(photo.photo_url);
    } catch (error) {
      console.error('Error saving after image:', error);
    }
  };

  return (
    <ProgressPhotosContext.Provider
      value={{
        beforeImage,
        afterImage,
        setBeforeImage,
        setAfterImage,
        loading,
        refreshPhotos,
      }}
    >
      {children}
    </ProgressPhotosContext.Provider>
  );
};

export const useProgressPhotos = () => useContext(ProgressPhotosContext);

export default ProgressPhotosProvider; 