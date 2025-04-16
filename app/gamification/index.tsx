import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, ProgressBar, useTheme, ActivityIndicator, IconButton } from 'react-native-paper';
import { useGamification } from '../store/GamificationContext';
import { format } from 'date-fns';

export default function GamificationScreen() {
  const theme = useTheme();
  const { stats, loading } = useGamification();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const progressPercentage = (stats.xp / stats.nextLevelXp) * 100;

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.levelCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.levelTitle}>
            Level {stats.level}
          </Text>
          <View style={styles.xpContainer}>
            <Text variant="bodyMedium">
              {stats.xp} / {stats.nextLevelXp} XP
            </Text>
            <Text variant="bodySmall" style={styles.totalXp}>
              Total XP: {stats.totalXp}
            </Text>
          </View>
          <ProgressBar
            progress={progressPercentage / 100}
            color={theme.colors.primary}
            style={styles.progressBar}
          />
        </Card.Content>
      </Card>

      <View style={styles.achievementsContainer}>
        <Text variant="titleLarge" style={styles.sectionTitle}>
          Achievements
        </Text>
        {stats.achievements.map((achievement, index) => (
          <Card key={achievement.id} style={styles.achievementCard}>
            <Card.Content style={styles.achievementContent}>
              <View style={styles.achievementIcon}>
                <IconButton
                  icon={achievement.icon}
                  size={24}
                  iconColor={achievement.completed ? theme.colors.primary : theme.colors.outline}
                />
              </View>
              <View style={styles.achievementInfo}>
                <Text variant="titleMedium">{achievement.title}</Text>
                <Text variant="bodySmall" style={styles.achievementDescription}>
                  {achievement.description}
                </Text>
                <View style={styles.achievementProgress}>
                  <ProgressBar
                    progress={achievement.progress / achievement.target}
                    color={achievement.completed ? theme.colors.primary : theme.colors.outline}
                    style={styles.achievementProgressBar}
                  />
                  <Text variant="bodySmall" style={styles.progressText}>
                    {achievement.progress} / {achievement.target}
                  </Text>
                </View>
                {achievement.completed && achievement.completedAt && (
                  <Text variant="bodySmall" style={styles.completedDate}>
                    Completed on {format(new Date(achievement.completedAt), 'MMM d, yyyy')}
                  </Text>
                )}
              </View>
            </Card.Content>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  levelCard: {
    marginBottom: 16,
  },
  levelTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  xpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalXp: {
    color: '#666',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  achievementsContainer: {
    marginTop: 8,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  achievementCard: {
    marginBottom: 12,
  },
  achievementContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  achievementIcon: {
    marginRight: 16,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementDescription: {
    color: '#666',
    marginTop: 4,
    marginBottom: 8,
  },
  achievementProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  achievementProgressBar: {
    flex: 1,
    height: 4,
    marginRight: 8,
  },
  progressText: {
    minWidth: 60,
    textAlign: 'right',
  },
  completedDate: {
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
}); 