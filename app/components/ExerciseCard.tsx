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

// Helper functions to reduce component complexity
const logSentryBreadcrumb = (message: string, category: string, data: Record<string, unknown>) => {
  try {
    Sentry.addBreadcrumb({
      message,
      category,
      level: 'info',
      data,
    });
  } catch (error) {
    console.warn('Failed to log Sentry breadcrumb:', error);
  }
};

const captureSentryException = (
  error: unknown,
  tags: Record<string, string>,
  extra: Record<string, unknown>,
) => {
  Sentry.captureException(error, { tags, extra });
  console.error('Error in ExerciseCard:', error);
};

const determineImageSource = (
  image: ExerciseCardProps['image'],
  exerciseId: string,
  exerciseName: string,
) => {
  try {
    if (typeof image === 'number') {
      return image;
    }
    if (image && typeof image === 'object' && 'uri' in image && image.uri) {
      return { uri: image.uri };
    }
    return require('../../assets/exercises/placeholder.jpg');
  } catch (error) {
    captureSentryException(
      error,
      { component: 'ExerciseCard', action: 'imageSource' },
      { exerciseId, exerciseName, imageType: typeof image, image: JSON.stringify(image) },
    );
    return require('../../assets/exercises/placeholder.jpg');
  }
};

const FavoriteButton = ({
  isFavorite,
  favoriteReadOnly,
  onToggleFavorite,
}: {
  isFavorite: boolean;
  favoriteReadOnly: boolean;
  onToggleFavorite: () => void;
}) => {
  const iconName = isFavorite ? 'star' : 'star-outline';
  const iconColor = isFavorite ? '#FFD700' : 'rgba(255,255,255,0.8)';

  return favoriteReadOnly ? (
    <View style={styles.favoriteButton}>
      <MaterialIcons name={iconName} size={26} color={iconColor} />
    </View>
  ) : (
    <TouchableOpacity style={styles.favoriteButton} onPress={onToggleFavorite} activeOpacity={0.7}>
      <MaterialIcons name={iconName} size={26} color={iconColor} />
    </TouchableOpacity>
  );
};

interface ExerciseCardProps {
  id: string;
  name: string;
  image: { uri: string } | { uri: null; testUri: string } | { uri: string | null } | number;
  isFavorite: boolean;
  onPress: (exerciseId: string) => void;
  onToggleFavorite: (exerciseId: string) => void;
  useOptimizedImage?: boolean;
  hideFavoriteButton?: boolean;
  favoriteReadOnly?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  showWrapper?: boolean;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 30) / 2; // Two cards per row with 16px padding on each side

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
    prevProps.favoriteReadOnly === nextProps.favoriteReadOnly &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.disabledReason === nextProps.disabledReason &&
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
    favoriteReadOnly = false,
    disabled = false,
    disabledReason = '',
    showWrapper = true,
  }: ExerciseCardProps) => {
    // Track component lifecycle with Sentry
    useEffect(() => {
      logSentryBreadcrumb('ExerciseCard mounted', 'component', {
        exerciseId: id,
        exerciseName: name,
        isFavorite,
        hideFavoriteButton,
        useOptimizedImage,
      });

      return () => {
        logSentryBreadcrumb('ExerciseCard unmounted', 'component', {
          exerciseId: id,
          exerciseName: name,
        });
      };
    }, [id, name, isFavorite, hideFavoriteButton, useOptimizedImage]);

    const handlePress = useCallback(() => {
      if (disabled) return;

      try {
        logSentryBreadcrumb('Exercise card pressed', 'user.interaction', {
          exerciseId: id,
          exerciseName: name,
          action: 'card_press',
        });
        onPress(id);
      } catch (error) {
        captureSentryException(
          error,
          { component: 'ExerciseCard', action: 'handlePress' },
          { exerciseId: id, exerciseName: name },
        );
      }
    }, [id, onPress, name, disabled]);

    const handleToggleFavorite = useCallback(() => {
      if (disabled) return;

      try {
        logSentryBreadcrumb('Exercise favorite toggled', 'user.interaction', {
          exerciseId: id,
          exerciseName: name,
          action: 'toggle_favorite',
          wasAlreadyFavorite: isFavorite,
          newFavoriteState: !isFavorite,
        });
        onToggleFavorite(id);
      } catch (error) {
        captureSentryException(
          error,
          { component: 'ExerciseCard', action: 'handleToggleFavorite' },
          { exerciseId: id, exerciseName: name, isFavorite },
        );
      }
    }, [id, onToggleFavorite, name, isFavorite, disabled]);

    // Determine the image source
    const imageSource = determineImageSource(image, id, name);

    const cardContent = (
      <Surface style={[styles.card, disabled && styles.disabledCard]} elevation={2}>
        <View style={styles.cardContentWrapper}>
          <TouchableOpacity
            style={styles.cardContent}
            onPress={handlePress}
            activeOpacity={disabled ? 1 : 0.7}
            disabled={disabled}
          >
            <View style={styles.imageContainer}>
              {useOptimizedImage ? (
                <OptimizedImage
                  source={imageSource}
                  style={[styles.exerciseImage, disabled && styles.disabledImage]}
                  fallback={require('../../assets/exercises/placeholder.jpg')}
                  resizeMode="cover"
                  cachePolicy="immutable"
                  testID={`exercise-card-${id}`}
                  isImportant={true}
                  showLoader={false}
                />
              ) : (
                <Image
                  source={imageSource}
                  style={[styles.exerciseImage, disabled && styles.disabledImage]}
                  resizeMode="cover"
                />
              )}

              {/* Disabled overlay */}
              {disabled && (
                <View style={styles.disabledOverlay}>
                  <MaterialIcons name="check-circle" size={32} color="rgba(124, 58, 237, 0.9)" />
                  <Text style={styles.disabledText}>{disabledReason || 'Already Added'}</Text>
                </View>
              )}

              {/* Favorite button overlay */}
              {!hideFavoriteButton && !disabled && (
                <FavoriteButton
                  isFavorite={isFavorite}
                  favoriteReadOnly={favoriteReadOnly}
                  onToggleFavorite={handleToggleFavorite}
                />
              )}
            </View>

            <View style={styles.textContainer}>
              <Text
                style={[styles.exerciseName, disabled && styles.disabledExerciseName]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {name}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </Surface>
    );

    return showWrapper ? (
      <View style={styles.exerciseCardWrapper}>{cardContent}</View>
    ) : (
      cardContent
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
  disabledCard: ViewStyle;
  disabledImage: ImageStyle;
  disabledOverlay: ViewStyle;
  disabledText: TextStyle;
  disabledExerciseName: TextStyle;
  exerciseCardWrapper: ViewStyle;
}

const styles = StyleSheet.create<Styles>({
  card: {
    width: CARD_WIDTH,
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    // Multi-layered shadow system for depth
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    // Sophisticated border with gradient-like effect
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
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
    height: 100,
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surface,
  },
  favoriteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    padding: SPACING.xs,
    minHeight: 40,
    minWidth: '100%',
    justifyContent: 'center',
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  disabledCard: {
    opacity: 0.6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  disabledImage: {
    opacity: 0.4,
  },
  disabledOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabledText: {
    color: 'rgba(124, 58, 237, 0.9)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  disabledExerciseName: {
    opacity: 0.5,
  },
  exerciseCardWrapper: {
    width: CARD_WIDTH,
    marginHorizontal: 4,
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ExerciseCard;
