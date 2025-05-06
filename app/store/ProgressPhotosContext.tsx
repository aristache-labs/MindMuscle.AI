import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import progressPhotoService, { ProgressPhoto } from '../services/progressPhotos';
import { useAuth } from './AuthContext';
import { preloadSingleImage } from '../utils/imagePreloader';

// Enable/disable detailed logging
const DEBUG_PROGRESS_PHOTOS = true;

interface ProgressPhotosContextType {
  beforeImage: string | null;
  afterImage: string | null;
  setBeforeImage: (uri: string) => Promise<void>;
  setAfterImage: (uri: string) => Promise<void>;
  loading: boolean;
  refreshPhotos: () => Promise<void>;
  lastRefresh: number | null;
}

const ProgressPhotosContext = createContext<ProgressPhotosContextType>({
  beforeImage: null,
  afterImage: null,
  setBeforeImage: async () => {},
  setAfterImage: async () => {},
  loading: true,
  refreshPhotos: async () => {},
  lastRefresh: null,
});

export const ProgressPhotosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [beforeImage, setBeforeImageState] = useState<string | null>(null);
  const [afterImage, setAfterImageState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const { session } = useAuth();

  // Load photos whenever the session changes
  useEffect(() => {
    if (session?.user?.id) {
      if (DEBUG_PROGRESS_PHOTOS) {
        console.log(`🔄 [ProgressPhotos] User session detected, loading photos for user: ${session.user.id.substring(0, 8)}...`);
      }
      loadPhotos();
    } else {
      if (DEBUG_PROGRESS_PHOTOS) {
        console.log('🔄 [ProgressPhotos] No user session, resetting state');
      }
      // Reset state when user logs out
      setBeforeImageState(null);
      setAfterImageState(null);
      setLoading(false);
      setLastRefresh(null);
    }
  }, [session]);

  const loadPhotos = async () => {
    if (!session?.user?.id) {
      if (DEBUG_PROGRESS_PHOTOS) {
        console.log('⚠️ [ProgressPhotos] Attempted to load photos without a user session');
      }
      return;
    }
    
    const startTime = Date.now();
    if (DEBUG_PROGRESS_PHOTOS) {
      console.log(`⏳ [ProgressPhotos] Loading progress photos for user: ${session.user.id.substring(0, 8)}...`);
    }
    
    setLoading(true);
    try {
      // Get latest photos from service
      const { before, after } = await progressPhotoService.getLatestPhotos(session.user.id);
      
      if (DEBUG_PROGRESS_PHOTOS) {
        console.log(`📊 [ProgressPhotos] Retrieved photos: before=${before ? '✓' : '✗'}, after=${after ? '✓' : '✗'}`);
      }
      
      if (before) {
        setBeforeImageState(before.photo_url);
        if (DEBUG_PROGRESS_PHOTOS) {
          console.log(`🖼️ [ProgressPhotos] Set before image: ${before.photo_url.substring(0, 40)}...`);
        }
      } else {
        setBeforeImageState(null);
        if (DEBUG_PROGRESS_PHOTOS) {
          console.log('🖼️ [ProgressPhotos] No before image available');
        }
      }

      if (after) {
        setAfterImageState(after.photo_url);
        if (DEBUG_PROGRESS_PHOTOS) {
          console.log(`🖼️ [ProgressPhotos] Set after image: ${after.photo_url.substring(0, 40)}...`);
        }
      } else {
        setAfterImageState(null);
        if (DEBUG_PROGRESS_PHOTOS) {
          console.log('🖼️ [ProgressPhotos] No after image available');
        }
      }
      
      const endTime = Date.now();
      setLastRefresh(endTime);
      
      if (DEBUG_PROGRESS_PHOTOS) {
        console.log(`✅ [ProgressPhotos] Successfully loaded photos in ${endTime - startTime}ms`);
      }
    } catch (error) {
      if (DEBUG_PROGRESS_PHOTOS) {
        console.error('❌ [ProgressPhotos] Error loading progress photos:', error);
      }
    } finally {
      setLoading(false);
      if (DEBUG_PROGRESS_PHOTOS) {
        console.log('🔄 [ProgressPhotos] Loading state set to false');
      }
    }
  };

  const refreshPhotos = async () => {
    const startTime = Date.now();
    if (DEBUG_PROGRESS_PHOTOS) {
      console.log('🔄 [ProgressPhotos] Manually refreshing photos...');
    }
    await loadPhotos();
    if (DEBUG_PROGRESS_PHOTOS) {
      console.log(`✅ [ProgressPhotos] Manual refresh completed in ${Date.now() - startTime}ms`);
    }
  };

  const setBeforeImage = async (uri: string) => {
    if (!session?.user?.id) {
      if (DEBUG_PROGRESS_PHOTOS) {
        console.warn('⚠️ [ProgressPhotos] Attempted to set before image without a user session');
      }
      return;
    }
    
    const startTime = Date.now();
    if (DEBUG_PROGRESS_PHOTOS) {
      console.log(`⏳ [ProgressPhotos] Uploading before image for user: ${session.user.id.substring(0, 8)}...`);
    }
    
    try {
      // Upload photo using service
      const photo = await progressPhotoService.uploadPhoto(
        session.user.id,
        'before',
        uri
      );
      
      // Update state with the new URL
      setBeforeImageState(photo.photo_url);
      
      if (DEBUG_PROGRESS_PHOTOS) {
        const endTime = Date.now();
        console.log(`✅ [ProgressPhotos] Before image uploaded and set in ${endTime - startTime}ms: ${photo.photo_url.substring(0, 40)}...`);
      }
    } catch (error) {
      if (DEBUG_PROGRESS_PHOTOS) {
        console.error('❌ [ProgressPhotos] Error saving before image:', error);
      }
    }
  };

  const setAfterImage = async (uri: string) => {
    if (!session?.user?.id) {
      if (DEBUG_PROGRESS_PHOTOS) {
        console.warn('⚠️ [ProgressPhotos] Attempted to set after image without a user session');
      }
      return;
    }
    
    const startTime = Date.now();
    if (DEBUG_PROGRESS_PHOTOS) {
      console.log(`⏳ [ProgressPhotos] Uploading after image for user: ${session.user.id.substring(0, 8)}...`);
    }
    
    try {
      // Upload photo using service
      const photo = await progressPhotoService.uploadPhoto(
        session.user.id,
        'after',
        uri
      );
      
      // Update state with the new URL
      setAfterImageState(photo.photo_url);
      
      if (DEBUG_PROGRESS_PHOTOS) {
        const endTime = Date.now();
        console.log(`✅ [ProgressPhotos] After image uploaded and set in ${endTime - startTime}ms: ${photo.photo_url.substring(0, 40)}...`);
      }
    } catch (error) {
      if (DEBUG_PROGRESS_PHOTOS) {
        console.error('❌ [ProgressPhotos] Error saving after image:', error);
      }
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
        lastRefresh,
      }}
    >
      {children}
    </ProgressPhotosContext.Provider>
  );
};

export const useProgressPhotos = () => useContext(ProgressPhotosContext);

export default ProgressPhotosProvider; 