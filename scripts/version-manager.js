#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Advanced version manager for different build types
 * Usage: node scripts/version-manager.js [action] [type]
 *
 * Actions: bump, set, sync
 * Types: patch, minor, major, prerelease
 */

class VersionManager {
  constructor() {
    this.packageJsonPath = path.join(process.cwd(), 'package.json');
    this.appJsonPath = path.join(process.cwd(), 'app.json');
  }

  readPackageJson() {
    return JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
  }

  readAppJson() {
    return JSON.parse(fs.readFileSync(this.appJsonPath, 'utf8'));
  }

  writePackageJson(packageJson) {
    fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  writeAppJson(appJson) {
    fs.writeFileSync(this.appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
  }

  parseVersion(version) {
    const parts = version.split('.');
    return {
      major: parseInt(parts[0]) || 0,
      minor: parseInt(parts[1]) || 0,
      patch: parseInt(parts[2]) || 0,
    };
  }

  formatVersion(major, minor, patch) {
    return `${major}.${minor}.${patch}`;
  }

  bumpVersion(currentVersion, type) {
    const { major, minor, patch } = this.parseVersion(currentVersion);

    switch (type) {
      case 'major':
        return this.formatVersion(major + 1, 0, 0);
      case 'minor':
        return this.formatVersion(major, minor + 1, 0);
      case 'patch':
        return this.formatVersion(major, minor, patch + 1);
      case 'prerelease':
        return this.formatVersion(major, minor, patch + 1);
      default:
        throw new Error(`Unknown version type: ${type}`);
    }
  }

  generateBuildVersion(baseVersion, buildType) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '');

    switch (buildType) {
      case 'development':
        return `${baseVersion}-dev.${timestamp}`;
      case 'preview':
        return `${baseVersion}-preview.${timestamp}`;
      case 'testflight':
        return baseVersion; // Keep clean for TestFlight
      case 'production':
        return baseVersion; // Keep clean for production
      default:
        return baseVersion;
    }
  }

  bump(type = 'patch') {
    console.log(`🚀 Bumping ${type} version...`);

    const packageJson = this.readPackageJson();
    const currentVersion = packageJson.version;
    const newVersion = this.bumpVersion(currentVersion, type);

    // Update package.json
    packageJson.version = newVersion;
    this.writePackageJson(packageJson);

    // Update app.json
    const appJson = this.readAppJson();
    appJson.expo.version = newVersion;
    this.writeAppJson(appJson);

    console.log(`📦 Version updated: ${currentVersion} → ${newVersion}`);
    return newVersion;
  }

  sync() {
    console.log('🔄 Syncing versions...');

    const packageJson = this.readPackageJson();
    const appJson = this.readAppJson();

    const packageVersion = packageJson.version;
    const appVersion = appJson.expo.version;

    if (packageVersion !== appVersion) {
      appJson.expo.version = packageVersion;
      this.writeAppJson(appJson);
      console.log(`📱 Synced app.json: ${appVersion} → ${packageVersion}`);
    } else {
      console.log('✅ Versions already in sync');
    }

    return packageVersion;
  }

  set(version) {
    console.log(`📝 Setting version to ${version}...`);

    // Update package.json
    const packageJson = this.readPackageJson();
    const oldVersion = packageJson.version;
    packageJson.version = version;
    this.writePackageJson(packageJson);

    // Update app.json
    const appJson = this.readAppJson();
    appJson.expo.version = version;
    this.writeAppJson(appJson);

    console.log(`📦 Version set: ${oldVersion} → ${version}`);
    return version;
  }

  getBuildVersion(buildType) {
    const packageJson = this.readPackageJson();
    const baseVersion = packageJson.version;
    return this.generateBuildVersion(baseVersion, buildType);
  }

  status() {
    const packageJson = this.readPackageJson();
    const appJson = this.readAppJson();

    console.log('📊 Version Status:');
    console.log(`   package.json: ${packageJson.version}`);
    console.log(`   app.json:     ${appJson.expo.version}`);
    console.log(`   Expo SDK:     ${appJson.expo.sdkVersion || 'Not specified'}`);

    if (packageJson.version !== appJson.expo.version) {
      console.log('⚠️  Versions are out of sync!');
      return false;
    } else {
      console.log('✅ Versions are in sync');
      return true;
    }
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  const action = args[0] || 'status';
  const type = args[1] || 'patch';

  const versionManager = new VersionManager();

  try {
    switch (action) {
      case 'bump':
        versionManager.bump(type);
        break;
      case 'set':
        if (!args[1]) {
          console.error('❌ Please provide a version number');
          process.exit(1);
        }
        versionManager.set(args[1]);
        break;
      case 'sync':
        versionManager.sync();
        break;
      case 'status':
        versionManager.status();
        break;
      case 'build-version': {
        const buildVersion = versionManager.getBuildVersion(type);
        console.log(buildVersion);
        break;
      }
      default:
        console.log('Usage: node scripts/version-manager.js [action] [type]');
        console.log('Actions: bump, set, sync, status, build-version');
        console.log('Types: patch, minor, major, prerelease');
        console.log('Build Types: development, preview, testflight, production');
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = VersionManager;
