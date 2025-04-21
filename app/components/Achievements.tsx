import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Modal } from 'react-native';
import { Text, useTheme, IconButton, Button, Surface } from 'react-native-paper';
import { Stack, router } from 'expo-router';
import { COLORS } from '../constants/theme';
import { format } from 'date-fns';
import { achievementService, Achievement, UserAchievement } from '../services/achievements';
import { useAuth } from '../store/AuthContext';
import InitialLoadingScreen from './InitialLoadingScreen';

export default function Achievements() {
  const theme = useTheme();
  const { user } = useAuth();
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAchievements();
  }, [user]);

  const loadAchievements = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const userAchievements = await achievementService.getUserAchievements(user.id);
      setAchievements(userAchievements);
    } catch (error) {
      console.error('Error loading achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAchievementPress = (achievement: UserAchievement) => {
    setSelectedAchievement(achievement.achievement || null);
  };

  const renderProgress = (userAchievement: UserAchievement) => {
    if (!userAchievement.achievement?.total_progress) return null;
    return (
      <Text style={styles.progressText}>
        {userAchievement.current_progress}/{userAchievement.achievement.total_progress}
      </Text>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <InitialLoadingScreen showProgress={false} message="Loading achievements..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'ACHIEVEMENTS',
          headerStyle: {
            backgroundColor: COLORS.background,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          headerLeft: () => (
            <IconButton
              icon="arrow-left"
              iconColor="#fff"
              size={24}
              onPress={() => router.back()}
            />
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.achievementsGrid}>
          {achievements.map((userAchievement) => (
            <Pressable
              key={userAchievement.id}
              style={styles.achievementCard}
              onPress={() => handleAchievementPress(userAchievement)}
            >
              <Surface style={[
                styles.achievementSurface,
                !userAchievement.is_completed && styles.achievementLocked
              ]} elevation={2}>
                <View style={styles.achievementOverflow}>
                  <View style={styles.achievementContent}>
                    <View style={[
                      styles.achievementIconContainer,
                      !userAchievement.is_completed && styles.achievementIconLocked
                    ]}>
                      <IconButton
                        icon={userAchievement.achievement?.icon || 'trophy'}
                        size={28}
                        iconColor={userAchievement.is_completed ? "#f9e009" : "#666"}
                      />
                    </View>
                    <Text style={[
                      styles.achievementTitle,
                      !userAchievement.is_completed && styles.achievementTextLocked
                    ]}>
                      {userAchievement.achievement?.title}
                    </Text>
                    <Text style={[
                      styles.achievementSubtitle,
                      !userAchievement.is_completed && styles.achievementTextLocked
                    ]}>
                      {userAchievement.achievement?.subtitle}
                    </Text>
                    {renderProgress(userAchievement)}
                  </View>
                </View>
              </Surface>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Achievement Modal */}
      <Modal
        visible={!!selectedAchievement}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedAchievement(null)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setSelectedAchievement(null)}
        >
          <View style={styles.modalContainer}>
            <Pressable style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <IconButton
                  icon="close"
                  iconColor="#fff"
                  size={24}
                  style={styles.closeButton}
                  onPress={() => setSelectedAchievement(null)}
                />
              </View>
              
              {selectedAchievement && (
                <View style={styles.achievementDetail}>
                  <View style={[
                    styles.achievementIconLarge,
                    { backgroundColor: selectedAchievement.icon_background_color }
                  ]}>
                    <IconButton
                      icon={selectedAchievement.icon}
                      size={40}
                      iconColor="#000"
                    />
                  </View>
                  <Text style={styles.achievementDetailTitle}>{selectedAchievement.title}</Text>
                  <Text style={styles.achievementDescription}>{selectedAchievement.description}</Text>
                  {selectedAchievement.total_progress && (
                    <Text style={styles.achievementProgress}>
                      Progress: {achievements.find(a => a.achievement?.id === selectedAchievement.id)?.current_progress || 0}/{selectedAchievement.total_progress}
                    </Text>
                  )}
                  {achievements.find(a => a.achievement?.id === selectedAchievement.id)?.completed_at && (
                    <Text style={styles.achievementDate}>
                      Completed on {format(new Date(achievements.find(a => a.achievement?.id === selectedAchievement.id)?.completed_at!), 'MMM dd, yyyy')}
                    </Text>
                  )}
                  {achievements.find(a => a.achievement?.id === selectedAchievement.id)?.is_completed && (
                    <Button
                      mode="contained"
                      style={styles.shareButton}
                      labelStyle={styles.shareButtonLabel}
                      onPress={() => {}}
                    >
                      Share
                    </Button>
                  )}
                </View>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 12,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementCard: {
    width: '31%',
    aspectRatio: 0.85,
    marginBottom: 4,
  },
  achievementSurface: {
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
  },
  achievementOverflow: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 12,
  },
  achievementContent: {
    flex: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(249, 224, 9, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  achievementTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 2,
  },
  achievementSubtitle: {
    fontSize: 10,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginTop: 2,
    justifyContent: 'center',
  },
  starIcon: {
    margin: -10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 340,
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalHeader: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    marginTop: -12,
    marginRight: -12,
  },
  closeButton: {
    margin: 0,
  },
  achievementDetail: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  achievementIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f9e009',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  achievementDetailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  achievementDescription: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 16,
  },
  shareButton: {
    backgroundColor: '#FFE600',
    borderRadius: 25,
    paddingHorizontal: 48,
    marginTop: 16,
  },
  shareButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  achievementLocked: {
    backgroundColor: '#1A1A1A',
    opacity: 0.8,
  },
  achievementIconLocked: {
    backgroundColor: 'rgba(102, 102, 102, 0.2)',
  },
  achievementTextLocked: {
    color: '#666',
  },
  progressText: {
    fontSize: 10,
    color: '#f9e009',
    marginTop: 4,
  },
  achievementProgress: {
    fontSize: 14,
    color: '#f9e009',
    marginBottom: 8,
  },
  achievementDate: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.5,
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 