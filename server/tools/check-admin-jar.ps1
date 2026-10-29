param(
    [string]$JarPath = 'server/target/visit-submission-server-0.1.0-SNAPSHOT.jar',
    [string]$JavaExecutable = 'java',
    [string]$OutputDirectory = 'output/admin-react-rebuild-v1-20261028/backend/jar-smoke'
)
$ErrorActionPreference = 'Stop'
$adminJavaVersion = (& $JavaExecutable --version 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $adminJavaVersion -notmatch '(?m)(?:openjdk|java) (?:2[1-9]|[3-9][0-9])\.') { throw 'Java21+ executable is required for the packaged server smoke' }
$adminRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$adminOutput = [IO.Path]::GetFullPath((Join-Path $adminRoot $OutputDirectory))
if (-not $adminOutput.StartsWith((Join-Path $adminRoot 'output') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Smoke evidence must stay under project output'
}
[void](New-Item -ItemType Directory -Force -Path $adminOutput)
$adminJar = (Resolve-Path -LiteralPath $JarPath).Path
$adminPrefix = 'BOOT-INF/classes/static/p1-admin/'
$adminArchive = [IO.Compression.ZipFile]::OpenRead($adminJar)
try {
    $adminEntries = @($adminArchive.Entries | Where-Object { $_.FullName.StartsWith($adminPrefix) -and -not $_.FullName.EndsWith('/') })
    $adminIndexEntry = $adminArchive.GetEntry($adminPrefix + 'index.html')
    if (-not $adminIndexEntry) { throw 'Packaged React index is missing' }
    $adminReader = [IO.StreamReader]::new($adminIndexEntry.Open())
    try { $adminHtml = $adminReader.ReadToEnd() } finally { $adminReader.Dispose() }
    $adminAssetPaths = @([regex]::Matches($adminHtml, '(?:src|href)="(/p1-admin/assets/[^"?#]+)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
    if (-not ($adminAssetPaths -match '\.js$') -or -not ($adminAssetPaths -match '\.css$')) { throw 'React index must reference bundled same-origin JS and CSS assets' }
    if ($adminHtml -match '(?:src|href)="(?:https?:)?//') { throw 'Runtime external static dependencies are forbidden' }
    foreach ($adminAsset in $adminAssetPaths) {
        if (-not $adminArchive.GetEntry('BOOT-INF/classes/static' + $adminAsset)) { throw "Referenced packaged asset is missing: $adminAsset" }
    }
    $adminDist = Join-Path $adminRoot 'admin-web/dist'
    $adminDistFiles = @(Get-ChildItem -LiteralPath $adminDist -File -Recurse -Force)
    if ($adminDistFiles.Count -ne $adminEntries.Count) { throw 'Packaged static file count differs from the complete Vite dist, including lazy chunks' }
    foreach ($adminDistFile in $adminDistFiles) {
        $adminRelative = $adminDistFile.FullName.Substring($adminDist.Length + 1).Replace('\','/')
        if (-not $adminArchive.GetEntry($adminPrefix + $adminRelative)) { throw "Vite output was omitted from JAR: $adminRelative" }
    }
    $adminAssetPaths = @($adminEntries | Where-Object { $_.FullName -match '\.(js|css)$' } | ForEach-Object { '/p1-admin/' + $_.FullName.Substring($adminPrefix.Length) })
    foreach ($adminOld in @('app.js','operations.js','publications.js','style.css')) {
        if ($adminArchive.GetEntry($adminPrefix + $adminOld)) { throw "Legacy workbench resource remains in JAR: $adminOld" }
    }
    # Check every copied output file, including lazy route chunks, against this exact Vite dist.
    foreach ($adminEntry in $adminEntries) {
        $adminRelative = $adminEntry.FullName.Substring($adminPrefix.Length)
        $adminSource = Join-Path $adminRoot ('admin-web/dist/' + $adminRelative)
        if (-not (Test-Path -LiteralPath $adminSource -PathType Leaf)) { throw "JAR contains a stale or unexpected backend resource: $adminRelative" }
        $adminStream = $adminEntry.Open()
        $adminSha = [Security.Cryptography.SHA256]::Create()
        try { $adminEntryHash = [BitConverter]::ToString($adminSha.ComputeHash($adminStream)).Replace('-','') } finally { $adminStream.Dispose(); $adminSha.Dispose() }
        if ($adminEntryHash -ne (Get-FileHash -LiteralPath $adminSource -Algorithm SHA256).Hash) { throw "JAR resource differs from current Vite dist: $adminRelative" }
    }
} finally { $adminArchive.Dispose() }

$adminLog = Join-Path $adminOutput 'jar-server.log'
$adminErrorLog = Join-Path $adminOutput 'jar-server-error.log'
$adminProcess = Start-Process -FilePath $JavaExecutable -ArgumentList @('-jar',('"'+$adminJar+'"'),'--server.address=127.0.0.1','--server.port=0',
    '--c4.persistence.enabled=false','--c5.auth.enabled=false','--c2.history.writes-enabled=false','--p1.intake.enabled=false','--institution.publications.enabled=false') -WindowStyle Hidden -PassThru -RedirectStandardOutput $adminLog -RedirectStandardError $adminErrorLog
$adminChecks = @()
try {
    $adminPort = $null
    for ($adminAttempt=0; $adminAttempt -lt 120; $adminAttempt++) {
        $adminStartup = Get-Content -LiteralPath $adminLog -Raw -ErrorAction SilentlyContinue
        if ($adminStartup -match 'Tomcat started on port ([0-9]+)') { $adminPort = [int]$Matches[1]; break }
        if ($adminProcess.HasExited) { throw 'Packaged server exited; inspect its local smoke logs' }
        Start-Sleep -Milliseconds 250
    }
    if (-not $adminPort) { throw 'Packaged server did not start within the bounded local smoke window' }
    $adminOrigin = "http://127.0.0.1:$adminPort"
    function Read-AdminSmoke([string]$Path) {
        try { return Invoke-WebRequest -Uri ($adminOrigin + $Path) -UseBasicParsing -TimeoutSec 10 }
        catch {
            if (-not $_.Exception.Response) { throw }
            return [pscustomobject]@{StatusCode=[int]$_.Exception.Response.StatusCode;Content='';Headers=@{}}
        }
    }
    foreach ($adminPage in @('/p1-admin','/p1-admin/','/p1-admin/index.html','/p1-admin/dashboard','/p1-admin/requests','/p1-admin/visits','/p1-admin/institutions','/p1-admin/reports/','/p1-admin/more','/p1-admin/more/')) {
        $adminResponse = Read-AdminSmoke $adminPage
        if ($adminResponse.StatusCode -ne 200 -or $adminResponse.Content -ne $adminHtml) { throw "React page or deep-link refresh failed: $adminPage" }
        $adminChecks += [pscustomobject]@{path=$adminPage;status=200;kind='React page'}
    }
    foreach ($adminAsset in $adminAssetPaths) {
        $adminResponse = Read-AdminSmoke $adminAsset
        if ($adminResponse.StatusCode -ne 200 -or $adminResponse.Content -match '^\s*<!doctype') { throw "Bundled asset did not load correctly: $adminAsset" }
        $adminChecks += [pscustomobject]@{path=$adminAsset;status=200;kind='Bundled asset'}
    }
    foreach ($adminMissing in @('/p1-admin/assets/missing.js','/p1-admin/missing.css','/p1-admin/unknown','/p1-admin/institutions/unknown','/api/v1/unknown')) {
        $adminResponse = Read-AdminSmoke $adminMissing
        if ($adminResponse.StatusCode -ne 404) { throw "Missing resource/API incorrectly handled: $adminMissing" }
        $adminChecks += [pscustomobject]@{path=$adminMissing;status=404;kind='No SPA fallback'}
    }
    $adminConfig = Invoke-RestMethod ($adminOrigin + '/api/v1/p1-service/config') -TimeoutSec 10
    if ($adminConfig.enabled -or $adminConfig.datasetMode -ne 'PRODUCTION') { throw 'Production JAR unexpectedly enabled real intake or synthetic identity' }
    $adminSession = Read-AdminSmoke '/api/v1/p1-service/admin/session'
    if ($adminSession.StatusCode -ne 503) { throw 'Unconfigured production administrator must remain unavailable' }
    $adminChecks += [pscustomobject]@{path='/api/v1/p1-service/config';status=200;kind='Production intake remains disabled'}
    $adminChecks += [pscustomobject]@{path='/api/v1/p1-service/admin/session';status=503;kind='Unconfigured admin remains unavailable'}
    [pscustomobject]@{checkedAt=[DateTimeOffset]::Now.ToString('o');jarSha256=(Get-FileHash -LiteralPath $adminJar -Algorithm SHA256).Hash.ToLowerInvariant();origin=$adminOrigin;packagedStaticFiles=$adminEntries.Count;checks=$adminChecks;realBusinessEnabled=$false} |
        ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $adminOutput 'result.json') -Encoding UTF8
    Write-Output ("Production JAR smoke passed: {0} static files; {1} real HTTP checks; business stays disabled." -f $adminEntries.Count,$adminChecks.Count)
} finally {
    if (-not $adminProcess.HasExited) { Stop-Process -Id $adminProcess.Id -ErrorAction Stop }
}
