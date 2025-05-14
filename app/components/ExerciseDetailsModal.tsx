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
  Image,
  Modal,
  TouchableWithoutFeedback
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { IconButton, Divider, Surface } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanGestureHandler, GestureHandlerRootView, ScrollView as GHScrollView, NativeViewGestureHandler } from 'react-native-gesture-handler';
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
import MuscleDiagram from './MuscleDiagram';
import MuscleTags from './MuscleTags';
import ExerciseInstructions from './ExerciseInstructions';

const { width, height } = Dimensions.get('window');

interface ExerciseDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  exerciseId: string;
  exerciseName: string;
  exerciseImage?: string;
}

export default function ExerciseDetailsModal({ 
  visible,
  onClose,
  exerciseId,
  exerciseName,
  exerciseImage
}: ExerciseDetailsModalProps) {
  const insets = useSafeAreaInsets();
  // Animation for modal slide up
  const translateY = useSharedValue(height);
  
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
  const panHandlerRef = useRef(null);
  const nativeScrollRef = useRef(null);
  
  // Run animation when visibility changes
  useEffect(() => {
    if (visible) {
      // Reset scroll position when opening
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ x: 0, y: 0, animated: false });
      }
      
      // Animate the modal sliding up
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      // Animate the modal sliding down
      translateY.value = withTiming(height, { duration: 300 });
    }
  }, [visible, translateY]);
  
  // Fetch exercise data from Supabase and SVG files
  useEffect(() => {
    if (visible && exerciseId) {
      console.log('Fetching exercise data for ID:', exerciseId);
      fetchExerciseData(exerciseId);
      
      // Load SVG files
      loadSvgFiles();
      
      // Fetch existing notes
      fetchExerciseNotes(exerciseId);
    }
  }, [exerciseId, visible]);

  // Save notes when they change (debounced)
  useEffect(() => {
    if (exerciseId && debouncedNotes !== undefined) {
      saveExerciseNotes(exerciseId, debouncedNotes);
    }
  }, [debouncedNotes, exerciseId]);

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

  // Handle back button press to dismiss modal or keyboard
  useEffect(() => {
    const handleBackButtonPress = () => {
      if (visible) {
        if (textInputRef.current && Keyboard.isVisible()) {
          textInputRef.current.blur();
          return true; // Prevent default back action while keyboard is visible
        } else {
          onClose();
          return true; // Prevent default back action
        }
      }
      return false; // Allow default back action when modal is not visible
    };

    // Add back button handler
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackButtonPress
    );

    // Clean up on unmount
    return () => {
      backHandler.remove();
    };
  }, [visible, onClose]);

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
        .maybeSingle(); // Use maybeSingle() instead of single() to avoid errors when no rows are found
      
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
      } else {
        // Handle case when exercise is not found
        console.log(`Exercise with ID ${exerciseId} not found`);
        setExerciseData({
          instructions: 'No instructions available for this exercise.',
          primaryMuscles: [],
          secondaryMuscles: []
        });
      }
    } catch (error) {
      console.error('Error fetching exercise data:', error);
    } finally {
      setLoading(false);
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

  // Function to manually change active section (for tab buttons)
  const changeSection = (section: 'muscles' | 'instructions') => {
    setActiveSection(section);
    translateX.value = withTiming(
      section === 'muscles' ? 0 : -sectionWidth, 
      { duration: 300 }
    );
  };

  // Animation for swiping between muscles and instructions sections
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startX = translateX.value;
    },
    onActive: (event, ctx) => {
      // Calculate absolute values for horizontal and vertical movement
      const absX = Math.abs(event.translationX);
      const absY = Math.abs(event.translationY);
      
      // Only process horizontal gestures when the horizontal movement is significantly more than vertical
      // This helps differentiate between scrolling up/down vs. swiping left/right
      if (absX > absY * 2) {
        // Calculate new position with boundaries
        let newPosition = ctx.startX + event.translationX;
        
        // Limit to only swipe between the two sections
        if (newPosition > 0) newPosition = 0;
        if (newPosition < -sectionWidth) newPosition = -sectionWidth;
        
        translateX.value = newPosition;
      }
    },
    onEnd: (event) => {
      // Only process horizontal gestures 
      const absX = Math.abs(event.velocityX);
      const absY = Math.abs(event.velocityY);
      
      // Only handle the end of gesture if it was primarily horizontal
      if (absX > absY) {
        // Determine which section to snap to based on velocity and position
        if (event.velocityX < -500 || (translateX.value < -sectionWidth / 2 && event.velocityX < 0)) {
          translateX.value = withTiming(-sectionWidth, { duration: 300 });
          runOnJS(setActiveSection)('instructions');
        } else {
          translateX.value = withTiming(0, { duration: 300 });
          runOnJS(setActiveSection)('muscles');
        }
      }
    },
  });

  // Animated styles for the modal container
  const animatedModalStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  // Animated styles for the sections container
  const animatedSectionsStyle = useAnimatedStyle(() => {
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
  
  // Helper function to get the correct image source
  const getImageSource = () => {
    if (!exerciseImage) {
      return require('../../assets/exercises/placeholder.jpg');
    }
    
    // If it's a URL, use it directly
    if (exerciseImage.toString().startsWith('http')) {
      return { uri: exerciseImage.toString() };
    }
    
    // Handle placeholder identifiers
    switch(exerciseImage.toString()) {
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

  // Early return if not visible
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.modalOverlay, { zIndex: 9999 }]}>
          <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
            <Animated.View style={[styles.modalContainer, animatedModalStyle, { zIndex: 10000 }]}>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardAvoidingView 
                  style={{ flex: 1 }} 
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
                >
                  <View style={styles.container}>
                    <StatusBar style="light" />
                    
                    {/* Adding glowing corners */}
                    <View style={styles.topGlowLeft} />
                    <View style={styles.topGlowRight} />
                    
                    {/* Header */}
                    <View style={[styles.header]}>
                      <IconButton
                        icon="close"
                        size={24}
                        iconColor="#fff"
                        onPress={onClose}
                        style={styles.closeButton}
                      />
                      <Text style={styles.headerTitle}>{exerciseName}</Text>
                    </View>
                    <Divider style={styles.divider} />
                    
                    <GHScrollView 
                      style={styles.scrollView} 
                      contentContainerStyle={styles.contentContainer}
                      ref={nativeScrollRef}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
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

                      {/* Tab buttons for switching between sections */}
                      <View style={styles.tabButtons}>
                        <Pressable
                          style={[
                            styles.tabButton,
                            activeSection === 'muscles' && styles.activeTabButton
                          ]}
                          onPress={() => changeSection('muscles')}
                        >
                          <Text style={[
                            styles.tabButtonText,
                            activeSection === 'muscles' && styles.activeTabButtonText
                          ]}>Muscles</Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.tabButton,
                            activeSection === 'instructions' && styles.activeTabButton
                          ]}
                          onPress={() => changeSection('instructions')}
                        >
                          <Text style={[
                            styles.tabButtonText,
                            activeSection === 'instructions' && styles.activeTabButtonText
                          ]}>Instructions</Text>
                        </Pressable>
                      </View>

                      {/* Swipeable Sections */}
                      <View style={styles.sectionsWrapper}>
                        <PanGestureHandler 
                          onGestureEvent={gestureHandler}
                          ref={panHandlerRef}
                          simultaneousHandlers={nativeScrollRef}
                          activeOffsetX={[-20, 20]} // Only activate for significant horizontal movements
                          failOffsetY={[-10, 10]} // Fail if primarily vertical
                        >
                          <Animated.View style={[styles.sectionsContainer, animatedSectionsStyle]}>
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
                    </GHScrollView>
                  </View>
                </KeyboardAvoidingView>
              </GestureHandlerRootView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    height: height,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    height: '94%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
  },
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 0,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { 
          width: 10, 
          height: 0,
        },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  topGlowLeft: {
    position: 'absolute',
    top: -0.7,
    left: -0.2,
    width: 13,
    height: 13,
    borderTopLeftRadius: 12,
    backgroundColor: 'transparent',
    borderLeftWidth: 0.9,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 15,
    zIndex: 1,
  },
  topGlowRight: {
    position: 'absolute',
    top: -0.7,
    right: -0.2,
    width: 13,
    height: 13,
    borderTopRightRadius: 12,
    backgroundColor: 'transparent',
    borderRightWidth: 0.9,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 15,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    padding: 16,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginRight: 40,
  },
  closeButton: {
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
  tabButtons: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  tabButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: COLORS.primary,
  },
  tabButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
  activeTabButtonText: {
    color: '#fff',
    fontWeight: 'bold',
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