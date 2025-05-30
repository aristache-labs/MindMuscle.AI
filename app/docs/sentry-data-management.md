# Sentry Data Management Implementation

This document outlines the comprehensive Sentry data management implementation for MindMuscle.AI, covering data collection, Apple Privacy Manifest compliance, and debug information files.

## Overview

Our Sentry implementation follows the official React Native documentation and includes:

1. **Data Collection Management** - Controlling what data is sent to Sentry
2. **Apple Privacy Manifest** - Compliance with Apple's privacy requirements
3. **Debug Information Files** - Source maps and debug symbols for better error tracking

## 1. Data Collection Configuration

### Implementation Location
- **File**: `app/services/sentry.ts`
- **Documentation**: [Sentry Data Collected](https://docs.sentry.io/platforms/react-native/data-management/data-collected/)

### Key Features

#### PII Data Handling
```typescript
sendDefaultPii: true  // Enables collection of user info, device names, etc.
```

#### Data Filtering
We implement a `beforeSend` hook to filter sensitive data:
- Removes Authorization headers
- Removes Cookie headers  
- Scrubs password and token query parameters

#### Breadcrumbs Configuration
- Console logs: ✅ Enabled
- DOM events: ✅ Enabled
- Fetch/XHR requests: ✅ Enabled
- History API: ✅ Enabled
- Sentry SDK errors: ✅ Enabled

#### HTTP Data Collection
- **User-Agent**: Automatically collected via `httpContextIntegration`
- **Request URLs**: Always sent (contains potential PII)
- **Query Strings**: Always sent (filtered for sensitive data)
- **Failed Requests**: Captured for status codes 400-599

#### Device Information
- **Device Names**: Sent when `sendDefaultPii: true`
- **IP Addresses**: Automatically inferred by Sentry backend
- **Platform Info**: iOS/Android detection included

#### Privacy Features
- **Screenshots**: Enabled with quality optimization (0.8)
- **View Hierarchy**: Enabled for debugging
- **Session Replay**: Not implemented (would require additional setup)

### Data Types Collected

| Data Type | Collected | Purpose | PII Required |
|-----------|-----------|---------|--------------|
| Crash Data | ✅ | Error tracking | No |
| Performance Data | ✅ | Performance monitoring | No |
| Console Logs | ✅ | Debugging | No |
| HTTP Headers | ❌ | Filtered out | Yes |
| Cookies | ❌ | Not sent | Yes |
| User Info | ✅ | User context | Yes |
| Device Names | ✅ | Device context | Yes |
| IP Addresses | ✅ | Geographic context | Yes |
| Screenshots | ✅ | Visual debugging | Potentially |

## 2. Apple Privacy Manifest

### Implementation Location
- **File**: `app.json` (iOS section)
- **Documentation**: [Apple Privacy Manifest](https://docs.sentry.io/platforms/react-native/data-management/apple-privacy-manifest/)

### Required for App Store Submission
Apple requires privacy manifests for apps using certain APIs. Our implementation covers:

#### Data Types Declared
1. **NSPrivacyCollectedDataTypeCrashData**
   - Purpose: App Functionality
   - Linked: No
   - Tracking: No

2. **NSPrivacyCollectedDataTypePerformanceData**
   - Purpose: App Functionality
   - Linked: No
   - Tracking: No

3. **NSPrivacyCollectedDataTypeOtherDiagnosticData**
   - Purpose: App Functionality
   - Linked: No
   - Tracking: No

#### API Types Accessed
1. **NSPrivacyAccessedAPICategoryUserDefaults** (CA92.1)
   - Reason: Accessing user defaults for app functionality

2. **NSPrivacyAccessedAPICategorySystemBootTime** (35F9.1)
   - Reason: Measuring time intervals for performance monitoring

3. **NSPrivacyAccessedAPICategoryFileTimestamp** (C617.1)
   - Reason: Accessing file timestamps for debugging

### Expo Configuration
For Expo apps using Continuous Native Generation (CNG), the privacy manifest is automatically generated from the `app.json` configuration.

### Verification
To verify the privacy manifest is correctly included:
1. Build and submit to App Store or TestFlight
2. Apple will email if manifest is missing or incorrect
3. Subject line: "The uploaded build for YourAppName has one or more issues"

## 3. Debug Information Files

### Implementation Location
- **File**: `sentry.properties`
- **Script**: `scripts/sentry-debug-upload.js`
- **Documentation**: [Debug Information Files](https://docs.sentry.io/platforms/react-native/data-management/debug-files/)

### Supported Debug File Formats

According to the [Sentry documentation](https://docs.sentry.io/platforms/react-native/data-management/debug-files/), we support:

- **dSYM files** for iOS, iPadOS, tvOS, watchOS, macOS, and visionOS
- **ELF symbols** for Linux and Android (NDK)
- **PDB files** for Windows and .NET
- **Breakpad symbols** for all platforms
- **WASM files** for WebAssembly
- **ProGuard mappings** for Java and Android
- **Source maps** for JavaScript/TypeScript

### Configuration Features

#### Source Maps
```properties
# === SOURCE MAPS CONFIGURATION ===
upload.sourcemaps=true
sourcemap.rewrite=true
sourcemap.stripPrefix=true
sourcemap.stripCommonPrefix=true
sourcemap.validate=true
sourcemap.url-prefix=~/
```

#### Debug Symbols
```properties
# === DEBUG SYMBOLS CONFIGURATION ===
upload.symbols=true
symbols.upload=true
symbols.include-sources=true
symbols.validate=true

# iOS specific - dSYM files
ios.upload-dsym=true
ios.dsym-path=ios/build/Build/Products/Release-iphoneos/

# Android specific - ProGuard mappings and native symbols
android.upload-proguard=true
android.upload-native-symbols=true
android.proguard-path=android/app/build/outputs/mapping/release/
```

#### Release Management
```properties
# === RELEASE MANAGEMENT ===
upload.release=true
release.finalize=true
release.deploy=true
release.set-commits=auto
release.new=true
```

#### Source Context
```properties
# === SOURCE CONTEXT ===
upload.sources=true
sources.include-paths=app/,components/,services/,hooks/,utils/,types/,constants/
sources.exclude-paths=node_modules/,dist/,build/,.expo/
```

#### Advanced Configuration
```properties
# === BUILD PROCESS INTEGRATION ===
upload.auto=true
upload.wait-for-processing=true
upload.max-wait=300

# === FILE HANDLING ===
max-file-size=40
max-archive-size=100
upload.compress=true

# === VALIDATION ===
validate.sourcemaps=true
validate.symbols=true

# === ENVIRONMENT SPECIFIC ===
[environment:development]
upload.auto=false
log.level=debug

[environment:production]
upload.auto=true
log.level=warn
upload.wait-for-processing=true
```

### Automated Upload Script

We provide a comprehensive Node.js script (`scripts/sentry-debug-upload.js`) for managing debug file uploads:

#### Features
- **Platform-specific uploads**: iOS dSYM, Android ProGuard/native symbols, Web source maps
- **Environment management**: Development, staging, production configurations
- **Validation**: Automatic validation of uploaded files
- **Release management**: Automatic release creation, finalization, and deployment
- **Cleanup**: Automatic cleanup of old releases
- **Error handling**: Comprehensive error handling and logging

#### Usage Examples
```bash
# Upload all debug files for production
npm run sentry:upload

# Upload only iOS debug symbols
npm run sentry:upload:ios

# Upload for staging environment
npm run sentry:upload:staging

# Upload for development (skip cleanup)
npm run sentry:upload:dev

# Validate uploaded files
npm run sentry:validate

# Check Sentry CLI info
npm run sentry:info

# Build and upload in one command
npm run build:release
```

#### Manual Usage
```bash
# Basic upload
node scripts/sentry-debug-upload.js

# Platform-specific upload
node scripts/sentry-debug-upload.js --platform ios --environment staging

# Skip validation and cleanup
node scripts/sentry-debug-upload.js --skip-validation --skip-cleanup

# Help
node scripts/sentry-debug-upload.js --help
```

### File Exclusion
- **File**: `.sentryignore`
- Excludes sensitive files from upload:
  - Environment files (.env)
  - Database files
  - Build artifacts
  - Development tools
  - Temporary files

### Retention Policy

According to the [Sentry documentation](https://docs.sentry.io/platforms/react-native/data-management/debug-files/), debug files have a retention period of **90 days** using a **time to idle** expiration mechanism. Files are retained as long as they're actively used for event processing.

### Benefits
1. **Better Stack Traces**: Source maps provide readable stack traces with original file names and line numbers
2. **Source Context**: View actual source code in Sentry error reports
3. **Native Crash Handling**: Debug symbols enable symbolication of native crashes
4. **Release Tracking**: Automatic release creation and deployment tracking
5. **Platform Coverage**: Support for iOS dSYM, Android ProGuard, and web source maps
6. **Automated Workflow**: Integrated build and upload process

## 4. Utility Functions

### SentryDataCollection Export
We provide a utility object for managing data collection:

```typescript
import { SentryDataCollection } from '@/services/sentry';

// Set user information
SentryDataCollection.setUser({
  id: 'user-123',
  email: 'user@example.com',
  username: 'username'
});

// Add custom context
SentryDataCollection.setContext('workout', {
  exercise: 'bench-press',
  weight: 185,
  reps: 8
});

// Capture exception with context
SentryDataCollection.captureException(error, {
  component: 'WorkoutSession',
  action: 'save-workout'
});
```

## 5. Environment Configuration

### Development vs Production
- **Development**: Full sampling (1.0) for traces and profiles
- **Production**: Reduced sampling (0.1) for performance
- **Debug Mode**: Enabled only in development

### Environment Variables
- `SENTRY_AUTH_TOKEN`: Required for uploads
- `SENTRY_DISABLE_AUTO_UPLOAD`: Set to disable automatic uploads

## 6. Compliance and Privacy

### GDPR Compliance
- Users can request data deletion through Sentry's data deletion API
- PII data is clearly marked and can be filtered
- Data retention follows Sentry's 90-day policy

### Data Minimization
- Only necessary data is collected
- Sensitive data is filtered before sending
- Screenshots and view hierarchy are optional

### User Control
- Users can opt-out of error reporting
- PII collection can be disabled per user
- Custom filtering can be implemented per user preferences

## 7. Monitoring and Maintenance

### Regular Tasks
1. **Review Data Collection**: Quarterly review of collected data types
2. **Update Privacy Manifest**: When adding new Sentry features
3. **Monitor Upload Quotas**: Track source map and symbol upload limits
4. **Review Filters**: Ensure sensitive data filtering is effective

### Troubleshooting
- Check Sentry dashboard for upload status
- Verify source maps are correctly uploaded
- Monitor error rates and data quality
- Review Apple App Store feedback for privacy compliance

## 8. Security Considerations

### Data in Transit
- All data sent over HTTPS
- Authentication tokens secured
- Rate limiting implemented

### Data at Rest
- Sentry handles data encryption
- Data retention policies enforced
- Access controls in place

### Access Control
- Sentry project access limited to team members
- API tokens with minimal required permissions
- Regular access reviews

## References

- [Sentry React Native Documentation](https://docs.sentry.io/platforms/react-native/)
- [Apple Privacy Manifest Guidelines](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files)
- [Expo Privacy Manifests](https://docs.expo.dev/guides/privacy-manifests/)
- [Sentry CLI Documentation](https://docs.sentry.io/cli/) 