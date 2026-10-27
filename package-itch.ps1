# Builds dist/checkmate-survivors-html5.zip with index.html at the root (what itch.io expects).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force -Path dist | Out-Null
$zip = "dist/checkmate-survivors-html5.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path index.html, css, js -DestinationPath $zip
Write-Host "Created $zip"
