# MindMuscle.AI

A React Native Expo application for AI-powered fitness coaching and progress tracking.

## Features

- 🤖 AI Coaching
  - Personalized workout advice
  - Nutrition guidance
  - Mindset coaching
  - Feedback system
  - Session history
  - AI-powered insights and recommendations

- 🎯 Discover & Exercises
  - Curated exercise library
  - Exercise timer with customizable intervals
  - Exercise categories and filters
  - Detailed exercise instructions
  - Progress tracking per exercise
  - Favorite exercises system

- 📊 Progress Tracking
  - Workout logging
  - Performance metrics
  - Progress visualization
  - Detailed workout history
  - Exercise-specific progress tracking
  - Performance analytics

- 🧠 Insights
  - AI-generated workout insights
  - Performance trends analysis
  - Personalized recommendations
  - Progress milestones
  - Achievement tracking
  - Weekly/monthly summaries

- 🎮 Gamification
  - Achievement system
  - Progress rewards
  - Motivation features
  - Streak tracking
  - Level progression
  - Badge collection

- 👤 User Profile
  - Personal information
  - Fitness goals
  - Medical conditions
  - Preferences
  - Workout preferences
  - Exercise history

## Project Structure

```
mindmuscle-ai/
├── app/                      # Main application code
│   ├── (app)/               # Protected routes
│   ├── (auth)/              # Authentication routes
│   ├── coaching/            # AI coaching feature
│   ├── components/          # Reusable components
│   ├── constants/           # App constants
│   ├── gamification/        # Gamification features
│   ├── hooks/               # Custom React hooks
│   ├── profile/             # User profile management
│   ├── progress/            # Progress tracking
│   ├── services/            # API and service integrations
│   ├── store/               # State management
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   ├── _layout.tsx          # Root layout
│   └── index.tsx            # Entry point
├── assets/                  # Static assets
├── prisma/                  # Database schema and migrations
├── .env                     # Environment variables
├── .env.example            # Environment variables template
├── app.json                # Expo configuration
├── package.json            # Dependencies and scripts
└── tsconfig.json           # TypeScript configuration
```

## Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **UI**: React Native Paper
- **State Management**: React Context API
- **Database**: Prisma with SQLite
- **AI Integration**: OpenAI API
- **Authentication**: Custom auth system
- **Persistence**: AsyncStorage
- **Date Handling**: date-fns
- **Language**: TypeScript

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Add your OpenAI API key:
     ```
     EXPO_PUBLIC_OPENAI_API_KEY=your_api_key_here
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

## Development

- **Code Style**: Follow TypeScript best practices
- **Components**: Use functional components with hooks
- **State Management**: Use Context API for global state
- **Navigation**: Follow Expo Router conventions
- **Styling**: Use React Native Paper components
- **Testing**: Jest for unit testing

## Security

- API keys are stored in environment variables
- User data is persisted securely
- Authentication is required for protected routes
- Input validation is implemented
- Rate limiting is in place for API calls

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
- All contributors to this project 