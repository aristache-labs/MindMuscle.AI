import React, { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Dimensions, ViewStyle, TextStyle, ImageStyle, Image } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { COLORS, BORDER_RADIUS } from '../constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import OptimizedImage from './OptimizedImage';

interface ExerciseCardProps {
  id: string;
  name: string;
  image: any;
  isFavorite?: boolean;
  onPress: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  useOptimizedImage?: boolean;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 cards per row with spacing

// Create a proper comparison function for memo
const arePropsEqual = (prevProps: ExerciseCardProps, nextProps: ExerciseCardProps) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.name === nextProps.name &&
    prevProps.isFavorite === nextProps.isFavorite &&
    // Compare image objects or URIs
    ((prevProps.image && nextProps.image && prevProps.image.uri === nextProps.image.uri) || 
     prevProps.image === nextProps.image) &&
    // Functions can't be directly compared, so we skip them
    // They should be wrapped in useCallback in the parent component
    true
  );
};

const ExerciseCard = memo(({ 
  id,
  name,
  image,
  isFavorite = false,
  onPress,
  onToggleFavorite,
  useOptimizedImage = false
}: ExerciseCardProps) => {
  // Create a unique debug label using exercise id or name
  const debugLabel = `exercise-card-${id || name.toLowerCase().replace(/\s+/g, '_').substring(0, 20)}`;

  // Memoize the image source to prevent unnecessary re-renders
  const imageSource = useMemo(() => {
    // Check if this is a placeholder image with a stable reference
    if (typeof image === 'object' && image !== null && 
        'testUri' in image && image.testUri && 
        (!image.uri || image.uri === null)) {
      // Use the globally cached placeholder image if available
      return (global as any).placeholderImages?.exercise || require('../../assets/exercises/placeholder.jpg');
    }
    return image;
  }, [image]);

  // Only log on dev builds and when needed for debugging
  if (__DEV__) {
    useEffect(() => {
      // console.log(`[ExerciseCard ${debugLabel}] mounted or props changed. Name: ${name}, Favorite: ${isFavorite}`);
      // console.log(`[ExerciseCard ${debugLabel}] Image prop:`, image);
    }, [id, name, isFavorite, image, debugLabel]);
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(id)}
      testID={`exercise-card-${id}`}
    >
      <Surface style={styles.card}>
        <View style={styles.cardContentWrapper}>
          <View style={styles.imageContainer}>
            {useOptimizedImage ? (
              <OptimizedImage
                source={imageSource}
                style={styles.image}
                resizeMode="cover"
                priority="high"
                testID={debugLabel}
                isImportant={true}
                showLoader={false}
              />
            ) : (
              <Image 
                source={imageSource} 
                style={styles.image} 
                resizeMode="cover"
              />
            )}
            {onToggleFavorite && (
              <TouchableOpacity
                style={styles.favoriteButton}
                onPress={() => onToggleFavorite(id)}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <MaterialIcons
                  name={isFavorite ? "favorite" : "favorite-border"}
                  size={24}
                  color={isFavorite ? "#FF5252" : "#757575"}
                />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
              {name}
            </Text>
          </View>
        </View>
      </Surface>
    </TouchableOpacity>
  );
}, arePropsEqual);

interface Styles {
  container: ViewStyle;
  card: ViewStyle;
  cardContentWrapper: ViewStyle;
  imageContainer: ViewStyle;
  image: ImageStyle;
  favoriteButton: ViewStyle;
  textContainer: ViewStyle;
  name: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    width: CARD_WIDTH,
    marginBottom: 16,
  },
  card: {
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#1E2126',
    elevation: 3,
  },
  cardContentWrapper: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 160,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  textContainer: {
    padding: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
    textAlign: 'center',
  },
});

export default ExerciseCard; 