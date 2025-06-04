import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  TextInput,
  Button,
  Card,
  Text,
  ActivityIndicator,
  Chip,
  Portal,
  Modal,
  TextInput as PaperTextInput,
} from 'react-native-paper';
import { useCoaching } from '../store/CoachingContext';
import { format } from 'date-fns';
import { Rating } from 'react-native-ratings';
import { CoachingSession } from '@services/aiCoaching';
import { simpleErrorHandler } from '../services/sentry/simpleErrorHandler';

const CoachingInterface: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [selectedType, setSelectedType] = useState<'workout' | 'nutrition' | 'mindset'>('workout');
  const [selectedSession, setSelectedSession] = useState<CoachingSession | null>(null);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState(3);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const {
    getCoachingResponse,
    sessions,
    isLoading,
    error,
    saveFeedback,
    updateUserProfile,
    context,
  } = useCoaching();

  // Track component mount
  React.useEffect(() => {
    simpleErrorHandler.addBreadcrumb('CoachingInterface component mounted', 'lifecycle', {
      sessionsCount: sessions.length,
      selectedType,
    });

    return () => {
      simpleErrorHandler.addBreadcrumb('CoachingInterface component unmounted', 'lifecycle');
    };
  }, []);

  // Track coaching type changes
  React.useEffect(() => {
    simpleErrorHandler.addBreadcrumb('Coaching type changed', 'user_interaction', {
      newType: selectedType,
      sessionsCount: sessions.length,
    });
  }, [selectedType]);

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      simpleErrorHandler.addBreadcrumb('User attempted to submit empty coaching prompt', 'warning');
      return;
    }

    try {
      simpleErrorHandler.addBreadcrumb('User submitted coaching prompt', 'user_interaction', {
        promptLength: prompt.length,
        type: selectedType,
        hasContext: !!context,
      });

      await getCoachingResponse(prompt, selectedType);

      simpleErrorHandler.addBreadcrumb('Successfully received coaching response', 'data', {
        type: selectedType,
        promptLength: prompt.length,
      });

      setPrompt('');
    } catch (err) {
      simpleErrorHandler.captureException(err as Error, {
        component: 'CoachingInterface',
        category: 'api_error',
      });
      console.error('Error getting coaching response:', err);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (selectedSession) {
      try {
        simpleErrorHandler.addBreadcrumb('User submitted coaching feedback', 'user_interaction', {
          sessionId: selectedSession.id,
          rating,
          hasFeedbackText: !!feedbackText.trim(),
          feedbackLength: feedbackText.length,
        });

        await saveFeedback(selectedSession.id, feedbackText, rating);

        simpleErrorHandler.addBreadcrumb('Successfully saved coaching feedback', 'data', {
          sessionId: selectedSession.id,
          rating,
        });

        setFeedbackModalVisible(false);
        setFeedbackText('');
        setRating(3);
      } catch (err) {
        simpleErrorHandler.captureException(err as Error, {
          component: 'CoachingInterface',
          category: 'database_error',
        });
        console.error('Error saving feedback:', err);
      }
    } else {
      simpleErrorHandler.addBreadcrumb(
        'User attempted to submit feedback without selected session',
        'warning',
      );
    }
  };

  const handleProfileUpdate = async () => {
    try {
      simpleErrorHandler.addBreadcrumb('User updated coaching profile', 'user_interaction', {
        hasAge: !!context.userProfile.age,
        hasWeight: !!context.userProfile.weight,
        hasHeight: !!context.userProfile.height,
        hasGender: !!context.userProfile.gender,
        hasMedicalConditions: !!context.userProfile.medicalConditions,
      });

      await updateUserProfile({
        age: Number(context.userProfile.age),
        weight: Number(context.userProfile.weight),
        height: Number(context.userProfile.height),
        gender: context.userProfile.gender,
        medicalConditions: context.userProfile.medicalConditions,
      });

      simpleErrorHandler.addBreadcrumb('Successfully updated coaching profile', 'data');

      setProfileModalVisible(false);
    } catch (err) {
      simpleErrorHandler.captureException(err as Error, {
        component: 'CoachingInterface',
        category: 'database_error',
      });
      console.error('Error updating profile:', err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button
          icon="account"
          mode="outlined"
          onPress={() => setProfileModalVisible(true)}
          style={styles.profileButton}
        >
          Profile
        </Button>
      </View>

      <View style={styles.typeSelector}>
        <Chip
          selected={selectedType === 'workout'}
          onPress={() => {
            simpleErrorHandler.addBreadcrumb(
              'User selected workout coaching type',
              'user_interaction',
            );
            setSelectedType('workout');
          }}
          style={styles.chip}
        >
          Workout
        </Chip>
        <Chip
          selected={selectedType === 'nutrition'}
          onPress={() => {
            simpleErrorHandler.addBreadcrumb(
              'User selected nutrition coaching type',
              'user_interaction',
            );
            setSelectedType('nutrition');
          }}
          style={styles.chip}
        >
          Nutrition
        </Chip>
        <Chip
          selected={selectedType === 'mindset'}
          onPress={() => {
            simpleErrorHandler.addBreadcrumb(
              'User selected mindset coaching type',
              'user_interaction',
            );
            setSelectedType('mindset');
          }}
          style={styles.chip}
        >
          Mindset
        </Chip>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          label="Ask your AI coach"
          value={prompt}
          onChangeText={setPrompt}
          multiline
          style={styles.input}
        />
        <Button
          mode="contained"
          onPress={handleSubmit}
          disabled={isLoading || !prompt.trim()}
          style={styles.button}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : 'Get Advice'}
        </Button>
      </View>

      {error && (
        <Card style={styles.errorCard}>
          <Card.Content>
            <Text style={styles.errorText}>{error}</Text>
          </Card.Content>
        </Card>
      )}

      <ScrollView style={styles.historyContainer}>
        {sessions.map((session) => (
          <Card key={session.id} style={styles.sessionCard}>
            <Card.Content>
              <Text style={styles.sessionType}>{session.type.toUpperCase()}</Text>
              <Text style={styles.sessionDate}>
                {format(new Date(session.timestamp), 'MMM d, yyyy h:mm a')}
              </Text>
              <Text style={styles.promptText}>Q: {session.prompt}</Text>
              <Text style={styles.responseText}>A: {session.response}</Text>
              {session.rating && (
                <View style={styles.ratingContainer}>
                  <Rating
                    readonly
                    startingValue={session.rating}
                    imageSize={20}
                    style={styles.rating}
                  />
                </View>
              )}
              {!session.feedback && (
                <Button
                  mode="text"
                  onPress={() => {
                    simpleErrorHandler.addBreadcrumb(
                      'User opened feedback modal',
                      'user_interaction',
                      {
                        sessionId: session.id,
                        sessionType: session.type,
                      },
                    );
                    setSelectedSession(session);
                    setFeedbackModalVisible(true);
                  }}
                >
                  Provide Feedback
                </Button>
              )}
            </Card.Content>
          </Card>
        ))}
      </ScrollView>

      <Portal>
        <Modal
          visible={feedbackModalVisible}
          onDismiss={() => {
            simpleErrorHandler.addBreadcrumb('User closed feedback modal', 'user_interaction', {
              sessionId: selectedSession?.id,
              hadFeedbackText: !!feedbackText.trim(),
            });
            setFeedbackModalVisible(false);
          }}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Provide Feedback</Text>
          <Rating
            showRating
            onFinishRating={setRating}
            startingValue={rating}
            style={styles.rating}
          />
          <TextInput
            label="Your feedback"
            value={feedbackText}
            onChangeText={setFeedbackText}
            multiline
            style={styles.feedbackInput}
          />
          <Button mode="contained" onPress={handleFeedbackSubmit}>
            Submit Feedback
          </Button>
        </Modal>

        <Modal
          visible={profileModalVisible}
          onDismiss={() => {
            simpleErrorHandler.addBreadcrumb('User closed profile modal', 'user_interaction');
            setProfileModalVisible(false);
          }}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Update Profile</Text>
          <PaperTextInput
            label="Age"
            value={context.userProfile.age.toString()}
            onChangeText={(text) => updateUserProfile({ age: Number(text) })}
            keyboardType="numeric"
            style={styles.input}
          />
          <PaperTextInput
            label="Weight (kg)"
            value={context.userProfile.weight.toString()}
            onChangeText={(text) => updateUserProfile({ weight: Number(text) })}
            keyboardType="numeric"
            style={styles.input}
          />
          <PaperTextInput
            label="Height (cm)"
            value={context.userProfile.height.toString()}
            onChangeText={(text) => updateUserProfile({ height: Number(text) })}
            keyboardType="numeric"
            style={styles.input}
          />
          <Button mode="contained" onPress={handleProfileUpdate}>
            Save Profile
          </Button>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  profileButton: {
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  chip: {
    marginHorizontal: 4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 8,
  },
  button: {
    marginTop: 8,
  },
  errorCard: {
    marginBottom: 16,
    backgroundColor: '#ffebee',
  },
  errorText: {
    color: '#c62828',
  },
  historyContainer: {
    flex: 1,
  },
  sessionCard: {
    marginBottom: 8,
  },
  sessionType: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  promptText: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  responseText: {
    color: '#333',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  rating: {
    marginVertical: 8,
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  feedbackInput: {
    marginVertical: 16,
  },
});

export default CoachingInterface;
