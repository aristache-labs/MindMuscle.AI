# Sentry Release Management Script (PowerShell)
# This script automates the creation and finalization of Sentry releases

param(
    [switch]$Help
)

if ($Help) {
    Write-Host "Sentry Release Management Script" -ForegroundColor Cyan
    Write-Host "Usage: .\sentry-release.ps1" -ForegroundColor White
    Write-Host "This script will create, set commits, and finalize a Sentry release" -ForegroundColor White
    exit 0
}

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Setup configuration values from sentry.properties
$env:SENTRY_AUTH_TOKEN = "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"
$env:SENTRY_ORG = "testmind-zb"
$env:SENTRY_PROJECT = "testreact"

# Check if sentry-cli is available
try {
    $null = Get-Command sentry-cli -ErrorAction Stop
} catch {
    Write-Error "sentry-cli is not installed or not in PATH"
    Write-Status "Install it with: npm install -g @sentry/cli"
    exit 1
}

Write-Status "Starting Sentry release workflow..."
Write-Status "Organization: $env:SENTRY_ORG"
Write-Status "Project: $env:SENTRY_PROJECT"

try {
    # Propose a version
    Write-Status "Proposing version..."
    $VERSION = & sentry-cli releases propose-version
    
    if (-not $VERSION) {
        Write-Error "Failed to propose version"
        exit 1
    }
    
    Write-Success "Proposed version: $VERSION"
    
    # Create new release
    Write-Status "Creating new release: $VERSION"
    & sentry-cli releases new $VERSION
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create release $VERSION"
        exit 1
    }
    Write-Success "Release $VERSION created successfully"
    
    # Set commits automatically
    Write-Status "Setting commits for release $VERSION"
    & sentry-cli releases set-commits $VERSION --auto
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Commits set successfully for release $VERSION"
    } else {
        Write-Warning "Failed to set commits automatically (this might be expected if no git repo or commits)"
    }
    
    # Finalize release
    Write-Status "Finalizing release $VERSION"
    & sentry-cli releases finalize $VERSION
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to finalize release $VERSION"
        exit 1
    }
    Write-Success "Release $VERSION finalized successfully"
    
    Write-Success "Sentry release workflow completed successfully!"
    Write-Status "Release $VERSION is now live and ready to receive events"
    Write-Status "You can view it at: https://sentry.io/organizations/$env:SENTRY_ORG/releases/"
    
    # Optional: Deploy to environment (uncomment if needed)
    # Write-Status "Deploying release to production environment..."
    # & sentry-cli releases deploys $VERSION new -e production
    
    Write-Host ""
    Write-Status "Next steps:"
    Write-Host "  1. Deploy your application with this version" -ForegroundColor White
    Write-Host "  2. Monitor the release in your Sentry dashboard" -ForegroundColor White
    Write-Host "  3. Check for any new issues or performance regressions" -ForegroundColor White
    
} catch {
    Write-Error "An error occurred: $($_.Exception.Message)"
    exit 1
} 