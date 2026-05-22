$ports = 3000..3006 + 5173

foreach ($port in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

  foreach ($connection in $connections) {
    $processId = $connection.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue

    if ($process) {
      Stop-Process -Id $processId -Force
      Write-Output "Stopped $($process.ProcessName) on port $port (PID $processId)"
    }
  }
}
