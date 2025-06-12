import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import { COLORS } from '../../../constants/theme';
import { styles } from '../styles';
import { LockedWeekInfo } from '../types';

interface LockedWeekComponentProps {
  lockedWeekInfo: LockedWeekInfo | null;
  onBackToCurrentWeek: () => void;
}

const LockedWeekComponent: React.FC<LockedWeekComponentProps> = ({
  lockedWeekInfo,
  onBackToCurrentWeek,
}) => {
  if (!lockedWeekInfo) return null;

  return (
    <View style={styles.lockedWeekContainer}>
      <View style={styles.lockedWeekHeader}>
        <View style={styles.lockedIconContainer}>
          <Icon source="lock" size={40} color={COLORS.primary} />
        </View>
        <Text style={styles.lockedWeekTitle}>Week {lockedWeekInfo.selectedWeek} Locked</Text>
        <Text style={styles.lockedWeekSubtitle}>{lockedWeekInfo.selectedWeekName} Phase</Text>
      </View>

      <View style={styles.lockedWeekContent}>
        <Text style={styles.lockedWeekMessage}>
          Complete Week {lockedWeekInfo.currentWeek} - {lockedWeekInfo.currentWeekName} before
          accessing this week's workouts.
        </Text>

        <View style={styles.lockedWeekProgress}>
          <Text style={styles.lockedProgressTitle}>Current Progress</Text>
          <View style={styles.lockedProgressInfo}>
            <View style={styles.currentWeekBadge}>
              <Text style={styles.currentWeekBadgeText}>W{lockedWeekInfo.currentWeek}</Text>
            </View>
            <Text style={styles.lockedProgressText}>{lockedWeekInfo.currentWeekName} Phase</Text>
          </View>
        </View>

        <View style={styles.lockedWeekTips}>
          <Text style={styles.lockedTipsTitle}>To unlock Week {lockedWeekInfo.selectedWeek}:</Text>
          <Text style={styles.lockedTip}>
            • Complete all workouts in Week {lockedWeekInfo.currentWeek}
          </Text>
          <Text style={styles.lockedTip}>• Follow the progressive training plan</Text>
          <Text style={styles.lockedTip}>• Maintain consistency with your schedule</Text>
        </View>

        <TouchableOpacity style={styles.backToCurrentWeekButton} onPress={onBackToCurrentWeek}>
          <Icon source="arrow-left" size={20} color={COLORS.text} />
          <Text style={styles.backToCurrentWeekText}>Back to Current Workout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default LockedWeekComponent;
