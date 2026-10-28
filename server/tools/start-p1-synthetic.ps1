param(
    [Parameter(Mandatory=$true)][string]$DatabaseSettings,
    [string]$JavaExecutable = 'java',
    [string]$OutputDirectory = 'output/p1-1',
    [ValidateSet(18341,18342)][int]$Port = 18341,
    [string]$BindAddress = '127.0.0.1'
)
$ErrorActionPreference = 'Stop'
$p1Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$p1SettingsPath = (Resolve-Path -LiteralPath $DatabaseSettings).Path
if (-not $p1SettingsPath.StartsWith((Join-Path $p1Root 'output') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Synthetic database settings must be a private file under this project output directory'
}
$p1Settings = Get-Content -LiteralPath $p1SettingsPath -Raw | ConvertFrom-Json
if($BindAddress -ne '127.0.0.1') {
    $p1OwnAddresses=[Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() | ForEach-Object {$_.GetIPProperties().UnicastAddresses.Address.IPAddressToString}
    if($Port -ne 18342 -or $BindAddress -notmatch '^(10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|192\.168\.[0-9]{1,3}\.[0-9]{1,3}|172\.(1[6-9]|2[0-9]|3[01])\.[0-9]{1,3}\.[0-9]{1,3})$' -or $p1OwnAddresses -notcontains $BindAddress) {throw 'Only a specific private IPv4 owned by this host is allowed for synthetic port18342'}
}
if ($p1Settings.P1_DISPOSABLE_MYSQL -ne 'true' -or $p1Settings.P1_MYSQL_URL -notmatch '^jdbc:mysql://127\.0\.0\.1:(?!3306/)[0-9]+/p1_intake_disposable_[a-z0-9]+\?') {
    throw 'Only an explicitly disposable isolated P1 schema on a non-production port is accepted'
}
$p1JavaVersion = (& $JavaExecutable --version 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $p1JavaVersion -notmatch '(?m)(?:openjdk|java) (?:2[1-9]|[3-9][0-9])\.') { throw 'Java 21+ executable is required' }
$p1JavaPath = (Get-Command $JavaExecutable -CommandType Application -ErrorAction Stop).Source
$p1JavaHome = Split-Path (Split-Path $p1JavaPath -Parent) -Parent
$p1PortCheck = [Net.Sockets.TcpClient]::new()
try {
    $p1Connecting = $p1PortCheck.BeginConnect($BindAddress, $Port, $null, $null)
    if ($p1Connecting.AsyncWaitHandle.WaitOne(250) -and $p1PortCheck.Connected) { throw 'Selected synthetic port is already occupied; do not start another server' }
} finally { $p1PortCheck.Dispose() }
$p1Output = [IO.Path]::GetFullPath((Join-Path $p1Root $OutputDirectory))
if (-not $p1Output.StartsWith((Join-Path $p1Root 'output') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Runtime output must stay under project output' }
[void](New-Item -ItemType Directory -Force -Path $p1Output)
$p1Runtime = Join-Path $p1Output 'runtime.private.json'
$p1Previous = @{}
try {
    foreach ($p1Name in @('P1_DISPOSABLE_MYSQL','P1_MYSQL_URL','P1_MYSQL_USERNAME','P1_MYSQL_PASSWORD','JAVA_HOME','Path')) {
        $p1Previous[$p1Name] = [Environment]::GetEnvironmentVariable($p1Name, 'Process')
        if ($p1Name -notin @('JAVA_HOME','Path')) { [Environment]::SetEnvironmentVariable($p1Name, [string]$p1Settings.$p1Name, 'Process') }
    }
    # Maven must use the same Java21+ checked above, even when the shell's java is an older installation.
    $env:JAVA_HOME = $p1JavaHome
    $env:Path = (Join-Path $p1JavaHome 'bin') + ';' + $env:Path
    Push-Location (Join-Path $p1Root 'server')
    try {
        & mvn -q '-DskipTests' test-compile dependency:build-classpath '-Dmdep.outputFile=target/p1-classpath.txt'
        if ($LASTEXITCODE -ne 0) { throw 'Synthetic server compilation failed' }
        $p1Classpath = (Join-Path (Get-Location) 'target/test-classes') + ';' + (Join-Path (Get-Location) 'target/classes') + ';' + (Get-Content target/p1-classpath.txt -Raw).Trim()
        $p1Arguments = @('-cp', ('"' + $p1Classpath + '"'), 'com.wuhan.eldercare.visit.p1.P1SyntheticServer', ('"' + $p1Runtime + '"'),[string]$Port,$BindAddress)
        $p1Process = Start-Process -FilePath $p1JavaPath -ArgumentList $p1Arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $p1Output 'synthetic-server.log') -RedirectStandardError (Join-Path $p1Output 'synthetic-server-error.log')
    } finally { Pop-Location }
} finally {
    foreach ($p1Name in $p1Previous.Keys) { [Environment]::SetEnvironmentVariable($p1Name, $p1Previous[$p1Name], 'Process') }
}
$p1Ready = $false
for ($p1Attempt=0; $p1Attempt -lt 40; $p1Attempt++) {
    try {
        $p1Response = Invoke-RestMethod "http://$($BindAddress):$Port/api/v1/p1-service/config" -TimeoutSec 1
        if ($p1Response.datasetMode -eq 'SYNTHETIC_TEST_ONLY' -and $p1Response.enabled) { $p1Ready=$true; break }
    } catch { }
    if ($p1Process.HasExited) { break }
    Start-Sleep -Milliseconds 250
}
if (-not $p1Ready) {
    if (-not $p1Process.HasExited) { Stop-Process -Id $p1Process.Id -ErrorAction Stop }
    throw 'Synthetic server did not become ready; its process was stopped. Check Java/MySQL and local synthetic-server logs.'
}
@{baseUrl="http://$($BindAddress):$Port";adminUrl="http://$($BindAddress):$Port/p1-admin/";datasetMode='SYNTHETIC_TEST_ONLY';processId=$p1Process.Id;privateRuntimeFile=$p1Runtime} |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $p1Output 'runtime.json') -Encoding UTF8
Write-Output "Synthetic P1 server ready: http://$($BindAddress):$Port/p1-admin/ (explicit synthetic binding)"
Write-Output 'Synthetic credentials remain only in the selected output directory runtime.private.json; do not paste them into logs or chat.'
