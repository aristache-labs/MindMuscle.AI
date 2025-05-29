import React from 'react';
import { View, Text } from 'react-native';
import { Button, Icon } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../constants/theme';
import { PulsingIconContainer } from './';
import { styles } from '../styles';

const NoPlanView: React.FC = () => {
  const router = useRouter();

  return (
    <View style={styles.noPlanContainer}>
      <View style={styles.noPlanCardWrapper}>
        <LinearGradient
          colors={['rgba(31, 31, 48, 0.9)', 'rgba(18, 20, 24, 0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.noPlanCard}
        >
          <PulsingIconContainer />

          <Text style={styles.noPlanTitle}>Ready to Begin?</Text>

          <View style={styles.noPlanDivider} />

          <Text style={styles.noPlanText}>
            Your fitness journey awaits! Choose a workout plan tailored to your goals and transform
            your body.
          </Text>

          <View style={styles.noPlanInfoBox}>
            <View style={styles.infoIconContainer}>
              <Icon source="information-outline" size={24} color={COLORS.text} />
            </View>
            <Text style={styles.noPlanInfoText}>
              Browse our expertly designed workout plans in the{' '}
              <Text style={styles.highlightText}>Discover</Text> section to get started.
            </Text>
          </View>

          <Button
            mode="contained"
            style={styles.browseButton}
            labelStyle={styles.browseButtonText}
            icon="compass"
            onPress={() => router.push('/discover')}
          >
            FIND YOUR PLAN
          </Button>
        </LinearGradient>
      </View>
    </View>
  );
};

export default NoPlanView;
