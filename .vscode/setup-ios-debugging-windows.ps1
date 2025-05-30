# iOS Debugging Setup for Windows
# This script helps set up the necessary tools for iOS debugging on Windows

param(
    [switch]$InstallChocolatey,
    [switch]$InstallNodeTools,
    [switch]$InstallVSCodeExtensions,
    [switch]$ConfigureFirewall,
    [switch]$All
)

Write-Host "🍎 iOS Debugging Setup for Windows" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Function to check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Function to install Chocolatey
function Install-Chocolatey {
    Write-Host "📦 Installing Chocolatey..." -ForegroundColor Yellow
    
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Host "✅ Chocolatey is already installed" -ForegroundColor Green
        return
    }
    
    try {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        Write-Host "✅ Chocolatey installed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Failed to install Chocolatey: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to install Node.js tools
function Install-NodeTools {
    Write-Host "🟢 Installing Node.js tools..." -ForegroundColor Yellow
    
    # Check if Node.js is installed
    if (Get-Command node -ErrorAction SilentlyContinue) {
        Write-Host "✅ Node.js is already installed: $(node --version)" -ForegroundColor Green
    } else {
        Write-Host "📦 Installing Node.js via Chocolatey..." -ForegroundColor Yellow
        choco install nodejs -y
    }
    
    # Install global packages
    $packages = @(
        "@expo/cli",
        "react-native-cli",
        "@react-native-community/cli",
        "flipper-server"
    )
    
    foreach ($package in $packages) {
        Write-Host "📦 Installing $package..." -ForegroundColor Yellow
        try {
            npm install -g $package
            Write-Host "✅ $package installed successfully" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ Failed to install $package" -ForegroundColor Red
        }
    }
}

# Function to install VS Code extensions
function Install-VSCodeExtensions {
    Write-Host "🔧 Installing VS Code extensions..." -ForegroundColor Yellow
    
    if (-not (Get-Command code -ErrorAction SilentlyContinue)) {
        Write-Host "❌ VS Code is not installed or not in PATH" -ForegroundColor Red
        Write-Host "Please install VS Code first: https://code.visualstudio.com/" -ForegroundColor Yellow
        return
    }
    
    $extensions = @(
        "ms-vscode.vscode-react-native",
        "ms-vscode-remote.remote-ssh",
        "esbenp.prettier-vscode",
        "eamodio.gitlens",
        "ms-vscode.vscode-json",
        "bradlc.vscode-tailwindcss",
        "formulahendry.auto-rename-tag",
        "christian-kohler.path-intellisense"
    )
    
    foreach ($extension in $extensions) {
        Write-Host "🔧 Installing $extension..." -ForegroundColor Yellow
        try {
            code --install-extension $extension --force
            Write-Host "✅ $extension installed successfully" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ Failed to install $extension" -ForegroundColor Red
        }
    }
}

# Function to configure Windows Firewall
function Configure-Firewall {
    Write-Host "🔥 Configuring Windows Firewall..." -ForegroundColor Yellow
    
    if (-not (Test-Administrator)) {
        Write-Host "❌ Administrator privileges required for firewall configuration" -ForegroundColor Red
        return
    }
    
    try {
        # Allow Node.js through firewall
        New-NetFirewallRule -DisplayName "Node.js Metro Bundler" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -ErrorAction SilentlyContinue
        New-NetFirewallRule -DisplayName "Node.js Metro Bundler Outbound" -Direction Outbound -Protocol TCP -LocalPort 8081 -Action Allow -ErrorAction SilentlyContinue
        
        # Allow Expo CLI
        New-NetFirewallRule -DisplayName "Expo CLI" -Direction Inbound -Protocol TCP -LocalPort 19000-19006 -Action Allow -ErrorAction SilentlyContinue
        New-NetFirewallRule -DisplayName "Expo CLI Outbound" -Direction Outbound -Protocol TCP -LocalPort 19000-19006 -Action Allow -ErrorAction SilentlyContinue
        
        Write-Host "✅ Firewall rules configured successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Failed to configure firewall: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to install alternative iOS tools
function Install-AlternativeTools {
    Write-Host "🛠️ Installing alternative iOS tools..." -ForegroundColor Yellow
    
    # Install iTunes (if not already installed)
    if (-not (Get-AppxPackage -Name "AppleInc.iTunes" -ErrorAction SilentlyContinue)) {
        Write-Host "📦 Installing iTunes..." -ForegroundColor Yellow
        try {
            choco install itunes -y
            Write-Host "✅ iTunes installed successfully" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ Failed to install iTunes. Please install manually from Microsoft Store" -ForegroundColor Red
        }
    } else {
        Write-Host "✅ iTunes is already installed" -ForegroundColor Green
    }
    
    # Note about 3uTools
    Write-Host "📝 Note: Consider installing 3uTools manually from https://www.3u.com/" -ForegroundColor Yellow
}

# Function to check system requirements
function Test-SystemRequirements {
    Write-Host "🔍 Checking system requirements..." -ForegroundColor Yellow
    
    # Check Windows version
    $osVersion = [System.Environment]::OSVersion.Version
    if ($osVersion.Major -ge 10) {
        Write-Host "✅ Windows version: $($osVersion) (Compatible)" -ForegroundColor Green
    } else {
        Write-Host "❌ Windows version: $($osVersion) (May have compatibility issues)" -ForegroundColor Red
    }
    
    # Check PowerShell version
    $psVersion = $PSVersionTable.PSVersion
    if ($psVersion.Major -ge 5) {
        Write-Host "✅ PowerShell version: $($psVersion) (Compatible)" -ForegroundColor Green
    } else {
        Write-Host "❌ PowerShell version: $($psVersion) (Please update)" -ForegroundColor Red
    }
    
    # Check available disk space
    $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 2)
    if ($freeSpaceGB -gt 5) {
        Write-Host "✅ Free disk space: $freeSpaceGB GB (Sufficient)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Free disk space: $freeSpaceGB GB (Low)" -ForegroundColor Yellow
    }
}

# Function to create development environment info
function Show-DevelopmentInfo {
    Write-Host "`n📋 Development Environment Information" -ForegroundColor Cyan
    Write-Host "=====================================" -ForegroundColor Cyan
    
    # Node.js version
    if (Get-Command node -ErrorAction SilentlyContinue) {
        Write-Host "Node.js: $(node --version)" -ForegroundColor White
    } else {
        Write-Host "Node.js: Not installed" -ForegroundColor Red
    }
    
    # npm version
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        Write-Host "npm: $(npm --version)" -ForegroundColor White
    } else {
        Write-Host "npm: Not installed" -ForegroundColor Red
    }
    
    # Expo CLI
    if (Get-Command expo -ErrorAction SilentlyContinue) {
        Write-Host "Expo CLI: $(expo --version)" -ForegroundColor White
    } else {
        Write-Host "Expo CLI: Not installed" -ForegroundColor Red
    }
    
    # React Native CLI
    if (Get-Command react-native -ErrorAction SilentlyContinue) {
        Write-Host "React Native CLI: Installed" -ForegroundColor White
    } else {
        Write-Host "React Native CLI: Not installed" -ForegroundColor Red
    }
    
    # VS Code
    if (Get-Command code -ErrorAction SilentlyContinue) {
        Write-Host "VS Code: Installed" -ForegroundColor White
    } else {
        Write-Host "VS Code: Not installed" -ForegroundColor Red
    }
    
    # Get local IP address
    try {
        $ipAddress = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*" | Where-Object { $_.IPAddress -notlike "169.254.*" }).IPAddress
        if ($ipAddress) {
            Write-Host "Local IP Address: $ipAddress" -ForegroundColor White
            Write-Host "Use this IP for network debugging from iOS devices" -ForegroundColor Yellow
        } else {
            # Try alternative method for getting IP
            $ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" }).IPAddress | Select-Object -First 1
            if ($ipAddress) {
                Write-Host "Local IP Address: $ipAddress" -ForegroundColor White
                Write-Host "Use this IP for network debugging from iOS devices" -ForegroundColor Yellow
            } else {
                Write-Host "⚠️ Could not determine local IP address" -ForegroundColor Yellow
            }
        }
    }
    catch {
        Write-Host "⚠️ Could not determine local IP address" -ForegroundColor Yellow
    }
}

# Main execution
Write-Host "`n🔍 Checking system requirements..." -ForegroundColor Cyan
Test-SystemRequirements

if ($All -or $InstallChocolatey) {
    Install-Chocolatey
}

if ($All -or $InstallNodeTools) {
    Install-NodeTools
}

if ($All -or $InstallVSCodeExtensions) {
    Install-VSCodeExtensions
}

if ($All -or $ConfigureFirewall) {  
    Configure-Firewall
}

if ($All) {
    Install-AlternativeTools
}

Show-DevelopmentInfo

Write-Host "`n🎉 Setup completed!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart your terminal/VS Code" -ForegroundColor White
Write-Host "2. Connect your iOS device to the same network" -ForegroundColor White
Write-Host "3. Use the debugging configurations in VS Code" -ForegroundColor White
Write-Host "4. Reference the VS Code launch configurations for iOS debugging" -ForegroundColor White

# Usage examples
Write-Host "`n📖 Usage Examples:" -ForegroundColor Cyan
Write-Host "# Install everything:" -ForegroundColor White
Write-Host ".\setup-ios-debugging-windows.ps1 -All" -ForegroundColor Gray
Write-Host "`n# Install specific components:" -ForegroundColor White
Write-Host ".\setup-ios-debugging-windows.ps1 -InstallNodeTools -InstallVSCodeExtensions" -ForegroundColor Gray
Write-Host "`n# Configure firewall only (requires admin):" -ForegroundColor White
Write-Host ".\setup-ios-debugging-windows.ps1 -ConfigureFirewall" -ForegroundColor Gray
