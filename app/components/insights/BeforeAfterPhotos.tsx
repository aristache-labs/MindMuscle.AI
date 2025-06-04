import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Surface, IconButton, useTheme } from 'react-native-paper';
import { format } from 'date-fns';
import OptimizedImage from '../OptimizedImage';
import { COLORS } from '../../constants/theme';
import * as Sentry from '@sentry/react-native';
import { captureUIError, SentryReactProfiler } from '../../services/sentry';

interface DisplayProgressPhoto {
  id: string;
  url: string;
  date: string;
}

interface BeforeAfterPhotosProps {
  beforePhoto?: DisplayProgressPhoto;
  afterPhoto?: DisplayProgressPhoto;
  isLoading: boolean;
  onPhotoPress: (type: 'before' | 'after') => void;
  onImageError: (type: 'before' | 'after') => void;
}

const BeforeAfterPhotosComponent: React.FC<BeforeAfterPhotosProps> = ({
  beforePhoto,
  afterPhoto,
  isLoading,
  onPhotoPress,
  onImageError,
}) => {
  const theme = useTheme();

  // Track component lifecycle and photo state
  useEffect(() => {
    // Track component mount and photo state
    Sentry.addBreadcrumb({
      message: 'Before After Photos Section Rendered',
      category: 'ui.render',
      level: 'info',
      data: {
        hasBeforePhoto: !!beforePhoto?.url,
        hasAfterPhoto: !!afterPhoto?.url,
        isLoading,
        beforePhotoId: beforePhoto?.id,
        afterPhotoId: afterPhoto?.id,
        timestamp: new Date().toISOString(),
      },
    });

    // Track component lifecycle
    SentryReactProfiler.trackComponentLifecycle('BeforeAfterPhotos', 'mount');

    return () => {
      SentryReactProfiler.trackComponentLifecycle('BeforeAfterPhotos', 'unmount');
    };
  }, []);

  // Track photo state changes
  useEffect(() => {
    if (beforePhoto || afterPhoto) {
      Sentry.addBreadcrumb({
        message: 'Progress Photos State Updated',
        category: 'api.success',
        level: 'info',
        data: {
          beforePhoto: beforePhoto
            ? {
                id: beforePhoto.id,
                hasUrl: !!beforePhoto.url,
                date: beforePhoto.date,
              }
            : null,
          afterPhoto: afterPhoto
            ? {
                id: afterPhoto.id,
                hasUrl: !!afterPhoto.url,
                date: afterPhoto.date,
              }
            : null,
          loadingState: isLoading,
        },
      });
    }
  }, [beforePhoto, afterPhoto, isLoading]);

  const handlePhotoPress = (type: 'before' | 'after') => {
    try {
      // Track user interaction with photo
      Sentry.addBreadcrumb({
        message: `${type === 'before' ? 'Before' : 'After'} Photo Pressed`,
        category: 'user.interaction',
        level: 'info',
        data: {
          photoType: type,
          hasPhoto: type === 'before' ? !!beforePhoto?.url : !!afterPhoto?.url,
          photoId: type === 'before' ? beforePhoto?.id : afterPhoto?.id,
          isLoading,
          action:
            type === 'before'
              ? beforePhoto?.url
                ? 'view_photo'
                : 'add_photo'
              : afterPhoto?.url
                ? 'view_photo'
                : 'add_photo',
          timestamp: new Date().toISOString(),
        },
      });

      onPhotoPress(type);

      // Track successful photo interaction
      Sentry.addBreadcrumb({
        message: 'Photo Press Handler Successful',
        category: 'user.success',
        level: 'info',
        data: {
          photoType: type,
          action: 'photo_interaction_completed',
        },
      });
    } catch (error) {
      // Capture photo press errors
      captureUIError(error as Error, 'BeforeAfterPhotos.handlePhotoPress', 'insights-photos');

      Sentry.addBreadcrumb({
        message: 'Photo Press Handler Failed',
        category: 'user.error',
        level: 'error',
        data: {
          error: (error as Error).message,
          photoType: type,
          hasPhoto: type === 'before' ? !!beforePhoto?.url : !!afterPhoto?.url,
        },
      });

      console.error('Photo press error:', error);
    }
  };

  const handleImageError = (type: 'before' | 'after') => {
    try {
      const photo = type === 'before' ? beforePhoto : afterPhoto;

      // Track image loading error
      Sentry.addBreadcrumb({
        message: `${type === 'before' ? 'Before' : 'After'} Photo Loading Error`,
        category: 'ui.error',
        level: 'error',
        data: {
          photoType: type,
          photoId: photo?.id,
          photoUrl: photo?.url,
          photoDate: photo?.date,
          timestamp: new Date().toISOString(),
        },
      });

      // Capture the image loading error
      captureUIError(
        new Error(`Failed to load ${type} photo`),
        'BeforeAfterPhotos.handleImageError',
        'insights-photos',
      );

      onImageError(type);

      // Track error handling completion
      Sentry.addBreadcrumb({
        message: 'Image Error Handler Completed',
        category: 'ui.error',
        level: 'info',
        data: {
          photoType: type,
          errorHandled: true,
        },
      });
    } catch (error) {
      // Capture error in error handler
      captureUIError(
        error as Error,
        'BeforeAfterPhotos.handleImageError.errorHandler',
        'insights-photos',
      );

      Sentry.addBreadcrumb({
        message: 'Image Error Handler Failed',
        category: 'ui.error',
        level: 'error',
        data: {
          error: (error as Error).message,
          photoType: type,
        },
      });

      console.error('Image error handler error:', error);
    }
  };

  const formatPhotoDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMMM, yyyy');
    } catch (error) {
      // Capture date formatting errors
      Sentry.addBreadcrumb({
        message: 'Photo Date Formatting Error',
        category: 'ui.error',
        level: 'error',
        data: {
          originalDate: dateString,
          error: (error as Error).message,
        },
      });

      console.error('Date formatting error:', error);
      return 'Invalid date';
    }
  };

  return (
    <Surface style={styles.beforeAfterContainer} elevation={2}>
      <Text style={styles.sectionTitle}>BEFORE AND AFTER</Text>
      <View style={styles.photoComparisonContainer}>
        {/* Before Photo */}
        <View style={styles.photoColumn}>
          <Pressable onPress={() => handlePhotoPress('before')} style={styles.photoFrame}>
            {beforePhoto && beforePhoto.url ? (
              <OptimizedImage
                source={{ uri: beforePhoto.url }}
                style={styles.photo}
                resizeMode="cover"
                priority="high"
                cachePolicy="immutable"
                isImportant={true}
                showLoader={true}
                loaderColor={theme.colors.primary}
                fallback={require('../../../assets/placeholder.jpg')}
                onError={() => {
                  console.log('Before photo error loading');
                  handleImageError('before');
                }}
              />
            ) : (
              <View style={[styles.addPhotoButton, isLoading && styles.disabled]}>
                <IconButton icon="camera-plus" size={32} iconColor={theme.colors.primary} />
                <Text style={[styles.addPhotoText, { color: theme.colors.primary }]}>
                  Add Photo
                </Text>
              </View>
            )}
          </Pressable>
          <Text style={styles.photoLabel}>BEFORE</Text>
          {beforePhoto && beforePhoto.date && (
            <Text style={styles.photoDate}>{formatPhotoDate(beforePhoto.date)}</Text>
          )}
        </View>

        {/* Arrow Icon */}
        <View style={styles.arrowContainer}>
          <View style={styles.purpleDot}>
            <IconButton icon="arrow-right" iconColor="#fff" size={20} />
          </View>
        </View>

        {/* After Photo */}
        <View style={styles.photoColumn}>
          <Pressable onPress={() => handlePhotoPress('after')} style={styles.photoFrame}>
            {afterPhoto && afterPhoto.url ? (
              <OptimizedImage
                source={{ uri: afterPhoto.url }}
                style={styles.photo}
                resizeMode="cover"
                priority="high"
                cachePolicy="immutable"
                isImportant={true}
                showLoader={true}
                loaderColor={theme.colors.primary}
                fallback={require('../../../assets/placeholder.jpg')}
                onError={() => {
                  console.log('After photo error loading');
                  handleImageError('after');
                }}
              />
            ) : (
              <View style={[styles.addPhotoButton, isLoading && styles.disabled]}>
                <IconButton icon="camera-plus" size={32} iconColor={theme.colors.primary} />
                <Text style={[styles.addPhotoText, { color: theme.colors.primary }]}>
                  Add Photo
                </Text>
              </View>
            )}
          </Pressable>
          <Text style={styles.photoLabel}>AFTER</Text>
          {afterPhoto && afterPhoto.date && (
            <Text style={styles.photoDate}>{formatPhotoDate(afterPhoto.date)}</Text>
          )}
        </View>
      </View>
    </Surface>
  );
};

// Export the component wrapped with Sentry profiler
export const BeforeAfterPhotos = SentryReactProfiler.withProfiler(
  BeforeAfterPhotosComponent as React.ComponentType<unknown>,
  'BeforeAfterPhotos',
) as React.FC<BeforeAfterPhotosProps>;

const styles = StyleSheet.create({
  beforeAfterContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  photoComparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoColumn: {
    flex: 1,
    alignItems: 'center',
  },
  photoFrame: {
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  addPhotoButton: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  addPhotoText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  photoDate: {
    fontSize: 10,
    color: COLORS.text,
    opacity: 0.7,
  },
  arrowContainer: {
    flex: 0.3,
    alignItems: 'center',
  },
  purpleDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function DisplayProgressPhoto() {
  return null;
}
