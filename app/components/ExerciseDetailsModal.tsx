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
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { IconButton, Divider, Surface } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import {
  PanGestureHandler,
  GestureHandlerRootView,
  ScrollView as GHScrollView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { useDebounce } from '../hooks/useDebounce';
import supabase from '../services/supabase';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import MuscleDiagram from './MuscleDiagram';
import MuscleTags from './MuscleTags';
import ExerciseInstructions from './ExerciseInstructions';
import OptimizedImage from './OptimizedImage';

const { width, height } = Dimensions.get('window');

// Load and cache SVG assets once at module level
const svgCache = {
  frontBody: null as string | null,
  backBody: null as string | null,
};

// Safely load an SVG asset
const safeLoadSvg = async (assetType: 'front' | 'back'): Promise<string | null> => {
  try {
    // Use static requires to avoid dynamic require errors
    let assetModule;
    if (assetType === 'front') {
      assetModule = require('../../assets/exercises/body_front.svg');
    } else if (assetType === 'back') {
      assetModule = require('../../assets/exercises/body_back.svg');
    } else {
      console.warn(`Unsupported SVG asset type: ${assetType}`);
      return null;
    }

    if (!assetModule) return null;

    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();

    if (asset.localUri) {
      return await FileSystem.readAsStringAsync(asset.localUri);
    }
    return null;
  } catch (error) {
    console.warn(`Failed to load SVG: ${assetType}`, error);
    return null;
  }
};

// Initialize SVG cache asynchronously
(async () => {
  try {
    // Only load if not already cached
    if (!svgCache.frontBody) {
      svgCache.frontBody = await safeLoadSvg('front');
    }

    if (!svgCache.backBody) {
      svgCache.backBody = await safeLoadSvg('back');
    }
  } catch (error) {
    console.warn('Error initializing SVG cache:', error);
    // Silent fail - we'll handle this in the component
  }
})();

interface ExerciseDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  exerciseId: string;
  exerciseName: string;
  exerciseImage?: string;
  primary_muscles?: string[];
  secondary_muscles?: string[];
}

// Custom hook for modal animation
const useModalAnimation = (visible: boolean, onClose: () => void) => {
  const translateY = useSharedValue(height);
  const [internalVisible, setInternalVisible] = useState(false);
  const isClosing = useRef(false);

  const handleInternalClose = () => {
    try {
      setInternalVisible(false);
      isClosing.current = false;
      onClose();
    } catch (error) {
      console.error('Error closing modal:', error);
      // Ensure we still clean up state even if onClose fails
      setInternalVisible(false);
      isClosing.current = false;
    }
  };

  const performClose = () => {
    if (isClosing.current) return;

    isClosing.current = true;
    translateY.value = withTiming(
      height,
      {
        duration: 400,
        easing: Easing.bezierFn(0.16, 1, 0.3, 1),
      },
      (finished) => {
        if (finished) {
          runOnJS(handleInternalClose)();
        }
      },
    );
  };

  const handleClose = () => {
    if (!isClosing.current) {
      performClose();
    }
  };

  useEffect(() => {
    if (visible && !isClosing.current) {
      setInternalVisible(true);
      isClosing.current = false;
      translateY.value = height;

      // Use requestAnimationFrame instead of setTimeout for better performance
      const animateIn = () => {
        translateY.value = withTiming(0, {
          duration: 400,
          easing: Easing.bezierFn(0.16, 1, 0.3, 1),
        });
      };

      requestAnimationFrame(animateIn);
    } else if (!visible && !isClosing.current) {
      // If visible becomes false externally, just hide immediately
      setInternalVisible(false);
    }
  }, [visible, translateY]);

  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return {
    internalVisible,
    handleClose,
    animatedModalStyle,
    isClosing: isClosing.current,
  };
};

// Custom hook for exercise data management
const useExerciseData = (
  exerciseId: string,
  visible: boolean,
  primary_muscles?: string[],
  secondary_muscles?: string[],
) => {
  const [loading, setLoading] = useState(true);
  const [exerciseData, setExerciseData] = useState<{
    instructions: string[] | string;
    primaryMuscles: string[];
    secondaryMuscles: string[];
  } | null>(null);

  const fetchExerciseData = async (exerciseId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exercises')
        .select('instructions, primary_muscles, secondary_muscles')
        .eq('id', exerciseId)
        .maybeSingle();

      if (error) return;

      if (data) {
        const exerciseInfo = {
          instructions: data.instructions || [],
          primaryMuscles:
            Array.isArray(primary_muscles) && primary_muscles.length > 0
              ? primary_muscles
              : Array.isArray(data.primary_muscles)
                ? data.primary_muscles
                : [],
          secondaryMuscles:
            Array.isArray(secondary_muscles) && secondary_muscles.length > 0
              ? secondary_muscles
              : Array.isArray(data.secondary_muscles)
                ? data.secondary_muscles
                : [],
        };
        setExerciseData(exerciseInfo);
      } else {
        setExerciseData({
          instructions: 'No instructions available for this exercise.',
          primaryMuscles: [],
          secondaryMuscles: [],
        });
      }
    } catch (error) {
      console.error('Error fetching exercise details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && exerciseId) {
      fetchExerciseData(exerciseId);
    }
  }, [exerciseId, visible]);

  return { loading, exerciseData };
};

// Custom hook for exercise notes
const useExerciseNotes = (exerciseId: string, visible: boolean) => {
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const debouncedNotes = useDebounce(notes, 1000);

  const fetchExerciseNotes = async (exerciseId: string) => {
    try {
      const { data, error } = await supabase
        .from('exercise_notes')
        .select('note_content')
        .eq('exercise_id', exerciseId)
        .maybeSingle();

      if (error) {
        console.warn('Failed to fetch exercise notes:', error);
        return;
      }

      setNotes(data?.note_content || '');
    } catch (error) {
      console.warn('Failed to fetch exercise notes:', error);
    }
  };

  const saveExerciseNotes = async (exerciseId: string, noteContent: string) => {
    if (!noteContent.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setSaveError('Failed to authenticate user');
        return;
      }

      const { error } = await supabase.from('exercise_notes').upsert(
        {
          exercise_id: exerciseId,
          note_content: noteContent,
          user_id: user.id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,exercise_id',
        },
      );

      if (error) {
        setSaveError('Failed to save notes');
      }
    } catch (error) {
      console.warn('Failed to save exercise notes:', error);
      setSaveError('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (visible && exerciseId) {
      fetchExerciseNotes(exerciseId);
    }
  }, [exerciseId, visible]);

  useEffect(() => {
    if (exerciseId && debouncedNotes !== undefined) {
      saveExerciseNotes(exerciseId, debouncedNotes);
    }
  }, [debouncedNotes, exerciseId]);

  return { notes, setNotes, isSaving, saveError };
};

// Custom hook for SVG management
const useSvgAssets = (visible: boolean) => {
  const [frontBodySvg, setFrontBodySvg] = useState<string | null>(svgCache.frontBody);
  const [backBodySvg, setBackBodySvg] = useState<string | null>(svgCache.backBody);

  useEffect(() => {
    const loadSvgs = async () => {
      try {
        if (!frontBodySvg && !svgCache.frontBody) {
          const content = await safeLoadSvg('front');
          if (content) {
            setFrontBodySvg(content);
            svgCache.frontBody = content;
          }
        } else if (!frontBodySvg && svgCache.frontBody) {
          setFrontBodySvg(svgCache.frontBody);
        }

        if (!backBodySvg && !svgCache.backBody) {
          const content = await safeLoadSvg('back');
          if (content) {
            setBackBodySvg(content);
            svgCache.backBody = content;
          }
        } else if (!backBodySvg && svgCache.backBody) {
          setBackBodySvg(svgCache.backBody);
        }
      } catch (error) {
        console.warn('Error loading SVGs in component:', error);
      }
    };

    if (visible) {
      loadSvgs();
    }
  }, [visible, frontBodySvg, backBodySvg]);

  return { frontBodySvg, backBodySvg };
};

// Custom hook for section swiping
const useSectionSwipe = () => {
  const [activeSection, setActiveSection] = useState<'muscles' | 'instructions'>('muscles');
  const translateX = useSharedValue(0);
  const sectionWidth = width - SPACING.md * 2;

  const changeSection = (section: 'muscles' | 'instructions') => {
    setActiveSection(section);
    translateX.value = withTiming(section === 'muscles' ? 0 : -sectionWidth, { duration: 300 });
  };

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: { startX: number }) => {
      ctx.startX = translateX.value;
    },
    onActive: (event, ctx) => {
      const absX = Math.abs(event.translationX);
      const absY = Math.abs(event.translationY);

      if (absX > absY * 2) {
        let newPosition = ctx.startX + event.translationX;
        if (newPosition > 0) newPosition = 0;
        if (newPosition < -sectionWidth) newPosition = -sectionWidth;
        translateX.value = newPosition;
      }
    },
    onEnd: (event) => {
      const absX = Math.abs(event.velocityX);
      const absY = Math.abs(event.velocityY);

      if (absX > absY) {
        if (
          event.velocityX < -500 ||
          (translateX.value < -sectionWidth / 2 && event.velocityX < 0)
        ) {
          translateX.value = withTiming(-sectionWidth, { duration: 300 });
          runOnJS(setActiveSection)('instructions');
        } else {
          translateX.value = withTiming(0, { duration: 300 });
          runOnJS(setActiveSection)('muscles');
        }
      }
    },
  });

  const animatedSectionsStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return {
    activeSection,
    changeSection,
    gestureHandler,
    animatedSectionsStyle,
  };
};

// Helper function to get image source
const getImageSource = (exerciseImage?: string) => {
  if (!exerciseImage) {
    return require('../../assets/exercises/placeholder.jpg');
  }

  if (exerciseImage.toString().startsWith('http')) {
    return { uri: exerciseImage.toString() };
  }

  switch (exerciseImage.toString()) {
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

// Helper function to determine if exercise is cardio
const isCardioExercise = (primaryMuscles: string[], secondaryMuscles: string[]) => {
  const hasCardio = primaryMuscles.some((muscle) => muscle?.toLowerCase().includes('cardio'));
  const backMuscles = ['lats', 'traps', 'lower back', 'lowerback', 'erector'];
  const hasBackMuscles = [...primaryMuscles, ...secondaryMuscles].some((muscle) =>
    backMuscles.some((backMuscle) => muscle?.toLowerCase().includes(backMuscle)),
  );
  return hasCardio && !hasBackMuscles;
};

// Modal Header Component
const ModalHeader = ({ exerciseName, onClose }: { exerciseName: string; onClose: () => void }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    onClose();
    // Reset after a short delay to prevent issues if modal doesn't close
    setTimeout(() => setIsClosing(false), 1000);
  };

  return (
    <>
      <View style={styles.topGlowLeft} />
      <View style={styles.topGlowRight} />
      <View style={styles.header}>
        <IconButton
          icon="close"
          size={24}
          iconColor="#fff"
          onPress={handleClose}
          style={styles.closeButton}
          disabled={isClosing}
        />
        <Text style={styles.headerTitle}>{exerciseName}</Text>
      </View>
      <Divider style={styles.divider} />
    </>
  );
};

// Exercise Media Component
const ExerciseMedia = ({ exerciseImage }: { exerciseImage?: string }) => (
  <Pressable style={styles.mediaContainer} onPress={() => {}}>
    <OptimizedImage
      source={getImageSource(exerciseImage)}
      style={styles.mediaImage}
      resizeMode="cover"
      cachePolicy="immutable"
      fallback={require('../../assets/exercises/placeholder.jpg')}
      isImportant={true}
    />
    <View style={styles.playButtonOverlay}>
      <MaterialIcons name="play-circle-filled" size={60} color="rgba(255,255,255,0.8)" />
    </View>
  </Pressable>
);

// Tab Navigation Component
const TabNavigation = ({
  activeSection,
  onChangeSection,
}: {
  activeSection: 'muscles' | 'instructions';
  onChangeSection: (section: 'muscles' | 'instructions') => void;
}) => (
  <View style={styles.tabButtons}>
    <Pressable
      style={[styles.tabButton, activeSection === 'muscles' && styles.activeTabButton]}
      onPress={() => onChangeSection('muscles')}
    >
      <Text
        style={[styles.tabButtonText, activeSection === 'muscles' && styles.activeTabButtonText]}
      >
        Muscles
      </Text>
    </Pressable>
    <Pressable
      style={[styles.tabButton, activeSection === 'instructions' && styles.activeTabButton]}
      onPress={() => onChangeSection('instructions')}
    >
      <Text
        style={[
          styles.tabButtonText,
          activeSection === 'instructions' && styles.activeTabButtonText,
        ]}
      >
        Instructions
      </Text>
    </Pressable>
  </View>
);

// Muscles Section Component
const MusclesSection = ({
  loading,
  effectivePrimaryMuscles,
  effectiveSecondaryMuscles,
  hasSecondaryMuscles,
  frontBodySvg,
  backBodySvg,
  cardioExercise,
}: {
  loading: boolean;
  effectivePrimaryMuscles: string[];
  effectiveSecondaryMuscles: string[];
  hasSecondaryMuscles: boolean;
  frontBodySvg: string | null;
  backBodySvg: string | null;
  cardioExercise: boolean;
}) => (
  <Surface style={styles.sectionContent}>
    <Text style={styles.sectionTitle}>Muscles Worked</Text>
    {loading ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    ) : (
      <>
        <View style={styles.muscleLabelsContainer}>
          <Text style={[styles.primaryLabel, hasSecondaryMuscles ? {} : { flex: 2 }]}>
            Primary:
          </Text>
          {hasSecondaryMuscles && <Text style={styles.secondaryLabel}>Secondary:</Text>}
        </View>
        <View style={styles.muscleGroupsContainer}>
          <View style={[styles.primaryMuscleContainer, hasSecondaryMuscles ? {} : { flex: 2 }]}>
            <MuscleTags muscles={effectivePrimaryMuscles} isPrimary={true} />
          </View>
          {hasSecondaryMuscles && (
            <View style={styles.secondaryMuscleContainer}>
              <MuscleTags muscles={effectiveSecondaryMuscles} isPrimary={false} />
            </View>
          )}
        </View>
      </>
    )}
    <MuscleDiagram
      frontBodySvg={frontBodySvg}
      backBodySvg={backBodySvg}
      primaryMuscles={effectivePrimaryMuscles}
      secondaryMuscles={effectiveSecondaryMuscles}
      loading={loading}
      isCardioExercise={cardioExercise}
      debugMode={false}
    />
  </Surface>
);

// Exercise Notes Component
const ExerciseNotes = ({
  notes,
  onNotesChange,
  isSaving,
  saveError,
  textInputRef,
  scrollViewRef,
}: {
  notes: string;
  onNotesChange: (text: string) => void;
  isSaving: boolean;
  saveError: string | null;
  textInputRef: React.RefObject<TextInput | null>;
  scrollViewRef: React.RefObject<ScrollView | null>;
}) => (
  <Surface style={styles.notesContainer}>
    <View style={styles.notesTitleContainer}>
      <Text style={styles.notesSectionTitle}>Exercise Notes</Text>
      {isSaving && (
        <ActivityIndicator size="small" color={COLORS.primary} style={styles.savingIndicator} />
      )}
      {saveError && <Text style={styles.errorText}>{saveError}</Text>}
    </View>
    <TextInput
      style={styles.notesInput}
      placeholder="Type your notes here"
      placeholderTextColor="rgba(255,255,255,0.5)"
      value={notes}
      onChangeText={onNotesChange}
      multiline
      textAlignVertical="top"
      autoFocus={false}
      onFocus={() => {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }}
      ref={textInputRef}
    />
  </Surface>
);

export default function ExerciseDetailsModal({
  visible,
  onClose,
  exerciseId,
  exerciseName,
  exerciseImage,
  primary_muscles,
  secondary_muscles,
}: ExerciseDetailsModalProps) {
  const { internalVisible, handleClose, animatedModalStyle, isClosing } = useModalAnimation(
    visible,
    onClose,
  );
  const { loading, exerciseData } = useExerciseData(
    exerciseId,
    visible,
    primary_muscles,
    secondary_muscles,
  );
  const { notes, setNotes, isSaving, saveError } = useExerciseNotes(exerciseId, visible);
  const { frontBodySvg, backBodySvg } = useSvgAssets(visible);
  const { activeSection, changeSection, gestureHandler, animatedSectionsStyle } = useSectionSwipe();

  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const panHandlerRef = useRef(null);
  const nativeScrollRef = useRef(null);

  // Effective muscle data with memoization
  const effectivePrimaryMuscles = useMemo(() => {
    return primary_muscles && primary_muscles.length > 0
      ? primary_muscles
      : exerciseData?.primaryMuscles || [];
  }, [primary_muscles, exerciseData?.primaryMuscles]);

  const effectiveSecondaryMuscles = useMemo(() => {
    return secondary_muscles && secondary_muscles.length > 0
      ? secondary_muscles
      : exerciseData?.secondaryMuscles || [];
  }, [secondary_muscles, exerciseData?.secondaryMuscles]);

  const hasSecondaryMuscles = useMemo(() => {
    return effectiveSecondaryMuscles && effectiveSecondaryMuscles.length > 0;
  }, [effectiveSecondaryMuscles]);

  const cardioExercise = useMemo(() => {
    return isCardioExercise(effectivePrimaryMuscles, effectiveSecondaryMuscles);
  }, [effectivePrimaryMuscles, effectiveSecondaryMuscles]);

  // Keyboard and back button handling
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  useEffect(() => {
    const handleBackButtonPress = () => {
      if (visible && !isClosing) {
        if (textInputRef.current && Keyboard.isVisible()) {
          textInputRef.current.blur();
          return true;
        } else {
          handleClose();
          return true;
        }
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackButtonPress);
    return () => {
      backHandler.remove();
    };
  }, [visible, handleClose, isClosing]);

  if (!internalVisible) return null;

  return (
    <Modal
      visible={internalVisible && !isClosing}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
      supportedOrientations={['portrait']}
      hardwareAccelerated={true}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={[styles.modalOverlay, { zIndex: 9999 }]}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Animated.View style={[styles.modalContainer, animatedModalStyle, { zIndex: 10000 }]}>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardAvoidingView
                  style={{ flex: 1 }}
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
                >
                  <View style={styles.container}>
                    <StatusBar style="light" />
                    <ModalHeader exerciseName={exerciseName} onClose={handleClose} />

                    <GHScrollView
                      style={styles.scrollView}
                      contentContainerStyle={styles.contentContainer}
                      ref={nativeScrollRef}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      scrollEventThrottle={16}
                      decelerationRate="fast"
                      overScrollMode="never"
                    >
                      <ExerciseMedia exerciseImage={exerciseImage} />
                      <TabNavigation
                        activeSection={activeSection}
                        onChangeSection={changeSection}
                      />

                      <View style={styles.sectionsWrapper}>
                        <PanGestureHandler
                          onGestureEvent={gestureHandler}
                          ref={panHandlerRef}
                          simultaneousHandlers={nativeScrollRef}
                          activeOffsetX={[-20, 20]}
                          failOffsetY={[-10, 10]}
                        >
                          <Animated.View style={[styles.sectionsContainer, animatedSectionsStyle]}>
                            <MusclesSection
                              loading={loading}
                              effectivePrimaryMuscles={effectivePrimaryMuscles}
                              effectiveSecondaryMuscles={effectiveSecondaryMuscles}
                              hasSecondaryMuscles={hasSecondaryMuscles}
                              frontBodySvg={frontBodySvg}
                              backBodySvg={backBodySvg}
                              cardioExercise={cardioExercise}
                            />
                            <Surface style={styles.sectionContent}>
                              <ExerciseInstructions
                                instructions={exerciseData?.instructions || null}
                                loading={loading}
                              />
                            </Surface>
                          </Animated.View>
                        </PanGestureHandler>
                      </View>

                      <ExerciseNotes
                        notes={notes}
                        onNotesChange={setNotes}
                        isSaving={isSaving}
                        saveError={saveError}
                        textInputRef={textInputRef}
                        scrollViewRef={scrollViewRef}
                      />

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
    height: '92%',
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
  loadingContainer: {
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
});
