import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Surface, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { Achievement, UserAchievement } from '../../services/achievements';
import { COLORS } from '../../constants/theme';

interface AchievementsSectionProps {
  achievementsLoading: boolean;
  completedAchievements: UserAchievement[];
  randomAchievements: Achievement[];
  onAchievementPress: (achievement: UserAchievement) => void;
  onRandomAchievementPress: (achievement: Achievement) => void;
}

export const AchievementsSection: React.FC<AchievementsSectionProps> = ({
  achievementsLoading,
  completedAchievements,
  randomAchievements,
  onAchievementPress,
  onRandomAchievementPress,
}) => {
  return (
    <Surface style={styles.achievementsContainer} elevation={2}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerSide} />
        <View style={styles.titleContainer}>
          <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
        </View>
        <View style={styles.headerSide}>
          <Button
            mode="text"
            textColor="#6B4EFF"
            style={styles.moreButton}
            labelStyle={styles.moreButtonLabel}
            onPress={() => router.push('/achievements')}
          >
            More
          </Button>
        </View>
      </View>
      <View style={styles.achievementsGrid}>
        {achievementsLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : completedAchievements.length > 0 || randomAchievements.length > 0 ? (
          <>
            {completedAchievements.map((userAchievement) => (
              <Pressable
                key={userAchievement.id}
                style={styles.achievementCard}
                onPress={() => onAchievementPress(userAchievement)}
              >
                <View style={styles.achievementContent}>
                  <View style={styles.achievementIconContainer}>
                    <IconButton
                      icon={userAchievement.achievement?.icon || 'trophy'}
                      size={24}
                      iconColor="#f9e009"
                    />
                  </View>
                  <Text style={styles.achievementLabel}>{userAchievement.achievement?.title}</Text>
                  {userAchievement.completed_at && (
                    <Text style={styles.achievementDate}>
                      {format(new Date(userAchievement.completed_at), 'MMM dd, yyyy')}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
            {randomAchievements.map((achievement) => (
              <Pressable
                key={achievement.id}
                style={[styles.achievementCard, styles.achievementLocked]}
                onPress={() => onRandomAchievementPress(achievement)}
              >
                <View style={styles.achievementContent}>
                  <View style={[styles.achievementIconContainer, styles.achievementIconLocked]}>
                    <IconButton icon={achievement.icon || 'trophy'} size={24} iconColor="#666" />
                  </View>
                  <Text style={[styles.achievementLabel, styles.achievementTextLocked]}>
                    {achievement.title}
                  </Text>
                  <Text style={[styles.achievementDate, styles.achievementTextLocked]}>
                    Not completed yet
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : (
          <Text style={styles.noAchievementsText}>No achievements completed yet</Text>
        )}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  achievementsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerSide: {
    flex: 1,
  },
  titleContainer: {
    flex: 2,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  moreButton: {
    margin: 0,
    padding: 0,
  },
  moreButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  achievementCard: {
    width: '30%',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  achievementLocked: {
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  achievementContent: {
    alignItems: 'center',
  },
  achievementIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(249, 224, 9, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  achievementIconLocked: {
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  achievementLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementTextLocked: {
    color: '#666',
  },
  achievementDate: {
    fontSize: 8,
    color: COLORS.text,
    opacity: 0.7,
    textAlign: 'center',
  },
  noAchievementsText: {
    fontSize: 14,
    color: COLORS.text,
    opacity: 0.7,
    textAlign: 'center',
    width: '100%',
    paddingVertical: 20,
  },
});
export default function AchievementsSectionProps() {
  return null;
}
