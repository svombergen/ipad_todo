# Push -> CI builds IPA -> download -> serve to iPad. Usage: .\ship.ps1   (add -NoPush to just re-serve)
param([switch]$NoPush)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not $NoPush) {
    git push
    $sha = git rev-parse HEAD
    Start-Sleep 5   # let GitHub register the run
    $id = gh run list --commit $sha --workflow "Build IPA" --limit 1 --json databaseId --jq '.[0].databaseId'
    gh run watch $id --exit-status
}

Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue
if ($NoPush) { $id = gh run list --workflow "Build IPA" --status success --limit 1 --json databaseId --jq '.[0].databaseId' } # after a push, keep the id of the run we just watched (the list can lag behind)
gh run download $id -n KidsTodo-ipa -D dist

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -match '^(192\.168|10\.)' } | Select-Object -First 1).IPAddress
$url = "http://${ip}:8000/KidsTodo.ipa"
@"
<meta name=viewport content="width=device-width"><body style="font:28px sans-serif;padding:40px">
<p><a href="apple-magnifier://install?url=$url">Install in TrollStore</a></p>
<p><a href="KidsTodo.ipa">Plain download (then Share -> TrollStore)</a></p>
"@ | Set-Content dist\index.html

Write-Host "On iPad Safari open: http://${ip}:8000"
Write-Host "Serving build $((Get-Content dist\version.json | ConvertFrom-Json).build). Ctrl+C to stop."
python tools\serve.py
