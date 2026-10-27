$ErrorActionPreference = 'Stop'
$receiptRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$receiptEndpoint = Read-Host 'Paste the deployed Apps Script /exec URL (not /dev)'
if ($receiptEndpoint -cnotmatch '^https://script\.google\.com/macros/s/[A-Za-z0-9_-]{20,200}/exec$') {
    throw 'Invalid receiver endpoint'
}
$receiptSecret = Read-Host 'Paste the receiver-only RECEIPT_TOKEN (64 lowercase hex characters; hidden)' -AsSecureString
$receiptPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($receiptSecret)
try {
    $receiptPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($receiptPointer)
    if ($receiptPlain -cnotmatch '^[0-9a-f]{64}$') { throw 'Invalid receiver token format' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($receiptPointer)
    $receiptPlain = $null
}
$receiptConfig = Join-Path $receiptRoot '.codex/delivery-receipt.local.json'
@{ endpoint = $receiptEndpoint; encryptedToken = (ConvertFrom-SecureString $receiptSecret) } |
    ConvertTo-Json | Set-Content -LiteralPath $receiptConfig -Encoding UTF8
Write-Host 'Saved Windows-user-bound encrypted receiver credential. No network request was made.'
