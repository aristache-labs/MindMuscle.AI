import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  ScrollView, 
  Pressable, 
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  BackHandler,
  Image
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
import { useDebounce } from '../hooks/useDebounce';
import supabase from '../services/supabase';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import MuscleDiagram from '../components/MuscleDiagram';
import MuscleTags from '../components/MuscleTags';
import ExerciseInstructions from '../components/ExerciseInstructions';

const { width } = Dimensions.get('window');

// In the component props interface, add the modal-specific props
interface ExerciseDetailsProps {
  isModal?: boolean;
  modalParams?: {
    id: string;
    name: string;
    image?: any;
  };
  onModalClose?: () => void;
}

export default function ExerciseDetailsScreen({ 
  isModal, 
  modalParams,
  onModalClose
}: ExerciseDetailsProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  // Use local params or modal params based on context
  const params = useLocalSearchParams();
  const { id, name, image } = isModal && modalParams 
    ? modalParams 
    : params;



  // State management
  const [activeSection, setActiveSection] = useState<'muscles' | 'instructions'>('muscles');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
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

  // State for notes
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Debounce notes changes to avoid too many database calls
  const debouncedNotes = useDebounce(notes, 1000);

  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  
  // Fetch exercise data from Supabase and SVG files
  useEffect(() => {
    if (id) {
      fetchExerciseData(id.toString());
    }
    
    // Load SVG files
    loadSvgFiles();
  }, [id]);

  // Fetch existing notes when component mounts
  useEffect(() => {
    if (id) {
      fetchExerciseNotes(id.toString());
    }
  }, [id]);

  // Save notes when they change (debounced)
  useEffect(() => {
    if (id && debouncedNotes !== undefined) {
      saveExerciseNotes(id.toString(), debouncedNotes);
    }
  }, [debouncedNotes]);

  // Handle keyboard show event
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        // Wait a bit for the keyboard animation to finish
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  // Handle back button press to dismiss keyboard
  useEffect(() => {
    // Function to dismiss keyboard when pressing back
    const handleBackButtonPress = () => {
      if (textInputRef.current && Keyboard.isVisible()) {
        textInputRef.current.blur();
        return true; // Prevent default back action while keyboard is visible
      }
      return false; // Allow default back action
    };

    // Add back button handler
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackButtonPress
    );

    // Clean up on unmount
    return () => {
      backHandler.remove();
      // Also blur the input when unmounting to prevent auto-focus when returning
      if (textInputRef.current) {
        textInputRef.current.blur();
      }
    };
  }, []);

  // Blur text input when navigating away
  useEffect(() => {
    return () => {
      // Ensure the keyboard is dismissed when unmounting
      Keyboard.dismiss();
      if (textInputRef.current) {
        textInputRef.current.blur();
      }
    };
  }, []);

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
      
      // Mark UI render time
      setTimeout(() => {

      }, 500);
    }
  };

  // Function to fetch exercise notes
  const fetchExerciseNotes = async (exerciseId: string) => {
    try {

      const { data, error } = await supabase
        .from('exercise_notes')
        .select('note_content')
        .eq('exercise_id', exerciseId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching notes:', error);

        return;
      }

      if (data) {
        setNotes(data.note_content);

      } else {
        setNotes('');
      }
    } catch (error) {
      console.error('Error fetching notes:', error);

    }
  };

  // Function to save exercise notes
  const saveExerciseNotes = async (exerciseId: string, noteContent: string) => {
    if (!noteContent.trim()) return; // Don't save empty notes
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      // Get current user ID
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Error getting user:', userError);
        setSaveError('Failed to authenticate user');
        return;
      }

      const { data, error } = await supabase
        .from('exercise_notes')
        .upsert(
          {
            exercise_id: exerciseId,
            note_content: noteContent,
            user_id: user.id,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'user_id,exercise_id'
          }
        );

      if (error) {
        console.error('Error saving notes:', error);
        setSaveError('Failed to save notes');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      setSaveError('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  // Update the handleBackPress function to use onModalClose when in modal mode
  const handleBackPress = () => {
    // Dismiss keyboard and blur input first
    Keyboard.dismiss();
    if (textInputRef.current) {
      textInputRef.current.blur();
    }

    if (isModal && onModalClose) {
      onModalClose();
    } else if (params.fromPlanDetails === 'true') {
      // If coming from plan-details, go back to plan-details explicitly
      const planId = params.planId || '';
      const accent = params.accent || '';
      const subcategoryId = params.subcategoryId || '';
      const subcategoryName = params.subcategoryName || '';
      const subcategoryTitle = params.subcategoryTitle || '';
      const subcategorySubtitle = params.subcategorySubtitle || '';
      const categoryName = params.categoryName || '';
      const planNumber = params.planNumber || '';
      const planTitle = params.planTitle || '';

      router.push({
        pathname: "/(tabs)/plan-details",
        params: { 
          planId,
          accent, // Pass accent color back to maintain color scheme
          subcategoryId,
          subcategoryName,
          subcategoryTitle,
          subcategorySubtitle,
          categoryName,
          planNumber,
          planTitle
        }
      });
    } else if (params.fromScreen) {
      // Route to the specific screen from where this was opened
      const fromScreen = params.fromScreen.toString();
      
      // Handle navigation based on fromScreen parameter
      if (fromScreen === 'exercises-list') {
        // Navigate back to exercises-list with the same parameters that brought us here
        const categoryId = params.categoryId || 'all';
        // Make sure to pass the groupByMuscle parameter to maintain muscle grouping view
        const groupByMuscle = params.groupByMuscle || 'false';
        
        router.push({
          pathname: "/(tabs)/exercises-list",
          params: { 
            categoryId,
            fromScreen: params.originalFromScreen || 'exercises', // Preserve original source
            groupByMuscle
          }
        });
      } else if (fromScreen === 'exercises') {
        // If coming from exercises tab, navigate back to exercises explicitly
        router.push('/(tabs)/exercises');
      } else {
        // For any other screen, try to navigate there directly
        router.push(`/(tabs)/${fromScreen}`);
      }
    } else {
      // Default fallback if no fromScreen is specified
      router.back();
    }
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

  // Only render header when not in modal mode
  const renderHeader = () => {
    if (isModal) return null;
    
    return (
      <>
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
          <View style={styles.headerRight} />
        </View>
        <Divider style={styles.divider} />
      </>
    );
  };
  
  // Helper function to get the correct image source
  const getImageSource = () => {
    if (!image) {
      return require('../../assets/exercises/placeholder.jpg');
    }
    
    // If it's a URL, use it directly
    if (image.toString().startsWith('http')) {
      return { uri: image.toString() };
    }
    
    // Handle placeholder identifiers from plan-details.tsx
    switch(image.toString()) {
      case 'placeholder_pushup':
        return require('../../assets/exercises/pushup.jpg');
      case 'placeholder_squat':
        return require('../../assets/exercises/squat.jpg');
      case 'placeholder_dumbbell':
        return require('../../assets/exercises/dumbbell.jpg');
      case 'placeholder_default':
      default:
        return require('../../assets/exercises/placeholder.jpg');
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
      >
        <View style={styles.container}>
          <StatusBar style="light" />
          
          {renderHeader()}
          
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.contentContainer}
            ref={scrollViewRef}
            keyboardShouldPersistTaps="handled"
          >
            {/* Exercise Image/Video */}
            <Pressable style={styles.mediaContainer} onPress={() => {}}>
              <Image 
                source={getImageSource()} 
                style={styles.mediaImage}
                resizeMode="cover"
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
              <View style={styles.notesTitleContainer}>
                <Text style={styles.notesSectionTitle}>Exercise Notes</Text>
                {isSaving && (
                  <ActivityIndicator size="small" color={COLORS.primary} style={styles.savingIndicator} />
                )}
                {saveError && (
                  <Text style={styles.errorText}>{saveError}</Text>
                )}
              </View>
              <TextInput
                style={styles.notesInput}
                placeholder="Type your notes here"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
                autoFocus={false}
                onFocus={() => {
                  // Scroll to the input when it receives focus
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
                ref={textInputRef}
              />
            </Surface>
            
            {/* Add some padding at the bottom for keyboard */}
            <View style={styles.keyboardSpacer} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    marginBottom: SPACING.md,
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
    maxHeight: 200, // Limit maximum height
    textAlignVertical: 'top',
  },
  notesTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  savingIndicator: {
    marginLeft: SPACING.sm,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    marginLeft: SPACING.sm,
  },
  keyboardSpacer: {
    height: Platform.OS === 'ios' ? 0 : 0, // Extra space at the bottom for keyboard
  },
});