$ErrorActionPreference = "Stop"

$token = $env:WECHATIDE_MCP_TOKEN

if ([string]::IsNullOrWhiteSpace($token)) {
    [Console]::Error.WriteLine(
        "WECHATIDE_MCP_TOKEN is not set. Configure it as a Windows user environment variable."
    )
    exit 2
}

& wechatide mcp "--token=$token"

exit $LASTEXITCODE