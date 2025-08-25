$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[ OK ] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERR ] $msg" -ForegroundColor Red }

$root = $PSScriptRoot
$projectDir = Join-Path $root 'project'
$backendDir = Join-Path $root 'backend'
$frontendDist = Join-Path $projectDir 'dist'
$backendPublic = Join-Path $backendDir 'public'

Write-Info "Root: $root"
Write-Info "Project: $projectDir"
Write-Info "Backend: $backendDir"

try {
  Write-Info 'Checking Node & npm...'
  $nodev = (node -v)
  $npmv = (npm -v)
  Write-Ok "Node $nodev / npm $npmv"
} catch {
  Write-Err 'Node.js/npm not found in PATH. Install Node.js LTS first.'
  exit 1
}

try {
  # 1) Build frontend
  Write-Info 'Installing frontend dependencies...'
  Push-Location $projectDir
  if (Test-Path 'package-lock.json') { npm ci } else { npm install }
  Write-Info 'Building frontend (vite build)...'
  npm run build
  Pop-Location
  Write-Ok 'Frontend built successfully'

  # 2) Copy dist to backend/public
  if (-not (Test-Path $backendPublic)) { New-Item -ItemType Directory -Force -Path $backendPublic | Out-Null }
  Write-Info 'Copying frontend dist to backend/public (mirror)...'
  $rc = & robocopy $frontendDist $backendPublic /MIR /NFL /NDL /NJH /NJS /NP
  $robocode = $LastExitCode
  if ($robocode -ge 8) { throw "robocopy failed with code $robocode" }
  Write-Ok 'Static files ready in backend/public'

  # 3) Backend deps + prestart
  Write-Info 'Installing backend dependencies...'
  Push-Location $backendDir
  if (Test-Path 'package-lock.json') { npm ci } else { npm install }
  Write-Info 'Running backend prestart (build + init)...'
  npm run prestart
  Pop-Location
  Write-Ok 'Backend built and initialized'

  # 4) Open firewall for port 4000
  $ruleName = 'Ecolav 4000'
  Write-Info 'Ensuring Windows Firewall rule for TCP 4000 (Private,Domain)...'
  $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if (-not $existingRule) {
    try {
      New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow -Profile Private,Domain | Out-Null
      Write-Ok 'Firewall rule added'
    } catch {
      Write-Warn 'Could not create firewall rule (try running PowerShell as Administrator)'
    }
  } else {
    Write-Ok 'Firewall rule already exists'
  }

  # 5) Start backend serving SPA on port 4000 in a new window
  Write-Info 'Starting backend (SERVE_SPA=true, PORT=4000) in a new window...'
  $cmd = "$env:SERVE_SPA='true'; $env:PORT='4000'; npm start"
  Start-Process -WorkingDirectory $backendDir -FilePath 'powershell.exe' -ArgumentList '-NoExit','-Command', $cmd | Out-Null
  Write-Ok 'Backend started (separate window)'

  # 6) Display local IPs and URLs
  Write-Info 'Detecting local IPv4 addresses...'
  $ips = @()
  try {
    $ips = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' }).IPAddress | Select-Object -Unique
  } catch {
    # Fallback to ipconfig parsing
    $ips = (ipconfig | Select-String -Pattern 'IPv4.*?:\s*(\d+\.\d+\.\d+\.\d+)' | ForEach-Object { $_.Matches[0].Groups[1].Value }) | Select-Object -Unique
  }
  if ($ips.Count -eq 0) { $ips = @('127.0.0.1') }
  Write-Host ''
  Write-Host 'Access URLs:' -ForegroundColor Cyan
  foreach ($ip in $ips) { Write-Host ("  http://$ip:4000") -ForegroundColor Green }
  Write-Host ''
  Write-Ok 'Done.'
} catch {
  Write-Err $_
  exit 1
}


