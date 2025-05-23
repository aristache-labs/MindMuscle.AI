## Project Folder Structure

Regularly update this folder structure each time you create, modify, or delete a file or folder. (Latest: Added ExerciseMaxWeightGraph component for workout session progress tracking):

```
mindmuscle-ai/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── achievements.tsx
│   ├── (auth)/
│   ├── (stack)/
│   │   ├── _layout.tsx
│   │   ├── settings.tsx
│   │   ├── exercises-list.tsx
│   │   ├── exercise-details.tsx
│   │   ├── plan-details.tsx
│   │   ├── workout-session.tsx        # Updated with max weight graph integration
│   │   └── plans.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx             # Modified to conditionally hide bottom tab bar
│   │   ├── index.tsx
│   │   ├── discover.tsx
│   │   ├── exercises.tsx
│   │   ├── plans.tsx               # Tab bar hidden on this screen
│   │   ├── plan-details.tsx        # Tab bar hidden on this screen
│   │   ├── exercises-list.tsx      # Tab bar hidden on this screen
│   │   ├── exercise-details.tsx    # Tab bar hidden on this screen
│   │   ├── insights.tsx
│   │   └── profile.tsx
│   ├── coaching/
│   ├── components/
│   │   ├── Achievements.tsx
│   │   ├── AuthGuard.tsx
│   │   ├── CoachingInterface.tsx
│   │   ├── ExerciseCard.tsx
│   │   ├── ExerciseGraphs.tsx
│   │   ├── ExerciseGraphModal.tsx
│   │   ├── ExerciseInstructions.tsx
│   │   ├── ExerciseMaxWeightGraph.tsx  # NEW: Max weight progress graph component
│   │   ├── GeneralHeader.tsx
│   │   ├── GlobalGestureHandler
│   │   ├── HowToMeasureModal
│   │   ├── InitialLoadingScreen.tsx
│   │   ├── MeasurementHistory
│   │   ├── MeasurementModal
│   │   ├── MeasurementsGraph
│   │   ├── MuscleDiagram.tsx
│   │   ├── MuscleTags.tsx
│   │   ├── OptimizedImage.tsx
│   │   ├── SplashScreenManager.tsx
│   │   ├── SwipeBackHandler
│   │   ├── ThemedDatePicker
│   │   ├── ThemedNumberPicker
│   │   └── timer.tsx
│   ├── constants/
│   ├── docs/
│   ├── hooks/
│   │   ├── useImagePreloader.ts
│   │   └── other hooks...
│   ├── services/
│   │   ├── exerciseService.ts
│   │   ├── profileService.ts
│   │   ├── progressPhotos.ts
│   │   ├── supabase.ts
│   │   └── workoutPlanService.ts      # Updated with fetchExerciseMaxWeightData function
│   ├── store/
│   │   ├── AuthContext
│   │   ├── CoachingContext
│   │   ├── GamificationContext
│   │   ├── ProfileContext
│   │   ├── ProgressContext
│   │   ├── ProgressPhotosContext.tsx
│   │   └── TaskContext
│   ├── types/
│   └── utils/
│       ├── imagePreloader.ts
│       └── muscleHighlighter.ts
├── assets/
│   ├── exercises/
│   └── measurements/
├── prisma/
├── supabase/
│   └── migrations/
├── android/
├── .env
├── .env.example
├── app.json
├── package.json
└── tsconfig.json
```

### Guidelines

- Always reference the folder structure above before creating a new file or folder.
- Update the folder structure immediately after creating, deleting, or moving files.
- Ensure consistency with naming conventions (PascalCase for components, camelCase for services and utilities, kebab-case for directories).
- Avoid duplicating existing files or folders by checking the structure carefully.
- For image handling, use the OptimizedImage component with the imagePreloader utilities to ensure efficient loading.
- Use SplashScreenManager for proper application initialization and asset preloading.
- The bottom tab navigation is hidden on specific screens (plans, plan-details, exercises-list, exercise-details) for a cleaner UI.
- The ExerciseMaxWeightGraph component displays exercise progress data from the user_exercise_records table.

---

// Tool Usage and Additional Instructions unchanged 