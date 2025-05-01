import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { 
  highlightMusclesInSvg, 
  extractSvgIds, 
  analyzeSvgStructure, 
  getMuscleColor,
  MUSCLE_CONFIG,
  MuscleConfig
} from '../utils/muscleHighlighter';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface BodyViewProps {
  svg: string | null;
  loading: boolean;
  placeholderText: string;
}

// Memoized BodyView component to prevent unnecessary re-renders
const BodyView = React.memo(({ svg, loading, placeholderText }: BodyViewProps) => {
  if (loading) {
    return <ActivityIndicator size="large" color={COLORS.primary} />;
  }
  
  if (!svg) {
    return (
      <View style={styles.bodyPlaceholder}>
        <Text style={styles.placeholderText}>{placeholderText}</Text>
      </View>
    );
  }
  
  return <SvgXml xml={svg} width="100%" height="100%" />;
});

BodyView.displayName = 'BodyView';

interface MuscleDiagramProps {
  frontBodySvg: string | null;
  backBodySvg: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  loading: boolean;
  isCardioExercise: boolean;
  debugMode?: boolean;
}

export default function MuscleDiagram({
  frontBodySvg,
  backBodySvg,
  primaryMuscles,
  secondaryMuscles,
  loading,
  isCardioExercise,
  debugMode = false,
}: MuscleDiagramProps) {
  // Ensure Cardio is included in primaryMuscles when isCardioExercise is true
  const enhancedPrimaryMuscles = useMemo(() => {
    if (isCardioExercise && !primaryMuscles.some(m => m.toLowerCase() === 'cardio')) {
      return ['Cardio', ...primaryMuscles];
    }
    return primaryMuscles;
  }, [primaryMuscles, isCardioExercise]);

  // Normalize muscle names to improve matching
  const normalizedSecondaryMuscles = useMemo(() => {
    return secondaryMuscles.map(m => m.trim());
  }, [secondaryMuscles]);

  // Debug SVG structure if needed
  useMemo(() => {
    if (debugMode) {
      console.log('======= MUSCLE DIAGRAM DEBUG =======');
      console.log('Muscles to highlight:', {
        primary: enhancedPrimaryMuscles,
        secondary: normalizedSecondaryMuscles
      });
      
      // Analyze front SVG
      if (frontBodySvg) {
        console.log('--- FRONT SVG ANALYSIS ---');
        console.log(analyzeSvgStructure(frontBodySvg, false));
      } else {
        console.warn('Front SVG is missing');
      }
      
      // Analyze back SVG
      if (backBodySvg) {
        console.log('--- BACK SVG ANALYSIS ---');
        console.log(analyzeSvgStructure(backBodySvg, true));
      } else {
        console.warn('Back SVG is missing');
      }
      
      console.log('==================================');
    }
  }, [frontBodySvg, backBodySvg, enhancedPrimaryMuscles, normalizedSecondaryMuscles, debugMode]);

  // Add diagnostic logging for SVG IDs and colors
  useMemo(() => {
    if (debugMode) {
      console.log('\n=== SVG ID Analysis ===');
      
      // Analyze front view
      if (frontBodySvg) {
        const frontIds = extractSvgIds(frontBodySvg);
        console.log('\nFRONT VIEW IDs:');
        console.log('----------------');
        frontIds.forEach(id => {
          // Try to identify if this ID matches any muscle
          const lowerCaseId = id.toLowerCase();
          const matchingMuscle = Object.entries(MUSCLE_CONFIG).find(([_, config]) => 
            config.ids.some(muscleId => 
              lowerCaseId.includes(muscleId.toLowerCase()) || 
              muscleId.toLowerCase().includes(lowerCaseId)
            )
          );

          if (matchingMuscle) {
            const [muscleName, config] = matchingMuscle;
            const isPrimary = primaryMuscles.some(m => 
              m.toLowerCase().includes(muscleName.toLowerCase()) ||
              muscleName.toLowerCase().includes(m.toLowerCase())
            );
            const isSecondary = secondaryMuscles.some(m => 
              m.toLowerCase().includes(muscleName.toLowerCase()) ||
              muscleName.toLowerCase().includes(m.toLowerCase())
            );
            
            console.log(`ID: ${id}`);
            console.log(`  → Matches muscle: ${muscleName}`);
            console.log(`  → Expected color: ${config.color}${isSecondary ? '80' : ''}`);
            console.log(`  → Role: ${isPrimary ? 'PRIMARY' : isSecondary ? 'SECONDARY' : 'NOT TARGETED'}`);
            console.log('----------------');
          } else if (id.toLowerCase().includes('vector')) {
            console.log(`ID: ${id}`);
            console.log('  → Vector element (no muscle match)');
            console.log('----------------');
          }
        });
      } else {
        console.log('No front view SVG available');
      }

      // Analyze back view
      if (backBodySvg) {
        const backIds = extractSvgIds(backBodySvg);
        console.log('\nBACK VIEW IDs:');
        console.log('----------------');
        backIds.forEach(id => {
          // Try to identify if this ID matches any muscle
          const lowerCaseId = id.toLowerCase();
          const matchingMuscle = Object.entries(MUSCLE_CONFIG).find(([_, config]) => 
            config.ids.some(muscleId => 
              lowerCaseId.includes(muscleId.toLowerCase()) || 
              muscleId.toLowerCase().includes(lowerCaseId)
            )
          );

          if (matchingMuscle) {
            const [muscleName, config] = matchingMuscle;
            const isPrimary = primaryMuscles.some(m => 
              m.toLowerCase().includes(muscleName.toLowerCase()) ||
              muscleName.toLowerCase().includes(m.toLowerCase())
            );
            const isSecondary = secondaryMuscles.some(m => 
              m.toLowerCase().includes(muscleName.toLowerCase()) ||
              muscleName.toLowerCase().includes(m.toLowerCase())
            );
            
            console.log(`ID: ${id}`);
            console.log(`  → Matches muscle: ${muscleName}`);
            console.log(`  → Expected color: ${config.color}${isSecondary ? '80' : ''}`);
            console.log(`  → Role: ${isPrimary ? 'PRIMARY' : isSecondary ? 'SECONDARY' : 'NOT TARGETED'}`);
            console.log('----------------');
          } else if (id.toLowerCase().includes('vector')) {
            console.log(`ID: ${id}`);
            console.log('  → Vector element (no muscle match)');
            console.log('----------------');
          }
        });
      } else {
        console.log('No back view SVG available');
      }
      
      console.log('\nTarget Muscles:');
      console.log('Primary:', primaryMuscles);
      console.log('Secondary:', secondaryMuscles);
      console.log('===================\n');
    }
  }, [frontBodySvg, backBodySvg, primaryMuscles, secondaryMuscles, debugMode]);

  // Memoize the highlighted SVGs to avoid recalculating on every render
  const highlightedFrontSvg = useMemo(() => {
    if (!frontBodySvg) return null;
    
    if (debugMode) {
      console.log('[FRONT] Generating highlighted SVG');
    }
    
    const result = highlightMusclesInSvg(
      frontBodySvg, 
      enhancedPrimaryMuscles, 
      normalizedSecondaryMuscles, 
      false, // isBackView
      debugMode  // debug mode
    );
    
    // Check if front SVG was modified
    if (debugMode) {
      if (result === frontBodySvg) {
        console.warn('[FRONT] WARNING: SVG was not modified by highlighting process');
      } else {
        console.log('[FRONT] SVG was successfully modified');
      }
    }
    
    return result;
  }, [frontBodySvg, enhancedPrimaryMuscles, normalizedSecondaryMuscles, debugMode]);

  const highlightedBackSvg = useMemo(() => {
    if (!backBodySvg) return null;
    
    if (debugMode) {
      console.log('[BACK] Generating highlighted SVG');
    }
    
    const result = highlightMusclesInSvg(
      backBodySvg, 
      enhancedPrimaryMuscles, 
      normalizedSecondaryMuscles, 
      true, // isBackView
      debugMode  // debug mode
    );
    
    // Check if back SVG was modified
    if (debugMode) {
      if (result === backBodySvg) {
        console.warn('[BACK] WARNING: SVG was not modified by highlighting process');
      } else {
        console.log('[BACK] SVG was successfully modified');
      }
    }
    
    return result;
  }, [backBodySvg, enhancedPrimaryMuscles, normalizedSecondaryMuscles, debugMode]);

  const views = useMemo(() => [
    { svg: highlightedFrontSvg, text: 'Front view not available' },
    { svg: highlightedBackSvg, text: 'Back view not available' },
  ], [highlightedFrontSvg, highlightedBackSvg]);

  return (
    <View style={styles.muscleMapContainer}>
      <View style={styles.muscleMap}>
        <View style={styles.bodyViewContainer}>
          {views.map((view, index) => (
            <View key={index} style={styles.bodyView}>
              <BodyView
                loading={loading}
                svg={view.svg}
                placeholderText={view.text}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  muscleMapContainer: {
    marginVertical: SPACING.md,
  },
  muscleMap: {
    position: 'relative',
    marginVertical: SPACING.md * -1,
  },
  bodyViewContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bodyView: {
    width: '45%',
    height: 325,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyPlaceholder: {
    width: '90%',
    height: '95%',
    backgroundColor: 'rgba(100,100,100,0.3)',
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: SPACING.sm,
  },
}); 