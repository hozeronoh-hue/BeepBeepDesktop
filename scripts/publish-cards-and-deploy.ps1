param(
  [switch]$SkipSync
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  if (-not $SkipSync) {
    powershell -ExecutionPolicy Bypass -File .\scripts\update-cards-from-sheet.ps1
    if ($LASTEXITCODE -ne 0) {
      throw 'cards sync failed.'
    }
  }

  npx.cmd vercel deploy --prod --yes
  if ($LASTEXITCODE -ne 0) {
    throw 'vercel deploy failed.'
  }
}
finally {
  Pop-Location
}
