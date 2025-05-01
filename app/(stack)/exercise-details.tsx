import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
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
import { StackActions } from '@react-navigation/native';
import { SvgXml } from 'react-native-svg';
import supabase from '../services/supabase';

import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import OptimizedImage from '../components/OptimizedImage';

const { width } = Dimensions.get('window');

// Import SVG files
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

// Muscle group color mapping
const MUSCLE_COLORS: { [key: string]: string } = {
  cardio: '#FF0000',         // red
  lats: '#3CE8E8',           // teal
  biceps: '#D74FA0',         // pink
  chest: '#00D3FF',          // light blue
  shoulders: '#C34FFB',      // purple
  forearms: '#FF38DF',       // pink
  obliques: '#38FF98',       // light green
  quads: '#EDFF38',          // yellow
  glutes: '#949F27',         // olive
  adductors: '#D7B110',      // gold
  abs: '#00FF19',            // green
  traps: '#7B3C9B',          // purple
  abductors: '#C2B575',      // beige
  lowerback: '#98D1D0',      // light teal
  'lower back': '#98D1D0',   // same as lowerback
  hamstrings: '#D0F70D',     // lime
  triceps: '#F361C4',        // pink
  calves: '#DFFE4A',         // yellow-green
};

// Mapping between database muscle names and SVG element IDs
const MUSCLE_ID_MAPPING: { [key: string]: string[] } = {
  // Primary mapping for front view muscles
  cardio: ['Cardio', 'cardio', 'heart'],
  chest: ['Chest', 'chest', 'Chest_2', 'Chest_3', 'Chest_4', 'pectorals', 'pecs'],
  shoulders: ['Shoulders', 'Shoulders_2', 'Shoulders_3', 'Delts', 'delts', 'deltoids', 'Vector_9', 'Vector_10', 'Shoulders-front', 'Shoulders-back'],
  triceps: ['Triceps', 'tricep', 'Tricep', 'Triceps-left', 'Triceps-right', 'Group 302', 'Group 303', 'Triceps_left', 'Triceps_right'],
  biceps: ['Biceps', 'Biceps_2', 'bicep', 'Biceps-left', 'Biceps-right', 'Biceps_left', 'Biceps_right', 'Vector 28', 'Vector 29', 'Vector 26', 'Vector 27'],
  forearms: ['Forearms', 'Forearms_2', 'Forearms_3', 'Forearms_4', 'forearm'],
  abs: ['Abs', 'Abs_2', 'Abs_3', 'abdomen', 'abdominals'],
  obliques: ['Obliques', 'oblique'],
  quads: ['Quads', 'Quads_2', 'quadriceps'],
  adductors: ['Adductors', 'Adductors_2', 'Adductors_3', 'Aductors', 'adductor'], // Note: "Aductors" accommodates the misspelling in SVG
  abductors: ['Abductors', 'Abductors_2'],
  
  // Primary mapping for back view muscles
  lats: ['Lats', 'Lats_2', 'latissimus', 'Vector_3', 'Vector_4', 'Vector_5', 'Vector_6', 'latissimus-dorsi'],
  traps: ['Traps', 'Traps_2', 'Traps_3', 'Traps_4', 'trapezius'],
  lowerback: ['Lower Back', 'LowerBack', 'lower-back', 'erectorspinae', 'erector-spinae', 'Erector', 'Lower_Back', 'Lowerback', 'erector'],
  glutes: ['Glutes', 'gluteus'],
  hamstrings: ['Hamstrings', 'Hamstrings_2', 'Hamstrings_3', 'Hamstrings_4', 'hamstring'],
  calves: ['Calves', 'calf', 'gastrocnemius']
};

export default function ExerciseDetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { id, name, image } = params;

  // State for managing which section is visible
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
        console.log('Front body SVG loaded, length:', frontBodyContent.length);
        
        // Extract and log all IDs and classes from the SVG to help with debugging
        const idMatches = frontBodyContent.match(/id="[^"]+"/g);
        if (idMatches && idMatches.length > 0) {
          console.log('Sample IDs in front body SVG:', 
            idMatches.slice(0, Math.min(10, idMatches.length)));
          
          // Store all IDs for debugging
          if (debugMode) {
            // Store all unique IDs to help identify muscle groups
            const allIds = idMatches.map(id => id.replace(/id="|"/g, ''));
            console.log('All unique IDs in front body:', Array.from(new Set(allIds)));
          }
        }
        
        setFrontBodySvg(frontBodyContent);
      }
      
      // Load back body SVG
      const backBodyAsset = Asset.fromModule(require('../../assets/exercises/body_back.svg'));
      await backBodyAsset.downloadAsync();
      if (backBodyAsset.localUri) {
        const backBodyContent = await FileSystem.readAsStringAsync(backBodyAsset.localUri);
        console.log('Back body SVG loaded, length:', backBodyContent.length);
        
        // Extract and log all IDs and classes from the SVG to help with debugging
        const idMatches = backBodyContent.match(/id="[^"]+"/g);
        if (idMatches && idMatches.length > 0) {
          console.log('Sample IDs in back body SVG:', 
            idMatches.slice(0, Math.min(10, idMatches.length)));
          
          // Store all IDs for debugging
          if (debugMode) {
            // Store all unique IDs to help identify muscle groups
            const allIds = idMatches.map(id => id.replace(/id="|"/g, ''));
            console.log('All unique IDs in back body:', Array.from(new Set(allIds)));
          }
        }
        
        setBackBodySvg(backBodyContent);
      }
    } catch (error) {
      console.error('Error loading SVG files:', error);
    }
  };

  // Function to analyze SVG when debug mode is toggled on
  useEffect(() => {
    if (debugMode && frontBodySvg && backBodySvg) {
      // Analyze front body SVG
      console.log('=== SVG Analysis for Debugging ===');
      
      // Extract and analyze all IDs from front SVG
      const frontIdMatches = frontBodySvg.match(/id="[^"]+"/g);
      if (frontIdMatches && frontIdMatches.length > 0) {
        const frontIds = frontIdMatches.map(id => id.replace(/id="|"/g, ''));
        console.log('Front body SVG - All IDs:', Array.from(new Set(frontIds)));
        
        // Look for potential muscle groups
        const potentialMuscleIds = frontIds.filter(id => {
          const lowerCaseId = id.toLowerCase();
          // Look for common muscle-related terms
          return Object.keys(MUSCLE_COLORS).some(muscle => 
            lowerCaseId.includes(muscle) || 
            (MUSCLE_ID_MAPPING[muscle] && MUSCLE_ID_MAPPING[muscle].some(m => 
              lowerCaseId.includes(m.toLowerCase())
            ))
          );
        });
        
        console.log('Front body SVG - Potential muscle IDs:', potentialMuscleIds);
      }
      
      // Extract and analyze all IDs from back SVG
      const backIdMatches = backBodySvg.match(/id="[^"]+"/g);
      if (backIdMatches && backIdMatches.length > 0) {
        const backIds = backIdMatches.map(id => id.replace(/id="|"/g, ''));
        console.log('Back body SVG - All IDs:', Array.from(new Set(backIds)));
        
        // Look for potential muscle groups
        const potentialMuscleIds = backIds.filter(id => {
          const lowerCaseId = id.toLowerCase();
          // Look for common muscle-related terms
          return Object.keys(MUSCLE_COLORS).some(muscle => 
            lowerCaseId.includes(muscle) || 
            (MUSCLE_ID_MAPPING[muscle] && MUSCLE_ID_MAPPING[muscle].some(m => 
              lowerCaseId.includes(m.toLowerCase())
            ))
          );
        });
        
        console.log('Back body SVG - Potential muscle IDs:', potentialMuscleIds);
      }
    }
  }, [debugMode, frontBodySvg, backBodySvg]);

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
        
        // Log the muscle data for debugging
        console.log('Exercise data loaded:', {
          primaryMuscles: exerciseInfo.primaryMuscles,
          secondaryMuscles: exerciseInfo.secondaryMuscles
        });
        
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
    setDebugMode(prev => {
      const newValue = !prev;
      console.log(`Debug mode ${newValue ? 'enabled' : 'disabled'}`);
      return newValue;
    });
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

  // Format instructions for display
  const formatInstructions = (instructions: string[] | string) => {
    if (!instructions) return '';
    
    // If instructions is a string, handle it as before
    if (typeof instructions === 'string') {
      const lines = instructions.includes('\n') 
        ? instructions.split('\n').filter(line => line.trim() !== '')
        : [instructions];
      
      return lines.join('\n');
    }
    
    // If instructions is an array, join them with newlines
    if (Array.isArray(instructions)) {
      return instructions.join('\n');
    }
    
    return '';
  };

  // Helper function to check if a muscle should be in front or back view
  const isMuscleInView = (muscle: string, isBackView: boolean): boolean => {
    // Define which muscles are visible in the back view
    const backViewMuscles = [
      'lats', 'traps', 'hamstrings', 'glutes', 'calves', 'lowerback', 'lower back'
    ];
    
    // Define which muscles are visible in the front view 
    const frontViewMuscles = [
      'chest', 'abs', 'biceps', 'quads', 'adductors', 'abductors', 'shoulders', 'forearms', 'obliques', 'triceps', 'cardio'
    ];
    
    const muscleLower = muscle.toLowerCase().replace(/\s+/g, '');
    
    // If we're in back view, check if it's a back muscle or if it could appear in both (like shoulders or triceps)
    if (isBackView) {
      // Always show these muscles in the back view
      if (backViewMuscles.includes(muscleLower)) {
        return true;
      }
      
      // For muscles like triceps or shoulders that could appear in both views
      // For back view, return true for these specific cases
      if (muscleLower === 'triceps' || muscleLower === 'shoulders') {
        return true;
      }
      
      // For all other muscles, don't show in back view
      return false;
    } else {
      // For front view
      // Always show front muscles
      if (frontViewMuscles.includes(muscleLower)) {
        return true;
      }
      
      // Don't show clearly back-specific muscles in front view
      if (backViewMuscles.includes(muscleLower) && 
          muscleLower !== 'shoulders' && 
          muscleLower !== 'triceps') {
        return false;
      }
      
      // Default to showing in front view if not clearly categorized
      return true;
    }
  };

  // Helper function to safely add style attributes to SVG elements
  const addStyleToElement = (match: string, styleToAdd: string): string => {
    // Check if the element already has a style attribute
    if (match.includes('style="')) {
      // Replace existing style
      return match.replace(/style="[^"]*"/, styleToAdd);
    }
    
    // Check if it's a self-closing tag with />
    if (match.includes('/>')) {
      // Insert style before the self-closing />
      return match.replace(/\/>$/, ` ${styleToAdd}/>`);
    }
    
    // Check if it's a tag with a closing / at the end
    if (match.includes('"/')) {
      // Fix the malformed tag and add style
      return match.replace(/"\//, `" ${styleToAdd}`);
    }
    
    // Regular tag, add style before the closing >
    return match.replace(/>$/, ` ${styleToAdd}>`);
  };

  // Modify SVG to highlight muscle groups
  const getHighlightedSvg = (svg: string | null, isBackView: boolean = false) => {
    if (!svg) return null;
    
    try {
      let modifiedSvg = svg;
      let coloredMuscles: string[] = [];
      
      if (exerciseData) {
        // Direct replacements for specific muscles that might be problematic
        exerciseData.primaryMuscles.forEach(muscle => {
          const muscleLower = muscle.toLowerCase().replace(/\s+/g, '');
          
          // Skip if the muscle isn't typically shown in this view
          if (!isMuscleInView(muscleLower, isBackView)) {
            return;
          }
          
          // Special handling for cardio which might be structured differently in SVG
          if (muscleLower === 'cardio' && !isBackView) {
            if (debugMode) {
              console.log("Handling Cardio element with special approach");
            }
            
            // Find any elements with id="Cardio" and replace their fill attribute
            // This more direct approach searches for the fill attribute and replaces it
            const cardioElementWithFill = new RegExp(`<([^>]*)id="Cardio"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
            let replacementCount = 0;
            
            modifiedSvg = modifiedSvg.replace(cardioElementWithFill, (match, prefix, middle, suffix) => {
              replacementCount++;
              return `<${prefix}id="Cardio"${middle}fill="${MUSCLE_COLORS.cardio}"${suffix}>`;
            });
            
            if (debugMode) {
              console.log(`Replaced ${replacementCount} fill attributes for Cardio elements`);
            }
            
            // In case there are no fill attributes, add them
            const cardioElementWithoutFill = new RegExp(`<([^>]*)id="Cardio"([^>]*[^"f][^"i][^"l][^"l])>`, 'gi');
            replacementCount = 0;
            
            modifiedSvg = modifiedSvg.replace(cardioElementWithoutFill, (match, prefix, suffix) => {
              replacementCount++;
              return `<${prefix}id="Cardio"${suffix} fill="${MUSCLE_COLORS.cardio}">`;
            });
            
            if (debugMode) {
              console.log(`Added ${replacementCount} fill attributes to Cardio elements`);
            }
            
            // Try the Heart element too
            const heartElementWithFill = new RegExp(`<([^>]*)id="Heart"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
            replacementCount = 0;
            
            modifiedSvg = modifiedSvg.replace(heartElementWithFill, (match, prefix, middle, suffix) => {
              replacementCount++;
              return `<${prefix}id="Heart"${middle}fill="${MUSCLE_COLORS.cardio}"${suffix}>`;
            });
            
            if (debugMode) {
              console.log(`Replaced ${replacementCount} fill attributes for Heart elements`);
            }
            
            // Direct approach
            // Find any paths with fill="#566B86" inside a Cardio group
            const specificFillPattern = /<g[^>]*id="Cardio"[^>]*>([\s\S]*?)<\/g>/gi;
            const cardioGroups = modifiedSvg.match(specificFillPattern);
            
            if (cardioGroups) {
              cardioGroups.forEach(group => {
                const updatedGroup = group.replace(/fill="#566B86"/gi, `fill="${MUSCLE_COLORS.cardio}"`);
                modifiedSvg = modifiedSvg.replace(group, updatedGroup);
                
                if (debugMode && group !== updatedGroup) {
                  console.log("Successfully replaced fill color in Cardio group");
                }
              });
            }
          }
          
          // Special handling for chest elements
          if (muscleLower === 'chest' && !isBackView) {
            if (debugMode) {
              console.log("Handling Chest element with special approach");
            }
            
            // Find all Chest elements and replace their fill attributes
            ['Chest', 'Chest_2', 'Chest_3', 'Chest_4'].forEach(chestId => {
              // Replace existing fill attributes
              const chestElementWithFill = new RegExp(`<([^>]*)id="${chestId}"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
              let replacementCount = 0;
              
              modifiedSvg = modifiedSvg.replace(chestElementWithFill, (match, prefix, middle, suffix) => {
                replacementCount++;
                return `<${prefix}id="${chestId}"${middle}fill="${MUSCLE_COLORS.chest}"${suffix}>`;
              });
              
              if (debugMode && replacementCount > 0) {
                console.log(`Replaced ${replacementCount} fill attributes for ${chestId} elements`);
              }
              
              // Add fill attributes if they don't exist
              const chestElementWithoutFill = new RegExp(`<([^>]*)id="${chestId}"([^>]*[^"f][^"i][^"l][^"l])>`, 'gi');
              replacementCount = 0;
              
              modifiedSvg = modifiedSvg.replace(chestElementWithoutFill, (match, prefix, suffix) => {
                replacementCount++;
                return `<${prefix}id="${chestId}"${suffix} fill="${MUSCLE_COLORS.chest}">`;
              });
              
              if (debugMode && replacementCount > 0) {
                console.log(`Added ${replacementCount} fill attributes to ${chestId} elements`);
              }
            });
            
            // Also look for nested elements with fill attributes inside chest groups
            const chestGroupPattern = /<g[^>]*id="Chest[^"]*"[^>]*>([\s\S]*?)<\/g>/gi;
            const chestGroups = modifiedSvg.match(chestGroupPattern);
            
            if (chestGroups) {
              chestGroups.forEach(group => {
                // Replace any fill attribute within the group
                const updatedGroup = group.replace(/fill="[^"]*"/gi, `fill="${MUSCLE_COLORS.chest}"`);
                modifiedSvg = modifiedSvg.replace(group, updatedGroup);
                
                if (debugMode && group !== updatedGroup) {
                  console.log("Successfully replaced fill colors in Chest group");
                }
              });
            }
          }
          
          // Special handling for lower back in back view
          if ((muscleLower === 'lowerback' || muscleLower === 'lower back' || muscleLower === 'lower-back') && isBackView) {
            if (debugMode) {
              console.log("Handling Lower Back element with special approach");
            }
            
            // Try different possible ID combinations
            ['Lower Back', 'LowerBack', 'lower-back', 'lower_back', 'Lower_Back', 'Lowerback', 'erectorspinae', 'erector-spinae', 'Erector'].forEach(backId => {
              // Replace existing fill attributes
              const lowerBackElementWithFill = new RegExp(`<([^>]*)id="${backId}"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
              let replacementCount = 0;
              
              modifiedSvg = modifiedSvg.replace(lowerBackElementWithFill, (match, prefix, middle, suffix) => {
                replacementCount++;
                return `<${prefix}id="${backId}"${middle}fill="${MUSCLE_COLORS.lowerback}"${suffix}>`;
              });
              
              if (debugMode && replacementCount > 0) {
                console.log(`Replaced ${replacementCount} fill attributes for ${backId} elements`);
              }
              
              // Add fill attributes if they don't exist
              const lowerBackElementWithoutFill = new RegExp(`<([^>]*)id="${backId}"([^>]*[^"f][^"i][^"l][^"l])>`, 'gi');
              replacementCount = 0;
              
              modifiedSvg = modifiedSvg.replace(lowerBackElementWithoutFill, (match, prefix, suffix) => {
                replacementCount++;
                return `<${prefix}id="${backId}"${suffix} fill="${MUSCLE_COLORS.lowerback}">`;
              });
              
              if (debugMode && replacementCount > 0) {
                console.log(`Added ${replacementCount} fill attributes to ${backId} elements`);
              }
            });
            
            // Try different ways to find lower back groups
            const lowerBackGroupPatterns = [
              /<g[^>]*id="Lower[^"]*Back[^"]*"[^>]*>([\s\S]*?)<\/g>/gi,
              /<g[^>]*id="lower[^"]*back[^"]*"[^>]*>([\s\S]*?)<\/g>/gi,
              /<g[^>]*id="Erector[^"]*"[^>]*>([\s\S]*?)<\/g>/gi,
              /<g[^>]*id="erector[^"]*"[^>]*>([\s\S]*?)<\/g>/gi
            ];
            
            lowerBackGroupPatterns.forEach(pattern => {
              const lowerBackGroups = modifiedSvg.match(pattern);
              
              if (lowerBackGroups) {
                lowerBackGroups.forEach(group => {
                  // Replace any fill attribute within the group
                  const updatedGroup = group.replace(/fill="[^"]*"/gi, `fill="${MUSCLE_COLORS.lowerback}"`);
                  modifiedSvg = modifiedSvg.replace(group, updatedGroup);
                  
                  if (debugMode && group !== updatedGroup) {
                    console.log("Successfully replaced fill colors in Lower Back group");
                  }
                });
              }
            });
            
            // Also try with class-based approach for erector spinae and lower back muscles
            ['erectorspinae', 'erector-spinae', 'lower-back', 'lowerback'].forEach(className => {
              const classPattern = new RegExp(`class="[^"]*${className}[^"]*"`, 'gi');
              if (modifiedSvg.match(classPattern)) {
                if (debugMode) {
                  console.log(`Found Lower Back with class ${className}`);
                }
                
                modifiedSvg = modifiedSvg.replace(classPattern, (match) => {
                  // Add a style attribute to the element
                  return `${match} style="fill:${MUSCLE_COLORS.lowerback};"`;
                });
              }
            });
          }
          
          // Special handling for triceps (particularly in back view)
          if (muscleLower === 'triceps') {
            if (debugMode) {
              console.log("Handling Triceps element with special approach");
            }
            
            // Direct approach for the main Triceps element
            const tricepsElementWithFill = new RegExp(`<([^>]*)id="Triceps"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
            let replacementCount = 0;
            
            modifiedSvg = modifiedSvg.replace(tricepsElementWithFill, (match, prefix, middle, suffix) => {
              replacementCount++;
              // Use primary or secondary color based on whether it's in primaryMuscles
              const color = exerciseData.primaryMuscles.some(m => 
                m.toLowerCase().replace(/\s+/g, '') === 'triceps') 
                ? MUSCLE_COLORS.triceps 
                : `${MUSCLE_COLORS.triceps}80`;
              
              return `<${prefix}id="Triceps"${middle}fill="${color}"${suffix}>`;
            });
            
            if (debugMode && replacementCount > 0) {
              console.log(`Replaced ${replacementCount} fill attributes for Triceps elements`);
            }
            
            // Look for Group 302 and Group 303 which might be left/right triceps
            ['Group 302', 'Group 303'].forEach(groupId => {
              const groupPattern = new RegExp(`<g[^>]*id="${groupId}"[^>]*>([\s\S]*?)<\/g>`, 'gi');
              const groups = modifiedSvg.match(groupPattern);
              
              if (groups) {
                groups.forEach(group => {
                  // Replace any fill attribute within the group
                  const color = exerciseData.primaryMuscles.some(m => 
                    m.toLowerCase().replace(/\s+/g, '') === 'triceps') 
                    ? MUSCLE_COLORS.triceps 
                    : `${MUSCLE_COLORS.triceps}80`;
                  
                  const updatedGroup = group.replace(/fill="[^"]*"/gi, `fill="${color}"`);
                  modifiedSvg = modifiedSvg.replace(group, updatedGroup);
                  
                  if (debugMode && group !== updatedGroup) {
                    console.log(`Successfully replaced fill colors in Triceps group ${groupId}`);
                  }
                });
              }
            });
            
            // Look for specific vector patterns within triceps groups
            ['Vector 112', 'Vector 111', 'Vector 110', 'Vector 112_2', 'Vector 111_2', 'Vector 110_2'].forEach(vectorId => {
              const vectorPattern = new RegExp(`<([^>]*)id="${vectorId.replace('_', '\\_')}"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
              
              modifiedSvg = modifiedSvg.replace(vectorPattern, (match, prefix, middle, suffix) => {
                // Use primary or secondary color based on whether it's in primaryMuscles
                const color = exerciseData.primaryMuscles.some(m => 
                  m.toLowerCase().replace(/\s+/g, '') === 'triceps') 
                  ? MUSCLE_COLORS.triceps 
                  : `${MUSCLE_COLORS.triceps}80`;
                
                if (debugMode) {
                  console.log(`Replaced fill for triceps vector: ${vectorId}`);
                }
                
                return `<${prefix}id="${vectorId}"${middle}fill="${color}"${suffix}>`;
              });
            });
            
            // Try parent elements that might contain triceps
            if (isBackView) {
              // Check for potential parent groups that might contain both triceps
              const parentGroups = modifiedSvg.match(/<g[^>]*id="[^"]*Arm[^"]*"[^>]*>([\s\S]*?)<\/g>/gi) || 
                                   modifiedSvg.match(/<g[^>]*id="[^"]*Arms[^"]*"[^>]*>([\s\S]*?)<\/g>/gi);
              
              if (parentGroups) {
                parentGroups.forEach(group => {
                  // Check if this group contains Triceps
                  if (group.includes('Triceps') || group.includes('triceps')) {
                    const color = exerciseData.primaryMuscles.some(m => 
                      m.toLowerCase().replace(/\s+/g, '') === 'triceps') 
                      ? MUSCLE_COLORS.triceps 
                      : `${MUSCLE_COLORS.triceps}80`;
                    
                    // Find all path elements inside this group with fill attributes
                    const paths = group.match(/<path[^>]*fill="[^"]*"[^>]*>/gi);
                    
                    if (paths) {
                      if (debugMode) {
                        console.log(`Found ${paths.length} potential triceps paths in arm group`);
                      }
                      
                      paths.forEach(path => {
                        const updatedPath = path.replace(/fill="[^"]*"/i, `fill="${color}"`);
                        modifiedSvg = modifiedSvg.replace(path, updatedPath);
                      });
                    }
                  }
                });
              }
              
              // Direct coloring approach - find all vector elements near triceps vectors
              const vectorRanges = [
                { start: 110, end: 112 },  // For right triceps vectors
                { start: 110, end: 112, suffix: '_2' }  // For left triceps vectors
              ];
              
              vectorRanges.forEach(range => {
                for (let i = range.start; i <= range.end; i++) {
                  const vectorId = `Vector ${i}${range.suffix || ''}`;
                  const color = exerciseData.primaryMuscles.some(m => 
                    m.toLowerCase().replace(/\s+/g, '') === 'triceps') 
                    ? MUSCLE_COLORS.triceps 
                    : `${MUSCLE_COLORS.triceps}80`;
                  
                  // Find vector with this ID
                  const vectorRegex = new RegExp(`<([^>]*)id="${vectorId}"([^>]*)>`, 'gi');
                  
                  modifiedSvg = modifiedSvg.replace(vectorRegex, (match, prefix, suffix) => {
                    if (match.includes('fill="')) {
                      // Replace existing fill
                      return match.replace(/fill="[^"]*"/i, `fill="${color}"`);
                    } else {
                      // Add fill attribute
                      return `<${prefix}id="${vectorId}"${suffix.replace('>', ` fill="${color}">`)}`;
                    }
                  });
                }
              });
            }
          }

          // Special handling for lats in back view
          if (muscleLower === 'lats' && isBackView) {
            if (debugMode) {
              console.log("Handling Lats element with special approach");
            }
            
            // Direct approach for the main Lats elements
            ['Lats', 'Lats_2'].forEach(latsId => {
              const latsElementWithFill = new RegExp(`<([^>]*)id="${latsId}"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
              let replacementCount = 0;
              
              modifiedSvg = modifiedSvg.replace(latsElementWithFill, (match, prefix, middle, suffix) => {
                replacementCount++;
                // Use primary or secondary color based on whether it's in primaryMuscles
                const color = exerciseData.primaryMuscles.some(m => 
                  m.toLowerCase().replace(/\s+/g, '') === 'lats') 
                  ? MUSCLE_COLORS.lats 
                  : `${MUSCLE_COLORS.lats}80`;
                
                return `<${prefix}id="${latsId}"${middle}fill="${color}"${suffix}>`;
              });
              
              if (debugMode && replacementCount > 0) {
                console.log(`Replaced ${replacementCount} fill attributes for ${latsId} elements`);
              }
            });
            
            // Look for specific vector patterns for lats
            ['Vector_3', 'Vector_4', 'Vector_5', 'Vector_6'].forEach(vectorId => {
              const vectorPattern = new RegExp(`<([^>]*)id="${vectorId}"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
              
              modifiedSvg = modifiedSvg.replace(vectorPattern, (match, prefix, middle, suffix) => {
                // Use primary or secondary color based on whether it's in primaryMuscles
                const color = exerciseData.primaryMuscles.some(m => 
                  m.toLowerCase().replace(/\s+/g, '') === 'lats') 
                  ? MUSCLE_COLORS.lats 
                  : `${MUSCLE_COLORS.lats}80`;
                
                if (debugMode) {
                  console.log(`Replaced fill for lats vector: ${vectorId}`);
                }
                
                // Fix the tag properly
                const newTag = `<${prefix}id="${vectorId}"${middle}fill="${color}"${suffix}>`;
                return newTag;
              });
              
              // Also handle case where fill attribute doesn't exist
              const vectorPatternNoFill = new RegExp(`<([^>]*)id="${vectorId}"([^>]*[^"f][^"i][^"l][^"l])>`, 'gi');
              
              modifiedSvg = modifiedSvg.replace(vectorPatternNoFill, (match, prefix, suffix) => {
                // Use primary or secondary color
                const color = exerciseData.primaryMuscles.some(m => 
                  m.toLowerCase().replace(/\s+/g, '') === 'lats') 
                  ? MUSCLE_COLORS.lats 
                  : `${MUSCLE_COLORS.lats}80`;
                
                if (debugMode) {
                  console.log(`Added fill for lats vector: ${vectorId}`);
                }
                
                // Use the addStyleToElement helper to add the fill attribute safely
                const styleAttr = `fill="${color}"`;
                return addStyleToElement(`<${prefix}id="${vectorId}"${suffix}>`, styleAttr);
              });
            });
            
            // Look for parent groups that might contain lats
            const latsGroupPattern = /<g[^>]*id="[^"]*lat[^"]*"[^>]*>([\s\S]*?)<\/g>/gi;
            const latsGroups = modifiedSvg.match(latsGroupPattern);
            
            if (latsGroups) {
              latsGroups.forEach(group => {
                // Use primary or secondary color
                const color = exerciseData.primaryMuscles.some(m => 
                  m.toLowerCase().replace(/\s+/g, '') === 'lats') 
                  ? MUSCLE_COLORS.lats 
                  : `${MUSCLE_COLORS.lats}80`;
                
                // Replace fill attributes within the group
                const updatedGroup = group.replace(/fill="[^"]*"/gi, `fill="${color}"`);
                modifiedSvg = modifiedSvg.replace(group, updatedGroup);
                
                if (debugMode && group !== updatedGroup) {
                  console.log("Successfully replaced fill colors in lats group");
                }
              });
            }
          }
          
          // Special handling for biceps
          if (muscleLower === 'biceps') {
            if (debugMode) {
              console.log("Handling Biceps element with special approach");
            }
            
            // Direct approach for the main Biceps elements
            ['Biceps', 'Biceps_2'].forEach(bicepsId => {
              const bicepsElementWithFill = new RegExp(`<([^>]*)id="${bicepsId}"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
              let replacementCount = 0;
              
              modifiedSvg = modifiedSvg.replace(bicepsElementWithFill, (match, prefix, middle, suffix) => {
                replacementCount++;
                // Use primary or secondary color based on whether it's in primaryMuscles
                const color = exerciseData.primaryMuscles.some(m => 
                  m.toLowerCase().replace(/\s+/g, '') === 'biceps') 
                  ? MUSCLE_COLORS.biceps 
                  : `${MUSCLE_COLORS.biceps}80`;
                
                return `<${prefix}id="${bicepsId}"${middle}fill="${color}"${suffix}>`;
              });
              
              if (debugMode && replacementCount > 0) {
                console.log(`Replaced ${replacementCount} fill attributes for ${bicepsId} elements`);
              }
              
              // Add fill attributes if they don't exist
              const bicepsElementWithoutFill = new RegExp(`<([^>]*)id="${bicepsId}"([^>]*[^"f][^"i][^"l][^"l])>`, 'gi');
              replacementCount = 0;
              
              modifiedSvg = modifiedSvg.replace(bicepsElementWithoutFill, (match, prefix, suffix) => {
                replacementCount++;
                // Use primary or secondary color
                const color = exerciseData.primaryMuscles.some(m => 
                  m.toLowerCase().replace(/\s+/g, '') === 'biceps') 
                  ? MUSCLE_COLORS.biceps 
                  : `${MUSCLE_COLORS.biceps}80`;
                
                return `<${prefix}id="${bicepsId}"${suffix} fill="${color}">`;
              });
              
              if (debugMode && replacementCount > 0) {
                console.log(`Added ${replacementCount} fill attributes to ${bicepsId} elements`);
              }
            });
            
            // Look for the vectors that make up the biceps
            const bicepsVectors = [
              { left: ['Vector 26', 'Vector 27'], right: ['Vector 28', 'Vector 29'] }
            ];
            
            bicepsVectors.forEach(pair => {
              // Process left biceps vectors
              pair.left.forEach(vectorId => {
                const vectorPattern = new RegExp(`<([^>]*)id="${vectorId}"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
                
                modifiedSvg = modifiedSvg.replace(vectorPattern, (match, prefix, middle, suffix) => {
                  // Use primary or secondary color
                  const color = exerciseData.primaryMuscles.some(m => 
                    m.toLowerCase().replace(/\s+/g, '') === 'biceps') 
                    ? MUSCLE_COLORS.biceps 
                    : `${MUSCLE_COLORS.biceps}80`;
                  
                  if (debugMode) {
                    console.log(`Replaced fill for left biceps vector: ${vectorId}`);
                  }
                  
                  return `<${prefix}id="${vectorId}"${middle}fill="${color}"${suffix}>`;
                });
                
                // Also handle case where fill attribute doesn't exist
                const vectorPatternNoFill = new RegExp(`<([^>]*)id="${vectorId}"([^>]*[^"f][^"i][^"l][^"l])>`, 'gi');
                
                modifiedSvg = modifiedSvg.replace(vectorPatternNoFill, (match, prefix, suffix) => {
                  // Use primary or secondary color
                  const color = exerciseData.primaryMuscles.some(m => 
                    m.toLowerCase().replace(/\s+/g, '') === 'biceps') 
                    ? MUSCLE_COLORS.biceps 
                    : `${MUSCLE_COLORS.biceps}80`;
                  
                  if (debugMode) {
                    console.log(`Added fill for left biceps vector: ${vectorId}`);
                  }
                  
                  return `<${prefix}id="${vectorId}"${suffix} fill="${color}">`;
                });
              });
              
              // Process right biceps vectors
              pair.right.forEach(vectorId => {
                const vectorPattern = new RegExp(`<([^>]*)id="${vectorId}"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
                
                modifiedSvg = modifiedSvg.replace(vectorPattern, (match, prefix, middle, suffix) => {
                  // Use primary or secondary color
                  const color = exerciseData.primaryMuscles.some(m => 
                    m.toLowerCase().replace(/\s+/g, '') === 'biceps') 
                    ? MUSCLE_COLORS.biceps 
                    : `${MUSCLE_COLORS.biceps}80`;
                  
                  if (debugMode) {
                    console.log(`Replaced fill for right biceps vector: ${vectorId}`);
                  }
                  
                  return `<${prefix}id="${vectorId}"${middle}fill="${color}"${suffix}>`;
                });
                
                // Also handle case where fill attribute doesn't exist
                const vectorPatternNoFill = new RegExp(`<([^>]*)id="${vectorId}"([^>]*[^"f][^"i][^"l][^"l])>`, 'gi');
                
                modifiedSvg = modifiedSvg.replace(vectorPatternNoFill, (match, prefix, suffix) => {
                  // Use primary or secondary color
                  const color = exerciseData.primaryMuscles.some(m => 
                    m.toLowerCase().replace(/\s+/g, '') === 'biceps') 
                    ? MUSCLE_COLORS.biceps 
                    : `${MUSCLE_COLORS.biceps}80`;
                  
                  if (debugMode) {
                    console.log(`Added fill for right biceps vector: ${vectorId}`);
                  }
                  
                  return `<${prefix}id="${vectorId}"${suffix} fill="${color}">`;
                });
              });
            });
            
            // Look for parent groups that might contain biceps
            const bicepsGroupPattern = /<g[^>]*id="[^"]*Biceps[^"]*"[^>]*>([\s\S]*?)<\/g>/gi;
            const bicepsGroups = modifiedSvg.match(bicepsGroupPattern);
            
            if (bicepsGroups) {
              bicepsGroups.forEach(group => {
                // Use primary or secondary color
                const color = exerciseData.primaryMuscles.some(m => 
                  m.toLowerCase().replace(/\s+/g, '') === 'biceps') 
                  ? MUSCLE_COLORS.biceps 
                  : `${MUSCLE_COLORS.biceps}80`;
                
                // Replace fill attributes within the group
                const updatedGroup = group.replace(/fill="[^"]*"/gi, `fill="${color}"`);
                modifiedSvg = modifiedSvg.replace(group, updatedGroup);
                
                if (debugMode && group !== updatedGroup) {
                  console.log("Successfully replaced fill colors in biceps group");
                }
              });
            }
          }
          
          // Special handling for shoulders
          if (muscleLower === 'shoulders') {
            if (debugMode) {
              console.log("Handling Shoulders element with special approach");
            }
            
            // Direct approach for the main Shoulders elements
            ['Shoulders', 'Shoulders_2', 'Shoulders_3'].forEach(shouldersId => {
              const shouldersElementWithFill = new RegExp(`<([^>]*)id="${shouldersId}"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
              let replacementCount = 0;
              
              modifiedSvg = modifiedSvg.replace(shouldersElementWithFill, (match, prefix, middle, suffix) => {
                replacementCount++;
                // Use primary or secondary color based on whether it's in primaryMuscles
                const color = exerciseData.primaryMuscles.some(m => 
                  m.toLowerCase().replace(/\s+/g, '') === 'shoulders') 
                  ? MUSCLE_COLORS.shoulders 
                  : `${MUSCLE_COLORS.shoulders}80`;
                
                return `<${prefix}id="${shouldersId}"${middle}fill="${color}"${suffix}>`;
              });
              
              if (debugMode && replacementCount > 0) {
                console.log(`Replaced ${replacementCount} fill attributes for ${shouldersId} elements`);
              }
              
              // Add fill attributes if they don't exist
              const shouldersElementWithoutFill = new RegExp(`<([^>]*)id="${shouldersId}"([^>]*[^"f][^"i][^"l][^"l])>`, 'gi');
              replacementCount = 0;
              
              modifiedSvg = modifiedSvg.replace(shouldersElementWithoutFill, (match, prefix, suffix) => {
                replacementCount++;
                // Use primary or secondary color
                const color = exerciseData.primaryMuscles.some(m => 
                  m.toLowerCase().replace(/\s+/g, '') === 'shoulders') 
                  ? MUSCLE_COLORS.shoulders 
                  : `${MUSCLE_COLORS.shoulders}80`;
                
                return `<${prefix}id="${shouldersId}"${suffix} fill="${color}">`;
              });
              
              if (debugMode && replacementCount > 0) {
                console.log(`Added ${replacementCount} fill attributes to ${shouldersId} elements`);
              }
            });
            
            // Special handling for shoulders in back view specifically
            if (isBackView) {
              // In back view, look for the specific vector IDs for the shoulder elements
              ['Vector_9', 'Vector_10'].forEach(vectorId => {
                const vectorPattern = new RegExp(`<([^>]*)id="${vectorId}"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
                
                modifiedSvg = modifiedSvg.replace(vectorPattern, (match, prefix, middle, suffix) => {
                  // Use primary or secondary color
                  const color = exerciseData.primaryMuscles.some(m => 
                    m.toLowerCase().replace(/\s+/g, '') === 'shoulders') 
                    ? MUSCLE_COLORS.shoulders 
                    : `${MUSCLE_COLORS.shoulders}80`;
                  
                  if (debugMode) {
                    console.log(`Replaced fill for shoulders back vector: ${vectorId}`);
                  }
                  
                  return `<${prefix}id="${vectorId}"${middle}fill="${color}"${suffix}>`;
                });
                
                // Also handle case where fill attribute doesn't exist
                const vectorPatternNoFill = new RegExp(`<([^>]*)id="${vectorId}"([^>]*[^"f][^"i][^"l][^"l])>`, 'gi');
                
                modifiedSvg = modifiedSvg.replace(vectorPatternNoFill, (match, prefix, suffix) => {
                  // Use primary or secondary color
                  const color = exerciseData.primaryMuscles.some(m => 
                    m.toLowerCase().replace(/\s+/g, '') === 'shoulders') 
                    ? MUSCLE_COLORS.shoulders 
                    : `${MUSCLE_COLORS.shoulders}80`;
                  
                  if (debugMode) {
                    console.log(`Added fill for shoulders back vector: ${vectorId}`);
                  }
                  
                  const styleAttr = `fill="${color}"`;
                  return addStyleToElement(`<${prefix}id="${vectorId}"${suffix}>`, styleAttr);
                });
              });
            }
            
            // Look for parent groups that might contain shoulders
            // First try for back view specific groups
            if (isBackView) {
              const shouldersBackGroupPattern = /<g[^>]*id="[^"]*Shoulders[^"]*"[^>]*>([\s\S]*?)<\/g>/gi;
              const shouldersBackGroups = modifiedSvg.match(shouldersBackGroupPattern);
              
              if (shouldersBackGroups) {
                shouldersBackGroups.forEach(group => {
                  // Use primary or secondary color
                  const color = exerciseData.primaryMuscles.some(m => 
                    m.toLowerCase().replace(/\s+/g, '') === 'shoulders') 
                    ? MUSCLE_COLORS.shoulders 
                    : `${MUSCLE_COLORS.shoulders}80`;
                  
                  // Replace fill attributes within the group
                  const updatedGroup = group.replace(/fill="[^"]*"/gi, `fill="${color}"`);
                  modifiedSvg = modifiedSvg.replace(group, updatedGroup);
                  
                  if (debugMode && group !== updatedGroup) {
                    console.log("Successfully replaced fill colors in shoulders back group");
                  }
                });
              }
              
              // Try a more specific approach - look for Group elements near shoulder elements
              const shouldersNeighboringGroups = [
                'Group 332', // This might be close to shoulders in back view
              ];
              
              shouldersNeighboringGroups.forEach(groupId => {
                const groupPattern = new RegExp(`<g[^>]*id="${groupId}"[^>]*>([\s\S]*?)<\/g>`, 'gi');
                const groups = modifiedSvg.match(groupPattern);
                
                if (groups) {
                  groups.forEach(group => {
                    // Only update if it hasn't been colored by another muscle
                    if (!group.includes('fill="#')) {
                      // Use primary or secondary color
                      const color = exerciseData.primaryMuscles.some(m => 
                        m.toLowerCase().replace(/\s+/g, '') === 'shoulders') 
                        ? MUSCLE_COLORS.shoulders 
                        : `${MUSCLE_COLORS.shoulders}80`;
                      
                      // Replace fill attributes within the group
                      const updatedGroup = group.replace(/fill="[^"]*"/gi, `fill="${color}"`);
                      modifiedSvg = modifiedSvg.replace(group, updatedGroup);
                      
                      if (debugMode && group !== updatedGroup) {
                        console.log(`Successfully replaced fill colors in neighboring shoulders group: ${groupId}`);
                      }
                    }
                  });
                }
              });
            } else {
              // Front view groups
              const shouldersFrontGroupPattern = /<g[^>]*id="[^"]*Shoulders[^"]*"[^>]*>([\s\S]*?)<\/g>/gi;
              const shouldersFrontGroups = modifiedSvg.match(shouldersFrontGroupPattern);
              
              if (shouldersFrontGroups) {
                shouldersFrontGroups.forEach(group => {
                  // Use primary or secondary color
                  const color = exerciseData.primaryMuscles.some(m => 
                    m.toLowerCase().replace(/\s+/g, '') === 'shoulders') 
                    ? MUSCLE_COLORS.shoulders 
                    : `${MUSCLE_COLORS.shoulders}80`;
                  
                  // Replace fill attributes within the group
                  const updatedGroup = group.replace(/fill="[^"]*"/gi, `fill="${color}"`);
                  modifiedSvg = modifiedSvg.replace(group, updatedGroup);
                  
                  if (debugMode && group !== updatedGroup) {
                    console.log("Successfully replaced fill colors in shoulders front group");
                  }
                });
              }
            }
            
            // Try for deltoid specific elements
            ['Delts', 'delts', 'deltoids'].forEach(deltId => {
              const deltPattern = new RegExp(`<([^>]*)id="${deltId}"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
              
              modifiedSvg = modifiedSvg.replace(deltPattern, (match, prefix, middle, suffix) => {
                // Use primary or secondary color
                const color = exerciseData.primaryMuscles.some(m => 
                  m.toLowerCase().replace(/\s+/g, '') === 'shoulders') 
                  ? MUSCLE_COLORS.shoulders 
                  : `${MUSCLE_COLORS.shoulders}80`;
                
                if (debugMode) {
                  console.log(`Replaced fill for deltoid element: ${deltId}`);
                }
                
                return `<${prefix}id="${deltId}"${middle}fill="${color}"${suffix}>`;
              });
            });
          }
        });
        
        // Handle secondary muscles too with direct fill replacement
        exerciseData.secondaryMuscles.forEach(muscle => {
          const muscleLower = muscle.toLowerCase().replace(/\s+/g, '');
          
          // Skip if the muscle isn't typically shown in this view or is already a primary muscle
          if (!isMuscleInView(muscleLower, isBackView) || 
              exerciseData.primaryMuscles.some(pm => pm.toLowerCase().replace(/\s+/g, '') === muscleLower)) {
            return;
          }
          
          if (MUSCLE_COLORS[muscleLower]) {
            const possibleIds = MUSCLE_ID_MAPPING[muscleLower] || [muscleLower];
            
            if (debugMode) {
              console.log(`Handling secondary muscle ${muscle} with special approach`);
            }
            
            // Process each possible ID for this muscle
            possibleIds.forEach(muscleId => {
              // Replace existing fill attributes (with 80% opacity for secondary muscles)
              const elementWithFill = new RegExp(`<([^>]*)id="${muscleId}"([^>]*)fill="[^"]*"([^>]*)>`, 'gi');
              let replacementCount = 0;
              
              modifiedSvg = modifiedSvg.replace(elementWithFill, (match, prefix, middle, suffix) => {
                replacementCount++;
                return `<${prefix}id="${muscleId}"${middle}fill="${MUSCLE_COLORS[muscleLower]}80"${suffix}>`;
              });
              
              if (debugMode && replacementCount > 0) {
                console.log(`Replaced ${replacementCount} fill attributes for secondary ${muscleId} elements`);
              }
              
              // Add fill attributes if they don't exist
              const elementWithoutFill = new RegExp(`<([^>]*)id="${muscleId}"([^>]*[^"f][^"i][^"l][^"l])>`, 'gi');
              replacementCount = 0;
              
              modifiedSvg = modifiedSvg.replace(elementWithoutFill, (match, prefix, suffix) => {
                replacementCount++;
                return `<${prefix}id="${muscleId}"${suffix} fill="${MUSCLE_COLORS[muscleLower]}80">`;
              });
              
              if (debugMode && replacementCount > 0) {
                console.log(`Added ${replacementCount} fill attributes to secondary ${muscleId} elements`);
              }
              
              // Also look for nested elements with fill attributes inside muscle groups
              const groupPattern = new RegExp(`<g[^>]*id="${muscleId}[^"]*"[^>]*>([\\s\\S]*?)</g>`, 'gi');
              const groups = modifiedSvg.match(groupPattern);
              
              if (groups) {
                groups.forEach(group => {
                  // Replace any fill attribute within the group
                  const updatedGroup = group.replace(/fill="[^"]*"/gi, `fill="${MUSCLE_COLORS[muscleLower]}80"`);
                  modifiedSvg = modifiedSvg.replace(group, updatedGroup);
                  
                  if (debugMode && group !== updatedGroup) {
                    console.log(`Successfully replaced fill colors in secondary ${muscleId} group`);
                  }
                });
              }
            });
          }
        });
        
        // First pass: Add or modify an internal style sheet to define classes for each muscle
        let styleTag = modifiedSvg.match(/<style[^>]*>([\s\S]*?)<\/style>/);
        let styleContent = styleTag ? styleTag[1] : '';
        let newStyle = '';
        
        // Process primary muscles first (they take precedence)
        exerciseData.primaryMuscles.forEach(muscle => {
          const muscleLower = muscle.toLowerCase().replace(/\s+/g, '');
          
          // Skip if the muscle isn't typically shown in this view
          if (!isMuscleInView(muscleLower, isBackView)) {
            if (debugMode) {
              console.log(`Skipping primary muscle ${muscle} in ${isBackView ? 'back' : 'front'} view`);
            }
            return;
          }
          
          if (MUSCLE_COLORS[muscleLower]) {
            // Get all possible SVG IDs for this muscle
            const possibleIds = MUSCLE_ID_MAPPING[muscleLower] || [muscleLower];
            
            // Log potential IDs we're looking for
            if (debugMode) {
              console.log(`Looking for primary muscle "${muscle}" with these possible IDs:`, possibleIds);
            }
            
            let found = false;
            
            // For each possible ID, create a CSS class and try to find the element
            possibleIds.forEach(muscleId => {
              // Create patterns to match both id and class attributes
              // Improved to handle potential capitalization differences
              let patterns = [
                `id="${muscleId}"`,
                `id="${muscleId.toLowerCase()}"`,
                `id="${muscleId.toUpperCase()}"`,
                `id="${muscleId}-left"`,
                `id="${muscleId}-right"`,
                `class="${muscleId}"`,
                `class="${muscleId}-left"`,
                `class="${muscleId}-right"`
              ];

              // Also include variations with suffixes if the SVG has them
              if (!muscleId.includes('_')) {
                for (let i = 2; i <= 4; i++) {
                  patterns.push(`id="${muscleId}_${i}"`);
                }
              }
              
              for (const pattern of patterns) {
                if (modifiedSvg.includes(pattern)) {
                  found = true;
                  coloredMuscles.push(`${muscleId} (primary)`);
                  
                  // Log that we found a match
                  if (debugMode) {
                    console.log(`✅ Found primary muscle with pattern: ${pattern}`);
                  }
                  
                  // Create a unique class name for this muscle
                  const className = `highlight-primary-${muscleLower.replace(/[^a-z0-9]/g, '-')}`;
                  
                  // Add a CSS class definition
                  newStyle += `
                    .${className} {
                      fill: ${MUSCLE_COLORS[muscleLower]} !important;
                      stroke: white !important;
                      stroke-width: 0.5 !important;
                    }
                  `;
                  
                  // Apply the class to the element using the actual attribute found
                  const attrName = pattern.startsWith('id=') ? 'id' : 'class';
                  const matchResult = pattern.match(/"([^"]*)"/);
                  const attrValue = matchResult ? matchResult[1] : '';
                  
                  // Find all elements with this attribute and add our class
                  const elementRegex = new RegExp(`<([^>]*?)${attrName}="${attrValue}"([^>]*)>`, 'g');
                  modifiedSvg = modifiedSvg.replace(elementRegex, (match, prefix, suffix) => {
                    // Check if class attribute already exists
                    if (match.includes('class="')) {
                      // Add our class to existing class attribute
                      return match.replace(/class="([^"]*)"/, `class="$1 ${className}"`);
                    } else {
                      // Add a new class attribute
                      return `<${prefix}${attrName}="${attrValue}" class="${className}"${suffix}>`;
                    }
                  });
                }
              }
            });
            
            if (debugMode && !found) {
              console.log(`❌ Could not find primary muscle: ${muscle} in ${isBackView ? 'back' : 'front'} view`);
            }
          } else if (debugMode) {
            console.log(`❌ No color defined for muscle: ${muscle}`);
          }
        });
        
        // Process secondary muscles (only if not already highlighted as primary)
        exerciseData.secondaryMuscles.forEach(muscle => {
          const muscleLower = muscle.toLowerCase().replace(/\s+/g, '');
          
          // Skip if the muscle isn't typically shown in this view
          if (!isMuscleInView(muscleLower, isBackView)) {
            if (debugMode) {
              console.log(`Skipping secondary muscle ${muscle} in ${isBackView ? 'back' : 'front'} view`);
            }
            return;
          }
          
          if (MUSCLE_COLORS[muscleLower]) {
            // Skip if this muscle is already a primary muscle
            if (!exerciseData.primaryMuscles.some(pm => 
              pm.toLowerCase().replace(/\s+/g, '') === muscleLower)) {
              
              // Get all possible SVG IDs for this muscle
              const possibleIds = MUSCLE_ID_MAPPING[muscleLower] || [muscleLower];
              
              // Log potential IDs we're looking for
              if (debugMode) {
                console.log(`Looking for secondary muscle "${muscle}" with these possible IDs:`, possibleIds);
              }
              
              let found = false;
              
              // For each possible ID, try to find it in the SVG
              possibleIds.forEach(muscleId => {
                // Create patterns to match both id and class attributes
                // Improved to handle potential capitalization differences
                let patterns = [
                  `id="${muscleId}"`,
                  `id="${muscleId.toLowerCase()}"`,
                  `id="${muscleId.toUpperCase()}"`,
                  `id="${muscleId}-left"`,
                  `id="${muscleId}-right"`,
                  `class="${muscleId}"`,
                  `class="${muscleId}-left"`,
                  `class="${muscleId}-right"`
                ];

                // Also include variations with suffixes if the SVG has them
                if (!muscleId.includes('_')) {
                  for (let i = 2; i <= 4; i++) {
                    patterns.push(`id="${muscleId}_${i}"`);
                  }
                }
                
                for (const pattern of patterns) {
                  if (modifiedSvg.includes(pattern)) {
                    found = true;
                    coloredMuscles.push(`${muscleId} (secondary)`);
                    
                    // Log that we found a match
                    if (debugMode) {
                      console.log(`✅ Found secondary muscle with pattern: ${pattern}`);
                    }
                    
                    // Create a unique class name for this secondary muscle
                    const className = `highlight-secondary-${muscleLower.replace(/[^a-z0-9]/g, '-')}`;
                    
                    // Add a CSS class definition with transparency
                    newStyle += `
                      .${className} {
                        fill: ${MUSCLE_COLORS[muscleLower]}80 !important;
                        stroke: white !important;
                        stroke-width: 0.5 !important;
                      }
                    `;
                    
                    // Apply the class to the element using the actual attribute found
                    const attrName = pattern.startsWith('id=') ? 'id' : 'class';
                    const matchResult = pattern.match(/"([^"]*)"/);
                    const attrValue = matchResult ? matchResult[1] : '';
                    
                    // Find all elements with this attribute and add our class
                    const elementRegex = new RegExp(`<([^>]*?)${attrName}="${attrValue}"([^>]*)>`, 'g');
                    modifiedSvg = modifiedSvg.replace(elementRegex, (match, prefix, suffix) => {
                      // Check if class attribute already exists
                      if (match.includes('class="')) {
                        // Add our class to existing class attribute
                        return match.replace(/class="([^"]*)"/, `class="$1 ${className}"`);
                      } else {
                        // Add a new class attribute
                        return `<${prefix}${attrName}="${attrValue}" class="${className}"${suffix}>`;
                      }
                    });
                  }
                }
              });
              
              if (debugMode && !found) {
                console.log(`❌ Could not find secondary muscle: ${muscle} in ${isBackView ? 'back' : 'front'} view`);
              }
            }
          } else if (debugMode) {
            console.log(`❌ No color defined for muscle: ${muscle}`);
          }
        });
        
        // Add the style tag if it doesn't exist, or update it if it does
        if (styleTag) {
          modifiedSvg = modifiedSvg.replace(/<style[^>]*>[\s\S]*?<\/style>/, `<style>${styleContent}\n${newStyle}</style>`);
        } else {
          modifiedSvg = modifiedSvg.replace(/<svg([^>]*)>/, `<svg$1><style>${newStyle}</style>`);
        }
        
        // Add a direct style attribute to make sure the color is applied
        exerciseData.primaryMuscles.forEach(muscle => {
          const muscleLower = muscle.toLowerCase().replace(/\s+/g, '');
          if (!isMuscleInView(muscleLower, isBackView)) return;
          
          if (MUSCLE_COLORS[muscleLower]) {
            const possibleIds = MUSCLE_ID_MAPPING[muscleLower] || [muscleLower];
            
            possibleIds.forEach(muscleId => {
              const idPattern = new RegExp(`<([^>]*)id="${muscleId}"[^>]*>`, 'g');
              modifiedSvg = modifiedSvg.replace(idPattern, (match) => {
                const styleAttr = `style="fill:${MUSCLE_COLORS[muscleLower]}; stroke:white; stroke-width:0.5;"`;
                return addStyleToElement(match, styleAttr);
              });
              
              // Also handle IDs with variations
              const variationPatterns = [
                new RegExp(`<([^>]*)id="${muscleId}_2"[^>]*>`, 'g'),
                new RegExp(`<([^>]*)id="${muscleId}_3"[^>]*>`, 'g'),
                new RegExp(`<([^>]*)id="${muscleId}_4"[^>]*>`, 'g')
              ];
              
              variationPatterns.forEach(pattern => {
                modifiedSvg = modifiedSvg.replace(pattern, (match) => {
                  const styleAttr = `style="fill:${MUSCLE_COLORS[muscleLower]}; stroke:white; stroke-width:0.5;"`;
                  return addStyleToElement(match, styleAttr);
                });
              });
            });
          }
        });
        
        // Add direct style for secondary muscles too
        exerciseData.secondaryMuscles.forEach(muscle => {
          const muscleLower = muscle.toLowerCase().replace(/\s+/g, '');
          if (!isMuscleInView(muscleLower, isBackView)) return;
          
          // Skip if already a primary muscle
          if (exerciseData.primaryMuscles.some(pm => pm.toLowerCase().replace(/\s+/g, '') === muscleLower)) return;
          
          if (MUSCLE_COLORS[muscleLower]) {
            const possibleIds = MUSCLE_ID_MAPPING[muscleLower] || [muscleLower];
            
            possibleIds.forEach(muscleId => {
              const idPattern = new RegExp(`<([^>]*)id="${muscleId}"[^>]*>`, 'g');
              modifiedSvg = modifiedSvg.replace(idPattern, (match) => {
                const styleAttr = `style="fill:${MUSCLE_COLORS[muscleLower]}80; stroke:white; stroke-width:0.5;"`;
                return addStyleToElement(match, styleAttr);
              });
              
              // Also handle IDs with variations
              const variationPatterns = [
                new RegExp(`<([^>]*)id="${muscleId}_2"[^>]*>`, 'g'),
                new RegExp(`<([^>]*)id="${muscleId}_3"[^>]*>`, 'g'),
                new RegExp(`<([^>]*)id="${muscleId}_4"[^>]*>`, 'g')
              ];
              
              variationPatterns.forEach(pattern => {
                modifiedSvg = modifiedSvg.replace(pattern, (match) => {
                  const styleAttr = `style="fill:${MUSCLE_COLORS[muscleLower]}80; stroke:white; stroke-width:0.5;"`;
                  return addStyleToElement(match, styleAttr);
                });
              });
            });
          }
        });
      }
      
      if (debugMode) {
        console.log(`Highlighted muscles in ${isBackView ? 'back' : 'front'} view:`, coloredMuscles);
      }
      
      return modifiedSvg;
    } catch (error) {
      console.error('Error highlighting SVG:', error);
      // Return the original SVG if there's an error in processing
      return svg;
    }
  };

  // Render muscle group tags
  const renderMuscleTags = (muscles: string[], isPrimary: boolean) => {
    if (!muscles || muscles.length === 0) {
      return (
        <Text style={styles.emptyMuscleText}>No data available</Text>
      );
    }

    return (
      <View style={styles.muscleTagsContainer}>
        {muscles.map((muscle, index) => {
          const muscleLower = muscle.toLowerCase().replace(/\s+/g, '');
          const tagColor = MUSCLE_COLORS[muscleLower] || (isPrimary ? '#FF3B30' : 'rgba(255,255,255,0.2)');
          
          return (
            <View 
              key={`${muscle}-${index}`} 
              style={[
                styles.muscleTag, 
                { backgroundColor: tagColor }
              ]}
            >
              <Text 
                style={[
                  styles.muscleTagText, 
                  { color: 'black' }
                ]}
              >
                {muscle.toUpperCase()}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

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
                icon={debugMode ? "bug" : "bug-outline"}
                size={24}
                onPress={toggleDebugMode}
                iconColor={debugMode ? COLORS.primary : COLORS.text}
                style={[
                  styles.debugButton, 
                  { backgroundColor: debugMode ? 'rgba(255, 0, 0, 0.2)' : 'transparent' }
                ]}
              />
            )}
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
                      {renderMuscleTags(exerciseData?.primaryMuscles || [], true)}
                    </View>
                    {hasSecondaryMuscles && (
                      <View style={styles.secondaryMuscleContainer}>
                        {renderMuscleTags(exerciseData?.secondaryMuscles || [], false)}
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.muscleMapContainer}>
                    <View style={styles.muscleMap}>
                      {/* Body visualization with both SVGs side by side */}
                      <View style={styles.bodyViewContainer}>
                        {/* Front Body (Left) */}
                        <View style={styles.bodyView}>
                          {loading ? (
                            <ActivityIndicator size="large" color={COLORS.primary} />
                          ) : frontBodySvg ? (
                            <SvgXml 
                              xml={getHighlightedSvg(frontBodySvg)} 
                              width="100%" 
                              height="100%" 
                            />
                          ) : (
                            <View style={styles.bodyPlaceholder}>
                              <Text style={styles.placeholderText}>Front view not available</Text>
                            </View>
                          )}
                        </View>

                        {/* Back Body (Right) */}
                        <View style={styles.bodyView}>
                          {loading ? (
                            <ActivityIndicator size="large" color={COLORS.primary} />
                          ) : backBodySvg ? (
                            <View style={{ position: 'relative', width: '100%', height: '100%' }}>
                              <SvgXml 
                                xml={getHighlightedSvg(backBodySvg, true)} 
                                width="100%" 
                                height="100%" 
                                opacity={isCardioExercise ? 0.5 : 1} // More subtle opacity change
                              />
                              {isCardioExercise && (
                                <View style={styles.fadedMuscleOverlay}>
                                </View>
                              )}
                            </View>
                          ) : (
                            <View style={styles.bodyPlaceholder}>
                              <Text style={styles.placeholderText}>Back view not available</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                </Surface>

                {/* Instructions Section */}
                <Surface style={styles.sectionContent}>
                  <Text style={styles.instructionsSectionTitle}>Instructions</Text>
                  
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color={COLORS.primary} />
                      <Text style={styles.loadingText}>Loading instructions...</Text>
                    </View>
                  ) : (
                    <ScrollView 
                      style={styles.instructionsScrollView}
                      contentContainerStyle={styles.instructionsScrollContent}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                    >
                      <Text style={styles.instructionText}>
                        {exerciseData?.instructions ? 
                          formatInstructions(exerciseData.instructions) : 
                          'Instructions not available for this exercise.'}
                      </Text>
                    </ScrollView>
                  )}
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
    height: 380,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  sectionsContainer: {
    flexDirection: 'row',
    width: (width - SPACING.md),
  },
  sectionContent: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    width: width - SPACING.md * 2,
    height: 380,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  seeAllText: {
    fontSize: 14,
    color: COLORS.text,
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
  muscleTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  muscleTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: SPACING.xs,
    marginBottom: 6,
  },
  muscleTagText: {
    fontWeight: '500',
    fontSize: 12,
  },
  emptyMuscleText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.5)',
  },
  sectionText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  instructionText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
  },
  muscleMapContainer: {
    marginTop: SPACING.xs * -6,
  },
  muscleMap: {
    marginVertical: SPACING.md,
    position: 'relative',
  },
  bodyViewContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bodyView: {
    width: '45%',
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyPlaceholder: {
    width: '90%',
    height: '95%',
    backgroundColor: 'rgba(100,100,100,0.3)',
    borderRadius: BORDER_RADIUS.md,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: 'rgba(255,255,255,0.7)',
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
  instructionsScrollView: {
    flex: 1,
    height: 250, // Set a specific height to make scrolling work
  },
  instructionsScrollContent: {
    paddingBottom: SPACING.md, // Add some bottom padding for better scrolling
  },
  instructionsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  debugButton: {
    margin: 0,
    borderRadius: 20,
  },
  fadedMuscleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0)', // Remove the background tint
  },
  fadedMuscleText: {
    color: COLORS.text,
    fontWeight: '500',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    textAlign: 'center',
  },
});