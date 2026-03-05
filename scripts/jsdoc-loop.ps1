# ============================================================================
# SonarLox JSDoc Documentation Loop (PowerShell)
# 
# Runs on a separate terminal using local Ollama + qwen3-coder to add JSDoc
# comments to all TypeScript source files. Non-destructive — only adds
# comments, never modifies logic.
#
# Prerequisites:
#   - Ollama running locally with qwen3-coder pulled
#   - Run from the sonarlox project root
#
# Usage:
#   .\scripts\jsdoc-loop.ps1
#
# Single file:
#   .\scripts\jsdoc-loop.ps1 -SingleFile "src/renderer/types/index.ts"
#
# Dry run (shows what it would do without writing):
#   .\scripts\jsdoc-loop.ps1 -DryRun
# ============================================================================

param(
    [string]$SingleFile = "",
    [switch]$DryRun = $false,
    [string]$Model = "qwen3-coder",
    [string]$BranchName = "chores/jsdoc"
)

$ErrorActionPreference = "Stop"

# --- Config ---
$OllamaUrl = "http://localhost:11434/api/generate"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $ProjectRoot) { $ProjectRoot = Get-Location }
$LogFile = Join-Path $ProjectRoot "scripts\jsdoc-loop.log"
$MaxRetries = 2
$DelayBetweenFiles = 3

# --- File list (dependency order) ---
$TargetFiles = @(
    "src/renderer/types/index.ts"
    "src/renderer/audio/IAudioEngine.ts"
    "src/renderer/audio/WebAudioEngine.ts"
    "src/renderer/audio/TestTones.ts"
    "src/renderer/audio/Exporter.ts"
    "src/renderer/audio/encodeWav.ts"
    "src/renderer/stores/useAppStore.ts"
    "src/renderer/stores/useTransportStore.ts"
    "src/renderer/components/AudioBridge.tsx"
    "src/renderer/components/Viewport.tsx"
    "src/renderer/components/Room.tsx"
    "src/renderer/components/SoundSource.tsx"
    "src/renderer/components/Listener.tsx"
    "src/renderer/components/DistanceRings.tsx"
    "src/renderer/components/AudioVisualizer.tsx"
    "src/renderer/components/ControlPanel.tsx"
    "src/renderer/components/SourceList.tsx"
    "src/renderer/components/TimelinePanel.tsx"
    "src/renderer/App.tsx"
    "src/main/index.ts"
    "src/main/ipc.ts"
    "src/preload/index.ts"
)

# --- Functions ---

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $timestamp = Get-Date -Format "HH:mm:ss"
    $logMsg = "[$timestamp] $Message"
    Write-Host $logMsg -ForegroundColor $Color
    Add-Content -Path $LogFile -Value $logMsg -ErrorAction SilentlyContinue
}

function Test-Ollama {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 5
        $models = $response.models | ForEach-Object { $_.name }
        if ($models -notcontains $Model -and $models -notcontains "$Model`:latest") {
            # Check partial match
            $found = $models | Where-Object { $_ -like "$Model*" }
            if (-not $found) {
                Write-Host "ERROR: Model '$Model' not found in Ollama" -ForegroundColor Red
                Write-Host "Available models: $($models -join ', ')" -ForegroundColor Yellow
                Write-Host "Pull it with: ollama pull $Model" -ForegroundColor Yellow
                exit 1
            }
        }
        Write-Log "Ollama connected, model '$Model' available" "Green"
    }
    catch {
        Write-Host "ERROR: Ollama not running at localhost:11434" -ForegroundColor Red
        Write-Host "Start it with: ollama serve" -ForegroundColor Yellow
        exit 1
    }
}

function Get-JsDocCount {
    param([string]$FilePath)
    $content = Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return 0 }
    return ([regex]::Matches($content, '^\s*/\*\*', [System.Text.RegularExpressions.RegexOptions]::Multiline)).Count
}

function Get-ExportCount {
    param([string]$Content)
    return ([regex]::Matches($Content, '^\s*export\s+(function|class|interface|type|const|async\s+function|enum)', [System.Text.RegularExpressions.RegexOptions]::Multiline)).Count
}

function Invoke-Ollama {
    param([string]$Prompt)
    
    $body = @{
        model   = $Model
        prompt  = $Prompt
        stream  = $false
        options = @{
            temperature = 0.1
            num_predict = 16384
            num_ctx     = 32768
        }
    } | ConvertTo-Json -Depth 5

    for ($retry = 0; $retry -lt $MaxRetries; $retry++) {
        try {
            $response = Invoke-RestMethod -Uri $OllamaUrl -Method Post -Body $body -ContentType "application/json" -TimeoutSec 180
            if ($response.response) {
                return $response.response
            }
        }
        catch {
            Write-Log "  Retry $($retry + 1)/$MaxRetries - $($_.Exception.Message)" "Yellow"
            Start-Sleep -Seconds 5
        }
    }
    return $null
}

function Add-JsDocToFile {
    param([string]$RelativePath)
    
    $filePath = Join-Path $ProjectRoot $RelativePath.Replace("/", "\")
    
    if (-not (Test-Path $filePath)) {
        Write-Log "SKIP: $RelativePath (not found)" "Yellow"
        return "skipped"
    }
    
    # Check if already documented
    $docCount = Get-JsDocCount $filePath
    if ($docCount -gt 3) {
        Write-Log "SKIP: $RelativePath (already has $docCount JSDoc blocks)" "Cyan"
        return "skipped"
    }
    
    $content = Get-Content $filePath -Raw
    $exportCount = Get-ExportCount $content
    
    if ($exportCount -eq 0) {
        Write-Log "SKIP: $RelativePath (no exports to document)" "Cyan"
        return "skipped"
    }
    
    Write-Log "DOCUMENTING: $RelativePath ($exportCount exports)" "Green"
    
    if ($DryRun) {
        Write-Log "  DRY RUN - would process this file" "Yellow"
        return "skipped"
    }
    
    # Build prompt
    $prompt = @"
You are adding JSDoc documentation to a TypeScript file from the SonarLox spatial audio editor.

RULES:
1. Add JSDoc comments (/** ... */) to every exported function, class, interface, type, and const
2. DO NOT modify any code logic, imports, or structure
3. DO NOT remove or change existing comments
4. DO NOT add @param or @returns if the types already make it obvious
5. Keep descriptions concise - one line for simple things, 2-3 lines max for complex
6. For audio/spatial concepts, briefly explain what they do in spatial audio terms
7. Output the COMPLETE file with JSDoc added - every single line, not just the changed parts
8. Do NOT wrap output in markdown code fences (no triple backticks)
9. Output ONLY the file content, no preamble, no explanation

CONTEXT:
- SonarLox is a 3D spatial audio editor built with Electron + React + Three.js + Web Audio API
- Sources are audio objects positioned in 3D space with HRTF binaural spatialization
- The app uses Zustand for state, React Three Fiber for 3D, Web Audio for audio

Here is the file to document:

$content
"@

    # Call Ollama
    $generated = Invoke-Ollama $prompt
    
    if (-not $generated) {
        Write-Log "  FAILED: No response from Ollama" "Red"
        return "failed"
    }
    
    # Strip markdown fences if model added them
    $generated = $generated -replace '(?m)^```(?:typescript|ts)?$', '' -replace '(?m)^```$', ''
    $generated = $generated.Trim()
    
    # Safety checks
    $origLines = ($content -split "`n").Count
    $newLines = ($generated -split "`n").Count
    $origExports = Get-ExportCount $content
    $newExports = Get-ExportCount $generated
    
    if ($newLines -lt $origLines) {
        Write-Log "  REJECTED: Output shorter than original ($newLines < $origLines lines)" "Red"
        return "failed"
    }
    
    if ($newExports -lt $origExports) {
        Write-Log "  REJECTED: Lost exports ($newExports < $origExports)" "Red"
        return "failed"
    }
    
    # Backup and write
    $backupPath = "$filePath.bak"
    Copy-Item $filePath $backupPath -Force
    
    # Write with UTF-8 no BOM (important for TypeScript)
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($filePath, $generated, $utf8NoBom)
    
    Write-Log "  Written (+$($newLines - $origLines) lines of docs)" "Green"
    
    # Typecheck
    Write-Log "  Running typecheck..." "Cyan"
    $typecheckResult = & npm run typecheck 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "  TYPECHECK FAILED - reverting" "Red"
        Copy-Item $backupPath $filePath -Force
        Remove-Item $backupPath -Force -ErrorAction SilentlyContinue
        return "failed"
    }
    
    Write-Log "  Typecheck passed" "Green"
    
    # Commit
    & git add $RelativePath 2>$null
    & git commit -m "docs: add JSDoc to $(Split-Path -Leaf $RelativePath)" --no-verify 2>$null
    
    # Cleanup
    Remove-Item $backupPath -Force -ErrorAction SilentlyContinue
    
    Write-Log "  Committed" "Green"
    return "succeeded"
}

# --- Main ---

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  SonarLox JSDoc Documentation Loop" -ForegroundColor Green
Write-Host "  Model: $Model" -ForegroundColor Green
Write-Host "  Files: $($TargetFiles.Count)" -ForegroundColor Green
if ($DryRun) { Write-Host "  MODE: DRY RUN" -ForegroundColor Yellow }
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# Prereqs
Test-Ollama
Set-Location $ProjectRoot

# Init log
$scriptsDir = Join-Path $ProjectRoot "scripts"
if (-not (Test-Path $scriptsDir)) { New-Item -ItemType Directory -Path $scriptsDir | Out-Null }
Add-Content -Path $LogFile -Value "=== JSDoc Loop Started $(Get-Date) ==="

# Branch setup
$currentBranch = & git branch --show-current 2>$null
if ($currentBranch -ne $BranchName -and -not $DryRun) {
    Write-Host "Current branch: $currentBranch" -ForegroundColor Yellow
    $answer = Read-Host "Create/switch to '$BranchName'? (y/n)"
    if ($answer -eq "y") {
        & git checkout -b $BranchName 2>$null
        if ($LASTEXITCODE -ne 0) {
            & git checkout $BranchName 2>$null
        }
    }
    else {
        Write-Log "Staying on $currentBranch"
    }
}

# Single file mode
if ($SingleFile) {
    $TargetFiles = @($SingleFile)
    Write-Log "Single file mode: $SingleFile"
}

# Process
$succeeded = 0
$skipped = 0
$failed = 0

foreach ($file in $TargetFiles) {
    Write-Host ""
    
    $result = Add-JsDocToFile $file
    
    switch ($result) {
        "succeeded" { $succeeded++ }
        "skipped"   { $skipped++ }
        "failed"    { $failed++ }
    }
    
    if ($result -eq "succeeded") {
        Start-Sleep -Seconds $DelayBetweenFiles
    }
}

# Summary
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  JSDoc Loop Complete" -ForegroundColor Green
Write-Host "  Succeeded: $succeeded" -ForegroundColor Green
Write-Host "  Skipped:   $skipped" -ForegroundColor Yellow
Write-Host "  Failed:    $failed" -ForegroundColor Red
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Results on branch: $(& git branch --show-current 2>$null)" -ForegroundColor Cyan
Write-Host "Log: $LogFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "When ready, merge with:" -ForegroundColor White
Write-Host "  git checkout main" -ForegroundColor White
Write-Host "  git merge $BranchName" -ForegroundColor White
