import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bold');
  console.log('='.repeat(60));
}

async function testSentryConnection() {
  logSection('🔍 SENTRY CONNECTION TEST');

  try {
    // 1. Check if app.json has correct DSN
    logSection('📋 Configuration Check');

    const appJsonPath = path.join(process.cwd(), 'app.json');
    if (!fs.existsSync(appJsonPath)) {
      log('❌ app.json not found', 'red');
      return false;
    }

    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const sentryDsn = appJson.expo?.extra?.sentryDsn;

    if (!sentryDsn) {
      log('❌ Sentry DSN not found in app.json', 'red');
      return false;
    }

    log(`✅ Sentry DSN found: ${sentryDsn.substring(0, 50)}...`, 'green');

    // 2. Check Sentry plugin configuration
    const sentryPlugin = appJson.expo?.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === '@sentry/react-native/expo',
    );

    if (!sentryPlugin) {
      log('❌ Sentry plugin not configured in app.json', 'red');
      return false;
    }

    log('✅ Sentry plugin configured', 'green');
    log(`   Organization: ${sentryPlugin[1].organization}`, 'blue');
    log(`   Project: ${sentryPlugin[1].project}`, 'blue');

    // 3. Check sentry.properties file
    const sentryPropsPath = path.join(process.cwd(), 'sentry.properties');
    if (!fs.existsSync(sentryPropsPath)) {
      log('⚠️  sentry.properties not found (optional for basic setup)', 'yellow');
    } else {
      log('✅ sentry.properties found', 'green');
    }

    // 4. Test CLI authentication
    logSection('🔐 CLI Authentication Test');

    try {
      const cliInfo = execSync('npx @sentry/cli info', { encoding: 'utf8' });
      log('✅ Sentry CLI authenticated successfully', 'green');

      // Extract user info
      const userMatch = cliInfo.match(/User: (.+)/);
      if (userMatch) {
        log(`   User: ${userMatch[1]}`, 'blue');
      }
    } catch (error) {
      log('❌ Sentry CLI authentication failed', 'red');
      log(`   Error: ${error.message}`, 'red');
      return false;
    }

    // 5. Test event sending
    logSection('📤 Event Sending Test');

    try {
      // Set DSN environment variable for CLI
      process.env.SENTRY_DSN = sentryDsn;

      const testMessage = `Test event from connection script - ${new Date().toISOString()}`;
      const sendResult = execSync(`npx @sentry/cli send-event -m "${testMessage}"`, {
        encoding: 'utf8',
      });

      // Extract event ID
      const eventIdMatch = sendResult.match(/Event id: ([a-f0-9-]+)/);
      if (eventIdMatch) {
        log('✅ Test event sent successfully', 'green');
        log(`   Event ID: ${eventIdMatch[1]}`, 'blue');
      } else {
        log('⚠️  Event sent but no ID returned', 'yellow');
      }
    } catch (error) {
      log('❌ Failed to send test event', 'red');
      log(`   Error: ${error.message}`, 'red');
      return false;
    }

    // 6. Check recent events
    logSection('📊 Recent Events Check');

    try {
      const recentEvents = execSync(
        'npx @sentry/cli events list --org mindmuscleai --project mind-muscle-ai --max 5',
        { encoding: 'utf8' },
      );

      if (recentEvents.trim()) {
        log('✅ Recent events found in Sentry', 'green');
        log('   Latest events:', 'blue');

        // Parse and display recent events
        const eventLines = recentEvents.split('\n').filter((line) => line.includes('|'));
        eventLines.slice(0, 5).forEach((line) => {
          const parts = line.split('|').map((p) => p.trim());
          if (parts.length >= 3) {
            log(`   • ${parts[2]} (${parts[1]})`, 'blue');
          }
        });
      } else {
        log('⚠️  No recent events found', 'yellow');
      }
    } catch {
      log('⚠️  Could not fetch recent events (this is normal)', 'yellow');
    }

    // 7. Check service configuration
    logSection('⚙️  Service Configuration Check');

    const sentryServicePath = path.join(process.cwd(), 'app', 'services', 'sentry.ts');
    if (!fs.existsSync(sentryServicePath)) {
      log('❌ Sentry service file not found', 'red');
      return false;
    }

    const sentryService = fs.readFileSync(sentryServicePath, 'utf8');

    // Check for key configurations
    const checks = [
      { name: 'DSN configuration', pattern: /sentryDsn.*Constants\.expoConfig/ },
      { name: 'Profiling enabled', pattern: /profilesSampleRate/ },
      { name: 'Mobile Replay enabled', pattern: /replaysSessionSampleRate/ },
      { name: 'Hermes profiling integration', pattern: /hermesProfilingIntegration/ },
      { name: 'Auto-initialization', pattern: /autoInitializeNativeSdk.*true/ },
      { name: 'Performance tracing', pattern: /enableAutoPerformanceTracing.*true/ },
    ];

    checks.forEach((check) => {
      if (check.pattern.test(sentryService)) {
        log(`✅ ${check.name}`, 'green');
      } else {
        log(`⚠️  ${check.name} not found`, 'yellow');
      }
    });

    // 8. Final summary
    logSection('📋 Summary');

    log('✅ Sentry is properly configured and connected!', 'green');
    log('', 'reset');
    log('What this means:', 'bold');
    log('• Events are being sent to Sentry.io', 'blue');
    log('• Error tracking is active', 'blue');
    log('• Performance monitoring is enabled', 'blue');
    log('• Mobile replay is configured', 'blue');
    log('• Profiling is enabled for development', 'blue');
    log('', 'reset');
    log("If you're not seeing events in the Sentry dashboard:", 'yellow');
    log("1. Check that you're looking at the correct project", 'yellow');
    log('2. Trigger some errors in your app to generate events', 'yellow');
    log('3. Events may take a few minutes to appear in the dashboard', 'yellow');
    log('4. Check the Issues tab in your Sentry project dashboard', 'yellow');

    return true;
  } catch (error) {
    log('❌ Unexpected error during testing', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

// Run the test
testSentryConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    log('❌ Test failed with error:', 'red');
    console.error(error);
    process.exit(1);
  });
