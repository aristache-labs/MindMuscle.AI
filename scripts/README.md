# Sentry Release Scripts

This directory contains scripts to automate Sentry release management for the MindMuscle.AI project.

## Available Scripts

### 1. Bash Script (Linux/macOS)

- **File**: `sentry-release.sh`
- **Usage**: `npm run sentry:release`
- **Direct usage**: `bash scripts/sentry-release.sh`

### 2. PowerShell Script (Windows)

- **File**: `sentry-release.ps1`
- **Usage**: `npm run sentry:release:win`
- **Direct usage**: `powershell -ExecutionPolicy Bypass -File scripts/sentry-release.ps1`

## What These Scripts Do

The scripts automate the following Sentry release workflow:

1. **Propose Version**: Automatically generates a version number based on your git commits
2. **Create Release**: Creates a new release in Sentry with the proposed version
3. **Set Commits**: Associates git commits with the release for better tracking
4. **Finalize Release**: Marks the release as finalized and ready to receive events

## Configuration

The scripts use the following configuration from your `sentry.properties` file:

```bash
SENTRY_AUTH_TOKEN=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
SENTRY_ORG=testmind-zb
SENTRY_PROJECT=testreact
```

## Prerequisites

1. **Sentry CLI**: Install the Sentry CLI globally

   ```bash
   npm install -g @sentry/cli
   ```

2. **Git Repository**: The scripts work best when run from a git repository with commits

3. **Authentication**: The auth token is already configured in the scripts

## Usage Examples

### Create a new release (Linux/macOS)

```bash
npm run sentry:release
```

### Create a new release (Windows)

```bash
npm run sentry:release:win
```

### Manual execution

```bash
# Linux/macOS
bash scripts/sentry-release.sh

# Windows
powershell -ExecutionPolicy Bypass -File scripts/sentry-release.ps1
```

## Script Features

- ✅ **Error Handling**: Scripts exit on errors and provide clear error messages
- ✅ **Colored Output**: Status messages are color-coded for better readability
- ✅ **Validation**: Checks for required tools and dependencies
- ✅ **Cross-Platform**: Separate scripts for Unix-like systems and Windows
- ✅ **Automated Workflow**: Complete release process in one command

## Output Example

```
[INFO] Starting Sentry release workflow...
[INFO] Organization: testmind-zb
[INFO] Project: testreact
[INFO] Proposing version...
[SUCCESS] Proposed version: 1.0.2-abc123
[INFO] Creating new release: 1.0.2-abc123
[SUCCESS] Release 1.0.2-abc123 created successfully
[INFO] Setting commits for release 1.0.2-abc123
[SUCCESS] Commits set successfully for release 1.0.2-abc123
[INFO] Finalizing release 1.0.2-abc123
[SUCCESS] Release 1.0.2-abc123 finalized successfully
[SUCCESS] Sentry release workflow completed successfully!
[INFO] Release 1.0.2-abc123 is now live and ready to receive events
[INFO] You can view it at: https://sentry.io/organizations/testmind-zb/releases/
```

## Troubleshooting

### Common Issues

1. **"sentry-cli not found"**

   - Install Sentry CLI: `npm install -g @sentry/cli`

2. **"Failed to set commits automatically"**

   - This is normal if you're not in a git repository or have no commits
   - The script will continue and still create a valid release

3. **Permission denied (Linux/macOS)**

   - Make the script executable: `chmod +x scripts/sentry-release.sh`

4. **PowerShell execution policy error (Windows)**
   - The npm script includes the bypass flag, but you can also run:
   - `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### Getting Help

- Run with help flag: `powershell scripts/sentry-release.ps1 -Help` (Windows only)
- Check Sentry CLI documentation: https://docs.sentry.io/cli/
- View releases in Sentry dashboard: https://sentry.io/organizations/testmind-zb/releases/

## Integration with Build Process

You can integrate these scripts into your CI/CD pipeline or build process:

```bash
# Example: Create release before deployment
npm run sentry:release
npm run build:release
```

## Next Steps After Running

1. Deploy your application with the new version
2. Monitor the release in your Sentry dashboard
3. Check for any new issues or performance regressions
4. Set up alerts for the new release if needed
