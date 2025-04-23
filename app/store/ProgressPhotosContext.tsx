import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ProgressPhoto {
  id: string;
  type: 'before' | 'after';
  uri: string;
  date: string;
}

interface ProgressPhotosContextType {
  beforeImage: string | null;
  afterImage: string | null;
  setBeforeImage: (uri: string) => Promise<void>;
  setAfterImage: (uri: string) => Promise<void>;
  loading: boolean;
}

const ProgressPhotosContext = createContext<ProgressPhotosContextType>({
  beforeImage: null,
  afterImage: null,
  setBeforeImage: async () => {},
  setAfterImage: async () => {},
  loading: true,
});

export const ProgressPhotosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [beforeImage, setBeforeImageState] = useState<string | null>(null);
  const [afterImage, setAfterImageState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      const [storedBeforeImage, storedAfterImage] = await Promise.all([
        AsyncStorage.getItem('beforeImage'),
        AsyncStorage.getItem('afterImage'),
      ]);

      if (storedBeforeImage) {
        setBeforeImageState(storedBeforeImage);
      }

      if (storedAfterImage) {
        setAfterImageState(storedAfterImage);
      }
    } catch (error) {
      console.error('Error loading progress photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const setBeforeImage = async (uri: string) => {
    try {
      await AsyncStorage.setItem('beforeImage', uri);
      setBeforeImageState(uri);
    } catch (error) {
      console.error('Error saving before image:', error);
    }
  };

  const setAfterImage = async (uri: string) => {
    try {
      await AsyncStorage.setItem('afterImage', uri);
      setAfterImageState(uri);
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
      }}
    >
      {children}
    </ProgressPhotosContext.Provider>
  );
};

export const useProgressPhotos = () => useContext(ProgressPhotosContext);

export default ProgressPhotosProvider; 