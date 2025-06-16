#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Sync version from package.json to app.json
 * This ensures both files have the same version number
 */
function syncVersion() {
  try {
    // Read package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version;

    console.log(`📦 Current package.json version: ${version}`);

    // Read app.json
    const appJsonPath = path.join(process.cwd(), 'app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

    // Update app.json version
    const oldVersion = appJson.expo.version;
    appJson.expo.version = version;

    // Write updated app.json
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

    console.log(`📱 Updated app.json version: ${oldVersion} → ${version}`);
    console.log('✅ Version sync completed successfully!');

    return true;
  } catch (error) {
    console.error('❌ Error syncing version:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  syncVersion();
}

module.exports = { syncVersion };
