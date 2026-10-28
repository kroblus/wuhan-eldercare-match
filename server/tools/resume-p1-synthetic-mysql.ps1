param(
    [string]$DatabaseSettings = 'output/p1-1/mysql.private.json',
    [string]$InstanceDirectory,
    [string]$MySqlExecutable = 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqld.exe'
)
$ErrorActionPreference = 'Stop'
$p1Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$p1OutputRoot = (Join-Path $p1Root 'output') + [IO.Path]::DirectorySeparatorChar
$p1SettingsPath = (Resolve-Path -LiteralPath $DatabaseSettings).Path
if (-not $p1SettingsPath.StartsWith($p1OutputRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Private settings must stay under project output' }
$p1Settings = Get-Content -LiteralPath $p1SettingsPath -Raw | ConvertFrom-Json
if ($p1Settings.P1_DISPOSABLE_MYSQL -ne 'true' -or $p1Settings.P1_MYSQL_URL -notmatch '^jdbc:mysql://127\.0\.0\.1:(?!3306/)([0-9]+)/p1_intake_disposable_[a-z0-9]+\?') {
    throw 'Only the existing isolated disposable P1 database is allowed'
}
$p1Port = [int]$Matches[1]
if (-not $InstanceDirectory) { $InstanceDirectory = (Get-Content -LiteralPath (Join-Path $p1Root 'output/c2-a/active-instance.txt') -Raw).Trim() }
$p1Instance = (Resolve-Path -LiteralPath $InstanceDirectory).Path
if (-not $p1Instance.StartsWith($p1OutputRoot, [StringComparison]::OrdinalIgnoreCase) -or
    (Split-Path $p1Instance -Leaf) -notmatch '^mysql-disposable-[a-f0-9]{32}$') { throw 'Only an existing project-local disposable MySQL instance is allowed' }
$p1Ini = Join-Path $p1Instance 'my.ini'
$p1Config = @{}
foreach ($p1Line in Get-Content -LiteralPath $p1Ini) {
    if ($p1Line -match '^([a-z-]+)=(.+)$') { $p1Config[$Matches[1]] = $Matches[2].Trim() }
}
if ($p1Config['bind-address'] -ne '127.0.0.1' -or $p1Config['port'] -ne [string]$p1Port -or $p1Config['mysqlx'] -ne '0' -or
    -not $p1Config['datadir'] -or [IO.Path]::GetFullPath($p1Config['datadir']) -ne (Join-Path $p1Instance 'data') -or
    -not (Test-Path -LiteralPath (Join-Path $p1Instance 'data/auto.cnf'))) {
    throw 'Existing MySQL binding/data directory does not match the disposable settings; nothing was started'
}
$p1Existing = @(Get-CimInstance Win32_Process -Filter "Name='mysqld.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($p1Ini) })
$p1ExistingIds = @($p1Existing | ForEach-Object { $_.ProcessId })
# On Windows MySQL may have a supervising parent and its server child with the same arguments.
$p1ProcessRoots = @($p1Existing | Where-Object { $p1ExistingIds -notcontains $_.ParentProcessId })
if ($p1Existing.Count -gt 0 -and $p1ProcessRoots.Count -ne 1) { throw 'Multiple unrelated processes refer to the existing isolated instance' }
$p1Socket = [Net.Sockets.TcpClient]::new()
try {
    $p1Connecting = $p1Socket.BeginConnect('127.0.0.1', $p1Port, $null, $null)
    if ($p1Connecting.AsyncWaitHandle.WaitOne(250) -and $p1Socket.Connected) {
        $p1Listeners = @(Get-NetTCPConnection -State Listen -LocalPort $p1Port -ErrorAction Stop)
        if ($p1Existing.Count -eq 0 -or $p1Listeners.Count -ne 1 -or $p1ExistingIds -notcontains $p1Listeners[0].OwningProcess) {
            throw 'The isolated port is occupied by a different process; nothing was replaced'
        }
        Write-Output "Existing isolated MySQL is already running on loopback port $p1Port. Data was preserved."
        exit 0
    }
} finally { $p1Socket.Dispose() }
if ($p1Existing.Count -ne 0) { throw 'The recorded isolated MySQL process is starting or unhealthy; inspect its local log before retrying' }
$p1Process = Start-Process -FilePath $MySqlExecutable -ArgumentList ('--defaults-file="' + $p1Ini + '"') -WindowStyle Hidden -PassThru
$p1Ready = $false
for ($p1Attempt = 0; $p1Attempt -lt 40; $p1Attempt++) {
    $p1Probe = [Net.Sockets.TcpClient]::new()
    try {
        $p1Pending = $p1Probe.BeginConnect('127.0.0.1', $p1Port, $null, $null)
        if ($p1Pending.AsyncWaitHandle.WaitOne(100) -and $p1Probe.Connected) { $p1Ready = $true; break }
    } finally { $p1Probe.Dispose() }
    if ($p1Process.HasExited) { break }
    Start-Sleep -Milliseconds 250
}
if (-not $p1Ready) {
    if (-not $p1Process.HasExited) { Stop-Process -Id $p1Process.Id }
    throw 'Existing isolated MySQL did not become ready; inspect its local mysql-error.log. No data was initialized or deleted.'
}
Write-Output "Existing isolated MySQL resumed on loopback port $p1Port. No database, user, or setting was recreated."
