import { MD3DarkTheme, MD3LightTheme, Provider as PaperProvider } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import React from 'react';

export const COLORS = {
  primary: '#8B6DFF',
  secondary: '#1A1B1E',
  background: '#181A20',
  surface: '#262A34',
  surfaceLight: '#363A47',
  error: '#FF4B4B',
  text: '#FFFFFF',
  onSurface: '#FFFFFF',
  disabled: '#6E6E6E',
  placeholder: '#9E9E9E',
  backdrop: 'rgba(0, 0, 0, 0.5)',
  notification: '#FF4B4B',
  success: '#4CAF50',
  warning: '#FFC107',
  info: '#2196F3',
  gradientStart: '#8B6DFF',
  gradientEnd: '#7048E8',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 999,
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    background: COLORS.background,
    surface: COLORS.surface,
    error: COLORS.error,
    text: COLORS.text,
    onSurface: COLORS.onSurface,
    disabled: COLORS.disabled,
    placeholder: COLORS.placeholder,
    backdrop: COLORS.backdrop,
    notification: COLORS.notification,
  },
};

const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    background: '#FFFFFF',
    surface: '#F5F5F5',
    error: COLORS.error,
    text: '#000000',
    onSurface: '#000000',
    disabled: COLORS.disabled,
    placeholder: COLORS.placeholder,
    backdrop: COLORS.backdrop,
    notification: COLORS.notification,
  },
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <PaperProvider theme={theme}>
      {children}
    </PaperProvider>
  );
};

export default {
  COLORS,
  SPACING,
  FONT_SIZES,
  BORDER_RADIUS,
  ThemeProvider,
}; 