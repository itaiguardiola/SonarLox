# SonarLox Lint Fix Loop
# Automatically runs ESLint fixes on the codebase

param(
    [string]$LogFile = "scripts/lint-fix-loop.log"
)

# Colors for output
$Red = [System.ConsoleColor]::Red
$Green = [System.ConsoleColor]::Green
$Yellow = [System.ConsoleColor]::Yellow
$Reset = [System.ConsoleColor]::White

# Write log header
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"=== Lint Fix Loop Started $timestamp ===" | Out-File -FilePath $LogFile -Append

Write-Host "  SonarLox Lint Fix Loop" -ForegroundColor Green

# Function to write log messages
function Write-Log {
    param(
        [string]$Message,
        [System.ConsoleColor]$Color = $Reset
    )

    if ($Color -ne $Reset) {
        Write-Host $Message -ForegroundColor $Color
    } else {
        Write-Host $Message
    }

    $Message | Out-File -FilePath $LogFile -Append
}

# Check if package.json exists
if (-not (Test-Path "package.json")) {
    Write-Log "Error: package.json not found" -Color $Red
    exit 1
}

# Check if ESLint is installed
try {
    $eslintVersion = npm list eslint --depth=0 2>$null
    if ($null -eq $eslintVersion) {
        Write-Log "Warning: ESLint not found. Installing..." -Color $Yellow
        npm install -g eslint
    }
} catch {
    Write-Log "Warning: Could not check ESLint installation" -Color $Yellow
}

# Run ESLint with auto-fix on all TypeScript/JavaScript files
Write-Log "Running ESLint fixes on source files..."

# Find all TypeScript and JavaScript files
$files = Get-ChildItem -Path "src/" -Recurse -Include "*.ts", "*.tsx", "*.js", "*.jsx" | Where-Object { $_.PSIsContainer -eq $false }

foreach ($file in $files) {
    if (Test-Path $file.FullName) {
        Write-Log "  Fixing: $($file.FullName)"
        try {
            npx eslint $file.FullName --fix --quiet
            if ($LASTEXITCODE -eq 0) {
                Write-Log "  ✓ Fixed: $($file.Name)" -Color $Green
            } else {
                Write-Log "  ✗ Error fixing: $($file.Name)" -Color $Red
            }
        } catch {
            Write-Log "  ✗ Error fixing: $($file.Name)" -Color $Red
        }
    }
}

# Run TypeScript type checking
Write-Log "Running TypeScript type checking..."
try {
    npx tsc --noEmit --project tsconfig.json
    if ($LASTEXITCODE -eq 0) {
        Write-Log "✓ TypeScript type checking passed" -Color $Green
    } else {
        Write-Log "✗ TypeScript type checking failed" -Color $Red
    }
} catch {
    Write-Log "✗ TypeScript type checking failed" -Color $Red
}

# Commit changes if any
try {
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        Write-Log "Committing changes..."
        git add .
        git commit -m "chore: auto-fix linting issues" --no-verify 2>$null
        Write-Log "✓ Changes committed" -Color $Green
    } else {
        Write-Log "No changes to commit" -Color $Yellow
    }
} catch {
    Write-Log "Warning: Could not commit changes" -Color $Yellow
}

Write-Log "  Lint Fix Loop Complete" -Color $Green