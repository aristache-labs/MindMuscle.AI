import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Image, Dimensions, TouchableOpacity, Pressable } from 'react-native';
import { Text, Card, Button, IconButton, useTheme, Chip } from 'react-native-paper';
import { useAuth } from '../store/AuthContext';
import { COLORS, SPACING, BORDER_RADIUS, HEADER_HEIGHT } from '../constants/theme';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MenuHeader } from '../components/MenuHeader';

// Import content components
import MyPlanScreen from '../(stack)/my-plan';
import SingleWorkoutScreen from '../(stack)/single-workout';
import AiCoachingScreen from '../(stack)/ai-coaching';
import CustomScreen from '../(stack)/custom';

const { width } = Dimensions.get('window');



export default function HomeScreen() {
  const { user, isLoading, signOut } = useAuth();
  const [selectedOption, setSelectedOption] = useState('My Plan');
  const params = useLocalSearchParams();
  const theme = useTheme();
  
  // Set My Plan as default option, especially when navigating back from plan details
  useEffect(() => {
    setSelectedOption('My Plan');
  }, []);
  
  const fullName = React.useMemo(() => {
    if (isLoading) return '...';
    return user?.user_metadata?.name  || 'User';
  }, [user, isLoading]);

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Function to render the appropriate content based on the selected option
  const renderContent = () => {
    switch(selectedOption) {
      case 'My Plan':
        return <MyPlanScreen embedded={true} />;
      case 'Single Workout':
        return <SingleWorkoutScreen embedded={true} />;
      case 'AI Coaching':
        return <AiCoachingScreen embedded={true} />;
      case 'Custom':
        return <CustomScreen embedded={true} />;
      default:
        return renderHomeContent();
    }
  };

  // Home content component
  const renderHomeContent = () => (
    <ScrollView 
      style={styles.scrollView} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollViewContent, { paddingTop: HEADER_HEIGHT }]}
    >
      <View style={styles.headerSpacer} />
      
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Welcome to MindMuscle.AI</Text>
        <Text style={styles.infoText}>
          Select an option from the dropdown menu above to get started with your fitness journey.
        </Text>
        <View style={styles.optionsHint}>
          <View style={styles.optionItem}>
            <MaterialCommunityIcons name="calendar-today" size={24} color={COLORS.primary} />
            <Text style={styles.optionText}>My Plan</Text>
          </View>
          <View style={styles.optionItem}>
            <MaterialCommunityIcons name="dumbbell" size={24} color={COLORS.primary} />
            <Text style={styles.optionText}>Single Workout</Text>
          </View>
          <View style={styles.optionItem}>
            <MaterialCommunityIcons name="robot" size={24} color={COLORS.primary} />
            <Text style={styles.optionText}>AI Coaching</Text>
          </View>
          <View style={styles.optionItem}>
            <MaterialCommunityIcons name="tune" size={24} color={COLORS.primary} />
            <Text style={styles.optionText}>Custom</Text>
          </View>
        </View>
        <Button
          mode="contained"
          style={styles.startButton}
          labelStyle={styles.startButtonLabel}
          onPress={() => setSelectedOption('My Plan')}>
          START MY PLAN
        </Button>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <MenuHeader 
        currentOption={selectedOption} 
        onOptionSelect={(option) => setSelectedOption(option)} 
      />
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerSpacer: {
    height: 30, 
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  welcomeSection: {
    paddingVertical: 24,
  },
  welcomeText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    marginVertical: 16,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 16,
    color: COLORS.secondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  optionsHint: {
    marginBottom: 24,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionText: {
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  startButton: {

    borderRadius: 1,
    paddingVertical: 12,
  },
  startButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 