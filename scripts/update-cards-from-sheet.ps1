param(
  [string]$SpreadsheetId = "1BcZ5N0Rk_8dUTIVSCKbatz2oBZEyuXk4L7S-Sm-IIUQ",
  [string]$SheetGid = "0",
  [string]$SheetTitle = "Sheet1",
  [string]$OutputPath = ".\data\cards.json"
)

$ErrorActionPreference = "Stop"

function Get-CellValue {
  param([object]$Cell)

  if ($null -eq $Cell) {
    return ""
  }

  if ($null -eq $Cell.v) {
    return ""
  }

  return [string]$Cell.v
}

function Normalize-CardText {
  param([string]$Value)

  if ($null -eq $Value) {
    return ""
  }

  return ($Value -replace "`r`n?", "`n" -replace "[ `t]+`n", "`n").TrimEnd()
}

$sheetUrl = "https://docs.google.com/spreadsheets/d/$SpreadsheetId/gviz/tq?gid=$SheetGid&tqx=out:json"
$response = Invoke-WebRequest -Uri $sheetUrl -UseBasicParsing
$content = $response.Content

$match = [regex]::Match($content, 'setResponse\((.*)\);', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $match.Success) {
  throw "Could not parse Google Sheets response."
}

$payload = $match.Groups[1].Value | ConvertFrom-Json
$rows = @($payload.table.rows)
if ($rows.Count -eq 0) {
  throw "The Google Sheet does not contain any rows."
}

$headerRow = @($rows[0].c)
$headers = @()
foreach ($cell in $headerRow) {
  $headers += (Get-CellValue $cell).Trim()
}

$requiredHeaders = @("category", "question", "definition", "keywords")
foreach ($requiredHeader in $requiredHeaders) {
  if ($headers -notcontains $requiredHeader) {
    throw "Missing required header: $requiredHeader"
  }
}

$headerIndex = @{}
for ($index = 0; $index -lt $headers.Count; $index++) {
  $headerIndex[$headers[$index]] = $index
}

$cards = New-Object System.Collections.Generic.List[object]
for ($rowIndex = 1; $rowIndex -lt $rows.Count; $rowIndex++) {
  $cells = @($rows[$rowIndex].c)

  $category = Normalize-CardText (Get-CellValue $cells[$headerIndex["category"]])
  $question = Normalize-CardText (Get-CellValue $cells[$headerIndex["question"]])
  $definition = Normalize-CardText (Get-CellValue $cells[$headerIndex["definition"]])
  $keywords = Normalize-CardText (Get-CellValue $cells[$headerIndex["keywords"]])

  if ([string]::IsNullOrWhiteSpace($question) -and [string]::IsNullOrWhiteSpace($definition) -and [string]::IsNullOrWhiteSpace($keywords)) {
    continue
  }

  $cards.Add([pscustomobject]@{
    id = $cards.Count + 1
    sourceFile = "Google Sheets/$SheetTitle"
    sourceTitle = $SheetTitle
    category = $category
    number = $cards.Count + 1
    question = $question
    definition = $definition
    keywords = $keywords
    score = ""
    note = ""
  })
}

$outputDirectory = Split-Path -Path $OutputPath -Parent
if ($outputDirectory -and -not (Test-Path $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$cards | ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding utf8
Write-Host "Saved $($cards.Count) cards to $OutputPath"
