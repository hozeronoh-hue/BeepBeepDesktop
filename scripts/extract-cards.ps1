$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipXml {
  param(
    [Parameter(Mandatory = $true)]
    [System.IO.Compression.ZipArchive]$Zip,
    [Parameter(Mandatory = $true)]
    [string]$EntryName
  )

  $entry = $Zip.GetEntry($EntryName)
  if (-not $entry) {
    throw "Zip entry not found: $EntryName"
  }

  $reader = [System.IO.StreamReader]::new($entry.Open())
  try {
    return [xml]$reader.ReadToEnd()
  } finally {
    $reader.Dispose()
  }
}

function Get-SharedStrings {
  param(
    [Parameter(Mandatory = $true)]
    [xml]$Xml
  )

  $ns = [System.Xml.XmlNamespaceManager]::new($Xml.NameTable)
  $ns.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

  $items = New-Object System.Collections.Generic.List[string]
  foreach ($si in $Xml.SelectNodes("//x:si", $ns)) {
    $parts = foreach ($node in $si.SelectNodes(".//x:t", $ns)) {
      $node.InnerText
    }
    $items.Add(($parts -join ""))
  }

  return $items
}

function Get-ColumnName {
  param([string]$CellRef)

  if ($CellRef -match "^[A-Z]+") {
    return $Matches[0]
  }

  return ""
}

function Get-CellValue {
  param(
    [System.Xml.XmlElement]$Cell,
    [System.Xml.XmlNamespaceManager]$Ns,
    [System.Collections.Generic.List[string]]$SharedStrings
  )

  $cellType = [string]$Cell.GetAttribute("t")
  $valueNode = $Cell.SelectSingleNode("./x:v", $Ns)
  $inlineNode = $Cell.SelectSingleNode("./x:is", $Ns)

  if ($cellType -eq "inlineStr" -and $inlineNode) {
    $parts = foreach ($node in $inlineNode.SelectNodes(".//x:t", $Ns)) {
      $node.InnerText
    }
    return ($parts -join "")
  }

  if (-not $valueNode) {
    return ""
  }

  $raw = $valueNode.InnerText
  if ($cellType -eq "s") {
    return $SharedStrings[[int]$raw]
  }

  return $raw
}

function Normalize-Text {
  param([string]$Text)

  if ($null -eq $Text) {
    return ""
  }

  $value = [string]$Text
  $value = $value -replace "_x0000_", ""
  $value = $value -replace "`r`n", "`n"
  $value = $value -replace "`r", "`n"
  $value = $value -replace "[ \t]+`n", "`n"
  $value = $value.Trim()
  return $value
}

function Get-WorksheetRows {
  param(
    [Parameter(Mandatory = $true)]
    [System.IO.Compression.ZipArchive]$Zip,
    [Parameter(Mandatory = $true)]
    [string]$SheetPath,
    [Parameter(Mandatory = $true)]
    [System.Collections.Generic.List[string]]$SharedStrings
  )

  $sheetXml = Read-ZipXml -Zip $Zip -EntryName $SheetPath
  $ns = [System.Xml.XmlNamespaceManager]::new($sheetXml.NameTable)
  $ns.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

  $rows = New-Object System.Collections.Generic.List[object]
  foreach ($row in $sheetXml.SelectNodes("//x:sheetData/x:row", $ns)) {
    $cells = @{}
    foreach ($cell in $row.SelectNodes("./x:c", $ns)) {
      $column = Get-ColumnName -CellRef $cell.GetAttribute("r")
      if ($column) {
        $cells[$column] = Get-CellValue -Cell $cell -Ns $ns -SharedStrings $SharedStrings
      }
    }
    $rows.Add([pscustomobject]$cells)
  }

  return $rows
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $projectRoot "data"
$outputPath = Join-Path $outputDir "cards.json"

if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$cards = New-Object System.Collections.Generic.List[object]
$excelFiles = Get-ChildItem -Path $projectRoot -Filter *.xlsx | Sort-Object Name
$globalId = 1

foreach ($file in $excelFiles) {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($file.FullName)
  try {
    $sharedStrings = Get-SharedStrings -Xml (Read-ZipXml -Zip $zip -EntryName "xl/sharedStrings.xml")
    $rows = Get-WorksheetRows -Zip $zip -SheetPath "xl/worksheets/sheet1.xml" -SharedStrings $sharedStrings
  } finally {
    $zip.Dispose()
  }

  foreach ($row in $rows | Select-Object -Skip 1) {
    $question = Normalize-Text $row.C
    $definition = Normalize-Text $row.D
    $keywords = Normalize-Text $row.E

    if ([string]::IsNullOrWhiteSpace($question) -and [string]::IsNullOrWhiteSpace($definition) -and [string]::IsNullOrWhiteSpace($keywords)) {
      continue
    }

    $numberValue = 0
    [void][int]::TryParse((Normalize-Text $row.B), [ref]$numberValue)

    $cards.Add([pscustomobject]@{
      id = $globalId
      sourceFile = $file.Name
      sourceTitle = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
      category = Normalize-Text $row.A
      number = $numberValue
      question = $question
      definition = $definition
      keywords = $keywords
      score = Normalize-Text $row.F
      note = Normalize-Text $row.G
    })

    $globalId += 1
  }
}

$cards |
  ConvertTo-Json -Depth 5 |
  Set-Content -Path $outputPath -Encoding UTF8

Write-Output "Saved $($cards.Count) cards to $outputPath"
