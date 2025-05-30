#!/usr/bin/env node

/**
 * Sentry Debug Information Upload Script
 *
 * This script manages the upload of debug information files to Sentry
 * including source maps, debug symbols, and source context.
 *
 * Based on: https://docs.sentry.io/platforms/react-native/data-management/debug-files/
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  sentryCliPath: './node_modules/@sentry/cli/bin/sentry-cli',
  organization: 'mindmuscleai',
  project: 'mindmuscle-ai',

  // Paths
  paths: {
    sourceMaps: './dist',
    iosSymbols: './ios/build/Build/Products/Release-iphoneos',
    androidSymbols: './android/app/build/outputs/mapping/release',
    androidNativeSymbols: './android/app/build/intermediates/merged_native_libs/release/out/lib',
    sources: './app',
  },

  // File patterns
  patterns: {
    sourceMaps: '**/*.map',
    iosSymbols: '**/*.dSYM',
    androidProguard: '**/mapping.txt',
    androidNativeSymbols: '**/*.so',
    sources: '**/*.{ts,tsx,js,jsx}',
  },
};

/**
 * Execute a command and return the output
 */
function exec(command, options = {}) {
  try {
    console.log(`🔧 Executing: ${command}`);
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'inherit',
      ...options,
    });
    return output;
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Check if a file or directory exists
 */
function exists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * Get the current release version
 */
function getRelease() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    return packageJson.version || '1.0.0';
  } catch (error) {
    console.warn('⚠️  Could not read package.json, using default version');
    return '1.0.0';
  }
}

/**
 * Create a new release in Sentry
 */
function createRelease(release) {
  console.log(`📦 Creating release: ${release}`);
  exec(`${config.sentryCliPath} releases new ${release}`);

  // Set commits if in git repository
  if (exists('.git')) {
    console.log('🔗 Setting commits for release');
    exec(`${config.sentryCliPath} releases set-commits ${release} --auto`);
  }
}

/**
 * Upload source maps
 */
function uploadSourceMaps(release) {
  console.log('🗺️  Uploading source maps...');

  if (!exists(config.paths.sourceMaps)) {
    console.warn(`⚠️  Source maps directory not found: ${config.paths.sourceMaps}`);
    return;
  }

  exec(
    `${config.sentryCliPath} releases files ${release} upload-sourcemaps ${config.paths.sourceMaps} --rewrite --strip-prefix --strip-common-prefix`,
  );
}

/**
 * Upload iOS debug symbols (dSYM files)
 */
function uploadiOSSymbols(release) {
  console.log('🍎 Uploading iOS debug symbols...');

  if (!exists(config.paths.iosSymbols)) {
    console.warn(`⚠️  iOS symbols directory not found: ${config.paths.iosSymbols}`);
    return;
  }

  exec(`${config.sentryCliPath} upload-dsym ${config.paths.iosSymbols}`);
}

/**
 * Upload Android debug symbols
 */
function uploadAndroidSymbols(release) {
  console.log('🤖 Uploading Android debug symbols...');

  // Upload ProGuard mappings
  if (exists(config.paths.androidSymbols)) {
    exec(`${config.sentryCliPath} upload-proguard ${config.paths.androidSymbols}`);
  } else {
    console.warn(`⚠️  Android ProGuard mappings not found: ${config.paths.androidSymbols}`);
  }

  // Upload native symbols
  if (exists(config.paths.androidNativeSymbols)) {
    exec(`${config.sentryCliPath} debug-files upload ${config.paths.androidNativeSymbols}`);
  } else {
    console.warn(`⚠️  Android native symbols not found: ${config.paths.androidNativeSymbols}`);
  }
}

/**
 * Upload source context
 */
function uploadSources(release) {
  console.log('📄 Uploading source context...');

  if (!exists(config.paths.sources)) {
    console.warn(`⚠️  Sources directory not found: ${config.paths.sources}`);
    return;
  }

  exec(
    `${config.sentryCliPath} releases files ${release} upload ${config.paths.sources} --include-paths app/ components/ services/ hooks/ utils/ types/ constants/`,
  );
}

/**
 * Finalize the release
 */
function finalizeRelease(release) {
  console.log(`✅ Finalizing release: ${release}`);
  exec(`${config.sentryCliPath} releases finalize ${release}`);
}

/**
 * Deploy the release
 */
function deployRelease(release, environment = 'production') {
  console.log(`🚀 Deploying release ${release} to ${environment}`);
  exec(`${config.sentryCliPath} releases deploys ${release} new -e ${environment}`);
}

/**
 * Validate uploaded files
 */
function validateUploads(release) {
  console.log('🔍 Validating uploads...');

  try {
    // List uploaded files
    exec(`${config.sentryCliPath} releases files ${release} list`);

    // Validate source maps
    exec(`${config.sentryCliPath} releases files ${release} validate`);

    console.log('✅ Validation completed successfully');
  } catch (error) {
    console.warn('⚠️  Validation failed, but continuing...');
  }
}

/**
 * Clean up old releases (keep last 10)
 */
function cleanupOldReleases() {
  console.log('🧹 Cleaning up old releases...');

  try {
    exec(
      `${config.sentryCliPath} releases list --max 20 | tail -n +11 | awk '{print $1}' | xargs -I {} ${config.sentryCliPath} releases delete {}`,
    );
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.warn('⚠️  Cleanup failed, but continuing...');
  }
}

/**
 * Main upload function
 */
function uploadDebugFiles(options = {}) {
  const {
    platform = 'all', // 'ios', 'android', 'web', or 'all'
    environment = 'production',
    skipValidation = false,
    skipCleanup = false,
  } = options;

  console.log('🚀 Starting Sentry debug files upload...');
  console.log(`📱 Platform: ${platform}`);
  console.log(`🌍 Environment: ${environment}`);

  // Check if Sentry CLI is available
  if (!exists(config.sentryCliPath)) {
    console.error('❌ Sentry CLI not found. Please install @sentry/cli');
    process.exit(1);
  }

  // Check authentication
  try {
    exec(`${config.sentryCliPath} info`, { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ Sentry authentication failed. Please set SENTRY_AUTH_TOKEN');
    process.exit(1);
  }

  const release = getRelease();

  try {
    // Create release
    createRelease(release);

    // Upload based on platform
    if (platform === 'all' || platform === 'web') {
      uploadSourceMaps(release);
      uploadSources(release);
    }

    if (platform === 'all' || platform === 'ios') {
      uploadiOSSymbols(release);
    }

    if (platform === 'all' || platform === 'android') {
      uploadAndroidSymbols(release);
    }

    // Validate uploads
    if (!skipValidation) {
      validateUploads(release);
    }

    // Finalize and deploy
    finalizeRelease(release);
    deployRelease(release, environment);

    // Cleanup old releases
    if (!skipCleanup) {
      cleanupOldReleases();
    }

    console.log('🎉 Debug files upload completed successfully!');
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--platform':
        options.platform = args[++i];
        break;
      case '--environment':
        options.environment = args[++i];
        break;
      case '--skip-validation':
        options.skipValidation = true;
        break;
      case '--skip-cleanup':
        options.skipCleanup = true;
        break;
      case '--help':
        console.log(`
Sentry Debug Files Upload Script

Usage: node scripts/sentry-debug-upload.js [options]

Options:
  --platform <platform>     Platform to upload for (ios|android|web|all) [default: all]
  --environment <env>       Environment to deploy to [default: production]
  --skip-validation         Skip validation of uploaded files
  --skip-cleanup           Skip cleanup of old releases
  --help                   Show this help message

Examples:
  node scripts/sentry-debug-upload.js
  node scripts/sentry-debug-upload.js --platform ios --environment staging
  node scripts/sentry-debug-upload.js --skip-validation --skip-cleanup
        `);
        process.exit(0);
        break;
    }
  }

  uploadDebugFiles(options);
}

module.exports = { uploadDebugFiles, config };
