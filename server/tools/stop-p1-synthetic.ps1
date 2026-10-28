param([string]$OutputDirectory = 'output/p1-1')
$ErrorActionPreference = 'Stop'
$p1Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$p1Output = [IO.Path]::GetFullPath((Join-Path $p1Root $OutputDirectory))
if (-not $p1Output.StartsWith((Join-Path $p1Root 'output') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Runtime output must stay under project output'
}
$p1RuntimePath = Join-Path $p1Output 'runtime.json'
$p1Runtime = Get-Content -LiteralPath $p1RuntimePath -Raw | ConvertFrom-Json
if ($p1Runtime.datasetMode -ne 'SYNTHETIC_TEST_ONLY' -or $p1Runtime.processId -lt 1) { throw 'Only a recorded synthetic runtime can be stopped' }
$p1Process = Get-CimInstance Win32_Process -Filter ('ProcessId=' + [long]$p1Runtime.processId)
if (-not $p1Process) { Write-Output 'Synthetic server is already stopped.'; exit 0 }
$p1PrivatePath = Join-Path $p1Output 'runtime.private.json'
if ($p1Process.Name -ne 'java.exe' -or -not $p1Process.CommandLine.Contains('com.wuhan.eldercare.visit.p1.P1SyntheticServer') -or
    -not $p1Process.CommandLine.Contains($p1PrivatePath)) {
    throw 'Recorded process does not match this synthetic server; no process was stopped'
}
Stop-Process -Id $p1Runtime.processId -ErrorAction Stop
$p1Runtime | Add-Member -NotePropertyName stoppedAt -NotePropertyValue ([DateTimeOffset]::UtcNow.ToString('o')) -Force
$p1Runtime | ConvertTo-Json | Set-Content -LiteralPath $p1RuntimePath -Encoding UTF8
Write-Output 'Synthetic HTTP server stopped. Its isolated MySQL data and private settings were preserved.'
