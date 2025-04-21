import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp, ImageSourcePropType } from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { ActivityIndicator } from 'react-native-paper';

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[';

interface OptimizedImageProps {
  source: string | ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  transition?: number;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
  transparent?: boolean;
}

export default function OptimizedImage({
  source,
  style,
  imageStyle,
  contentFit = 'cover',
  transition = 1000,
  placeholder = blurhash,
  onLoad,
  onError,
  transparent = false,
}: OptimizedImageProps) {
  return (
    <View style={[
      styles.container,
      transparent ? styles.transparentContainer : styles.defaultContainer,
      style
    ]}>
      <Image
        style={[StyleSheet.absoluteFill, imageStyle]}
        source={source}
        placeholder={typeof source === 'string' ? placeholder : undefined}
        contentFit={contentFit}
        transition={transition}
        onLoad={onLoad}
        onError={onError}
        cachePolicy="memory-disk"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  defaultContainer: {
    backgroundColor: '#f0f0f0',
  },
  transparentContainer: {
    backgroundColor: 'transparent',
  },
}); 