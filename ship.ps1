# Push -> CI builds IPA -> download -> serve to iPad. Usage: .\ship.ps1   (add -NoPush to just re-serve)
param([switch]$NoPush)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not $NoPush) {
    git push
    $sha = git rev-parse HEAD
    $id = $null
    while (-not $id) {   # GitHub needs a moment to register the run
        Start-Sleep 3
        $id = gh run list --commit $sha --workflow "Build IPA" --limit 1 --json databaseId --jq '.[0].databaseId'
    }
    gh run watch $id --exit-status
    if ($LASTEXITCODE) { throw "Build failed" }
}

Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue
if ($NoPush) { $id = gh run list --workflow "Build IPA" --status success --limit 1 --json databaseId --jq '.[0].databaseId' } # after a push, keep the id of the run we just watched (the list can lag behind)
gh run download $id -n KidsTodo-ipa -D dist

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -match '^(192\.168|10\.)' } | Select-Object -First 1).IPAddress
$base = "http://${ip}:8000"

# One card per IPA: install, download, and a browser preview (the web app is inside the IPA; it falls back to localStorage without the iOS shell).
$apps = @(
    @{ name = 'Mijn dag (kids)'; id = 'kids'; ipa = 'KidsTodo.ipa'; dir = 'dist';       app = 'KidsTodo.app'; w = 1024; h = 768 },
    @{ name = 'Dagboek';         id = 'diary'; ipa = 'diary/Diary.ipa'; dir = 'dist/diary'; app = 'Diary.app';    w = 1024; h = 768 }
)
$cards = ''
foreach ($a in $apps) {
    $file = Join-Path $a.dir (Split-Path $a.ipa -Leaf)
    if (-not (Test-Path $file)) { continue }
    $out = "dist/preview/$($a.id)"
    New-Item -ItemType Directory -Force $out | Out-Null
    tar -xf $file -C $out --strip-components=3 "Payload/$($a.app)/web"
    $cards += "<div class=card><h2>$($a.name)</h2>" +
        "<a class=b href=`"apple-magnifier://install?url=$base/$($a.ipa)`">Installeren in TrollStore</a>" +
        "<a class=b href=`"$($a.ipa)`">IPA downloaden</a>" +
        "<a class=b href=`"preview.html?app=$($a.id)&w=$($a.w)&h=$($a.h)`">Preview (iPad)</a></div>"
}
Copy-Item tools\preview.html dist\preview.html
@"
<meta charset=utf-8><meta name=viewport content="width=device-width"><title>Apps</title>
<style>body{font:22px system-ui,sans-serif;background:#f4f6fb;padding:30px;max-width:640px;margin:auto}
.card{background:#fff;border-radius:20px;padding:20px 24px;margin-bottom:20px}h2{margin:0 0 12px}
.b{display:block;padding:14px 18px;margin-top:10px;border-radius:14px;background:#eef3ff;color:#2b7cff;font-weight:600;text-decoration:none}</style>
$cards
"@ | Set-Content dist\index.html -Encoding utf8

Write-Host "On iPad Safari open: http://${ip}:8000"
Write-Host "Serving build $((Get-Content dist\version.json | ConvertFrom-Json).build). Ctrl+C to stop."
python tools\serve.py
