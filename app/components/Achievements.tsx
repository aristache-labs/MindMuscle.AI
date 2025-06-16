import { format } from 'date-fns';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Divider, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { COLORS } from '../constants/theme';
import { Achievement, achievementService, UserAchievement } from '../services/achievements';
import { simpleErrorHandler } from '../services/sentry/simpleErrorHandler';
import { useAuth } from '../store/AuthContext';
import InitialLoadingScreen from './InitialLoadingScreen';

export default function Achievements() {
  const theme = useTheme();
  const { user } = useAuth();
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFullLoadingScreen, setShowFullLoadingScreen] = useState(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simple function to handle back navigation
  const handleGoBack = () => {
    try {
      simpleErrorHandler.addBreadcrumb('User navigated back from achievements', 'navigation', {
        level: 'info',
      });
      router.push('/(tabs)/insights');
    } catch (error) {
      simpleErrorHandler.captureException(error as Error, {
        component: 'Achievements',
        category: 'navigation_error',
      });
      console.error('Error during back navigation:', error);
      // Try once more after a short delay
      setTimeout(() => {
        try {
          router.push('/(tabs)/insights');
        } catch (secondError) {
          simpleErrorHandler.captureException(secondError as Error, {
            component: 'Achievements',
            category: 'navigation_error',
          });
          console.error('Second attempt failed:', secondError);
        }
      }, 100);
    }
  };

  useEffect(() => {
    // Track component mount
    simpleErrorHandler.addBreadcrumb('Achievements component mounted', 'lifecycle', {
      userId: user?.id,
      hasUser: !!user,
    });

    loadAchievements();

    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }

      simpleErrorHandler.addBreadcrumb('Achievements component unmounted', 'lifecycle');
    };
  }, [user]);

  const loadAchievements = async () => {
    if (!user?.id) {
      simpleErrorHandler.addBreadcrumb('Attempted to load achievements without user ID', 'warning');
      return;
    }

    try {
      setLoading(true);

      simpleErrorHandler.addBreadcrumb('Started loading achievements', 'data', { userId: user.id });

      // Only show the full loading screen if loading takes more than 500ms
      loadingTimerRef.current = setTimeout(() => {
        setShowFullLoadingScreen(true);
        simpleErrorHandler.addBreadcrumb('Showing full loading screen for achievements', 'ui');
      }, 500);

      const userAchievements = await achievementService.getUserAchievements(user.id);

      simpleErrorHandler.addBreadcrumb('Successfully loaded achievements', 'data', {
        userId: user.id,
        achievementCount: userAchievements.length,
        completedCount: userAchievements.filter((a) => a.is_completed).length,
      });

      console.log('🏆 Loaded achievements:', userAchievements.length);
      console.log('🏆 First achievement:', userAchievements[0]);
      setAchievements(userAchievements);
    } catch (error) {
      simpleErrorHandler.captureException(error as Error, {
        component: 'Achievements',
        category: 'database_error',
        userId: user.id,
      });

      console.error('Error loading achievements:', error);
      Alert.alert('Error', 'Failed to load achievements. Please try again.');
    } finally {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setShowFullLoadingScreen(false);
      setLoading(false);
    }
  };

  const handleAchievementPress = (achievement: UserAchievement) => {
    try {
      simpleErrorHandler.addBreadcrumb('User pressed achievement', 'user_interaction', {
        achievementId: achievement.id,
        achievementTitle: achievement.achievement?.title,
        isCompleted: achievement.is_completed,
      });

      setSelectedAchievement(achievement.achievement || null);
    } catch (error) {
      simpleErrorHandler.captureException(error as Error, {
        component: 'Achievements',
        category: 'ui_error',
      });
      console.error('Error handling achievement press:', error);
    }
  };

  const renderProgress = (userAchievement: UserAchievement) => {
    if (!userAchievement.achievement?.total_progress) return null;

    const progress = userAchievement.current_progress || 0;
    const total = userAchievement.achievement.total_progress;

    return (
      <Text style={styles.progressText}>
        {progress}/{total}
      </Text>
    );
  };

  // If we need to show the full loading screen
  if (loading && showFullLoadingScreen) {
    return (
      <View style={styles.loadingContainer}>
        <InitialLoadingScreen showProgress={false} message="Loading achievements..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <IconButton
            icon="arrow-left"
            iconColor="#fff"
            size={24}
            onPress={handleGoBack}
            style={styles.backButton}
          />
        </View>
        <Text style={styles.headerTitle}>ACHIEVEMENTS</Text>
        <View style={styles.headerRight} />
      </View>
      <Divider style={styles.divider} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.simpleLoadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <View style={styles.achievementsGrid}>
            {achievements.map((userAchievement) => (
              <Pressable
                key={userAchievement.id}
                style={styles.achievementCard}
                onPress={() => handleAchievementPress(userAchievement)}
              >
                <View style={styles.achievementOverflow}>
                  <Surface
                    style={[
                      styles.achievementSurface,
                      !userAchievement.is_completed && styles.achievementLocked,
                    ]}
                    elevation={2}
                  >
                    <View style={styles.achievementContent}>
                      <View
                        style={[
                          styles.achievementIconContainer,
                          !userAchievement.is_completed && styles.achievementIconLocked,
                        ]}
                      >
                        <IconButton
                          icon={userAchievement.achievement?.icon || 'trophy'}
                          size={28}
                          iconColor={userAchievement.is_completed ? '#f9e009' : '#666'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.achievementTitle,
                          !userAchievement.is_completed && styles.achievementTextLocked,
                        ]}
                      >
                        {userAchievement.achievement?.title || 'Achievement Title'}
                      </Text>
                      <Text
                        style={[
                          styles.achievementSubtitle,
                          !userAchievement.is_completed && styles.achievementTextLocked,
                        ]}
                      >
                        {userAchievement.achievement?.subtitle || 'Achievement Description'}
                      </Text>
                      {renderProgress(userAchievement)}
                    </View>
                  </Surface>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Achievement Modal */}
      <Modal
        visible={!!selectedAchievement}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          simpleErrorHandler.addBreadcrumb('User closed achievement modal', 'user_interaction', {
            achievementId: selectedAchievement?.id,
            achievementTitle: selectedAchievement?.title,
          });
          setSelectedAchievement(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            simpleErrorHandler.addBreadcrumb(
              'User closed achievement modal via overlay tap',
              'user_interaction',
            );
            setSelectedAchievement(null);
          }}
        >
          <View style={styles.modalContainer}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <IconButton
                  icon="close"
                  iconColor="#fff"
                  size={24}
                  style={styles.closeButton}
                  onPress={() => {
                    simpleErrorHandler.addBreadcrumb(
                      'User closed achievement modal via close button',
                      'user_interaction',
                    );
                    setSelectedAchievement(null);
                  }}
                />
              </View>

              {selectedAchievement && (
                <View style={styles.achievementDetail}>
                  <View
                    style={[
                      styles.achievementIconLarge,
                      { backgroundColor: selectedAchievement.icon_background_color || '#f9e009' },
                    ]}
                  >
                    <IconButton icon={selectedAchievement.icon} size={40} iconColor="#000" />
                  </View>
                  <Text style={styles.achievementDetailTitle}>
                    {selectedAchievement.title || 'Achievement'}
                  </Text>
                  <Text style={styles.achievementDescription}>
                    {selectedAchievement.description || 'Achievement description'}
                  </Text>
                  {selectedAchievement.total_progress && (
                    <Text style={styles.achievementProgress}>
                      Progress:{' '}
                      {achievements.find((a) => a.achievement?.id === selectedAchievement.id)
                        ?.current_progress || 0}
                      /{selectedAchievement.total_progress}
                    </Text>
                  )}
                  {(() => {
                    const foundAchievement = achievements.find(
                      (a) => a.achievement?.id === selectedAchievement.id,
                    );
                    return (
                      foundAchievement?.completed_at && (
                        <Text style={styles.achievementDate}>
                          Completed on{' '}
                          {(() => {
                            try {
                              return format(
                                new Date(foundAchievement.completed_at),
                                'MMM dd, yyyy',
                              );
                            } catch (error) {
                              simpleErrorHandler.captureException(error as Error, {
                                component: 'Achievements',
                                category: 'ui_error',
                              });
                              console.error('Date formatting error:', error);
                              return 'Recently';
                            }
                          })()}
                        </Text>
                      )
                    );
                  })()}
                  {(() => {
                    const foundAchievement = achievements.find(
                      (a) => a.achievement?.id === selectedAchievement.id,
                    );
                    return (
                      foundAchievement?.is_completed && (
                        <Button
                          mode="contained"
                          style={styles.shareButton}
                          labelStyle={styles.shareButtonLabel}
                          onPress={() => {
                            simpleErrorHandler.addBreadcrumb(
                              'User pressed share achievement button',
                              'user_interaction',
                              {
                                achievementId: selectedAchievement.id,
                                achievementTitle: selectedAchievement.title,
                              },
                            );
                            // TODO: Implement share functionality
                          }}
                        >
                          Share
                        </Button>
                      )
                    );
                  })()}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: COLORS.background,
  },
  headerLeft: {
    width: 60,
    alignItems: 'flex-start',
  },
  headerRight: {
    width: 60,
  },
  backButton: {
    margin: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  divider: {
    backgroundColor: COLORS.primary,
    height: 0.2,
  },
  scrollContent: {
    padding: 12,
    paddingTop: 16,
    paddingBottom: 40,
    flexGrow: 1,
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
    backgroundColor: COLORS.surface,
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
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#6B4EFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
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
  simpleLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
});
