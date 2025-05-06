```mermaid
flowchart TD
    %% Main Application Structure
    App[MindMuscle.AI App] --> Layout["_layout.tsx\nRoot Layout"]
    Layout --> ThemeProvider["ThemeProvider\n(constants/theme.tsx)"]
    Layout --> Providers["Context Providers"]
    Layout --> InitialLoading["InitialLoadingScreen.tsx\n(app/components)"]
    Layout --> AuthGuard["AuthGuard.tsx\n(app/components)"]
    
    %% Context Providers
    Providers --> AuthContext["AuthContext\n(store/AuthContext.tsx)"]
    Providers --> ProfileContext["ProfileContext\n(store/ProfileContext.tsx)"]
    Providers --> ProgressContext["ProgressContext\n(store/ProgressContext.tsx)"]
    Providers --> GamificationContext["GamificationContext\n(store/GamificationContext.tsx)"]
    Providers --> ProgressPhotosContext["ProgressPhotosContext\n(store/ProgressPhotosContext.tsx)"]
    Providers --> MeasurementsContext["MeasurementsContext\n(store/MeasurementsContext.tsx)"]
    Providers --> CoachingContext["CoachingContext\n(store/CoachingContext.tsx)"]
    Providers --> TaskContext["TaskContext\n(store/TaskContext.tsx)"]
    
    %% Authentication Flow
    AuthGuard --> |Not Authenticated| AuthRoutes["Auth Routes\n(app/(auth))"]
    AuthGuard --> |Authenticated| MainRoutes["Main Routes"]
    
    %% Auth Routes
    AuthRoutes --> Login["login.tsx"]
    AuthRoutes --> Register["register.tsx"]
    AuthRoutes --> ForgotPassword["forgot-password.tsx"]
    AuthRoutes --> ResetPassword["reset-password.tsx"]
    AuthRoutes --> EditProfile["edit-profile.tsx"]
    
    %% Main Route Structure
    MainRoutes --> TabRoutes["Tab Routes\n(app/(tabs))"]
    MainRoutes --> StackRoutes["Stack Routes\n(app/(stack))"]
    MainRoutes --> CoachingRoute["Coaching Route\n(app/coaching)"]
    
    %% Tab Routes
    TabRoutes --> HomeTab["index.tsx\nHome Screen"]
    TabRoutes --> ExercisesTab["exercises.tsx\nExercises Screen"]
    TabRoutes --> DiscoverTab["discover.tsx\nDiscover Screen"]
    TabRoutes --> InsightsTab["insights.tsx\nInsights Screen"]
    TabRoutes --> ProfileTab["profile.tsx\nProfile Screen"]
    
    %% Stack Routes
    StackRoutes --> Settings["settings.tsx"]
    StackRoutes --> ExercisesList["exercises-list.tsx"]
    StackRoutes --> ExerciseDetails["exercise-details.tsx"]
    StackRoutes --> Plans["plans.tsx"]
    StackRoutes --> PlanDetails["plan-details.tsx"]
    StackRoutes --> MyPlan["my-plan.tsx"]
    StackRoutes --> SingleWorkout["single-workout.tsx"]
    StackRoutes --> AICoachingStack["ai-coaching.tsx"]
    StackRoutes --> Custom["custom.tsx"]
    
    %% Core Features & Components
    subgraph "Feature: AI Coaching"
        CoachingRoute --> CoachingApp["coaching/index.tsx"]
        CoachingApp --> CoachingInterface["CoachingInterface.tsx\n(components)"]
        CoachingInterface --> AICoachingService["aiCoaching.ts\n(services)"]
        AICoachingService --> OpenAIAPI[OpenAI API]
        AICoachingService --> SupabaseMPC["Supabase MPC\n(Secure Computation)"]
    end
    
    subgraph "Feature: Exercise Management"
        ExercisesTab --> ExerciseLibrary["Exercise Library"]
        ExerciseDetails --> ExerciseInstructions["ExerciseInstructions.tsx\n(components)"]
        ExerciseDetails --> MuscleDiagram["MuscleDiagram.tsx\n(components)"]
        ExerciseDetails --> MuscleTags["MuscleTags.tsx\n(components)"]
        ExerciseDetails --> ExerciseTimer["timer.tsx\n(components)"]
        ExercisesList --> ExerciseCard["ExerciseCard.tsx\n(components)"]
        ExerciseDetails --> ExerciseGraphModal["ExerciseGraphModal.tsx\n(components)"]
    end
    
    subgraph "Feature: Progress Tracking"
        InsightsTab --> WorkoutLogging["Workout Logging"]
        InsightsTab --> MetricsVisuals["Metrics Visualization"]
        InsightsTab --> BodyMeasures["Body Measurements"]
        BodyMeasures --> MeasurementModal["MeasurementModal.tsx\n(components)"]
        BodyMeasures --> MeasurementHistory["MeasurementHistory.tsx\n(components)"]
        BodyMeasures --> MeasurementsGraph["MeasurementsGraph.tsx\n(components)"]
        BodyMeasures --> HowToMeasureModal["HowToMeasureModal.tsx\n(components)"]
        InsightsTab --> ProgressPhotos["Progress Photos"]
        InsightsTab --> ExerciseGraphs["ExerciseGraphs.tsx\n(components)"]
    end
    
    subgraph "Feature: Gamification"
        HomeTab --> AchievementSys["Achievements System"]
        AchievementSys --> AchievementsComponent["Achievements.tsx\n(components)"]
        AchievementsComponent --> AchievementsService["achievements.ts\n(services)"]
    end
    
    %% Database Models - Updated to Supabase structure
    subgraph "Supabase Database Schema"
        DB[(Supabase\nDatabase)] --> User["auth.users\n(Authentication)"]
        DB --> ExercisesTable["exercises\n(Exercise library)"]
        DB --> WorkoutProgressTable["workout_progress\n(Workout history)"]
        DB --> ProfilesTable["profiles\n(User profiles)"]
        DB --> AchievementsTable["achievements\n(Achievement definitions)"]
        DB --> UserAchievementsTable["user_achievements\n(User progress)"]
        DB --> MeasurementsTable["measurements\n(Body measurements)"]
        DB --> ProgressPhotosTable["progress_photos\n(User photos)"]
        DB --> WorkoutPlansTable["workout_plans\n(Workout templates)"]
        DB --> WorkoutCategoriesTable["workout_categories\n(Plan categories)"]
        DB --> WorkoutSubcategoriesTable["workout_subcategories\n(Plan subcategories)"]
        DB --> WorkoutPlanExercisesTable["workout_plan_exercises\n(Exercises in plans)"]
        DB --> UserFavoriteExercisesTable["user_favorite_exercises\n(User favorites)"]
        DB --> ExerciseNotesTable["exercise_notes\n(User notes)"]
        DB --> PersonalRecordsTable["personal_records\n(User PRs)"]
        DB --> UserProfileDetailsTable["user_profile_details\n(Detailed profiles)"]
        
        %% Table relationships
        User --> ProfilesTable
        User --> UserAchievementsTable
        User --> UserProfileDetailsTable
        User --> MeasurementsTable
        User --> ProgressPhotosTable
        User --> WorkoutProgressTable
        User --> UserFavoriteExercisesTable
        User --> ExerciseNotesTable
        User --> PersonalRecordsTable
        
        AchievementsTable --> UserAchievementsTable
        ExercisesTable --> UserFavoriteExercisesTable
        ExercisesTable --> ExerciseNotesTable
        ExercisesTable --> WorkoutPlanExercisesTable
        
        WorkoutCategoriesTable --> WorkoutSubcategoriesTable
        WorkoutSubcategoriesTable --> WorkoutPlansTable
        WorkoutPlansTable --> WorkoutPlanExercisesTable
    end
    
    %% Services Layer
    subgraph "Services Layer (app/services)"
        Services --> AuthService["auth.ts"]
        Services --> ProfileService["profileService.ts"]
        Services --> WorkoutService["workoutService.ts"]
        Services --> WorkoutPlanService["workoutPlanService.ts"]
        Services --> ExerciseService["exerciseService.ts"]
        Services --> MeasurementsService["measurements.ts"]
        Services --> ProgressPhotosService["progressPhotos.ts"]
        Services --> AICoachingService
        Services --> AchievementsService
        Services --> SupabaseService["supabase.ts"]
        Services --> SentryService["sentry.ts"]
        Services --> DatabaseService["database.tsx"]
        Services --> InitDatabaseService["initDatabase.ts"]
    end
    
    %% Utilities
    subgraph "Utilities (app/utils)"
        Utils --> ImagePreloader["imagePreloader.ts"]
        Utils --> MuscleHighlighter["muscleHighlighter.ts"]
        Utils --> Logger["logger.ts"]
    end
    
    %% Hooks
    subgraph "Custom Hooks (app/hooks)"
        Hooks --> UseImagePreloader["useImagePreloader.ts"]
        Hooks --> UseDebounce["useDebounce.ts"]
        Hooks --> UseDatabase["useDatabase.ts"]
    end
    
    %% Assets
    subgraph "Assets (assets/)"
        Assets --> ExerciseImages["exercises/"]
        Assets --> MeasurementImages["measurements/instructions/"]
        Assets --> NavigationIcons["navigation/"]
        Assets --> BodyModels["body-model_front.png\nbody-model_back.png"]
    end
    
    %% Types
    subgraph "TypeScript Types (app/types)"
        Types --> ExerciseTypes["exercise.ts"]
        Types --> WorkoutTypes["workout.ts"]
    end
    
    %% Backend Integration
    SupabaseService --> DB
    AuthService --> User
    SentryService --> SentryMPC[(Sentry.io MPC)]
    
    %% Component Dependencies
    ExerciseGraphs --> Victory["victory-native\n(Data Visualization)"]
    MeasurementsGraph --> Victory
    CoachingInterface --> OpenAI["openai\n(API Integration)"]
    ExerciseTimer --> RNGestureHandler["react-native-gesture-handler"]
    
    %% Mobile UI Components
    subgraph "UI Framework"
        UI --> RNPaper["react-native-paper\n(Material UI Components)"]
        UI --> RNReanimated["react-native-reanimated\n(Animations)"]
        UI --> ExpoImage["expo-image\n(Optimized Images)"]
        UI --> ExpoRouter["expo-router\n(Navigation)"]
    end
    
    %% File Storage & Security
    subgraph "Data Security & Storage"
        Security --> ExpoSecureStore["expo-secure-store"]
        Security --> ExpoFileSystem["expo-file-system"]
        Security --> RNAsyncStorage["@react-native-async-storage/async-storage"]
        Security --> ExpoSQLite["expo-sqlite"]
    end
    
    %% Styling
    classDef contextNode fill:#e8eaf6,stroke:#3f51b5,stroke-width:1px
    classDef screenNode fill:#e0f7fa,stroke:#006064,stroke-width:1px
    classDef componentNode fill:#fff9c4,stroke:#fbc02d,stroke-width:1px
    classDef serviceNode fill:#fce4ec,stroke:#880e4f,stroke-width:1px
    classDef databaseNode fill:#f3e5f5,stroke:#4a148c,stroke-width:1px
    classDef utilityNode fill:#f1f8e9,stroke:#33691e,stroke-width:1px
    
    class AuthContext,ProfileContext,ProgressContext,GamificationContext,ProgressPhotosContext,MeasurementsContext,CoachingContext,TaskContext contextNode
    class HomeTab,ExercisesTab,DiscoverTab,InsightsTab,ProfileTab,Login,Register,ForgotPassword,ResetPassword,EditProfile,Settings,ExercisesList,ExerciseDetails,Plans,PlanDetails,MyPlan,SingleWorkout,AICoachingStack,Custom,CoachingApp screenNode
    class CoachingInterface,ExerciseInstructions,MuscleDiagram,MuscleTags,ExerciseTimer,ExerciseCard,ExerciseGraphModal,MeasurementModal,MeasurementHistory,MeasurementsGraph,HowToMeasureModal,AchievementsComponent componentNode
    class AICoachingService,AuthService,ProfileService,WorkoutService,WorkoutPlanService,ExerciseService,MeasurementsService,ProgressPhotosService,AchievementsService,SupabaseService,SentryService,DatabaseService,InitDatabaseService serviceNode
    class DB,User,ExercisesTable,WorkoutProgressTable,ProfilesTable,AchievementsTable,UserAchievementsTable,MeasurementsTable,ProgressPhotosTable,WorkoutPlansTable,WorkoutCategoriesTable,WorkoutSubcategoriesTable,WorkoutPlanExercisesTable,UserFavoriteExercisesTable,ExerciseNotesTable,PersonalRecordsTable,UserProfileDetailsTable databaseNode
    class Utils,ImagePreloader,MuscleHighlighter,Logger,Hooks,UseImagePreloader,UseDebounce,UseDatabase utilityNode