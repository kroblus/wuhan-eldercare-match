[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('initialize', 'start', 'verify', 'stop')]
    [string]$Mode,

    [Parameter(Mandatory = $true)]
    [string]$EnvironmentRoot,

    [string]$MySqlBin,
    [string]$NodeExe,
    [string]$ArtifactRoot,
    [string]$JavaExe
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$MySqlPort = 33410
$HttpPort = 34579
$ScriptPath = [IO.Path]::GetFullPath($MyInvocation.MyCommand.Path)
$RepoRoot = [IO.Directory]::GetParent([IO.Directory]::GetParent($ScriptPath).FullName).FullName
$ServerTargetRoot = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'server/target'))
$script:CurrentPhase = 'argument-validation'
$script:BlockedEnvironmentNames = @()

function Set-SafePhase([string]$Name) {
    $script:CurrentPhase = $Name
}

function ConvertTo-FullPath([string]$Path) {
    return [IO.Path]::GetFullPath($Path)
}

function Test-PathWithin([string]$Path, [string]$Parent) {
    $fullPath = ConvertTo-FullPath $Path
    $fullParent = (ConvertTo-FullPath $Parent).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    return $fullPath.StartsWith($fullParent + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
}

function Assert-EnvironmentRoot([string]$Path, [bool]$MustNotExist) {
    $full = ConvertTo-FullPath $Path
    if (-not [string]::Equals([IO.Path]::GetDirectoryName($full), $ServerTargetRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'environment root must be a direct child of server/target'
    }
    $serverPath = Join-Path $RepoRoot 'server'
    foreach ($ancestor in @($RepoRoot, $serverPath, $ServerTargetRoot)) {
        if (-not (Test-Path -LiteralPath $ancestor -PathType Container)) { throw 'workspace server/target path is unavailable' }
        if ((Get-Item -LiteralPath $ancestor -Force).Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)) {
            throw 'workspace server/target ancestors may not be junctions or symbolic links'
        }
    }
    $leaf = [IO.Path]::GetFileName($full)
    if ($leaf -notmatch '^history-test-environment-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
        throw 'environment root must be a fresh history-test-environment UUID directory'
    }
    if ($MustNotExist -and (Test-Path -LiteralPath $full)) { throw 'environment root already exists; it will not be overwritten' }
    if (-not $MustNotExist -and -not (Test-Path -LiteralPath $full -PathType Container)) { throw 'environment root is not initialized' }
    if (-not $MustNotExist -and (Get-Item -LiteralPath $full -Force).Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)) {
        throw 'environment root may not be a junction or symbolic link'
    }
    return $full
}

function Assert-NoRelevantEnvironmentOverrides {
    Set-SafePhase 'environment-override-check'
    $forbidden = @(Get-ChildItem Env: | Where-Object {
        $_.Name -match '^(SPRING_|C4_|C5_|ASSESSMENT_HISTORY_|SERVER_|MYSQL_HOME$|MYSQL_PWD$|MYSQL_TCP_PORT$|MYSQL_UNIX_PORT$|MYSQL_TEST_LOGIN_FILE$|JAVA_TOOL_OPTIONS$|JDK_JAVA_OPTIONS$|_JAVA_OPTIONS$|CLASSPATH$|NODE_OPTIONS$|NODE_PATH$)'
    })
    if ($forbidden.Count -gt 0) {
        $script:BlockedEnvironmentNames = @($forbidden | ForEach-Object { [string]$_.Name } | Sort-Object -Unique)
        throw 'relevant environment overrides are present'
    }
}

function Protect-Directory([string]$Path) {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $icacls = Join-Path $env:SystemRoot 'System32/icacls.exe'
    & $icacls $Path '/inheritance:r' '/grant:r' ("$identity`:(OI)(CI)F") 'NT AUTHORITY\SYSTEM:(OI)(CI)F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'could not apply current-user ACL to isolated environment' }
}

function Write-NewPrivateFile([string]$Path, [string]$Content) {
    if (Test-Path -LiteralPath $Path) { throw 'refusing to overwrite private environment file' }
    [IO.File]::WriteAllText($Path, $Content, [Text.UTF8Encoding]::new($false))
    Protect-Directory ([IO.Directory]::GetParent($Path).FullName)
}

function New-RandomHex([int]$Bytes = 32) {
    $buffer = [byte[]]::new($Bytes)
    [Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
    return [Convert]::ToHexString($buffer).ToLowerInvariant()
}

function New-RandomUrlToken([int]$Bytes = 32) {
    $buffer = [byte[]]::new($Bytes)
    [Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
    return [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Quote-StartProcessArgument([string]$Value) {
    return '"' + $Value.Replace('"', '\"') + '"'
}

function New-UniqueLogPath([string]$Directory, [string]$Prefix) {
    $stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
    $suffix = [Guid]::NewGuid().ToString('N')
    return Join-Path $Directory "$Prefix-$stamp-$suffix.log"
}

function Invoke-CapturedProcess([string]$FilePath, [string[]]$Arguments, [string]$WorkingDirectory, [hashtable]$EnvironmentOverrides = @{}) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $FilePath
    $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    foreach ($argument in $Arguments) { [void]$info.ArgumentList.Add($argument) }
    foreach ($name in $EnvironmentOverrides.Keys) { $info.Environment[[string]$name] = [string]$EnvironmentOverrides[$name] }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $info
    if (-not $process.Start()) { throw 'external process did not start' }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit(120000)) {
        try { $process.Kill($true) } catch { }
        throw 'external process timed out'
    }
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    $code = $process.ExitCode
    $process.Dispose()
    if ($code -ne 0) { throw 'external process failed; protected diagnostics were retained' }
    return [pscustomobject]@{ Output = $stdout.Trim(); Error = $stderr.Trim() }
}

function Test-TcpListener([string]$HostName, [int]$Port) {
    $client = [Net.Sockets.TcpClient]::new()
    try {
        $task = $client.ConnectAsync($HostName, $Port)
        if (-not $task.Wait(500)) { return $false }
        return $client.Connected
    } catch { return $false }
    finally { $client.Dispose() }
}

function Assert-PortFree([int]$Port) {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
    try { $listener.Start() }
    catch { throw "required local port $Port is already in use" }
    finally { $listener.Stop() }
}

function Get-StatePath([string]$Root) { return Join-Path $Root 'environment-state.json' }
function Get-PrivatePath([string]$Root, [string]$Name) { return Join-Path (Join-Path $Root 'private') $Name }

function Read-State([string]$Root) {
    $path = Get-StatePath $Root
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'environment state is missing' }
    $state = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    if ($state.environmentRoot -ne $Root -or $state.schema -ne 'history-isolated-environment-state-v1' -or
            $state.environmentId -notmatch '^TEST_ONLY_[A-Za-z0-9_-]{1,72}$') {
        throw 'environment state boundary check failed'
    }
    return $state
}

function Write-State($State) {
    $path = Get-StatePath $State.environmentRoot
    $temporaryPath = Join-Path $State.environmentRoot ('.state-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    [IO.File]::WriteAllText($temporaryPath, ($State | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
    [IO.File]::Move($temporaryPath, $path, $true)
}

function Get-MySqlExecutables([string]$Bin) {
    if ([string]::IsNullOrWhiteSpace($Bin)) {
        $found = Get-Command mysqld.exe -ErrorAction Stop
        $Bin = Split-Path -Parent $found.Source
    }
    $fullBin = ConvertTo-FullPath $Bin
    $mysqld = Join-Path $fullBin 'mysqld.exe'
    $mysql = Join-Path $fullBin 'mysql.exe'
    $mysqladmin = Join-Path $fullBin 'mysqladmin.exe'
    foreach ($path in @($mysqld, $mysql, $mysqladmin)) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'MySQL 8 server and client executables are required' }
    }
    $version = Invoke-CapturedProcess $mysqld @('--no-defaults', '--version') $fullBin
    if ($version.Output -notmatch 'Ver 8\.') { throw 'only MySQL 8 is accepted for this isolated environment' }
    return [pscustomobject]@{ Bin = $fullBin; Mysqld = $mysqld; Mysql = $mysql; MysqlAdmin = $mysqladmin; Version = $version.Output }
}

function Start-HiddenOwnedProcess([string]$FilePath, [string[]]$Arguments, [string]$WorkingDirectory, [string]$Stdout, [string]$Stderr) {
    $argumentLine = ($Arguments | ForEach-Object { Quote-StartProcessArgument $_ }) -join ' '
    return Start-Process -FilePath $FilePath -ArgumentList $argumentLine -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput $Stdout -RedirectStandardError $Stderr
}

function Get-IsolatedMySqlClientEnvironment([string]$Root) {
    $loginPath = Join-Path (Join-Path $Root 'private') 'mysql-client-login-path-disabled.mylogin.cnf'
    if (Test-Path -LiteralPath $loginPath) { throw 'isolated login-path override must refer to a missing private file' }
    return @{ MYSQL_TEST_LOGIN_FILE = $loginPath }
}

function Invoke-MySql([string]$MysqlExe, [string]$DefaultsFile, [string]$Database, [string]$Query, [string]$Root) {
    $args = @("--defaults-file=$DefaultsFile", '--host=127.0.0.1', "--port=$MySqlPort", '--protocol=tcp', '--connect-timeout=2', '--batch', '--raw', '--skip-column-names', "--database=$Database", '--execute', $Query)
    return (Invoke-CapturedProcess $MysqlExe $args (Split-Path -Parent $MysqlExe) (Get-IsolatedMySqlClientEnvironment $Root)).Output
}

function Wait-MySqlReady([string]$MysqlExe, [string]$DefaultsFile, [string]$Database, [string]$Root, [int]$LauncherPid = 0) {
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($LauncherPid -gt 0 -and -not (Get-Process -Id $LauncherPid -ErrorAction SilentlyContinue) -and -not (Test-TcpListener '127.0.0.1' $MySqlPort)) {
            throw 'isolated MySQL launcher and listener stopped before becoming ready'
        }
        try {
            $result = Invoke-MySql $MysqlExe $DefaultsFile $Database 'SELECT DATABASE(), CURRENT_USER(), @@port;' $Root
            if ($result -match [regex]::Escape($Database) -and $result -match [regex]::Escape("$MySqlPort")) { return $result }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw 'isolated MySQL did not become ready; protected logs were retained'
}

function Get-OwnedProcess([int]$ProcessId, [string]$ExpectedExecutable, [string[]]$RequiredCommandParts) {
    if ($ProcessId -le 0) { return $null }
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    if ($null -eq $processInfo) { return $null }
    $actualExe = [string]$processInfo.ExecutablePath
    $actualCommand = [string]$processInfo.CommandLine
    if (-not [string]::Equals((ConvertTo-FullPath $actualExe), (ConvertTo-FullPath $ExpectedExecutable), [StringComparison]::OrdinalIgnoreCase)) {
        throw 'refusing to control a PID with a different executable'
    }
    foreach ($part in $RequiredCommandParts) {
        if (-not $actualCommand.Contains($part, [StringComparison]::OrdinalIgnoreCase)) { throw 'refusing to control a PID without matching environment arguments' }
    }
    return $processInfo
}

function Get-MySqlProcessSet([string]$Root, [string]$ExpectedExecutable, [string]$DataDirectory) {
    $expectedExe = ConvertTo-FullPath $ExpectedExecutable
    $dataToken = "--datadir=$DataDirectory"
    $portToken = "--port=$MySqlPort"
    $ownedProcesses = [System.Collections.Generic.List[object]]::new()
    foreach ($candidate in @(Get-CimInstance Win32_Process -Filter "Name = 'mysqld.exe'" -ErrorAction SilentlyContinue)) {
        $actualExe = [string]$candidate.ExecutablePath
        if ([string]::IsNullOrWhiteSpace($actualExe)) { continue }
        try { $actualExe = ConvertTo-FullPath $actualExe } catch { continue }
        $actualCommand = [string]$candidate.CommandLine
        if ([string]::Equals($actualExe, $expectedExe, [StringComparison]::OrdinalIgnoreCase) -and
                $actualCommand.Contains($dataToken, [StringComparison]::OrdinalIgnoreCase) -and
                $actualCommand.Contains($portToken, [StringComparison]::OrdinalIgnoreCase)) {
            $ownedProcesses.Add($candidate)
        }
    }
    $processes = @($ownedProcesses.ToArray())
    $pidFile = Join-Path (Join-Path $Root 'mysql') 'mysqld.pid'
    $server = $null
    if (Test-Path -LiteralPath $pidFile -PathType Leaf) {
        $pidText = (Get-Content -LiteralPath $pidFile -Raw).Trim()
        $serverPid = 0
        if (-not [int]::TryParse($pidText, [ref]$serverPid) -or $serverPid -le 0) {
            throw 'isolated MySQL PID file is invalid'
        }
        $server = @($processes | Where-Object { [int]$_.ProcessId -eq $serverPid } | Select-Object -First 1) | Select-Object -First 1
        if ($null -eq $server) {
            $pidProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $serverPid" -ErrorAction SilentlyContinue
            if ($null -ne $pidProcess) { throw 'isolated MySQL PID file does not identify the expected server process' }
        }
    } elseif ($processes.Count -gt 0) {
        $processIds = @($processes | ForEach-Object { [int]$_.ProcessId })
        $child = @($processes | Where-Object { $processIds -contains [int]$_.ParentProcessId -and [int]$_.ParentProcessId -ne [int]$_.ProcessId } | Select-Object -First 1)
        if ($child.Count -gt 0) { $server = $child[0] }
        elseif ($processes.Count -eq 1) { $server = $processes[0] }
    }
    return [pscustomobject]@{ Processes = $processes; Server = $server }
}

function Stop-MySqlProcessSet([object[]]$Processes, [string]$ExpectedExecutable, [string]$DataDirectory) {
    $pending = @($Processes)
    while ($pending.Count -gt 0) {
        $leaves = @($pending | Where-Object {
            $parentId = [int]$_.ProcessId
            @($pending | Where-Object { [int]$_.ParentProcessId -eq $parentId -and [int]$_.ProcessId -ne $parentId }).Count -eq 0
        })
        if ($leaves.Count -eq 0) { throw 'isolated MySQL process ownership graph is invalid' }
        foreach ($leaf in $leaves) {
            [void](Stop-OwnedProcess ([int]$leaf.ProcessId) $ExpectedExecutable @("--datadir=$DataDirectory", "--port=$MySqlPort"))
            $pending = @($pending | Where-Object { [int]$_.ProcessId -ne [int]$leaf.ProcessId })
        }
    }
}

function Get-ProcessTreeSnapshot([int]$RootProcessId) {
    $all = @(Get-CimInstance Win32_Process -ErrorAction Stop)
    $selected = @()
    $knownIds = [System.Collections.Generic.HashSet[int]]::new()
    [void]$knownIds.Add($RootProcessId)
    $root = @($all | Where-Object { [int]$_.ProcessId -eq $RootProcessId } | Select-Object -First 1)
    if ($root.Count -eq 0) { return @() }
    $selected += $root[0]
    $changed = $true
    while ($changed) {
        $changed = $false
        foreach ($candidate in $all) {
            if (-not $knownIds.Contains([int]$candidate.ProcessId) -and $knownIds.Contains([int]$candidate.ParentProcessId)) {
                [void]$knownIds.Add([int]$candidate.ProcessId)
                $selected += $candidate
                $changed = $true
            }
        }
    }
    return $selected
}

function Test-ProcessSnapshotAlive([object]$Snapshot) {
    $current = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$Snapshot.ProcessId)" -ErrorAction SilentlyContinue
    if ($null -eq $current) { return $false }
    return [string]$current.CreationDate -eq [string]$Snapshot.CreationDate -and
        [string]::Equals([string]$current.ExecutablePath, [string]$Snapshot.ExecutablePath, [StringComparison]::OrdinalIgnoreCase)
}

function Stop-OwnedProcess([int]$ProcessId, [string]$ExpectedExecutable, [string[]]$RequiredCommandParts, [switch]$KillProcessTree) {
    $owned = Get-OwnedProcess $ProcessId $ExpectedExecutable $RequiredCommandParts
    if ($null -eq $owned) { return $false }
    $snapshot = if ($KillProcessTree) { @(Get-ProcessTreeSnapshot $ProcessId) } else { @($owned) }
    $process = [Diagnostics.Process]::GetProcessById($ProcessId)
    try {
        if ($KillProcessTree) { $process.Kill($true) }
        else { $process.Kill() }
    } finally {
        $process.Dispose()
    }
    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        $alive = @($snapshot | Where-Object { Test-ProcessSnapshotAlive $_ })
        if ($alive.Count -eq 0) { return $true }
        Start-Sleep -Milliseconds 250
    }
    throw 'owned process did not stop'
}

function Get-ArtifactManifest([string]$Root) {
    if ((Get-Item -LiteralPath $Root -Force).Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)) { throw 'frozen artifact root may not be a junction or symbolic link' }
    $reparseItems = @(Get-ChildItem -LiteralPath $Root -Force -Recurse | Where-Object { $_.Attributes.HasFlag([IO.FileAttributes]::ReparsePoint) })
    if ($reparseItems.Count -gt 0) { throw 'frozen artifact may not contain junctions or symbolic links' }
    $manifestPath = Join-Path $Root 'ARTIFACT_MANIFEST.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'frozen backend artifact is not prepared' }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.kind -ne 'history_environment_frozen_backend_artifact_v1' -or
            $manifest.testAppIdGate -ne 'WAITING_FOR_OWNER' -or
            $manifest.buildProvenance -ne 'NOT_VERIFIED' -or
            $manifest.liveTargetClasspath -ne $false -or
            $manifest.productionWrite -ne $false -or
            $manifest.nodeExecutableSha256 -notmatch '^[a-f0-9]{64}$' -or
            $manifest.artifactId -notmatch '^[a-f0-9]{64}$') {
        throw 'backend artifact manifest does not match the TEST_ONLY gate'
    }
    $expected = @{}
    foreach ($file in $manifest.files) {
        $relative = [string]$file.path
        if ([string]::IsNullOrWhiteSpace($relative) -or $relative.Contains('\') -or $relative.StartsWith('/') -or $relative.Contains('../')) {
            throw 'backend artifact manifest contains an unsafe path'
        }
        $filePath = Join-Path $Root ($relative.Replace('/', [IO.Path]::DirectorySeparatorChar))
        if (-not (Test-PathWithin $filePath $Root) -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) { throw 'backend artifact file is missing' }
        $item = Get-Item -LiteralPath $filePath
        $hash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($item.Length -ne [long]$file.size -or $hash -ne [string]$file.sha256) { throw 'backend artifact file hash or size mismatch' }
        if ($expected.ContainsKey($relative)) { throw 'duplicate backend artifact manifest path' }
        $expected[$relative] = $true
    }
    $actual = @(Get-ChildItem -LiteralPath $Root -File -Recurse | Where-Object { $_.FullName -ne $manifestPath } | ForEach-Object { $_.FullName.Substring($Root.Length + 1).Replace('\', '/') })
    if ($actual.Count -ne $expected.Count -or @($actual | Where-Object { -not $expected.ContainsKey($_) }).Count -gt 0) {
        throw 'backend artifact contains files outside its frozen manifest'
    }
    return $manifest
}

function Initialize-Environment([string]$Root, [string]$MySqlDirectory, [string]$RequestedNodeExe) {
    Assert-NoRelevantEnvironmentOverrides
    Set-SafePhase 'environment-root-boundary-check'
    $Root = Assert-EnvironmentRoot $Root $true
    Set-SafePhase 'local-port-availability-check'
    Assert-PortFree $MySqlPort
    Assert-PortFree $HttpPort
    Set-SafePhase 'mysql-8-executable-discovery'
    $executables = Get-MySqlExecutables $MySqlDirectory
    Set-SafePhase 'node-24-runtime-discovery'
    $nodePath = if ([string]::IsNullOrWhiteSpace($RequestedNodeExe)) { (Get-Command node.exe -ErrorAction Stop).Source } else { $RequestedNodeExe }
    $nodeExe = ConvertTo-FullPath $nodePath
    $nodeVersion = Invoke-CapturedProcess $nodeExe @('--version') (Split-Path -Parent $nodeExe)
    $nodeHash = (Get-FileHash -LiteralPath $nodeExe -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($nodeVersion.Output -notmatch '^v24\.') { throw 'Node.js 24 is required for the Assessment validator bridge' }

    Set-SafePhase 'create-private-environment-root'
    [void][IO.Directory]::CreateDirectory($Root)
    $private = Join-Path $Root 'private'
    $data = Join-Path $Root 'mysql/data'
    $logs = Join-Path $Root 'logs'
    [void][IO.Directory]::CreateDirectory($private)
    [void][IO.Directory]::CreateDirectory($data)
    [void][IO.Directory]::CreateDirectory($logs)
    Protect-Directory $Root
    Protect-Directory $private
    Protect-Directory $data

    Set-SafePhase 'write-protected-runtime-configuration'
    $environmentToken = [Guid]::NewGuid().ToString('D').ToLowerInvariant()
    $environmentId = 'TEST_ONLY_HISTORY_DEVICE_' + $environmentToken
    $database = 'history_disposable_' + (New-RandomHex 8)
    # MySQL account names are limited to 32 characters; this prefix leaves 20 random hex characters.
    $username = 'history_app_' + (New-RandomHex 10)
    $runtimePassword = New-RandomUrlToken 32
    $rootPassword = New-RandomHex 32
    $hashSecret = New-RandomUrlToken 32
    $loginTicketA = New-RandomUrlToken 32
    $loginTicketB = New-RandomUrlToken 32

    $runtimeProperties = @(
        "environment.id=$environmentId",
        'environment.appIdGate=WAITING_FOR_OWNER',
        'mysql.host=127.0.0.1',
        "mysql.port=$MySqlPort",
        "mysql.database=$database",
        "mysql.username=$username",
        "mysql.password=$runtimePassword",
        "http.port=$HttpPort",
        "c5.hashSecret=$hashSecret",
        "c5.syntheticLoginTicketA=$loginTicketA",
        "c5.syntheticLoginTicketB=$loginTicketB",
        "node.executable=$($nodeExe.Replace('\', '/'))"
    ) -join "`n"
    Write-NewPrivateFile (Get-PrivatePath $Root 'runtime.properties') $runtimeProperties
    $adminOptions = @(
        '[client]',
        'user=root',
        "password=$rootPassword",
        'host=127.0.0.1',
        "port=$MySqlPort",
        'protocol=tcp'
    ) -join "`n"
    Write-NewPrivateFile (Get-PrivatePath $Root 'mysql-admin.cnf') $adminOptions
    $runtimeOptions = @(
        '[client]',
        "user=$username",
        "password=$runtimePassword",
        'host=127.0.0.1',
        "port=$MySqlPort",
        "database=$database",
        'protocol=tcp'
    ) -join "`n"
    Write-NewPrivateFile (Get-PrivatePath $Root 'mysql-runtime.cnf') $runtimeOptions

    $initSql = @(
        "ALTER USER 'root'@'localhost' IDENTIFIED BY '$rootPassword';",
        "CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '$rootPassword';",
        "ALTER USER 'root'@'127.0.0.1' IDENTIFIED BY '$rootPassword';",
        "CREATE DATABASE ``$database`` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;",
        "GRANT SELECT ON ``$database``.* TO 'root'@'127.0.0.1';",
        "GRANT SHUTDOWN ON *.* TO 'root'@'127.0.0.1';",
        "CREATE USER '$username'@'127.0.0.1' IDENTIFIED BY '$runtimePassword';",
        "GRANT ALL PRIVILEGES ON ``$database``.* TO '$username'@'127.0.0.1';",
        'FLUSH PRIVILEGES;'
    ) -join "`n"
    Write-NewPrivateFile (Get-PrivatePath $Root 'mysql-bootstrap.sql') $initSql

    $state = [pscustomobject]@{
        schema = 'history-isolated-environment-state-v1'
        status = 'INITIALIZING'
        environmentRoot = $Root
        environmentId = $environmentId
        appIdGate = 'WAITING_FOR_OWNER'
        productionWrite = $false
        mysql = [pscustomobject]@{
            version = $executables.Version
            bin = $executables.Bin
            port = $MySqlPort
            database = $database
            runtimeUser = $username
            dataDirectory = $data
            serverProcessId = 0
            processId = 0
        }
        backend = [pscustomobject]@{ port = $HttpPort; processId = 0; artifactRoot = $null; artifactId = $null; java = $null }
        node = [pscustomobject]@{ path = $nodeExe; version = $nodeVersion.Output; sha256 = $nodeHash }
        logs = [pscustomobject]@{ mysql = @(); backend = @() }
        createdAt = [DateTime]::UtcNow.ToString('o')
    }
    Write-State $state

    Set-SafePhase 'initialize-isolated-mysql-datadir'
    $initializeStdout = New-UniqueLogPath $logs 'mysql-initialize-stdout'
    $initializeStderr = New-UniqueLogPath $logs 'mysql-initialize-stderr'
    $mysqlBase = ConvertTo-FullPath (Join-Path $executables.Bin '..')
    $initArguments = @('--no-defaults', '--initialize-insecure', "--basedir=$mysqlBase", "--datadir=$data", "--log-error=$(Join-Path $logs 'mysql-initialize-error.log')")
    $initLine = ($initArguments | ForEach-Object { Quote-StartProcessArgument $_ }) -join ' '
    $initProcess = Start-Process -FilePath $executables.Mysqld -ArgumentList $initLine -WorkingDirectory $executables.Bin `
        -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $initializeStdout -RedirectStandardError $initializeStderr
    if ($initProcess.ExitCode -ne 0) { throw 'MySQL isolated datadir initialization failed; no files were deleted' }

    Set-SafePhase 'start-isolated-mysql-server'
    $mysqlLogs = @(New-UniqueLogPath $logs 'mysql-stdout'; New-UniqueLogPath $logs 'mysql-stderr')
    $mysqlErrorLog = New-UniqueLogPath $logs 'mysql-error'
    $serverArguments = @(
        '--no-defaults',
        "--basedir=$mysqlBase",
        "--datadir=$data",
        "--port=$MySqlPort",
        '--bind-address=127.0.0.1',
        '--mysqlx=0',
        '--skip-name-resolve',
        '--skip-log-bin',
        '--local-infile=0',
        '--secure-file-priv=NULL',
        '--max-connections=32',
        "--pid-file=$(Join-Path $Root 'mysql/mysqld.pid')",
        "--log-error=$mysqlErrorLog",
        "--init-file=$(Get-PrivatePath $Root 'mysql-bootstrap.sql')",
        '--console'
    )
    $mysqlProcess = Start-HiddenOwnedProcess $executables.Mysqld $serverArguments $Root $mysqlLogs[0] $mysqlLogs[1]
    $state.mysql.processId = $mysqlProcess.Id
    $state.logs.mysql = @($initializeStdout, $initializeStderr, $mysqlLogs[0], $mysqlLogs[1], $mysqlErrorLog)
    Write-State $state
    $adminConfig = Get-PrivatePath $Root 'mysql-admin.cnf'
    $runtimeConfig = Get-PrivatePath $Root 'mysql-runtime.cnf'
    Set-SafePhase 'verify-isolated-mysql-admin-connectivity'
    [void](Wait-MySqlReady $executables.Mysql $adminConfig $database $Root $mysqlProcess.Id)
    Set-SafePhase 'verify-runtime-database-identity'
    $runtimeIdentity = Wait-MySqlReady $executables.Mysql $runtimeConfig $database $Root $mysqlProcess.Id
    if ($runtimeIdentity -notmatch [regex]::Escape($username + '@127.0.0.1')) { throw 'runtime database user identity verification failed' }
    Set-SafePhase 'verify-runtime-database-grants'
    $grants = Invoke-MySql $executables.Mysql $runtimeConfig $database 'SHOW GRANTS FOR CURRENT_USER();' $Root
    $grantLines = @($grants -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $normalizedGrants = @($grantLines | ForEach-Object { $_.Replace('`', '').Replace("'", '') })
    if ($normalizedGrants.Count -ne 2 -or $normalizedGrants -notcontains "GRANT ALL PRIVILEGES ON $database.* TO $username@127.0.0.1" -or
            $normalizedGrants -notcontains "GRANT USAGE ON *.* TO $username@127.0.0.1") {
        throw 'runtime database grants exceed or differ from the dedicated test schema'
    }
    $mysqlProcessSet = Get-MySqlProcessSet $Root $executables.Mysqld $data
    if ($null -eq $mysqlProcessSet.Server) { throw 'isolated MySQL server PID could not be verified' }
    $state.mysql.serverProcessId = [int]$mysqlProcessSet.Server.ProcessId
    $state.status = 'MYSQL_READY'
    Write-State $state
    return $state
}

function Start-Backend([string]$Root, [string]$RequestedArtifactRoot, [string]$RequestedJavaExe) {
    Assert-NoRelevantEnvironmentOverrides
    Set-SafePhase 'start-environment-root-boundary-check'
    $Root = Assert-EnvironmentRoot $Root $false
    $state = Read-State $Root
    $mysql = Get-MySqlExecutables $state.mysql.bin
    $mysqlProcessSet = Get-MySqlProcessSet $Root $mysql.Mysqld $state.mysql.dataDirectory
    if ($mysqlProcessSet.Processes.Count -eq 0 -or -not (Test-TcpListener '127.0.0.1' $MySqlPort)) { throw 'owned isolated MySQL is not running' }
    Assert-PortFree $HttpPort
    $artifact = ConvertTo-FullPath $RequestedArtifactRoot
    if (-not (Test-PathWithin $artifact $Root) -or [IO.Path]::GetFileName($artifact) -ne 'backend-artifact') {
        throw 'frozen backend artifact must be inside this environment as backend-artifact'
    }
    $manifest = Get-ArtifactManifest $artifact
    $java = if ([string]::IsNullOrWhiteSpace($RequestedJavaExe)) { (Get-Command java.exe -ErrorAction Stop).Source } else { ConvertTo-FullPath $RequestedJavaExe }
    if (-not (Test-Path -LiteralPath $java -PathType Leaf)) { throw 'Java runtime is unavailable' }
    $runtimeConfig = Get-PrivatePath $Root 'runtime.properties'
    $privatePath = Get-PrivatePath $Root 'private'
    $runtimeAcls = & (Join-Path $env:SystemRoot 'System32/icacls.exe') $runtimeConfig
    if ($LASTEXITCODE -ne 0) { throw 'private runtime config ACL check failed' }
    $classPath = @(
        (Join-Path $artifact 'classes'),
        (Join-Path $artifact 'test-classes'),
        (Join-Path $artifact 'lib/*')
    ) -join [IO.Path]::PathSeparator
    $stdout = New-UniqueLogPath (Join-Path $Root 'logs') 'backend-stdout'
    $stderr = New-UniqueLogPath (Join-Path $Root 'logs') 'backend-stderr'
    $arguments = @('-cp', $classPath, 'com.wuhan.eldercare.visit.assessment.HistoryIsolatedEnvironmentServer', "--private-config=$runtimeConfig")
    $process = Start-HiddenOwnedProcess $java $arguments $artifact $stdout $stderr
    $state.backend.processId = $process.Id
    $state.backend.java = $java
    $state.backend.artifactRoot = $artifact
    $state.backend.artifactId = [string]$manifest.artifactId
    $state.logs.backend = @($stdout, $stderr)
    $state.status = 'BACKEND_STARTING'
    Write-State $state

    $ready = $false
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        $running = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
        if ($null -eq $running) { break }
        try {
            $response = Invoke-RestMethod -Uri "http://127.0.0.1:$HttpPort/api/v1/completed-assessments/trusted-preview-capability" -Method Get -TimeoutSec 2
            if ($response.availability -eq 'ready' -and $response.kind -eq 'trusted_recommendation_preview_capability_v1') { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) {
        [void](Stop-OwnedProcess ([int]$process.Id) $java @('com.wuhan.eldercare.visit.assessment.HistoryIsolatedEnvironmentServer', "--private-config=$runtimeConfig"))
        $state.backend.processId = 0
        $state.status = 'MYSQL_READY_BACKEND_REFUSED'
        Write-State $state
        throw 'isolated backend did not pass its local readiness gate; protected diagnostics were retained'
    }
    $state.status = 'TEST_ONLY_BACKEND_READY'
    Write-State $state
    return $state
}

function Verify-Environment([string]$Root) {
    Assert-NoRelevantEnvironmentOverrides
    Set-SafePhase 'verify-environment-root-boundary-check'
    $Root = Assert-EnvironmentRoot $Root $false
    $state = Read-State $Root
    $mysql = Get-MySqlExecutables $state.mysql.bin
    $mysqlProcessSet = Get-MySqlProcessSet $Root $mysql.Mysqld $state.mysql.dataDirectory
    $mysqlReady = $mysqlProcessSet.Processes.Count -gt 0 -and (Test-TcpListener '127.0.0.1' $MySqlPort)
    $backendReady = $false
    $capability = $null
    if ($state.backend.processId -gt 0 -and $state.backend.artifactRoot) {
        $artifact = Get-ArtifactManifest ([string]$state.backend.artifactRoot)
        if ($artifact.artifactId -ne $state.backend.artifactId) { throw 'running backend artifact identity changed' }
        $java = if (Test-Path -LiteralPath $state.backend.java -PathType Leaf) { [string]$state.backend.java } else { (Get-Command java.exe -ErrorAction Stop).Source }
        $ownedBackend = Get-OwnedProcess ([int]$state.backend.processId) $java @('com.wuhan.eldercare.visit.assessment.HistoryIsolatedEnvironmentServer', "--private-config=$(Get-PrivatePath $Root 'runtime.properties')", (Join-Path $state.backend.artifactRoot 'classes'), (Join-Path $state.backend.artifactRoot 'test-classes'))
        if ($null -ne $ownedBackend) {
            try {
                $capability = Invoke-RestMethod -Uri "http://127.0.0.1:$HttpPort/api/v1/completed-assessments/trusted-preview-capability" -Method Get -TimeoutSec 3
                $backendReady = $capability.availability -eq 'ready'
            } catch { }
        }
    }
    $runtimeIdentity = $null
    $grantScope = $null
    if ($mysqlReady) {
        $runtimeIdentity = Invoke-MySql $mysql.Mysql (Get-PrivatePath $Root 'mysql-runtime.cnf') $state.mysql.database 'SELECT CURRENT_USER(), DATABASE(), @@port;' $Root
        $grantScope = Invoke-MySql $mysql.Mysql (Get-PrivatePath $Root 'mysql-runtime.cnf') $state.mysql.database 'SHOW GRANTS FOR CURRENT_USER();' $Root
        $allGrantLines = @($grantScope -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { $_.Replace('`', '').Replace("'", '') })
        $allowedGrant = "^GRANT ALL PRIVILEGES ON $([regex]::Escape([string]$state.mysql.database))\.\* TO $([regex]::Escape([string]$state.mysql.runtimeUser))@127\.0\.0\.1$"
        $usageGrant = "^GRANT USAGE ON \*\.\* TO $([regex]::Escape([string]$state.mysql.runtimeUser))@127\.0\.0\.1$"
        $unexpectedGrants = @($allGrantLines | Where-Object { $_ -notmatch $allowedGrant -and $_ -notmatch $usageGrant })
        if ($unexpectedGrants.Count -gt 0 -or $allGrantLines.Count -ne 2 -or
                @($allGrantLines | Where-Object { $_ -match $allowedGrant }).Count -ne 1) {
            throw 'runtime database account has grants outside its test schema'
        }
    }
    return [pscustomobject]@{
        status = if ($backendReady -and $mysqlReady) { 'TEST_ONLY_BACKEND_READY' } elseif ($mysqlReady) { 'MYSQL_READY_DEVICE_BLOCKED' } else { 'STOPPED_OR_UNAVAILABLE' }
        environmentId = $state.environmentId
        database = $state.mysql.database
        runtimeUser = $state.mysql.runtimeUser
        mysqlPort = $MySqlPort
        mysqlOwned = $mysqlReady
        runtimeDatabaseIdentity = $runtimeIdentity
        runtimeGrantScope = $grantScope
        backendPort = $HttpPort
        backendOwned = $backendReady
        historyCapability = $capability
        testAppIdGate = 'WAITING_FOR_OWNER'
        productionWrite = $false
        artifactId = $state.backend.artifactId
        nodeVersion = $state.node.version
        nodeExecutableSha256 = $state.node.sha256
    }
}

function Stop-Environment([string]$Root) {
    Assert-NoRelevantEnvironmentOverrides
    Set-SafePhase 'stop-environment-root-boundary-check'
    $Root = Assert-EnvironmentRoot $Root $false
    $state = Read-State $Root
    $stoppedBackend = $false
    if ($state.backend.processId -gt 0 -and $state.backend.artifactRoot) {
        $java = if ($state.backend.java -and (Test-Path -LiteralPath $state.backend.java -PathType Leaf)) { [string]$state.backend.java } else { (Get-Command java.exe -ErrorAction Stop).Source }
        $runtimeConfig = Get-PrivatePath $Root 'runtime.properties'
        $ownedBackend = Get-OwnedProcess ([int]$state.backend.processId) $java @('com.wuhan.eldercare.visit.assessment.HistoryIsolatedEnvironmentServer', "--private-config=$runtimeConfig")
        if ($null -eq $ownedBackend) {
            $stoppedBackend = -not (Test-TcpListener '127.0.0.1' $HttpPort)
        } else {
            [void](Stop-OwnedProcess ([int]$state.backend.processId) $java @('com.wuhan.eldercare.visit.assessment.HistoryIsolatedEnvironmentServer', "--private-config=$runtimeConfig") -KillProcessTree)
            for ($attempt = 0; $attempt -lt 80; $attempt++) {
                if (-not (Test-TcpListener '127.0.0.1' $HttpPort)) { $stoppedBackend = $true; break }
                Start-Sleep -Milliseconds 250
            }
        }
        if ($stoppedBackend) { $state.backend.processId = 0 }
    } else {
        $stoppedBackend = -not (Test-TcpListener '127.0.0.1' $HttpPort)
    }
    $stoppedMysql = $false
    $mysql = Get-MySqlExecutables $state.mysql.bin
    $mysqlProcessSet = Get-MySqlProcessSet $Root $mysql.Mysqld $state.mysql.dataDirectory
    $listenerAtPort = Test-TcpListener '127.0.0.1' $MySqlPort
    if ($mysqlProcessSet.Processes.Count -gt 0) {
        if ($listenerAtPort) {
            try {
                $adminArgs = @("--defaults-file=$(Get-PrivatePath $Root 'mysql-admin.cnf')", '--host=127.0.0.1', "--port=$MySqlPort", '--protocol=tcp', '--connect-timeout=2', 'shutdown')
                [void](Invoke-CapturedProcess $mysql.MysqlAdmin $adminArgs $mysql.Bin (Get-IsolatedMySqlClientEnvironment $Root))
            } catch { }
        }
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            $mysqlProcessSet = Get-MySqlProcessSet $Root $mysql.Mysqld $state.mysql.dataDirectory
            if ($mysqlProcessSet.Processes.Count -eq 0 -and -not (Test-TcpListener '127.0.0.1' $MySqlPort)) {
                $stoppedMysql = $true
                break
            }
            Start-Sleep -Milliseconds 250
        }
        if (-not $stoppedMysql -and $mysqlProcessSet.Processes.Count -gt 0) {
            Stop-MySqlProcessSet $mysqlProcessSet.Processes $mysql.Mysqld $state.mysql.dataDirectory
            for ($attempt = 0; $attempt -lt 40; $attempt++) {
                $mysqlProcessSet = Get-MySqlProcessSet $Root $mysql.Mysqld $state.mysql.dataDirectory
                if ($mysqlProcessSet.Processes.Count -eq 0 -and -not (Test-TcpListener '127.0.0.1' $MySqlPort)) {
                    $stoppedMysql = $true
                    break
                }
                Start-Sleep -Milliseconds 250
            }
        }
    } elseif (-not $listenerAtPort) {
        $stoppedMysql = $true
    }
    $mysqlListenerAfterStop = Test-TcpListener '127.0.0.1' $MySqlPort
    $backendListenerAfterStop = Test-TcpListener '127.0.0.1' $HttpPort
    if ($stoppedMysql -and $stoppedBackend -and -not $mysqlListenerAfterStop -and -not $backendListenerAfterStop) {
        $state.mysql.processId = 0
        if ($state.mysql.PSObject.Properties['serverProcessId']) { $state.mysql.serverProcessId = 0 }
        $state.backend.processId = 0
        $state.status = 'STOPPED_DATA_RETAINED'
    } elseif ($backendListenerAfterStop -and $state.backend.processId -le 0) {
        $state.status = 'STOP_INCOMPLETE_UNOWNED_LISTENER'
    } else {
        $state.status = 'STOP_INCOMPLETE_DATA_RETAINED'
    }
    Write-State $state
    return [pscustomobject]@{ status = $state.status; backendStopped = $stoppedBackend; mysqlStopped = $stoppedMysql; dataRetained = $true }
}

try {
    Set-SafePhase "dispatch-$Mode"
    switch ($Mode) {
        'initialize' { $result = Initialize-Environment $EnvironmentRoot $MySqlBin $NodeExe }
        'start' {
            if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) { throw 'frozen backend artifact path is required for start' }
            $result = Start-Backend $EnvironmentRoot $ArtifactRoot $JavaExe
        }
        'verify' { $result = Verify-Environment $EnvironmentRoot }
        'stop' { $result = Stop-Environment $EnvironmentRoot }
    }
    $result | Select-Object status,environmentId,appIdGate,productionWrite,mysqlPort,backendPort,database,runtimeUser,mysqlOwned,backendOwned,testAppIdGate,artifactId,nodeVersion,nodeExecutableSha256,dataRetained,backendStopped,mysqlStopped
} catch {
    if ($script:BlockedEnvironmentNames.Count -gt 0) {
        $names = $script:BlockedEnvironmentNames -join ', '
        Write-Error "Isolated TEST_ONLY operation refused at safe phase '$($script:CurrentPhase)' because these environment variable names are set: $names. Values were not read into diagnostics. No environment data was deleted."
    } else {
        $failureType = if ($null -eq $_.Exception) { 'Unknown' } else { $_.Exception.GetType().Name }
        $failureLine = if ($null -eq $_.InvocationInfo) { 0 } else { [int]$_.InvocationInfo.ScriptLineNumber }
        Write-Error "Isolated TEST_ONLY environment operation failed at safe phase '$($script:CurrentPhase)' (failure type $failureType, helper line $failureLine). Exception text and configuration values were withheld. No environment data was deleted."
    }
    exit 1
}
