import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface ExerciseInstructionsProps {
  instructions: string[] | string | null;
  loading: boolean;
}

export default function ExerciseInstructions({ 
  instructions, 
  loading 
}: ExerciseInstructionsProps) {
  
  // Format instructions for display
  const formatInstructions = (instructionsData: string[] | string | null): string => {
    if (!instructionsData) return 'No instructions available for this exercise.';
    
    // If instructions is a string, handle it
    if (typeof instructionsData === 'string') {
      const lines = instructionsData.includes('\n') 
        ? instructionsData.split('\n').filter(line => line.trim() !== '')
        : [instructionsData];
      
      return lines.join('\n');
    }
    
    // If instructions is an array, join them with newlines
    if (Array.isArray(instructionsData)) {
      return instructionsData.join('\n');
    }
    
    return 'Instructions format not recognized.';
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Instructions</Text>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading instructions...</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          <Text style={styles.instructionText}>
            {formatInstructions(instructions)}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: 'rgba(255,255,255,0.7)',
  },
  scrollView: {
    flex: 1,
    height: 350, // Increased from 250 to 350 to match the larger section
  },
  scrollContent: {
    paddingBottom: SPACING.md, // Add some bottom padding for better scrolling
  },
  instructionText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
  },
}); 