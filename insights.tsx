import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useProgressPhotos } from '@/app/store/ProgressPhotosContext';

export default function InsightsScreen() {
  const { beforeImage, afterImage, setBeforeImage, setAfterImage } = useProgressPhotos();

  const pickImage = async (type: 'before' | 'after') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        if (type === 'before') {
          await setBeforeImage(uri);
        } else {
          await setAfterImage(uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <TouchableOpacity onPress={() => pickImage('before')} style={styles.imageBox}>
          {beforeImage ? (
            <Image source={{ uri: beforeImage }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Text>Tap to add before photo</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => pickImage('after')} style={styles.imageBox}>
          {afterImage ? (
            <Image source={{ uri: afterImage }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Text>Tap to add after photo</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  imageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  imageBox: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
}); 