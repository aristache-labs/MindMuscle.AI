import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  ScrollView, 
  Pressable, 
  Dimensions,
  ActivityIndicator
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
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import supabase from '../services/supabase';

import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import OptimizedImage from '../components/OptimizedImage';
import MuscleDiagram from '../components/MuscleDiagram';
import MuscleTags from '../components/MuscleTags';
import ExerciseInstructions from '../components/ExerciseInstructions';

const { width } = Dimensions.get('window');

export default function ExerciseDetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { id, name, image } = params;

  // State management
  const [activeSection, setActiveSection] = useState<'muscles' | 'instructions'>('muscles');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [debugMode, setDebugMode] = useState(false); // For development debugging
  const [exerciseData, setExerciseData] = useState<{
    instructions: string[] | string;
    primaryMuscles: string[];
    secondaryMuscles: string[];
  } | null>(null);
  const [frontBodySvg, setFrontBodySvg] = useState<string | null>(null);
  const [backBodySvg, setBackBodySvg] = useState<string | null>(null);
  
  // Animation for swipeable sections
  const translateX = useSharedValue(0);
  const sectionWidth = width - (SPACING.md * 2); // Account for padding

  // Fetch exercise data from Supabase and SVG files
  useEffect(() => {
    if (id) {
      fetchExerciseData(id.toString());
    }
    
    // Load SVG files
    loadSvgFiles();
  }, [id]);

  const loadSvgFiles = async () => {
    try {
      // Load front body SVG
      const frontBodyAsset = Asset.fromModule(require('../../assets/exercises/body_front.svg'));
      await frontBodyAsset.downloadAsync();
      if (frontBodyAsset.localUri) {
        const frontBodyContent = await FileSystem.readAsStringAsync(frontBodyAsset.localUri);
        setFrontBodySvg(frontBodyContent);
      }
      
      // Load back body SVG
      const backBodyAsset = Asset.fromModule(require('../../assets/exercises/body_back.svg'));
      await backBodyAsset.downloadAsync();
      if (backBodyAsset.localUri) {
        const backBodyContent = await FileSystem.readAsStringAsync(backBodyAsset.localUri);
        setBackBodySvg(backBodyContent);
      }
    } catch (error) {
      console.error('Error loading SVG files:', error);
    }
  };

  const fetchExerciseData = async (exerciseId: string) => {
    try {
      setLoading(true);
      
      // Fetch exercise data from Supabase
      const { data, error } = await supabase
        .from('exercises')
        .select('instructions, primary_muscles, secondary_muscles')
        .eq('id', exerciseId)
        .single();
      
      if (error) {
        console.error('Error fetching exercise data:', error);
        return;
      }
      
      if (data) {
        const exerciseInfo = {
          instructions: data.instructions || '',
          primaryMuscles: data.primary_muscles || [],
          secondaryMuscles: data.secondary_muscles || []
        };
        
        setExerciseData(exerciseInfo);
      }
    } catch (error) {
      console.error('Error fetching exercise data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle back button press
  const handleBackPress = () => {
    router.back();
  };

  // Toggle debug mode for development
  const toggleDebugMode = () => {
    setDebugMode(prev => !prev);
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
      // Only process horizontal gestures
      // If the user is primarily swiping vertically (more vertical than horizontal), ignore the gesture
      if (Math.abs(event.translationY) > Math.abs(event.translationX)) {
        return;
      }
      
      // Calculate new position with boundaries
      let newPosition = ctx.startX + event.translationX;
      
      // Limit to only swipe between the two sections
      if (newPosition > 0) newPosition = 0;
      if (newPosition < -sectionWidth) newPosition = -sectionWidth;
      
      translateX.value = newPosition;
    },
    onEnd: (event) => {
      // Only process horizontal gestures
      if (Math.abs(event.velocityY) > Math.abs(event.velocityX)) {
        return;
      }
      
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

  // Check if secondary muscles exist
  const hasSecondaryMuscles = useMemo(() => {
    return exerciseData?.secondaryMuscles && exerciseData.secondaryMuscles.length > 0;
  }, [exerciseData?.secondaryMuscles]);
  
  // Check if the exercise is cardio-focused
  const isCardioExercise = useMemo(() => {
    // Consider it a cardio exercise if:
    // 1. "Cardio" is in the primary muscles
    // 2. There are no back muscles in primary or secondary muscles
    
    const primaryMuscles = exerciseData?.primaryMuscles || [];
    const secondaryMuscles = exerciseData?.secondaryMuscles || [];
    
    // Check if cardio is in primary muscles
    const hasCardio = primaryMuscles.some(
      muscle => muscle.toLowerCase().includes('cardio')
    );
    
    // List of back-specific muscles
    const backMuscles = ['lats', 'traps', 'lower back', 'lowerback', 'erector'];
    
    // Check if any back muscles are in primary or secondary
    const hasBackMuscles = [...primaryMuscles, ...secondaryMuscles].some(
      muscle => backMuscles.some(backMuscle => 
        muscle.toLowerCase().includes(backMuscle)
      )
    );
    
    return hasCardio && !hasBackMuscles;
  }, [exerciseData?.primaryMuscles, exerciseData?.secondaryMuscles]);

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
            {/* Debug button toggle - visible only in dev environment */}
            {__DEV__ && (
              <IconButton
                icon="bug"
                size={24}
                onPress={toggleDebugMode}
                iconColor={debugMode ? COLORS.primary : COLORS.text}
              />
            )}
          </View>
        </View>
        
        <Divider style={styles.divider} />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          {/* Exercise Image/Video */}
          <Pressable style={styles.mediaContainer} onPress={handleMediaPress}>
            <OptimizedImage 
              source={image ? { uri: image.toString() } : require('../../assets/exercises/placeholder.jpg')} 
              style={styles.mediaImage}
            />
            <View style={styles.playButtonOverlay}>
              <MaterialIcons name="play-circle-filled" size={60} color="rgba(255,255,255,0.8)" />
            </View>
          </Pressable>

          {/* Swipe Indicator */}
          <View style={styles.swipeIndicatorContainer}>
            <Text style={styles.swipeIndicatorText}>
              {activeSection === 'muscles' ? 'Swipe left for instructions' : 'Swipe right for muscles'}
            </Text>
            <MaterialIcons 
              name={activeSection === 'muscles' ? 'arrow-forward' : 'arrow-back'} 
              size={20} 
              color="rgba(255,255,255,0.6)" 
            />
          </View>

          {/* Swipeable Sections */}
          <View style={styles.sectionsWrapper}>
            <PanGestureHandler 
              onGestureEvent={gestureHandler}
              activeOffsetX={[-10, 10]} // Only activate for horizontal movements greater than 10 units
              failOffsetY={[-5, 5]} // Fail the gesture if it moves vertically more than 5 units
            >
              <Animated.View style={[styles.sectionsContainer, animatedStyle]}>
                {/* Muscles Worked Section */}
                <Surface style={styles.sectionContent}>
                  <Text style={styles.sectionTitle}>Muscles Worked</Text>
                  
                  {/* Primary and Secondary muscle labels side by side */}
                  <View style={styles.muscleLabelsContainer}>
                    <Text style={[styles.primaryLabel, hasSecondaryMuscles ? {} : { flex: 2 }]}>Primary:</Text>
                    {hasSecondaryMuscles && <Text style={styles.secondaryLabel}>Secondary:</Text>}
                  </View>
                  
                  {/* Primary and Secondary muscle groups */}
                  <View style={styles.muscleGroupsContainer}>
                    <View style={[styles.primaryMuscleContainer, hasSecondaryMuscles ? {} : { flex: 2 }]}>
                      <MuscleTags 
                        muscles={exerciseData?.primaryMuscles || []} 
                        isPrimary={true} 
                      />
                    </View>
                    {hasSecondaryMuscles && (
                      <View style={styles.secondaryMuscleContainer}>
                        <MuscleTags 
                          muscles={exerciseData?.secondaryMuscles || []} 
                          isPrimary={false} 
                        />
                      </View>
                    )}
                  </View>
                  
                  <MuscleDiagram 
                    frontBodySvg={frontBodySvg}
                    backBodySvg={backBodySvg}
                    primaryMuscles={exerciseData?.primaryMuscles || []}
                    secondaryMuscles={exerciseData?.secondaryMuscles || []}
                    loading={loading}
                    isCardioExercise={isCardioExercise}
                    debugMode={debugMode}
                  />
                </Surface>

                {/* Instructions Section */}
                <Surface style={styles.sectionContent}>
                  <ExerciseInstructions 
                    instructions={exerciseData?.instructions || null}
                    loading={loading}
                  />
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
  sectionsWrapper: {
    height: 450,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  sectionsContainer: {
    flexDirection: 'row',
    width: width - SPACING.md * 2,
  },
  sectionContent: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    width: width - SPACING.md * 2,
    height: 450,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  muscleLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    flex: 1,
  },
  secondaryLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)', // Faded text for secondary
    flex: 2,
    textAlign: 'left',
  },
  muscleGroupsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  primaryMuscleContainer: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  secondaryMuscleContainer: {
    flex: 2,
    paddingRight: 20,
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
    marginBottom: SPACING.sm,
  },
  notesInput: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    color: COLORS.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});