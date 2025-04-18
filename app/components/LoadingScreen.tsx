import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const LoadingScreen = () => {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons 
        name="dumbbell" 
        size={64} 
        color="white" 
      />
      <View style={styles.spinnerContainer}>
        <ActivityIndicator size="small" color="white" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6c47ff', // Purple color matching the screenshot
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerContainer: {
    position: 'absolute',
    bottom: 40,
  },
});

export default LoadingScreen; 