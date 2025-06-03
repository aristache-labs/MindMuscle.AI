# MindMuscle.AI

![Logo](assets/icon.png)

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/MindMuscleAI/MindMuscle.AI/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

MindMuscle.AI delivers AI‑powered fitness coaching and progress tracking using React Native and Expo. It integrates Supabase MPC for secure computations and Sentry for monitoring.

## Table of Contents
- [Features](#features)
- [Future-Requirements](#future-requirements)
- [Project Structure](#project-structure)
- [Node.js Polyfills](#nodejs-polyfills)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Development Guidelines](#development-guidelines)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)
- [Sentry Setup](#sentry-setup)

## Future Requirements

- WatermelondDB offline with the Supabase database

## Features

- 🤖 **AI Coaching** – Personalized workout advice and real-time feedback via OpenAI with secure Supabase MPC.
- 🎯 **Exercise Management** – Extensive library, advanced timers, filtering and progress graphs.
- 📊 **Progress Tracking** – Log workouts, track body metrics and analyze performance.
- 🧠 **Insights & Analytics** – AI-generated recommendations and milestone tracking.
- 🎮 **Gamification** – Achievements, badges and streaks keep you motivated.
- 👤 **User Profiles** – Secure authentication with profile and goal management.
- 🔒 **Security & Performance** – Sentry monitoring, optimized assets and type-safe code.

## Project Structure

```
mindmuscle-ai/
├── app/                           # Main application code
│   ├── _layout.tsx               # Root layout with providers and navigation
│   ├── index.tsx                 # Entry point
│   ├── achievements.tsx          # Achievements system implementation
│   ├── (auth)/                   # Authentication routes and screens
│   ├── (stack)/                  # Stack-based navigation screens
│   ├── (tabs)/                   # Tab-based navigation screens
│   ├── coaching/                 # AI coaching implementation
│   ├── components/               # Reusable components
│   │   ├── Achievements.tsx      # Achievement display and management
│   │   ├── AuthGuard.tsx        # Authentication protection
│   │   ├── CoachingInterface.tsx # AI coaching interface
│   │   ├── ExerciseGraphs.tsx   # Exercise progress visualization
│   │   ├── ExerciseGraphModal.tsx# Detailed exercise statistics
│   │   ├── GlobalGestureHandler  # Gesture management
│   │   ├── HowToMeasureModal    # Measurement instructions
│   │   ├── InitialLoadingScreen # App initialization
│   │   ├── MeasurementHistory   # Body measurements history
│   │   ├── MeasurementModal     # Body measurements input
│   │   ├── MeasurementsGraph    # Measurements visualization
│   │   ├── OptimizedImage       # Performance-optimized images
│   │   ├── SplashScreenManager  # Splash screen handling
│   │   ├── SwipeBackHandler     # Navigation gestures
│   │   ├── ThemedDatePicker     # Themed date selection
│   │   ├── ThemedNumberPicker   # Themed number input
│   │   └── timer.tsx            # Workout timer
│   ├── constants/               # Application constants
│   ├── docs/                   # Documentation
│   ├── hooks/                  # Custom React hooks
│   ├── services/               # API and service integrations
│   ├── store/                  # State management
│   │   ├── AuthContext        # Authentication state
│   │   ├── CoachingContext   # AI coaching state
│   │   ├── GamificationContext# Achievements state
│   │   ├── ProfileContext    # User profile state
│   │   ├── ProgressContext   # Progress tracking state
│   │   ├── ProgressPhotosContext# Photos management
│   │   └── TaskContext       # Workout scheduling
│   ├── types/                 # TypeScript definitions
│   └── utils/                 # Utility functions
├── assets/                    # Static assets
│   ├── exercises/            # Exercise images
│   └── measurements/         # Measurement reference images
├── prisma/                   # Database schema and migrations
├── supabase/                 # Supabase configuration
│   └── migrations/          # Database migrations
├── android/                  # Android specific configuration
├── .env                     # Environment variables
├── .env.example            # Environment template
├── app.json                # Expo configuration
├── package.json            # Dependencies and scripts
└── tsconfig.json           # TypeScript configuration
```

## Node.js Polyfills

We use community-maintained polyfills for Node.js modules:

- **Polyfill Strategy**: We use `node-libs-react-native` to provide React Native-compatible implementations of Node.js core modules.
- **Metro Config**: Metro resolver is configured to use polyfills from `node-libs-react-native`.
- **Polyfill Imports**: Essential polyfills like Buffer and URL are imported in the app entry point.
- **Best Practices**:
  - Use React Native-compatible libraries (fetch instead of http, AsyncStorage instead of fs)
  - Avoid server-side logic in the mobile bundle
  - Keep Node.js API dependencies to a minimum

## Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **UI**: React Native Paper
- **State Management**: React Context API with TypeScript
- **Database**: Supabase with MPC
- **AI Integration**: OpenAI API
- **Authentication**: Supabase Auth
- **Monitoring**: Sentry.io MPC
- **Persistence**: AsyncStorage with encryption
- **Date Handling**: date-fns
- **Language**: TypeScript
- **Testing**: Jest and React Native Testing Library
- **Performance**:
  - Optimized image loading
  - Gesture handling
  - Memoization
  - Code splitting

## Getting Started

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   - Copy `.env.example` to `.env`
   - Configure required keys:
     ```
     EXPO_PUBLIC_OPENAI_API_KEY=your_api_key_here
     SUPABASE_URL=your_supabase_url
     SUPABASE_ANON_KEY=your_supabase_anon_key
     SENTRY_DSN=your_sentry_dsn
     ```

4. Start the development server:

   ```bash
   npm start
   ```

5. Run on your preferred platform:
   ```bash
   npm run android  # For Android
   npm run ios      # For iOS
   npm run web      # For web
   ```

## Development Guidelines

- **Code Style**:

  - Follow TypeScript strict mode
  - Use functional components with hooks
  - Implement proper error boundaries
  - Follow React Native best practices

- **State Management**:

  - Use Context API for global state
  - Implement proper type safety
  - Follow proper state initialization
  - Handle loading and error states

- **Navigation**:

  - Follow Expo Router conventions
  - Implement proper deep linking
  - Handle navigation state
  - Manage navigation history

- **Security**:

  - Secure API key storage
  - Data encryption at rest
  - Proper authentication flow
  - Input validation
  - Rate limiting
  - Secure computation with MPC

- **Performance**:
  - Optimize image loading
  - Implement proper memoization
  - Handle memory management
  - Optimize animations
  - Implement proper error boundaries

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- React Native community
- Expo team
- React Native Paper contributors
- Supabase team
- OpenAI team
- All contributors to this project

## Sentry Setup

To properly configure Sentry for error monitoring:

1. Set up your Sentry account and create a project at [sentry.io](https://sentry.io)
2. Get your Sentry DSN and add it to your environment variables:
   ```
   SENTRY_DSN=your_sentry_dsn
   ```
3. For CI/CD builds, you have two options:

   - Option 1: Authenticate with Sentry CLI:
     ```
     npx @sentry/cli login
     ```
   - Option 2: Disable auto-upload during builds by setting:
     ```
     SENTRY_DISABLE_AUTO_UPLOAD=true
     ```
     This is currently configured in eas.json for all build profiles.

4. For manual source map uploads, use:
   ```
   npx @sentry/cli releases files <release_name> upload-sourcemaps <path_to_sourcemaps>
   ```
