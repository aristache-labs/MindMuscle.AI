import { MaterialIcons } from '@expo/vector-icons';
import React, { memo, useCallback, useEffect } from 'react';
import {
  Dimensions,
  Image,
  ImageStyle,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Surface, Text } from 'react-native-paper';
import * as Sentry from '@sentry/react-native';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import OptimizedImage from './OptimizedImage';

interface ExerciseCardProps {
  id: string;
  name: string;
  image: { uri: string } | { uri: null; testUri: string } | { uri: string | null } | number;
  isFavorite: boolean;
  onPress: (exerciseId: string) => void;
  onToggleFavorite: (exerciseId: string) => void;
  useOptimizedImage?: boolean;
  hideFavoriteButton?: boolean;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32) / 2; // Two cards per row with 16px padding on each side

// Create a proper comparison function for memo
const arePropsEqual = (prevProps: ExerciseCardProps, nextProps: ExerciseCardProps) => {
  const imageEquals = (() => {
    // Handle number comparison (local requires)
    if (typeof prevProps.image === 'number' && typeof nextProps.image === 'number') {
      return prevProps.image === nextProps.image;
    }
    // Handle object comparison
    if (
      prevProps.image &&
      nextProps.image &&
      typeof prevProps.image === 'object' &&
      typeof nextProps.image === 'object' &&
      'uri' in prevProps.image &&
      'uri' in nextProps.image
    ) {
      return prevProps.image.uri === nextProps.image.uri;
    }
    // Fallback comparison
    return prevProps.image === nextProps.image;
  })();

  return (
    prevProps.id === nextProps.id &&
    prevProps.name === nextProps.name &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.hideFavoriteButton === nextProps.hideFavoriteButton &&
    imageEquals
  );
};

const ExerciseCard = memo(
  ({
    id,
    name,
    image,
    isFavorite,
    onPress,
    onToggleFavorite,
    useOptimizedImage = true,
    hideFavoriteButton = false,
  }: ExerciseCardProps) => {
    // Track component lifecycle with Sentry
    useEffect(() => {
      try {
        Sentry.addBreadcrumb({
          message: 'ExerciseCard mounted',
          category: 'component',
          level: 'info',
          data: {
            exerciseId: id,
            exerciseName: name,
            isFavorite,
            hideFavoriteButton,
            useOptimizedImage,
          },
        });
      } catch (error) {
        console.warn('Failed to log Sentry breadcrumb for ExerciseCard mount:', error);
      }

      return () => {
        try {
          Sentry.addBreadcrumb({
            message: 'ExerciseCard unmounted',
            category: 'component',
            level: 'info',
            data: {
              exerciseId: id,
              exerciseName: name,
            },
          });
        } catch (error) {
          console.warn('Failed to log Sentry breadcrumb for ExerciseCard unmount:', error);
        }
      };
    }, [id, name, isFavorite, hideFavoriteButton, useOptimizedImage]);

    const handlePress = useCallback(() => {
      try {
        Sentry.addBreadcrumb({
          message: 'Exercise card pressed',
          category: 'user.interaction',
          level: 'info',
          data: {
            exerciseId: id,
            exerciseName: name,
            action: 'card_press',
          },
        });

        onPress(id);
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            component: 'ExerciseCard',
            action: 'handlePress',
          },
          extra: {
            exerciseId: id,
            exerciseName: name,
          },
        });
        console.error('Error in ExerciseCard handlePress:', error);
      }
    }, [id, onPress, name]);

    const handleToggleFavorite = useCallback(() => {
      try {
        Sentry.addBreadcrumb({
          message: 'Exercise favorite toggled',
          category: 'user.interaction',
          level: 'info',
          data: {
            exerciseId: id,
            exerciseName: name,
            action: 'toggle_favorite',
            wasAlreadyFavorite: isFavorite,
            newFavoriteState: !isFavorite,
          },
        });

        onToggleFavorite(id);
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            component: 'ExerciseCard',
            action: 'handleToggleFavorite',
          },
          extra: {
            exerciseId: id,
            exerciseName: name,
            isFavorite,
          },
        });
        console.error('Error in ExerciseCard handleToggleFavorite:', error);
      }
    }, [id, onToggleFavorite, name, isFavorite]);

    // Determine the image source
    const imageSource = (() => {
      try {
        // Handle number (local require)
        if (typeof image === 'number') {
          return image;
        }
        // Handle object with uri property
        if (image && typeof image === 'object' && 'uri' in image && image.uri) {
          return { uri: image.uri };
        }
        // Default fallback
        return require('../../assets/exercises/placeholder.jpg');
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            component: 'ExerciseCard',
            action: 'imageSource',
          },
          extra: {
            exerciseId: id,
            exerciseName: name,
            imageType: typeof image,
            image: JSON.stringify(image),
          },
        });
        console.error('Error determining image source in ExerciseCard:', error);
        return require('../../assets/exercises/placeholder.jpg');
      }
    })();

    return (
      <Surface style={styles.card} elevation={2}>
        <View style={styles.cardContentWrapper}>
          <TouchableOpacity style={styles.cardContent} onPress={handlePress} activeOpacity={0.7}>
            <View style={styles.imageContainer}>
              {useOptimizedImage ? (
                <OptimizedImage
                  source={imageSource}
                  style={styles.exerciseImage}
                  fallback={require('../../assets/exercises/placeholder.jpg')}
                  resizeMode="cover"
                  cachePolicy="immutable"
                  testID={`exercise-card-${id}`}
                  isImportant={true}
                  showLoader={false}
                />
              ) : (
                <Image source={imageSource} style={styles.exerciseImage} resizeMode="cover" />
              )}

              {/* Favorite button overlay */}
              {!hideFavoriteButton && (
                <TouchableOpacity
                  style={styles.favoriteButton}
                  onPress={handleToggleFavorite}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={isFavorite ? 'star' : 'star-outline'}
                    size={20}
                    color={isFavorite ? '#FFD700' : 'rgba(255,255,255,0.8)'}
                  />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.textContainer}>
              <Text style={styles.exerciseName} numberOfLines={2} ellipsizeMode="tail">
                {name}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </Surface>
    );
  },
  arePropsEqual,
);

interface Styles {
  card: ViewStyle;
  cardContentWrapper: ViewStyle;
  cardContent: ViewStyle;
  imageContainer: ViewStyle;
  exerciseImage: ImageStyle;
  favoriteButton: ViewStyle;
  textContainer: ViewStyle;
  exerciseName: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  card: {
    width: CARD_WIDTH,
    marginHorizontal: 4,
    marginVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  cardContentWrapper: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    height: 120,
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surface,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    padding: SPACING.sm,
    minHeight: 50,
    justifyContent: 'center',
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default ExerciseCard;
