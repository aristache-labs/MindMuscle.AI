import React from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  Image,
  KeyboardAvoidingView,
  ImageSourcePropType,
  Animated
} from 'react-native';
import { Text, IconButton, Portal, Provider } from 'react-native-paper';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { MeasurementCategory } from '../services/measurements';
import OptimizedImage from './OptimizedImage';
import { STATIC_IMAGES } from '../utils/imagePreloader';
import { COLORS } from '../constants/theme';

interface MeasurementInstruction {
  category: MeasurementCategory;
  title: string;
  instruction: string;
  icon: ImageSourcePropType;
}

const MEASUREMENT_INSTRUCTIONS: MeasurementInstruction[] = [
  {
    category: 'WEIGHT',
    title: 'Weight',
    instruction: 'Weigh yourself first thing in the morning, on an empty stomach, and after going to the bathroom.',
    icon: STATIC_IMAGES.measurements.weight
  },
  {
    category: 'BICEPS',
    title: 'Biceps',
    instruction: 'Straighten your arms and lift them to the side of your body, parallel to the floor. Wrap the thickest part of your arm with the tape measure, making sure that it is tight to your skin and in a straight line. Flex your arm as hard as possible and then take the measurement.',
    icon: STATIC_IMAGES.measurements.biceps
  },
  {
    category: 'CHEST',
    title: 'Chest',
    instruction: 'Stand straight with your arms at your sides. Wrap the measuring tape around your chest at the fullest point, typically at nipple level. Keep the tape parallel to the ground and breathe normally.',
    icon: STATIC_IMAGES.measurements.chest
  },
  {
    category: 'WAIST',
    title: 'Waist',
    instruction: 'Measure around your natural waistline, at the narrowest part of your waist, typically just above your belly button. Keep the tape snug but not tight, and measure after exhaling.',
    icon: STATIC_IMAGES.measurements.waist
  },
  {
    category: 'ABS',
    title: 'Abs',
    instruction: 'Measure around your abdomen at the widest point, typically at the belly button level. Keep the tape parallel to the ground and breathe normally.',
    icon: STATIC_IMAGES.measurements.abs
  },
  {
    category: 'SHLDRS',
    title: 'Shoulders',
    instruction: 'Measure across the widest part of your shoulders, from one end to the other. Keep the tape straight and level across your back.',
    icon: STATIC_IMAGES.measurements.shoulders
  },
  {
    category: 'THIGH',
    title: 'Thigh',
    instruction: 'Stand with your feet slightly apart. Measure around the fullest part of your thigh, typically near the top of your leg. Keep the tape level and snug but not tight.',
    icon: STATIC_IMAGES.measurements.thigh
  },
  {
    category: 'CALF',
    title: 'Calf',
    instruction: 'Sit with your leg bent at 90 degrees. Measure around the fullest part of your calf muscle. Keep the tape snug but not tight.',
    icon: STATIC_IMAGES.measurements.calf
  }
];

interface Props {
  visible: boolean;
  onClose: () => void;
  modalAnim: Animated.Value;
}

export default function HowToMeasureModal({ visible, onClose, modalAnim }: Props) {
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
                <Animated.View style={[styles.modalContainer, { transform: [{ translateY: modalAnim }] }]}>
                  <View style={styles.container}>
                    <View style={styles.topGlowLeft} />
                    <View style={styles.topGlowRight} />
                    <View style={styles.header}>
                      <IconButton
                        icon="close"
                        iconColor="#fff"
                        size={24}
                        style={styles.closeButton}
                        onPress={onClose}
                      />
                      <Text style={styles.title}>HOW TO MEASURE</Text>
                    </View>
                    <GestureHandlerRootView style={styles.gestureRoot}>
                      <ScrollView
                        style={styles.scrollView}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollViewContent}
                        bounces={true}
                        scrollEventThrottle={16}
                      >
                        {MEASUREMENT_INSTRUCTIONS.map((instruction, index) => (
                          <View 
                            key={instruction.category}
                            style={[
                              styles.instructionCard,
                              index === 0 && styles.firstCard,
                              index === MEASUREMENT_INSTRUCTIONS.length - 1 && styles.lastCard
                            ]}
                          >
                            <View style={styles.instructionImageContainer}>
                              <View style={styles.imageWrapper}>
                                <OptimizedImage 
                                  source={instruction.icon}
                                  style={styles.imageWrapper}
                                  imageStyle={styles.instructionImage}
                                  contentFit="contain"
                                  transparent
                                />
                              </View>
                            </View>
                            <Text style={styles.instructionTitle}>
                              {instruction.title.toUpperCase()}
                            </Text>
                            <Text style={styles.instructionText}>
                              {instruction.instruction}
                            </Text>
                          </View>
                        ))}
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
    padding: 16,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.background,
			  
  },
  closeButton: {
    margin: 0,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginRight: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
    paddingBottom: 32,
  },
  instructionCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#6c47ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#6c47ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  firstCard: {
    marginTop: 8,
  },
  lastCard: {
    marginBottom: 8,
  },
  instructionImageContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  imageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  instructionImage: {
    width: '100%',
    height: '100%',
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  }
}); 