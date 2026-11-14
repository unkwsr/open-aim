# PC usage logger (test copy). Every 2 s, writes one JSON line to
# test-data/pc-logs/<start time>.jsonl: total CPU, graphics card (3D) use, disk and
# memory, plus the programs using the most CPU and the most graphics card.
# Times are UTC, like the round reports in test-data/frame-logs/, so the two line up.
# Started by "Start Test Game + PC log.cmd"; stops a few seconds after the game closes.
param([int]$IntervalSeconds = 2, [int]$MaxMinutes = 180)

$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root "test-data\pc-logs"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$file = Join-Path $dir ((Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ss") + "Z.jsonl")
$cores = [Environment]::ProcessorCount
$counters = @(
  '\Processor(_Total)\% Processor Time',
  '\Process(*)\% Processor Time',
  '\GPU Engine(*engtype_3D)\Utilization Percentage',
  '\PhysicalDisk(_Total)\% Idle Time',
  '\Memory\Available MBytes'
)

function GameRunning {
  [bool](Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*aimtrainer-test*" })
}

$deadline = (Get-Date).AddMinutes($MaxMinutes)
$seenGame = $false
$goneSince = $null
Write-Host "PC usage log: $file"

while ((Get-Date) -lt $deadline) {
  try {
    $samples = (Get-Counter -Counter $counters -SampleInterval $IntervalSeconds -MaxSamples 1 -ErrorAction SilentlyContinue).CounterSamples
  } catch {
    Start-Sleep -Seconds $IntervalSeconds
    continue
  }
  $names = @{}
  foreach ($p in Get-Process -ErrorAction SilentlyContinue) { $names[$p.Id] = $p.ProcessName }

  $cpuTotal = ($samples | Where-Object { $_.Path -like '*\processor(_total)\*' }).CookedValue
  $procs = $samples | Where-Object { $_.Path -like '*\process(*' -and $_.InstanceName -notin @('_total', 'idle') }
  $cpuTop = $procs | Group-Object InstanceName | ForEach-Object {
    [pscustomobject]@{ name = ($_.Name -replace '#\d+$', ''); cpu = ($_.Group | Measure-Object CookedValue -Sum).Sum / $cores }
  } | Group-Object name | ForEach-Object {
    [pscustomobject]@{ name = $_.Name; cpu = [math]::Round(($_.Group | Measure-Object cpu -Sum).Sum, 1) }
  } | Where-Object { $_.cpu -ge 0.5 } | Sort-Object cpu -Descending | Select-Object -First 8

  $gpuRows = $samples | Where-Object { $_.Path -like '*gpu engine*' -and $_.CookedValue -gt 0 }
  $gpuTop = $gpuRows | ForEach-Object {
    $procId = [int]([regex]::Match($_.InstanceName, 'pid_(\d+)').Groups[1].Value)
    [pscustomobject]@{ name = $(if ($names.ContainsKey($procId)) { $names[$procId] } else { "pid $procId" }); gpu = $_.CookedValue }
  } | Group-Object name | ForEach-Object {
    [pscustomobject]@{ name = $_.Name; gpu = [math]::Round(($_.Group | Measure-Object gpu -Sum).Sum, 1) }
  } | Where-Object { $_.gpu -ge 0.5 } | Sort-Object gpu -Descending | Select-Object -First 6

  $diskIdle = ($samples | Where-Object { $_.Path -like '*physicaldisk*' }).CookedValue
  $memFree = ($samples | Where-Object { $_.Path -like '*available mbytes*' }).CookedValue
  $line = [ordered]@{
    t = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    cpuTotal = [math]::Round($cpuTotal, 1)
    gpu3dTotal = [math]::Round((($gpuRows | Measure-Object CookedValue -Sum).Sum), 1)
    diskBusy = [math]::Round(100 - [math]::Min(100, $diskIdle), 1)
    memFreeMB = [int]$memFree
    cpuTop = @($cpuTop)
    gpuTop = @($gpuTop)
  }
  Add-Content -Path $file -Value ($line | ConvertTo-Json -Compress -Depth 4) -Encoding utf8

  # Stop once the game has been closed for a few seconds (only after it was seen).
  if (GameRunning) { $seenGame = $true; $goneSince = $null }
  elseif ($seenGame) {
    if (-not $goneSince) { $goneSince = Get-Date }
    elseif (((Get-Date) - $goneSince).TotalSeconds -ge 6) { break }
  } elseif ((Get-Date) -gt $deadline.AddMinutes(-$MaxMinutes + 2)) { break }
}
Write-Host "PC usage log finished: $file"
