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
  ImageSourcePropType
} from 'react-native';
import { Text, IconButton, Portal, Provider } from 'react-native-paper';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { MeasurementCategory } from '../services/measurements';
import OptimizedImage from './OptimizedImage';
import { STATIC_IMAGES } from '../utils/imagePreloader';

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
}

export default function HowToMeasureModal({ visible, onClose }: Props) {
  if (!visible) return null;

  return (
    <Provider>
      <Portal>
        <Modal
          visible={visible}
          transparent={true}
          animationType="slide"
          onRequestClose={onClose}
          statusBarTranslucent={true}
        >
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={styles.overlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={styles.modalContainer}>
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
    height: '80%',
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  gestureRoot: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#1E1E1E',
    zIndex: 1,
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
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
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
    backgroundColor: '#2A2A2A',
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