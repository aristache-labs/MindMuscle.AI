import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Pressable, 
  Dimensions 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { IconButton, Divider, Surface } from 'react-native-paper';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedGestureHandler,
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import { StackActions } from '@react-navigation/native';

import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import OptimizedImage from '../components/OptimizedImage';

const { width } = Dimensions.get('window');

export default function ExerciseDetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { id, name, image } = params;

  // State for managing which section is visible
  const [activeSection, setActiveSection] = useState<'muscles' | 'instructions'>('muscles');
  const [notes, setNotes] = useState('');
  
  // Animation for swipeable sections
  const translateX = useSharedValue(0);
  const sectionWidth = width - (SPACING.md * 2); // Account for padding

  // Handle back button press
  const handleBackPress = () => {
    router.back();
  };

  // Handle image/video container press - would show fullscreen or play video
  const handleMediaPress = () => {
    // Implementation for showing fullscreen image or playing video
    console.log('Media pressed');
  };

  // Animation for swiping between muscles and instructions sections
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startX = translateX.value;
    },
    onActive: (event, ctx) => {
      // Calculate new position with boundaries
      let newPosition = ctx.startX + event.translationX;
      
      // Limit to only swipe between the two sections
      if (newPosition > 0) newPosition = 0;
      if (newPosition < -sectionWidth) newPosition = -sectionWidth;
      
      translateX.value = newPosition;
    },
    onEnd: (event) => {
      // Determine which section to snap to based on velocity and position
      if (event.velocityX < -500 || (translateX.value < -sectionWidth / 2 && event.velocityX < 0)) {
        translateX.value = withTiming(-sectionWidth, { duration: 300 });
        runOnJS(setActiveSection)('instructions');
      } else {
        translateX.value = withTiming(0, { duration: 300 });
        runOnJS(setActiveSection)('muscles');
      }
    },
  });

  // Animated styles for the sections container
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar style="light" />
        
        {/* Custom Header with Back Button */}
        <View style={[styles.header, { marginTop: insets.top }]}>
          <View style={styles.headerLeft}>
            <IconButton
              icon="arrow-left"
              size={28}
              onPress={handleBackPress}
              iconColor={COLORS.text}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            />
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{name}</Text>
          </View>
          <View style={styles.headerRight}>
            {/* Empty space for balance */}
          </View>
        </View>
        <Divider style={styles.divider} />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          {/* Exercise Image/Video Container */}
          <TouchableOpacity 
            style={styles.mediaContainer}
            onPress={handleMediaPress}
            activeOpacity={0.9}
          >
            <OptimizedImage
              source={typeof image === 'string' ? { uri: image } : require('../../assets/exercises/placeholder.jpg')}
              style={styles.mediaImage}
              contentFit="cover"
            />
            <View style={styles.playButtonOverlay}>
              <MaterialIcons name="play-circle-outline" size={48} color="white" />
            </View>
          </TouchableOpacity>

          {/* Exercise History Container (placeholder) */}
          <Surface style={styles.historyContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Exercise History</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.placeholderText}>
              Your exercise history will appear here once you've completed this exercise.
            </Text>
          </Surface>

          {/* Swipe Indicator */}
          <View style={styles.swipeIndicatorContainer}>
            <Text style={styles.swipeIndicatorText}>
              {activeSection === 'muscles' ? 'Swipe left for Instructions' : 'Swipe right for Muscles Worked'}
            </Text>
            <MaterialIcons 
              name={activeSection === 'muscles' ? 'arrow-forward' : 'arrow-back'} 
              size={20} 
              color="rgba(255,255,255,0.6)" 
            />
          </View>

          {/* Swipeable Sections */}
          <View style={styles.sectionsWrapper}>
            <PanGestureHandler onGestureEvent={gestureHandler}>
              <Animated.View style={[styles.sectionsContainer, animatedStyle]}>
                {/* Muscles Worked Section */}
                <Surface style={styles.sectionContent}>
                  <Text style={styles.sectionTitle}>Muscles Worked</Text>
                  
                  <Text style={styles.sectionSubtitle}>Primary:</Text>
                  <View style={styles.primaryMuscleTag}>
                    <Text style={styles.primaryMuscleText}>Cardio</Text>
                  </View>
                  
                  <View style={styles.muscleMapContainer}>
                    <View style={styles.muscleMap}>
                      {/* Simplified muscle visualization */}
                      <View style={styles.bodyView}>
                        <View style={styles.bodyPlaceholder}>
                          <View style={styles.chestHighlight} />
                        </View>
                      </View>
                    </View>
                  </View>
                  
                  <Text style={styles.sectionSubtitle}>Secondary:</Text>
                  <Text style={styles.sectionText}>
                    Shoulders, Triceps, Core
                  </Text>
                </Surface>

                {/* Instructions Section */}
                <Surface style={styles.sectionContent}>
                  <Text style={styles.sectionTitle}>Instructions</Text>
                  
                  <Text style={styles.instructionText}>
                    Set the treadmill to your desired incline and speed.
                    Begin with a slow jog to warm up for 2-3 minutes.
                    Gradually increase speed to your target pace.
                    Maintain an upright posture with your head up, shoulders back, and core engaged.
                    Land midfoot, not on your heels or toes.
                    Allow your arms to swing naturally at 90-degree angles.
                    Continue for your desired duration.
                    Finish with a cooldown walk for 2-3 minutes.
                  </Text>
                </Surface>
              </Animated.View>
            </PanGestureHandler>
          </View>

          {/* Exercise Notes */}
          <Surface style={styles.notesContainer}>
            <Text style={styles.notesSectionTitle}>Exercise Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Type your notes here"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
          </Surface>
        </ScrollView>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: SPACING.md,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 4,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  backButton: {
    margin: 0,
  },
  divider: {
    backgroundColor: COLORS.primary,
    height: 0.2,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.md,
  },
  mediaContainer: {
    height: 240,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  historyContainer: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionsWrapper: {
    height: 350,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  sectionsContainer: {
    flexDirection: 'row',
    width: (width - SPACING.md), // Double width to hold both sections
  },
  sectionContent: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    width: width - SPACING.md * 2, // Full width minus padding
    height: 350,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  seeAllText: {
    fontSize: 14,
    color: COLORS.primary,
  },
  placeholderText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
  },
  swipeIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  swipeIndicatorText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginRight: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sectionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  instructionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
  },
  muscleMapContainer: {
    marginBottom: SPACING.md,
  },
  muscleMap: {
    marginVertical: SPACING.sm,
  },
  bodyView: {
    width: '100%',
    height: 200,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyPlaceholder: {
    width: '50%',
    height: '90%',
    backgroundColor: 'rgba(100,100,100,0.3)',
    borderRadius: BORDER_RADIUS.md,
    position: 'relative',
  },
  chestHighlight: {
    position: 'absolute',
    width: 40,
    height: 30,
    backgroundColor: 'rgba(255,0,0,0.6)',
    borderRadius: BORDER_RADIUS.sm,
    top: 50,
    left: 25,
  },
  primaryMuscleTag: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
  },
  primaryMuscleText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 12,
  },
  notesContainer: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  notesSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  notesInput: {
    height: 100,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    color: COLORS.text,
    fontSize: 14,
  },
}); 