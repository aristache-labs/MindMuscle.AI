import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  Animated,
  TouchableOpacity
} from 'react-native';
import { Text, IconButton, Portal, Provider } from 'react-native-paper';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { COLORS, SPACING } from '../constants/theme';

interface WeekData {
  number: number;
  name: string;
  color: string;
  description: string;
  days: number;
  isActive?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  modalAnim?: Animated.Value;
  planTitle: string;
  planSubtitle?: string;
  weeks: WeekData[];
  currentWeek: number;
  onWeekPress?: (weekNumber: number) => void;
  onDayPress?: (weekNumber: number, dayNumber: number) => void;
}

export default function PlanOverviewModal({ 
  visible, 
  onClose, 
  planTitle, 
  planSubtitle,
  weeks, 
  currentWeek,
  onWeekPress,
  onDayPress
}: Props) {
  // Generate our own animation value
  const [modalAnim] = useState(() => new Animated.Value(0));
  
  // Run animation when visibility changes
  useEffect(() => {
    if (visible) {
      Animated.spring(modalAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, modalAnim]);
  
  // Calculate translateY based on animation value
  const translateY = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get('window').height, 0],
  });

  // Early return after all hooks have been called
  if (!visible) return null;

  return (
    <Provider>
      <Portal>
        <Modal
          visible={visible}
          transparent={true}
          animationType="none"
          onRequestClose={onClose}
          statusBarTranslucent={true}
        >
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={styles.overlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <Animated.View style={[styles.modalContainer, { transform: [{ translateY }] }]}>
                  <View style={styles.container}>
                    <View style={styles.topGlowLeft} />
                    <View style={styles.topGlowRight} />
                    <View style={styles.header}>
                      <Text style={styles.title}>PLAN OVERVIEW</Text>
                      <IconButton
                        icon="close"
                        iconColor="#fff"
                        size={24}
                        style={styles.closeButton}
                        onPress={onClose}
                      />
                    </View>
                    
                    {planTitle && (
                      <Text style={styles.planTitle}>{planTitle}</Text>
                    )}
                    
                    {planSubtitle && (
                      <Text style={styles.planSubtitle}>{planSubtitle}</Text>
                    )}
                    
                    <GestureHandlerRootView style={styles.gestureRoot}>
                      <ScrollView
                        style={styles.scrollView}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollViewContent}
                        bounces={true}
                        scrollEventThrottle={16}
                      >
                        <View style={styles.timeline}>
                          {/* Single continuous vertical line that starts at first dot and ends at last dot */}
                          {weeks.length > 0 && <View style={styles.timelineLine} />}
                          
                          {weeks.map((week, index) => (
                            <View key={`week-${week.number}`} style={styles.weekContainer}>
                              {/* Timeline dot */}
                              <View style={styles.timelineLeft}>
                                <View 
                                  style={[
                                    styles.timelineDot, 
                                    { backgroundColor: week.color }
                                  ]} 
                                />
                              </View>
                              
                              {/* Week content */}
                              <View 
                                style={[
                                  styles.weekContent,
                                  week.number === currentWeek && styles.activeWeekContent
                                ]}
                              >
                                <View style={styles.weekHeader}>
                                  <View style={[styles.weekIndicator, { backgroundColor: week.color }]} />
                                  <Text style={styles.weekTitle}>Week {week.number} - {week.name}</Text>
                                </View>
                                
                                {week.description && (
                                  <View style={styles.weekDescription}>
                                    <Text style={styles.descriptionText}>{week.description}</Text>
                                  </View>
                                )}
                                
                                <View style={styles.dayButtonsContainer}>
                                  {Array.from({ length: week.days }).map((_, i) => (
                                    <TouchableOpacity
                                      key={`day-${i+1}`}
                                      style={styles.dayButton}
                                      onPress={() => onDayPress?.(week.number, i+1)}
                                    >
                                      <Text style={styles.dayButtonText}>Day {i+1}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>
                        
                        <Text style={styles.footerText}>
                          Once you complete your last workout on this plan we will generate your next plan based on your preferences, so you continue seeing results
                        </Text>
                      </ScrollView>
                    </GestureHandlerRootView>
                  </View>
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </Portal>
    </Provider>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    height: SCREEN_HEIGHT,
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
  gestureRoot: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.background,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    right: 8,
    margin: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  planTitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  planSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  timeline: {
    marginTop: 16,
    position: 'relative',
    paddingLeft: 0, // Remove padding to position elements properly
  },
  timelineLine: {
    position: 'absolute',
    width: 1,
    top: 90, // Start exactly at the blue dot
    bottom: 70, // End exactly at the green dot
    left: 30, // Center it through the dots
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 1,
  },
  timelineLineSegment: {
    position: 'absolute',
    width: 1,
    height: 70,
    left: 5.5, // Better center alignment with the dot
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 1,
  },
  weekContainer: {
    flexDirection: 'row',
    marginBottom: 0,
    position: 'relative',
    paddingTop: 10,
  },
  timelineLeft: {
    width: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginLeft: 24, // Position dots over the line
    zIndex: 2,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginTop: 0, // Adjusted for better vertical alignment
    zIndex: 2,
  },
  weekContent: {
    flex: 1,
    backgroundColor: '#242936',
    borderRadius: 12,
    padding: 16,
    marginLeft: 12,
  },
  activeWeekContent: {
    backgroundColor: '#24293E',
    borderWidth: 1,
    borderColor: '#1D6AE5', // Blue border for active week as shown in screenshot
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  weekIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  weekDescription: {
    marginBottom: 10,
    marginTop: 2,
  },
  descriptionText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  dayButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayButton: {
    backgroundColor: '#333845',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  dayButtonText: {
    fontSize: 14,
    color: '#fff',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 16,
    fontStyle: 'italic',
  }
}); 