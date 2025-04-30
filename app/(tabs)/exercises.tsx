import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, SafeAreaView, StatusBar, ViewStyle, GestureResponderEvent, Animated, Modal, Pressable, Platform } from 'react-native';
import { Text, IconButton, Surface, Divider } from 'react-native-paper';
import { COLORS, SPACING, BORDER_RADIUS, HEADER_HEIGHT } from '../constants/theme';
import Timer from '../components/timer';
import OptimizedImage from '../components/OptimizedImage';
import { useImagePreloader } from '../hooks/useImagePreloader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GeneralHeader } from '../components/GeneralHeader';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

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
  heartPosition?: {
    top: string;
    left?: string;
    right?: string;
  };
}

const muscleGroups: MuscleGroup[] = [
  // Front view muscles
  { 
    id: 1, 
    name: 'Shoulders', 
    dotPosition: { top: '27%', left: '30%' },
    textPosition: { top: '25%', left: '1%' },
    view: 'front' 
  },
  { 
    id: 17, 
    name: 'Cardio', 
    dotPosition: { top: '20%', right: '25%' },
    textPosition: { top: '18%', right: '1%' },
    view: 'front',
    heartPosition: { top: '20%', right: '25%' }
  },
  { 
    id: 2, 
    name: 'Chest', 
    dotPosition: { top: '32%', left: '40%' },
    textPosition: { top: '30%', left: '1%' },
    view: 'front' 
  },
  { 
    id: 3, 
    name: 'Biceps', 
    dotPosition: { top: '35%', right: '31%' },
    textPosition: { top: '33%', right: '1%' },
    view: 'front' 
  },
  { 
    id: 4, 
    name: 'Forearms', 
    dotPosition: { top: '42%', left: '22%' },
    textPosition: { top: '40%', left: '1%' },
    view: 'front' 
  },
  { 
    id: 5, 
    name: 'Abs', 
    dotPosition: { top: '41%', right: '47%' },
    textPosition: { top: '39%', right: '1%' },
    view: 'front' 
  },
  { 
    id: 6, 
    name: 'Obliques', 
    dotPosition: { top: '48%', left: '34%' },
    textPosition: { top: '46%', left: '1%' },
    view: 'front' 
  },
  { 
    id: 7, 
    name: 'Quads', 
    dotPosition: { top: '58%', left: '39%' },
    textPosition: { top: '56%', left: '1%' },
    view: 'front' 
  },
  { 
    id: 8, 
    name: 'Adductors', 
    dotPosition: { top: '60%', right: '47%' },
    textPosition: { top: '58%', right: '1%' },
    view: 'front' 
  },
  // Back view muscles
  { 
    id: 9, 
    name: 'Traps', 
    dotPosition: { top: '24%', left: '44%' },
    textPosition: { top: '22%', left: '1%' },
    view: 'back' 
  },
  { 
    id: 10, 
    name: 'Triceps', 
    dotPosition: { top: '34%', left: '25%' },
    textPosition: { top: '32%', left: '1%' },
    view: 'back' 
  },
  { 
    id: 11, 
    name: 'Abductors', 
    dotPosition: { top: '44%', left: '35%' },
    textPosition: { top: '42%', left: '1%' },
    view: 'back' 
  },
  { 
    id: 12, 
    name: 'Lats', 
    dotPosition: { top: '31%', right: '39%' },
    textPosition: { top: '29%', right: '1%' },
    view: 'back' 
  },
  { 
    id: 13, 
    name: 'Lower back', 
    dotPosition: { top: '42%', right: '44%' },
    textPosition: { top: '40%', right: '1%' },
    view: 'back' 
  },
  { 
    id: 14, 
    name: 'Glutes', 
    dotPosition: { top: '50%', right: '45%' },
    textPosition: { top: '48%', right: '1%' },
    view: 'back' 
  },
  { 
    id: 15, 
    name: 'Hamstrings', 
    dotPosition: { top: '58%', left: '36%' },
    textPosition: { top: '56%', left: '1%' },
    view: 'back' 
  },
  { 
    id: 16, 
    name: 'Calves', 
    dotPosition: { top: '70%', left: '34%' },
    textPosition: { top: '68%', left: '1%' },
    view: 'back' 
  }
];

export default function ExercisesScreen() {
  const [currentView, setCurrentView] = useState<'front' | 'back'>('front');
  const [touchStart, setTouchStart] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const SWIPE_THRESHOLD = 50;
  const router = useRouter();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Preload body model images
  const bodyModelImages = [
    require('../../assets/body-model_front.png'),
    require('../../assets/body-model_back.png')
  ];
  const { loaded: imagesPreloaded } = useImagePreloader(bodyModelImages);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (isImageLoaded) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Start the pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isImageLoaded]);

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

  const navigateToExercisesList = (muscleGroupName: string) => {
    // Pass the exact muscle group name as the categoryId
    // Also pass the fromScreen parameter so we can navigate back to exercises tab
    const categoryId = muscleGroupName;
    
    router.push({
      pathname: '/(stack)/exercises-list',
      params: { categoryId, fromScreen: 'exercises' }
    });
  };

  const filteredMuscles = muscleGroups.filter(muscle => muscle.view === currentView);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <GeneralHeader
        title="Exercises"
        icon={<MaterialIcons name="fitness-center" size={24} color={COLORS.text} />}
        rightElement={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable style={styles.premiumButton} onPress={() => {}}>
              <View style={styles.premiumIconColumn}>
                <IconButton
                  icon="crown"
                  iconColor="#f9e009"
                  size={26}
                  style={styles.premiumIcon}
                />
                <Text style={styles.premiumText}>PREMIUM</Text>
              </View>
            </Pressable>
          </View>
        }
      />
      
      {/* Timer Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showTimer}
        onRequestClose={() => setShowTimer(false)}
      >
        <View style={styles.modalContainer}>
          <Timer onClose={() => setShowTimer(false)} />
        </View>
      </Modal>

      {/* Body Model Container */}
      <View 
        style={[styles.bodyModelContainer, { paddingTop: HEADER_HEIGHT }]}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Animated.View style={[styles.modelContainer, { opacity: fadeAnim }]}>
          <View style={styles.imagesContainer}>
            <OptimizedImage
              source={require('../../assets/body-model_front.png')}
              style={[
                styles.bodyModel,
                {
                  opacity: currentView === 'front' ? 1 : 0,
                  position: 'absolute',
                }
              ]}
              imageStyle={styles.bodyModel}
              contentFit="contain"
              onLoad={() => setIsImageLoaded(true)}
              transparent
            />
            <OptimizedImage
              source={require('../../assets/body-model_back.png')}
              style={[
                styles.bodyModel,
                {
                  opacity: currentView === 'back' ? 1 : 0,
                  position: 'absolute',
                }
              ]}
              imageStyle={styles.bodyModel}
              contentFit="contain"
              onLoad={() => setIsImageLoaded(true)}
              transparent
            />
          </View>
          
          {/* Timer Icon */}
          <IconButton
            icon="timer-outline"
            iconColor="white"
            size={38}
            style={styles.timerIcon}
            onPress={() => setShowTimer(true)}
          />

          {/* Muscle Group Markers */}
          {isImageLoaded && filteredMuscles.map((muscle) => (
            <React.Fragment key={muscle.id}>
              {/* Create a larger clickable area first */}
              <TouchableOpacity
                style={[
                  styles.clickableZone,
                  {
                    position: 'absolute',
                    width: `${Math.abs(
                      parseFloat((muscle.textPosition.right ? (100 - parseFloat(muscle.textPosition.right)) : muscle.textPosition.left || '0').toString()) -
                      parseFloat((muscle.dotPosition.right ? (100 - parseFloat(muscle.dotPosition.right)) : muscle.dotPosition.left || '0').toString())
                    ) + 5}%`, // Slightly wider than the dotted line
                    height: '10%', // Tall enough to be easily clickable
                    left: `${
                      muscle.textPosition.right 
                        ? (100 - Math.max(
                            parseFloat(muscle.textPosition.right),
                            parseFloat(muscle.dotPosition.right || '0')
                          ))
                        : Math.min(
                            parseFloat(muscle.dotPosition.left || '100'),
                            parseFloat(muscle.textPosition.left || '100')
                          )
                    }%`,
                    top: `${parseFloat(muscle.dotPosition.top) - 5}%`, // Slightly above the dot
                    zIndex: 5,
                  } as ViewStyle
                ]}
                onPress={() => navigateToExercisesList(muscle.name)}
              />
              
              <TouchableOpacity
                style={[
                  styles.muscleMarker,
                  muscle.name === 'Cardio' ? { 
                    width: 32, 
                    height: 32, 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    marginTop: -12
                  } : {},
                  muscle.name === 'Cardio' ? muscle.heartPosition as ViewStyle : muscle.dotPosition as ViewStyle
                ]}
                onPress={() => navigateToExercisesList(muscle.name)}
              >
                {muscle.name === 'Cardio' ? (
                  <MaterialCommunityIcons name="heart-pulse" size={28} color={COLORS.primary} style={{ marginTop: -1 }} />
                ) : (
                  <Animated.View 
                    style={[
                      styles.markerDot,
                      { 
                        transform: [{ scale: pulseAnim }],
                      }
                    ]} 
                  />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.textContainer,
                  muscle.textPosition as ViewStyle,
                  muscle.textPosition.right ? styles.textRight : styles.textLeft
                ]}
                onPress={() => navigateToExercisesList(muscle.name)}
              >
                <Text style={styles.markerText}>{muscle.name}</Text>
              </TouchableOpacity>
              {/* Visual dotted line (not clickable anymore as we have the large clickable zone) */}
              <View
                style={[
                  styles.dottedLine,
                  {
                    width: `${Math.abs(
                      parseFloat((muscle.textPosition.right ? (100 - parseFloat(muscle.textPosition.right)) : muscle.textPosition.left || '0').toString()) -
                      parseFloat((muscle.dotPosition.right ? (100 - parseFloat(muscle.dotPosition.right)) : muscle.dotPosition.left || '0').toString())
                    )}%`,
                    left: `${
                      muscle.textPosition.right 
                        ? (100 - Math.max(
                            parseFloat(muscle.textPosition.right),
                            parseFloat(muscle.dotPosition.right || '0')
                          ))
                        : Math.min(
                            parseFloat(muscle.dotPosition.left || '100'),
                            parseFloat(muscle.textPosition.left || '100')
                          )
                    }%`,
                    top: `${parseFloat(muscle.dotPosition.top) + 0.5}%`,
                  } as ViewStyle
                ]}
              />
            </React.Fragment>
          ))}

          <View style={styles.viewIndicator}>
            <View style={[styles.dot, currentView === 'front' && styles.activeDot]} />
            <View style={[styles.dot, currentView === 'back' && styles.activeDot]} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  bodyModelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    bottom: 35,
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
    width: 10,
    height: 10,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
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
    fontSize: 14,
    backgroundColor: 'rgba(108, 71, 255, 0.27)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dottedLine: {
    position: 'absolute',
    borderStyle: 'dotted',
    borderWidth: 1,
    borderColor: '#6c47ff',
  },
  viewIndicator: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(224, 15, 15, 0.3)',
  },
  activeDot: {
    backgroundColor: 'white',
  },
  timerIcon: {
    position: 'absolute',
    right: 20,
    bottom: '10%',
    backgroundColor: '#2A2F35',
    borderRadius: 40,
    width: 56,
    height: 56,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#181a20',
  },
  premiumButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  premiumIcon: {
    margin: 0,
    marginTop: 0,
    marginLeft: 0,
  },
  premiumIconColumn: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  premiumText: {
    color: '#f9e009',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -10,
  },
  clickableZone: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 4,
  },
}); 