import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from 'react-native-paper';
import { format } from 'date-fns';
import { styles } from '../styles';

interface RestDayComponentProps {
  selectedDate: Date;
}

const RestDayComponent: React.FC<RestDayComponentProps> = ({ selectedDate }) => {
  // Array of rest day messages
  const restDayVariations = [
    {
      icon: 'walk',
      title: 'ACTIVE RECOVERY',
      message:
        'Perfect day for light movement! Consider a gentle bike ride, leisurely walk, or some dynamic stretching to keep your body active while recovering.',
      color: '#4CAF50',
    },
    {
      icon: 'meditation',
      title: 'REST & RESTORE',
      message:
        'Your muscles are rebuilding stronger today. Take time for peaceful meditation, gentle yoga, or mindful breathing to support your recovery process.',
      color: '#9C27B0',
    },
    {
      icon: 'sleep',
      title: 'RECOVERY DAY',
      message:
        'Rest is when the magic happens! Allow your body to repair and adapt. Focus on quality sleep and gentle stretching to optimize recovery.',
      color: '#2196F3',
    },
    {
      icon: 'spa',
      title: 'WELLNESS FOCUS',
      message:
        'Treat yourself to some self-care today! Consider a relaxing bath, foam rolling session, or gentle massage to help your muscles recover.',
      color: '#FF9800',
    },
    {
      icon: 'nature',
      title: 'MINDFUL MOVEMENT',
      message:
        'Connect with nature and move mindfully. A peaceful outdoor walk, light gardening, or gentle stretching in fresh air can boost recovery.',
      color: '#4CAF50',
    },
  ];

  // Generate a consistent random index based on the selected date
  const dateString = format(selectedDate, 'yyyy-MM-dd');

  // Use the dateString to create a deterministic index
  let dateSum = 0;
  for (let i = 0; i < dateString.length; i++) {
    dateSum += dateString.charCodeAt(i);
  }

  // Use modulo to get an index within the array bounds
  const determinedIndex = dateSum % restDayVariations.length;
  const currentVariation = restDayVariations[determinedIndex];

  return (
    <View style={styles.restDayContainer}>
      <Text style={styles.restDayTitle}>{currentVariation.title}</Text>

      <View style={styles.restDayIconContainer}>
        <Icon source={currentVariation.icon} size={60} color={currentVariation.color} />
      </View>

      <Text style={styles.restDayMessage}>{currentVariation.message}</Text>

      <View style={styles.restDayTips}>
        <Text style={styles.restDayTipsTitle}>Recovery Activities:</Text>
        <Text style={styles.restDayTip}>• 10-20 minute gentle walk or nature stroll</Text>
        <Text style={styles.restDayTip}>• Light stretching, yoga, or mobility work</Text>
        <Text style={styles.restDayTip}>• Foam rolling or self-massage therapy</Text>
        <Text style={styles.restDayTip}>• Meditation, breathing exercises, or mindfulness</Text>
        <Text style={styles.restDayTip}>• Relaxing bath or spa-like self-care</Text>
        <Text style={styles.restDayTip}>• Quality sleep and proper hydration</Text>
      </View>
    </View>
  );
};

export default RestDayComponent;
