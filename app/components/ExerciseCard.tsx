import React from 'react';
import { StyleSheet, View, TouchableOpacity, Dimensions, ViewStyle, TextStyle, ImageStyle, Image } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { COLORS, BORDER_RADIUS } from '../constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

interface ExerciseCardProps {
  id: string;
  name: string;
  image: any;
  isFavorite?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 cards per row with spacing

const ExerciseCard = ({ 
  id,
  name,
  image,
  isFavorite = false,
  onPress,
  onToggleFavorite
}: ExerciseCardProps) => {
  // Create a unique debug label using exercise id or name
  const debugLabel = `exercise-card-${id || name.toLowerCase().replace(/\s+/g, '_').substring(0, 20)}`;
  
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Surface style={styles.card}>
        <View style={styles.cardContentWrapper}>
          <View style={styles.imageContainer}>
            <Image
              source={image}
              style={styles.image}
              resizeMode="cover"
              testID={debugLabel}
            />
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={onToggleFavorite}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <MaterialIcons
                name={isFavorite ? "star" : "star-outline"}
                size={24}
                color={isFavorite ? "#FFD700" : "white"}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.name} numberOfLines={2}>{name}</Text>
          </View>
        </View>
      </Surface>
    </TouchableOpacity>
  );
};

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