import { MaterialIcons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, GestureResponderEvent, Image, Text, View } from 'react-native';
import { captureUIError } from '../../../services/sentry';
import { useMuscleGroupFiltering, useSearchState } from '../hooks';
import { styles } from '../styles';
import { MuscleGroupRender } from './MuscleMarkers';

export const Step1MuscleSelection = ({
  currentView,
  setCurrentView,
  onMuscleSelect,
  pulseAnim,
  searchState,
}: {
  currentView: 'front' | 'back';
  setCurrentView: (view: 'front' | 'back') => void;
  onMuscleSelect: (muscle: string) => void;
  pulseAnim: Animated.Value;
  searchState: ReturnType<typeof useSearchState>;
}) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const SWIPE_THRESHOLD = 50;

  // Track step 1 rendering
  useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'Step 1 Muscle Selection Rendered',
      category: 'ui.render',
      level: 'info',
      data: {
        currentView,
        isImageLoaded,
        searchQuery: searchState.searchQuery,
      },
    });
  }, [currentView, isImageLoaded, searchState.searchQuery]);

  const frontBodyModel = require('../../../../assets/body-model_front.png');
  const backBodyModel = require('../../../../assets/body-model_back.png');

  // Use muscle group filtering
  const { filteredMuscleGroups } = useMuscleGroupFiltering(searchState.searchQuery, currentView);

  useEffect(() => {
    if (isImageLoaded) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isImageLoaded]);

  const handleViewChange = (newView: 'front' | 'back') => {
    if (isTransitioning || newView === currentView) return;

    try {
      // Track view change
      Sentry.addBreadcrumb({
        message: 'Body Model View Changed',
        category: 'user.interaction',
        level: 'info',
        data: {
          fromView: currentView,
          toView: newView,
          trigger: 'swipe',
        },
      });

      setIsTransitioning(true);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentView(newView);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          setIsTransitioning(false);
        });
      });
    } catch (error) {
      captureUIError(error as Error, 'Step1MuscleSelection.handleViewChange', 'add-exercise-modal');
    }
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    setTouchStart(event.nativeEvent.pageX);
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    const swipeLength = event.nativeEvent.pageX - touchStart;

    if (Math.abs(swipeLength) > SWIPE_THRESHOLD) {
      // Any swipe (left or right) toggles between front and back views
      if (currentView === 'front') {
        handleViewChange('back');
      } else {
        handleViewChange('front');
      }
    }
  };

  return (
    <View style={styles.stepContainer}>
      <View
        style={styles.bodyModelContainer}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Animated.View style={[styles.modelContainer, { opacity: fadeAnim }]}>
          <View style={styles.imagesContainer}>
            <Image
              source={frontBodyModel}
              style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                opacity: currentView === 'front' ? 1 : 0,
                resizeMode: 'contain',
              }}
              onLoad={() => {
                setIsImageLoaded(true);
              }}
            />
            <Image
              source={backBodyModel}
              style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                opacity: currentView === 'back' ? 1 : 0,
                resizeMode: 'contain',
              }}
              onLoad={() => {
                setIsImageLoaded(true);
              }}
            />
          </View>

          {isImageLoaded &&
            filteredMuscleGroups.map((muscle) => (
              <MuscleGroupRender
                key={muscle.id}
                muscle={muscle}
                pulseAnim={pulseAnim}
                onPress={onMuscleSelect}
              />
            ))}
        </Animated.View>
      </View>

      {/* Show empty state when search has no results */}
      {isImageLoaded && searchState.searchQuery.trim() && filteredMuscleGroups.length === 0 && (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="search-off" size={48} color="rgba(255,255,255,0.5)" />
          <Text style={styles.emptyText}>No muscle groups match your search</Text>
        </View>
      )}
    </View>
  );
};
