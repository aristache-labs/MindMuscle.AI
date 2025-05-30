import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Surface, IconButton, useTheme } from 'react-native-paper';
import { format } from 'date-fns';
import OptimizedImage from '../OptimizedImage';
import { COLORS } from '../../constants/theme';

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

export const BeforeAfterPhotos: React.FC<BeforeAfterPhotosProps> = ({
  beforePhoto,
  afterPhoto,
  isLoading,
  onPhotoPress,
  onImageError,
}) => {
  const theme = useTheme();

  return (
    <Surface style={styles.beforeAfterContainer} elevation={2}>
      <Text style={styles.sectionTitle}>BEFORE AND AFTER</Text>
      <View style={styles.photoComparisonContainer}>
        {/* Before Photo */}
        <View style={styles.photoColumn}>
          <Pressable onPress={() => onPhotoPress('before')} style={styles.photoFrame}>
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
                  onImageError('before');
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
            <Text style={styles.photoDate}>{format(new Date(beforePhoto.date), 'MMMM, yyyy')}</Text>
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
          <Pressable onPress={() => onPhotoPress('after')} style={styles.photoFrame}>
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
                  onImageError('after');
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
            <Text style={styles.photoDate}>{format(new Date(afterPhoto.date), 'MMMM, yyyy')}</Text>
          )}
        </View>
      </View>
    </Surface>
  );
};

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
