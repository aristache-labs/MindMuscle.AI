import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../constants/theme';
import { styles } from '../styles';
import { MuscleGroup, MuscleMarkerProps } from '../types';
import {
  calculateClickableZoneLeft,
  calculateClickableZoneWidth,
  calculateDottedLineLeft,
  calculateDottedLineWidth,
} from '../utils';

export const MuscleMarker = ({ muscle, pulseAnim, onPress }: MuscleMarkerProps) => {
  const isCardio = muscle.name === 'Cardio';
  const markerStyle = isCardio ? muscle.heartPosition : muscle.dotPosition;

  return (
    <TouchableOpacity
      style={[
        styles.muscleMarker,
        isCardio
          ? {
              width: 32,
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: -12,
            }
          : {},
        markerStyle as Record<string, unknown>,
      ]}
      onPress={() => onPress(muscle.name)}
    >
      {isCardio ? (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <MaterialCommunityIcons
            name="heart-pulse"
            size={28}
            color={COLORS.primary}
            style={{ marginTop: -1 }}
          />
        </Animated.View>
      ) : (
        <Animated.View
          style={[
            styles.markerDot,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      )}
    </TouchableOpacity>
  );
};

export const MuscleText = ({
  muscle,
  onPress,
}: {
  muscle: MuscleGroup;
  onPress: (muscleName: string) => void;
}) => (
  <TouchableOpacity
    style={[
      styles.textContainer,
      muscle.textPosition as Record<string, unknown>,
      muscle.textPosition.right ? styles.textRight : styles.textLeft,
    ]}
    onPress={() => onPress(muscle.name)}
  >
    <Text style={styles.markerText}>{muscle.name}</Text>
  </TouchableOpacity>
);

export const ClickableZone = ({
  muscle,
  onPress,
}: {
  muscle: MuscleGroup;
  onPress: (muscleName: string) => void;
}) => (
  <TouchableOpacity
    style={[
      styles.clickableZone,
      {
        position: 'absolute',
        width: `${calculateClickableZoneWidth(muscle)}%`,
        height: '10%',
        left: `${calculateClickableZoneLeft(muscle)}%`,
        top: `${parseFloat(muscle.dotPosition.top) - 5}%`,
        zIndex: 5,
      } as Record<string, unknown>,
    ]}
    onPress={() => onPress(muscle.name)}
  />
);

export const DottedLine = ({ muscle }: { muscle: MuscleGroup }) => (
  <View
    style={[
      styles.dottedLine,
      {
        width: `${calculateDottedLineWidth(muscle)}%`,
        left: `${calculateDottedLineLeft(muscle)}%`,
        top: `${parseFloat(muscle.dotPosition.top) + 0.5}%`,
      } as Record<string, unknown>,
    ]}
  />
);

export const MuscleGroupRender = ({
  muscle,
  pulseAnim,
  onPress,
}: {
  muscle: MuscleGroup;
  pulseAnim: Animated.Value;
  onPress: (muscleName: string) => void;
}) => (
  <React.Fragment key={muscle.id}>
    <ClickableZone muscle={muscle} onPress={onPress} />
    <MuscleMarker muscle={muscle} pulseAnim={pulseAnim} onPress={onPress} />
    <MuscleText muscle={muscle} onPress={onPress} />
    <DottedLine muscle={muscle} />
  </React.Fragment>
);
