import React, { useRef, useEffect } from 'react';
import { Animated } from 'react-native';
import { Icon } from 'react-native-paper';
import { COLORS } from '../../../constants/theme';
import { styles } from '../styles';

const PulsingIconContainer: React.FC = () => {
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.noPlanIconContainer,
        {
          transform: [{ scale: pulseAnimation }],
        },
      ]}
    >
      <Icon source="weight-lifter" size={90} color={COLORS.primary} />
    </Animated.View>
  );
};

export default PulsingIconContainer;
