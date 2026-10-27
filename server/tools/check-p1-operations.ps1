param(
 [string]$DatabaseSettings='output/p1-1/mysql.private.json',
 [string]$Tests='P1BoundaryTest,P1ServiceMySqlIntegrationTest,P1OperationsMySqlIntegrationTest,P1ReportsMySqlIntegrationTest',
 [string]$JavaHome=$env:JAVA_HOME,
 [string]$MigrationRootClient,
 [string]$MySqlExecutable='C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe'
)
$ErrorActionPreference='Stop'
$p1Root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
[void](New-Item -ItemType Directory -Force -Path (Join-Path $p1Root 'output/p1-operations'))
if(-not $JavaHome -or -not(Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))){throw 'Pass -JavaHome with the installed Java21+ directory'}
$p1SettingsPath=(Resolve-Path -LiteralPath $DatabaseSettings).Path
if (-not $p1SettingsPath.StartsWith((Join-Path $p1Root 'output')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Private settings must be in project output' }
$p1Settings=Get-Content -LiteralPath $p1SettingsPath -Raw | ConvertFrom-Json
if ($p1Settings.P1_DISPOSABLE_MYSQL -ne 'true' -or $p1Settings.P1_MYSQL_URL -notmatch '^jdbc:mysql://127\.0\.0\.1:(?!3306/)[0-9]+/p1_intake_disposable_[a-z0-9]+\?') { throw 'Only disposable P1 loopback MySQL on non3306 allowed' }
$p1Previous=@{}
$p1MigrationSchemas=@()
try {
 foreach($p1Name in @('P1_DISPOSABLE_MYSQL','P1_MYSQL_URL','P1_MYSQL_USERNAME','P1_MYSQL_PASSWORD')) {
  $p1Previous[$p1Name]=[Environment]::GetEnvironmentVariable($p1Name,'Process')
  [Environment]::SetEnvironmentVariable($p1Name,[string]$p1Settings.$p1Name,'Process')
 }
 if($Tests -match 'MySqlIntegrationTest') {
  # Separate the test suite from the GUI rehearsal schema and provision only explicit temporary schemas.
  if(-not $MigrationRootClient){$MigrationRootClient=Join-Path ([IO.File]::ReadAllText((Join-Path $p1Root 'output/c2-a/active-instance.txt')).Trim()) 'root-client.private.cnf'}
  $p1RootClient=(Resolve-Path -LiteralPath $MigrationRootClient).Path
  $p1RootConfig=Get-Content -LiteralPath $p1RootClient
  if(-not $p1RootClient.StartsWith((Join-Path $p1Root 'output')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or
    $p1RootConfig -notcontains 'host=127.0.0.1' -or $p1RootConfig -notcontains 'port=33427' -or $p1Settings.P1_MYSQL_USERNAME -notmatch '^p1_test_[a-z0-9]+$') { throw 'Isolated migration provisioning guard failed' }
  $p1MigrationSchemas=@(('p1_intake_disposable_ops'+[guid]::NewGuid().ToString('N')),('p1_intake_disposable_ops'+[guid]::NewGuid().ToString('N')),('p1_intake_disposable_ops'+[guid]::NewGuid().ToString('N')))
  $p1Provision=($p1MigrationSchemas | ForEach-Object { "CREATE DATABASE ``$_`` CHARACTER SET utf8mb4; GRANT ALL PRIVILEGES ON ``$_``.* TO '$($p1Settings.P1_MYSQL_USERNAME)'@'localhost';" }) -join "`n"
  $p1Provision | & $MySqlExecutable "--defaults-file=$p1RootClient" --batch *> (Join-Path $p1Root 'output/p1-operations/migration-provision.log')
  if($LASTEXITCODE -ne 0) { throw 'Isolated migration provisioning failed' }
  $p1Previous['P1_MIGRATION_SCHEMAS']=[Environment]::GetEnvironmentVariable('P1_MIGRATION_SCHEMAS','Process')
  $env:P1_MIGRATION_SCHEMAS=$p1MigrationSchemas[1..2] -join ','
  $env:P1_MYSQL_URL=[regex]::Replace([string]$p1Settings.P1_MYSQL_URL,'/p1_intake_disposable_[a-z0-9]+\?',('/'+$p1MigrationSchemas[0]+'?'))
 }
 $p1OldJava=$env:JAVA_HOME; $p1OldPath=$env:Path
 $env:JAVA_HOME=$JavaHome; $env:Path=$JavaHome+'/bin;'+$env:Path
 Push-Location (Join-Path $p1Root 'server')
 try {
  & mvn '-q' "-Dtest=$Tests" test *> (Join-Path $p1Root 'output/p1-operations/backend-tests.log')
  $p1Exit=$LASTEXITCODE
 } finally { Pop-Location; $env:JAVA_HOME=$p1OldJava; $env:Path=$p1OldPath }
} finally {
 foreach($p1Name in $p1Previous.Keys) { [Environment]::SetEnvironmentVariable($p1Name,$p1Previous[$p1Name],'Process') }
 if($p1MigrationSchemas.Count -gt 0) {
  $p1Cleanup=($p1MigrationSchemas | ForEach-Object { if($_ -notmatch '^p1_intake_disposable_ops[a-f0-9]{32}$'){throw 'Unexpected migration schema'}; "REVOKE ALL PRIVILEGES ON ``$_``.* FROM '$($p1Settings.P1_MYSQL_USERNAME)'@'localhost'; DROP DATABASE ``$_``;" }) -join "`n"
  $p1Cleanup | & $MySqlExecutable "--defaults-file=$p1RootClient" --batch *> (Join-Path $p1Root 'output/p1-operations/migration-cleanup.log')
 }
}
if($p1Exit -ne 0) { Write-Output 'P1 checks failed; inspect output/p1-operations/backend-tests.log'; exit $p1Exit }
Write-Output 'P1 checks passed; actual test counts are in server/target/surefire-reports.'
