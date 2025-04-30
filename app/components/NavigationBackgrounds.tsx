import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLORS } from '../constants/theme';

export const TabBarBackground = () => (
  <View style={{
    position: 'absolute',
    left: -26,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  }}>
    <Svg width="480" height="120" viewBox="0 0 480 120">
      <Defs>
        <LinearGradient id="borderGradient" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0.9" stopColor={COLORS.primary} />
          <Stop offset="0.1" stopColor={COLORS.primary} />
          <Stop offset="0.5" stopColor={COLORS.primary} />
          <Stop offset="0.9" stopColor={COLORS.primary} />
          <Stop offset="0.9" stopColor={COLORS.primary} />
        </LinearGradient>
      </Defs>
      <Path
        d="M6 0L474 0C477.31 0 480 2.68 480 6L480 94C480 108.35 468.35 120 454 120L26 120C11.64 120 0 108.35 0 94L0 6C0 2.68 2.68 0 6 0Z"
        fill={COLORS.surface}
        stroke="url(#borderGradient)"
        strokeWidth="1"
      />
    </Svg>
  </View>
);

export const CircleBackground = () => (
  <View style={{
    position: 'absolute',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 9,
    borderColor: COLORS.primary,
    borderWidth: 9,
    borderRadius: 60,
    elevation: 9,
  }}>
    <Svg width="72" height="72" viewBox="0 0 72 72">
      <Circle
        cx="36"
        cy="36"
        r="36"
        fill={COLORS.surface}
      />
    </Svg>
  </View>
);

// Add a default export for the main component
const NavigationBackgrounds = { TabBarBackground, CircleBackground };
export default NavigationBackgrounds; 