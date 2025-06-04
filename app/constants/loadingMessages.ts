import { SentryLogger, addBreadcrumb, setContext } from '../services/sentry';

/**
 * Shared loading messages used across the app
 * This centralizes all loading text to avoid duplication
 * Integrated with Sentry for performance monitoring and error tracking
 */
export const LOADING_MESSAGES = {
  // Core system messages
  START: 'Starting up...',
  STATIC_ASSETS: 'Loading static assets...',
  REMOTE_ASSETS: 'Loading remote assets...',
  IMAGES: 'Caching important images...',
  DATA: 'Preloading essential data...',
  CONTENT: 'Loading content...',
  OFFLINE: 'Offline mode',
  ALMOST_READY: 'Almost ready...',
  READY: 'Ready!',
  COMPLETE: 'Setup complete!',
  LIMITED: 'Ready (with limited resources)',

  // User-facing messages
  DEFAULT: 'Welcome to MindMuscle.AI',
  DEFAULT_WORKOUT: 'Preparing your workout...',
  AUTHENTICATED: 'Preparing your workout experience...',
  GETTING_READY: 'Getting things ready...',

  // User-specific content loading
  USER_CONTENT: 'Loading your personal content...',
  PROGRESS_PHOTOS: 'Caching your progress photos...',
  FAVORITE_EXERCISES: 'Preparing your favorite exercises...',
  WORKOUT_HISTORY: 'Loading your workout history...',

  // Rotating messages for loading screen
  ROTATION: [
    'Loading exercises...',
    'Just a moment...',
    'AI is working...',
    'Calculating your gains...',
    'Getting pumped up...',
    'Almost there...',
    'Hold on tight...',
    'Finalizing...',
  ],
};

/**
 * Loading state tracker with Sentry integration
 * Tracks loading phases for performance monitoring
 */
export class LoadingStateTracker {
  private static instance: LoadingStateTracker;
  private currentPhase: string | null = null;
  private phaseStartTime: number | null = null;
  private totalLoadingStartTime: number | null = null;
  private completedPhases: Array<{ phase: string; duration: number; timestamp: string }> = [];

  private constructor() {
    // Initialize Sentry context for loading tracking
    setContext('loading_tracker', {
      initialized: true,
      timestamp: new Date().toISOString(),
    });
  }

  static getInstance(): LoadingStateTracker {
    if (!LoadingStateTracker.instance) {
      LoadingStateTracker.instance = new LoadingStateTracker();
    }
    return LoadingStateTracker.instance;
  }

  /**
   * Start tracking a loading phase
   */
  startPhase(phase: string, message?: string): void {
    try {
      const now = Date.now();

      // End previous phase if exists
      if (this.currentPhase && this.phaseStartTime) {
        this.endPhase();
      }

      // Start new phase
      this.currentPhase = phase;
      this.phaseStartTime = now;

      // Start total loading time on first phase
      if (!this.totalLoadingStartTime) {
        this.totalLoadingStartTime = now;

        addBreadcrumb({
          message: 'App loading started',
          category: 'loading.start',
          level: 'info',
          data: {
            firstPhase: phase,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Log phase start
      addBreadcrumb({
        message: `Loading phase started: ${phase}`,
        category: 'loading.phase_start',
        level: 'info',
        data: {
          phase,
          message: message || LOADING_MESSAGES[phase as keyof typeof LOADING_MESSAGES] || phase,
          timestamp: new Date().toISOString(),
        },
      });

      // Update Sentry context
      setContext('current_loading_phase', {
        phase,
        message: message || LOADING_MESSAGES[phase as keyof typeof LOADING_MESSAGES] || phase,
        startTime: new Date(now).toISOString(),
        totalPhasesCompleted: this.completedPhases.length,
      });
    } catch (error) {
      SentryLogger.error('Error starting loading phase', {
        error,
        phase,
        message,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * End the current loading phase
   */
  endPhase(): void {
    try {
      if (!this.currentPhase || !this.phaseStartTime) {
        return;
      }

      const now = Date.now();
      const duration = now - this.phaseStartTime;
      const phaseData = {
        phase: this.currentPhase,
        duration,
        timestamp: new Date().toISOString(),
      };

      // Store completed phase
      this.completedPhases.push(phaseData);

      // Log phase completion
      addBreadcrumb({
        message: `Loading phase completed: ${this.currentPhase}`,
        category: 'loading.phase_end',
        level: 'info',
        data: {
          ...phaseData,
          durationMs: duration,
        },
      });

      // Log performance if phase took too long
      if (duration > 3000) {
        // 3 seconds threshold
        SentryLogger.warn('Slow loading phase detected', {
          phase: this.currentPhase,
          duration,
          threshold: 3000,
        });
      }

      // Clear current phase
      this.currentPhase = null;
      this.phaseStartTime = null;
    } catch (error) {
      SentryLogger.error('Error ending loading phase', {
        error,
        currentPhase: this.currentPhase,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Complete all loading and generate summary
   */
  completeLoading(): void {
    try {
      // End current phase if exists
      if (this.currentPhase) {
        this.endPhase();
      }

      if (!this.totalLoadingStartTime) {
        return;
      }

      const totalDuration = Date.now() - this.totalLoadingStartTime;
      const summary = {
        totalDuration,
        totalPhases: this.completedPhases.length,
        phases: this.completedPhases,
        averagePhaseTime:
          this.completedPhases.length > 0
            ? this.completedPhases.reduce((sum, phase) => sum + phase.duration, 0) /
              this.completedPhases.length
            : 0,
        timestamp: new Date().toISOString(),
      };

      // Log completion
      addBreadcrumb({
        message: 'App loading completed',
        category: 'loading.complete',
        level: 'info',
        data: summary,
      });

      // Set final context
      setContext('loading_summary', summary);

      // Log performance summary
      SentryLogger.info('Loading completed', summary);

      // Log warning if total loading took too long
      if (totalDuration > 10000) {
        // 10 seconds threshold
        SentryLogger.warn('Slow app loading detected', {
          totalDuration,
          threshold: 10000,
          phases: this.completedPhases.length,
        });
      }

      // Reset for next loading cycle
      this.reset();
    } catch (error) {
      SentryLogger.error('Error completing loading tracking', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Reset the tracker
   */
  reset(): void {
    this.currentPhase = null;
    this.phaseStartTime = null;
    this.totalLoadingStartTime = null;
    this.completedPhases = [];
  }

  /**
   * Get current loading state
   */
  getCurrentState(): {
    currentPhase: string | null;
    totalPhases: number;
    isLoading: boolean;
  } {
    return {
      currentPhase: this.currentPhase,
      totalPhases: this.completedPhases.length,
      isLoading: this.currentPhase !== null || this.totalLoadingStartTime !== null,
    };
  }
}

/**
 * Utility functions for loading message tracking
 */
export const LoadingUtils = {
  /**
   * Get a random rotation message with tracking
   */
  getRandomRotationMessage(): string {
    try {
      const message =
        LOADING_MESSAGES.ROTATION[Math.floor(Math.random() * LOADING_MESSAGES.ROTATION.length)];

      addBreadcrumb({
        message: 'Random loading message displayed',
        category: 'loading.rotation',
        level: 'info',
        data: {
          message,
          totalRotationMessages: LOADING_MESSAGES.ROTATION.length,
          timestamp: new Date().toISOString(),
        },
      });

      return message;
    } catch (error) {
      SentryLogger.error('Error getting random rotation message', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      return LOADING_MESSAGES.DEFAULT;
    }
  },

  /**
   * Track loading message usage
   */
  trackMessageUsage(messageKey: string, context?: Record<string, unknown>): void {
    try {
      addBreadcrumb({
        message: `Loading message used: ${messageKey}`,
        category: 'loading.message_usage',
        level: 'info',
        data: {
          messageKey,
          message: LOADING_MESSAGES[messageKey as keyof typeof LOADING_MESSAGES],
          context,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      SentryLogger.error('Error tracking message usage', {
        error,
        messageKey,
        context,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
};

// Define a default export to satisfy Expo Router
export default LOADING_MESSAGES;
