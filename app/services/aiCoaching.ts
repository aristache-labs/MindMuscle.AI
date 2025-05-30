import AsyncStorage from '@react-native-async-storage/async-storage';
import OpenAI from 'openai';
import { getAuth } from '@services/auth';

export interface CoachingSession {
  id: string;
  userId: string;
  timestamp: Date;
  type: 'workout' | 'nutrition' | 'mindset';
  prompt: string;
  response: string;
  feedback?: string;
  rating?: number;
}

export interface CoachingContext {
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  preferences: string[];
  recentWorkouts: string[];
  userProfile: {
    age: number;
    gender: string;
    weight: number;
    height: number;
    medicalConditions?: string[];
  };
}

class AICoachingService {
  private static instance: AICoachingService;
  private coachingHistory: CoachingSession[] = [];
  private openai: OpenAI;
  private systemPrompt: string;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    });

    this.systemPrompt = `You are an expert fitness and wellness coach. Your responses should be:
    - Personalized based on the user's context
    - Actionable and specific
    - Evidence-based
    - Encouraging and supportive
    - Concise but informative
    - Focused on the user's goals and preferences
    
    User context:
    - Fitness level: {fitnessLevel}
    - Goals: {goals}
    - Preferences: {preferences}
    - Recent workouts: {recentWorkouts}
    - Age: {age}
    - Gender: {gender}
    - Weight: {weight} kg
    - Height: {height} cm
    - Medical conditions: {medicalConditions}`;
  }

  public static getInstance(): AICoachingService {
    if (!AICoachingService.instance) {
      AICoachingService.instance = new AICoachingService();
    }
    return AICoachingService.instance;
  }

  public async getCoachingResponse(
    prompt: string,
    context: CoachingContext,
    type: CoachingSession['type'],
  ): Promise<string> {
    try {
      const auth = await getAuth();
      if (!auth?.user) {
        throw new Error('User not authenticated');
      }

      const formattedPrompt = this.systemPrompt
        .replace('{fitnessLevel}', context.fitnessLevel)
        .replace('{goals}', context.goals.join(', '))
        .replace('{preferences}', context.preferences.join(', '))
        .replace('{recentWorkouts}', context.recentWorkouts.join(', '))
        .replace('{age}', context.userProfile.age.toString())
        .replace('{gender}', context.userProfile.gender)
        .replace('{weight}', context.userProfile.weight.toString())
        .replace('{height}', context.userProfile.height.toString())
        .replace(
          '{medicalConditions}',
          context.userProfile.medicalConditions?.join(', ') || 'none',
        );

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: formattedPrompt },
          { role: 'user', content: `Type: ${type}\nQuestion: ${prompt}` },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const response =
        completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

      const session: CoachingSession = {
        id: Date.now().toString(),
        userId: auth.user.id,
        timestamp: new Date(),
        type,
        prompt,
        response,
      };

      await this.saveSession(session);
      return response;
    } catch (error) {
      console.error('Error getting coaching response:', error);
      throw error;
    }
  }

  public async saveFeedback(sessionId: string, feedback: string, rating: number): Promise<void> {
    try {
      const sessionIndex = this.coachingHistory.findIndex((s) => s.id === sessionId);
      if (sessionIndex !== -1) {
        this.coachingHistory[sessionIndex] = {
          ...this.coachingHistory[sessionIndex],
          feedback,
          rating,
        };
        await AsyncStorage.setItem('coachingHistory', JSON.stringify(this.coachingHistory));
      }
    } catch (error) {
      console.error('Error saving feedback:', error);
      throw error;
    }
  }

  private async saveSession(session: CoachingSession): Promise<void> {
    this.coachingHistory.push(session);
    await AsyncStorage.setItem('coachingHistory', JSON.stringify(this.coachingHistory));
  }

  public async getCoachingHistory(): Promise<CoachingSession[]> {
    try {
      const auth = await getAuth();
      if (!auth?.user) {
        throw new Error('User not authenticated');
      }

      const history = await AsyncStorage.getItem('coachingHistory');
      if (history) {
        this.coachingHistory = JSON.parse(history);
        // Filter sessions for the current user
        this.coachingHistory = this.coachingHistory.filter(
          (session) => session.userId === auth.user?.id,
        );
      }
      return this.coachingHistory;
    } catch (error) {
      console.error('Error getting coaching history:', error);
      return [];
    }
  }
}

export default AICoachingService;
