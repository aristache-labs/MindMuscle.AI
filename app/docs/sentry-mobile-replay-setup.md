# Sentry Mobile Replay Integration

## Overview

Mobile Replay has been successfully integrated into MindMuscle.AI to capture user session recordings for debugging and user experience analysis.

## ✅ What's Configured

### SDK Version

- **Sentry React Native SDK**: v6.14.0 (meets minimum requirement of 6.5.0)

### Integration Settings

```javascript
// Mobile Replay Configuration
replaysSessionSampleRate: __DEV__ ? 1.0 : 0.1, // 100% in dev, 10% in production
replaysOnErrorSampleRate: 1.0, // Always capture replays on errors

// Privacy Protection
Sentry.mobileReplayIntegration({
  maskAllText: true,     // Mask all text by default for privacy
  maskAllImages: true,   // Mask all images by default for privacy
  maskAllVectors: true,  // Mask all vector graphics by default for privacy
})
```

## 🎬 What Mobile Replay Captures

- **User Interactions**: Taps, swipes, scrolls, gestures
- **Screen Transitions**: Navigation between screens
- **App State Changes**: Background/foreground transitions
- **Network Requests**: Metadata only (no sensitive data)
- **Console Logs**: Error messages and debug information
- **Performance Metrics**: Loading times, render performance

## 🔒 Privacy Protection

All sensitive content is automatically masked:

- Text content is replaced with placeholder blocks
- Images are replaced with colored rectangles
- Vector graphics are masked
- Sensitive data in network requests is filtered

## 🧪 Testing Mobile Replay

### Method 1: Using Test Utilities

```javascript
import { SentryTestUtils } from '../services/sentry';

// Test mobile replay specifically
SentryTestUtils.testMobileReplay();

// Or run comprehensive test including replay
SentryTestUtils.runComprehensiveTest();
```

### Method 2: Manual Testing

1. Run your React Native app in development mode
2. Perform various user interactions:
   - Navigate between screens
   - Tap buttons and interact with UI elements
   - Trigger errors (if testing error replay)
3. Check Sentry dashboard under "Replays" section

### Method 3: Using NPM Script

```bash
npm run sentry:test:replay
```

## 📊 Verifying in Sentry Dashboard

1. **Go to Sentry.io** → Your Project → **Replays**
2. **Look for recent sessions** with your device/user info
3. **Click on a session** to view the replay
4. **Verify that**:
   - User interactions are captured
   - Text and images are properly masked
   - Timeline shows app events
   - Performance data is correlated

## ⚙️ Configuration Options

### Sample Rates

- **Development**: 100% of sessions recorded for thorough testing
- **Production**: 10% of sessions to balance insights with performance
- **Error Replays**: 100% capture rate when errors occur

### Privacy Settings

Current configuration prioritizes privacy with full masking. You can adjust:

```javascript
Sentry.mobileReplayIntegration({
  maskAllText: false, // To show actual text (not recommended for production)
  maskAllImages: false, // To show actual images (not recommended for production)
  maskAllVectors: false, // To show actual vectors (not recommended for production)
});
```

## 🚀 Production Considerations

### Performance Impact

- Minimal impact on app performance
- Recordings are compressed and uploaded in background
- Sample rate controls data volume

### Data Usage

- Replay data is compressed before upload
- 10% sample rate in production keeps data manageable
- Error replays provide maximum debugging value

### Privacy Compliance

- All sensitive content is masked by default
- No personal information is captured in replays
- Network request bodies are not recorded

## 🔧 Troubleshooting

### If replays don't appear:

1. Check that sample rate allows recording (100% in dev)
2. Verify Sentry DSN is correctly configured
3. Ensure app has network connectivity
4. Check console for Sentry initialization messages

### If replays are too frequent:

- Adjust `replaysSessionSampleRate` for production
- Consider user consent for replay recording

### If sensitive data appears:

- Verify masking settings are enabled
- Add custom masking rules if needed
- Review privacy configuration

## 📈 Benefits

- **Faster Bug Resolution**: See exactly what users experienced
- **UX Insights**: Understand user behavior patterns
- **Performance Analysis**: Correlate user actions with performance
- **Error Context**: Link errors to user session recordings
- **Quality Assurance**: Verify app behavior in real user scenarios

## 🎯 Next Steps

1. **Test the integration** using the provided test utilities
2. **Monitor replay data** in your Sentry dashboard
3. **Adjust sample rates** based on your needs
4. **Configure custom masking** if required
5. **Train your team** on using replay data for debugging

---

**Note**: Mobile Replay is now fully integrated and ready for use. The configuration prioritizes privacy while providing valuable debugging insights.
