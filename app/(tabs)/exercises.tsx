import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, SafeAreaView, StatusBar, ViewStyle, GestureResponderEvent, Animated } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { COLORS } from '../constants/theme';

interface MuscleGroup {
  id: number;
  name: string;
  dotPosition: {
    top: string;
    left?: string;
    right?: string;
  };
  textPosition: {
    top: string;
    left?: string;
    right?: string;
  };
  view: 'front' | 'back';
}

const muscleGroups: MuscleGroup[] = [
  // Front view muscles
  { 
    id: 1, 
    name: 'Shoulders', 
    dotPosition: { top: '22%', left: '30%' },
    textPosition: { top: '20%', left: '1%' },
    view: 'front' 
  },
  { 
    id: 2, 
    name: 'Chest', 
    dotPosition: { top: '28%', left: '40%' },
    textPosition: { top: '28%', left: '1%' },
    view: 'front' 
  },
  { 
    id: 3, 
    name: 'Biceps', 
    dotPosition: { top: '31%', right: '32%' },
    textPosition: { top: '31%', right: '1%' },
    view: 'front' 
  },
  { 
    id: 4, 
    name: 'Forearms', 
    dotPosition: { top: '42%', left: '24%' },
    textPosition: { top: '41%', left: '1%' },
    view: 'front' 
  },
  { 
    id: 5, 
    name: 'Abs', 
    dotPosition: { top: '40%', right: '47%' },
    textPosition: { top: '39%', right: '1%' },
    view: 'front' 
  },
  { 
    id: 6, 
    name: 'Obliques', 
    dotPosition: { top: '43%', left: '37%' },
    textPosition: { top: '48%', left: '1%' },
    view: 'front' 
  },
  { 
    id: 7, 
    name: 'Quads', 
    dotPosition: { top: '55%', left: '39%' },
    textPosition: { top: '55%', left: '1%' },
    view: 'front' 
  },
  { 
    id: 8, 
    name: 'Adductors', 
    dotPosition: { top: '60%', right: '47%' },
    textPosition: { top: '60%', right: '1%' },
    view: 'front' 
  },
  // Back view muscles
  { 
    id: 9, 
    name: 'Traps', 
    dotPosition: { top: '20%', left: '43%' },
    textPosition: { top: '20%', left: '1%' },
    view: 'back' 
  },
  { 
    id: 10, 
    name: 'Triceps', 
    dotPosition: { top: '30%', left: '28%' },
    textPosition: { top: '28%', left: '1%' },
    view: 'back' 
  },
  { 
    id: 11, 
    name: 'Abductors', 
    dotPosition: { top: '43%', left: '35%' },
    textPosition: { top: '42%', left: '1%' },
    view: 'back' 
  },
  { 
    id: 12, 
    name: 'Lats', 
    dotPosition: { top: '30%', right: '40%' },
    textPosition: { top: '30%', right: '1%' },
    view: 'back' 
  },
  { 
    id: 13, 
    name: 'Lower back', 
    dotPosition: { top: '40%', right: '45%' },
    textPosition: { top: '40%', right: '1%' },
    view: 'back' 
  },
  { 
    id: 14, 
    name: 'Glutes', 
    dotPosition: { top: '50%', right: '45%' },
    textPosition: { top: '50%', right: '1%' },
    view: 'back' 
  },
  { 
    id: 15, 
    name: 'Hamstrings', 
    dotPosition: { top: '60%', left: '38%' },
    textPosition: { top: '60%', left: '1%' },
    view: 'back' 
  },
  { 
    id: 16, 
    name: 'Calves', 
    dotPosition: { top: '75%', left: '35%' },
    textPosition: { top: '74%', left: '1%' },
    view: 'back' 
  }
];

export default function ExercisesScreen() {
  const [currentView, setCurrentView] = useState<'front' | 'back'>('front');
  const [touchStart, setTouchStart] = useState(0);
  const SWIPE_THRESHOLD = 50;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleViewChange = (newView: 'front' | 'back') => {
    if (isTransitioning || newView === currentView) return;

    setIsTransitioning(true);
    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setCurrentView(newView);
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setIsTransitioning(false);
      });
    });
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    setTouchStart(event.nativeEvent.pageX);
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    const swipeLength = event.nativeEvent.pageX - touchStart;
    
    if (Math.abs(swipeLength) > SWIPE_THRESHOLD) {
      if (swipeLength > 0 && currentView === 'back') {
        handleViewChange('front');
      } else if (swipeLength < 0 && currentView === 'front') {
        handleViewChange('back');
      }
    }
  };

  const filteredMuscles = muscleGroups.filter(muscle => muscle.view === currentView);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Exercises</Text>
        <View style={styles.headerRight}>
          <IconButton
            icon="star-outline"
            iconColor="white"
            size={24}
            onPress={() => {}}
          />
        </View>
      </View>

      {/* Body Model Container */}
      <View 
        style={styles.bodyModelContainer}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Animated.View style={[styles.modelContainer, { opacity: fadeAnim }]}>
          <View style={styles.imagesContainer}>
            <Animated.Image
              source={require('../../assets/body-model_front.png')}
              style={[
                styles.bodyModel,
                {
                  opacity: currentView === 'front' ? 1 : 0,
                  position: 'absolute',
                }
              ]}
              resizeMode="contain"
            />
            <Animated.Image
              source={require('../../assets/body-model_back.png')}
              style={[
                styles.bodyModel,
                {
                  opacity: currentView === 'back' ? 1 : 0,
                  position: 'absolute',
                }
              ]}
              resizeMode="contain"
            />
          </View>
          
          {/* Muscle Group Markers */}
          {filteredMuscles.map((muscle) => (
            <React.Fragment key={muscle.id}>
              <View
                style={[
                  styles.muscleMarker,
                  muscle.dotPosition as ViewStyle
                ]}
              >
                <View style={styles.markerDot} />
              </View>
              <View
                style={[
                  styles.textContainer,
                  muscle.textPosition as ViewStyle,
                  muscle.textPosition.right ? styles.textRight : styles.textLeft
                ]}
              >
                <Text style={styles.markerText}>{muscle.name}</Text>
              </View>
            </React.Fragment>
          ))}
        </Animated.View>

        {/* View Indicator */}
        <View style={styles.viewIndicator}>
          <View style={[styles.dot, currentView === 'front' && styles.activeDot]} />
          <View style={[styles.dot, currentView === 'back' && styles.activeDot]} />
        </View>
      </View>

      {/* Bottom Icons */}
      <View style={styles.bottomIcons}>
        <IconButton
          icon="sync"
          iconColor="white"
          size={24}
          style={styles.bottomIcon}
          onPress={() => handleViewChange(currentView === 'front' ? 'back' : 'front')}
          disabled={isTransitioning}
        />
        <IconButton
          icon="timer-outline"
          iconColor="white"
          size={24}
          style={styles.bottomIcon}
          onPress={() => {}}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1F25',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bodyModelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  modelContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  imagesContainer: {
    width: '100%',
    height: '90%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyModel: {
    width: '100%',
    height: '100%',
  },
  muscleMarker: {
    position: 'absolute',
    width: 8,
    height: 8,
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
  },
  textContainer: {
    position: 'absolute',
    maxWidth: '30%',
  },
  textLeft: {
    alignItems: 'flex-start',
  },
  textRight: {
    alignItems: 'flex-end',
  },
  markerText: {
    color: 'white',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  bottomIcons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 20,
  },
  bottomIcon: {
    backgroundColor: '#2A2F35',
    borderRadius: 30,
  },
  viewIndicator: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  activeDot: {
    backgroundColor: 'white',
  },
}); 