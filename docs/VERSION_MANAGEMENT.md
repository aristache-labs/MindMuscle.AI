# Version Management Guide

This guide explains how to manage app versions dynamically for different build types in the MindMuscle.AI project.

## 📋 Overview

We have implemented a comprehensive version management system that supports:
- Automatic version syncing between `package.json` and `app.json`
- Different versioning strategies for different build environments
- EAS Build auto-increment for build numbers
- Manual version control with npm scripts

## 🚀 Quick Start

### Check Current Version Status
```bash
npm run version:status
```

### Bump Version (Patch)
```bash
npm run version:patch  # 1.0.4 → 1.0.5
```

### Build TestFlight (Auto-increment)
```bash
npm run build:testflight  # Bumps patch version + builds
```

## 📊 Version Management Strategies

### 1. EAS Auto-Increment (Recommended for Builds)

We've configured `eas.json` with automatic build number incrementation:

```json
{
  "ios": {
    "autoIncrement": "buildNumber"  // iOS build number
  },
  "android": {
    "autoIncrement": "versionCode"  // Android version code
  }
}
```

**Benefits:**
- ✅ Automatic increment on each build
- ✅ No manual intervention needed
- ✅ Prevents version conflicts in App Store

### 2. Manual Version Control

Use our npm scripts for precise version control:

```bash
# Increment versions
npm run version:patch   # 1.0.4 → 1.0.5
npm run version:minor   # 1.0.4 → 1.1.0
npm run version:major   # 1.0.4 → 2.0.0

# Set specific version
npm run version:set 1.2.3

# Sync versions between files
npm run version:sync

# Check status
npm run version:status
```

### 3. Advanced Version Manager

Our custom `scripts/version-manager.js` provides advanced features:

```bash
# Direct usage
node scripts/version-manager.js bump patch
node scripts/version-manager.js set 1.5.0
node scripts/version-manager.js sync
node scripts/version-manager.js status
```

## 🏗️ Build Commands

### Recommended Build Workflow

1. **TestFlight Builds** (Auto-increment patch):
   ```bash
   npm run build:testflight
   ```

2. **Production Builds** (Sync existing version):
   ```bash
   npm run build:production
   ```

3. **Preview Builds** (Internal testing):
   ```bash
   npm run build:preview
   ```

4. **Development Builds**:
   ```bash
   npm run build:dev
   ```

### Manual EAS Commands

For more control, use EAS directly:

```bash
# TestFlight with auto-increment
eas build --platform ios --profile testflight

# Production for both platforms
eas build --platform all --profile production

# Preview build
eas build --platform all --profile preview
```

## 📁 File Structure

Our version management affects these files:

- `package.json` - Source of truth for version
- `app.json` - Expo configuration (synced from package.json)
- `eas.json` - Build configuration with auto-increment
- `scripts/version-manager.js` - Advanced version management
- `scripts/sync-version.js` - Simple sync utility

## 🔧 Configuration Details

### EAS Build Profiles

Each profile in `eas.json` has specific versioning behavior:

```json
{
  "testflight": {
    "ios": {
      "autoIncrement": "buildNumber"  // Auto-increment build number
    }
  },
  "production": {
    "ios": {
      "autoIncrement": "buildNumber"  // Auto-increment build number
    },
    "android": {
      "autoIncrement": "versionCode"  // Auto-increment version code
    }
  }
}
```

### Version Format

- **App Version**: `1.0.4` (major.minor.patch)
- **iOS Build Number**: Auto-incremented by EAS
- **Android Version Code**: Auto-incremented by EAS

## 🎯 Best Practices

### For Development
- Use `npm run build:dev` for development builds
- Version stays the same, build numbers increment

### For Testing (TestFlight/Internal)
- Use `npm run build:testflight` or `npm run build:preview`
- Automatically bumps patch version
- Build numbers auto-increment

### For Production
- Use `npm run version:minor` or `npm run version:major` first
- Then use `npm run build:production`
- Syncs existing version to both files

### Version Naming Convention

- **Major (1.x.x)**: Breaking changes, major features
- **Minor (x.1.x)**: New features, significant updates
- **Patch (x.x.1)**: Bug fixes, small improvements

## 🛠️ Troubleshooting

### Version Mismatch
If versions are out of sync:
```bash
npm run version:sync
```

### Check Status
Always verify versions before building:
```bash
npm run version:status
```

### Manual Fix
If you need to manually set a specific version:
```bash
npm run version:set 1.2.3
```

## 📚 Examples

### Scenario 1: TestFlight Release
```bash
# Current version: 1.0.4
npm run build:testflight
# Result: Version 1.0.5, builds for TestFlight
```

### Scenario 2: Minor Feature Release
```bash
# Current version: 1.0.4
npm run version:minor
# Result: Version 1.1.0
npm run build:production
# Builds production version 1.1.0
```

### Scenario 3: Hotfix
```bash
# Current version: 1.1.0
npm run version:patch
# Result: Version 1.1.1
npm run build:production
# Builds hotfix version 1.1.1
```

## 🚨 Important Notes

1. **EAS auto-increment** only affects build numbers, not app version
2. **App version** must be incremented manually for App Store releases
3. **TestFlight** builds should have clean version numbers (no suffixes)
4. **Always sync** versions before building for production
5. **Build numbers** are handled automatically by EAS

## 🔗 Related Scripts

All version management scripts are in `package.json`:

- `version:patch` - Increment patch version
- `version:minor` - Increment minor version  
- `version:major` - Increment major version
- `version:sync` - Sync versions between files
- `version:status` - Check version status
- `version:set` - Set specific version
- `build:testflight` - Build TestFlight with auto-increment
- `build:production` - Build production with sync
- `build:preview` - Build preview/internal
- `build:dev` - Build development 