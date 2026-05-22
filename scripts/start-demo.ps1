$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root ".demo-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$services = @(
  "admin",
  "search",
  "booking",
  "comments",
  "notification",
  "ai-agent",
  "gateway"
)

foreach ($service in $services) {
  $workDir = Join-Path $root "services\$service"
  $outLog = Join-Path $logDir "$service.out.log"
  $errLog = Join-Path $logDir "$service.err.log"

  Start-Process `
    -FilePath "node" `
    -ArgumentList "index.js" `
    -WorkingDirectory $workDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog | Out-Null
}

Start-Process `
  -FilePath "npm.cmd" `
  -ArgumentList "run", "dev", "--", "--host", "127.0.0.1" `
  -WorkingDirectory (Join-Path $root "frontend") `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logDir "frontend.out.log") `
  -RedirectStandardError (Join-Path $logDir "frontend.err.log") | Out-Null

Start-Sleep -Seconds 5

Write-Output "Demo services started."
Write-Output "Frontend: http://127.0.0.1:5173"
Write-Output "Gateway:  http://127.0.0.1:3000"
Write-Output "Logs:     $logDir"
