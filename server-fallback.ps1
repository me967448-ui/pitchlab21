# Minimal Windows PowerShell fallback HTTP server for opening PitchLab 21 without Python.
# It serves the local website and health route. Live PESMASTER catalogue synchronization
# remains available only through server.py (Python 3).
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$dataDir = Join-Path $root 'data'
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }
$cacheFile = Join-Path $dataDir 'pesmaster-team-catalog.json'
$portFile = Join-Path $dataDir 'last-port.txt'
$listener = $null
$lastError = $null
foreach ($candidate in 8000..8010) {
  try {
    $tryListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, [int]$candidate)
    $tryListener.Start()
    $listener = $tryListener
    break
  } catch { $lastError = $_.Exception.Message }
}
if ($null -eq $listener) {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
}
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
[System.IO.File]::WriteAllText($portFile, [string]$port, [System.Text.Encoding]::ASCII)
$url = "http://127.0.0.1:$port/"
Write-Host ''
Write-Host 'PitchLab 21 compatibility server is running at:' -ForegroundColor Green
Write-Host $url -ForegroundColor Cyan
Write-Host 'Static website mode. Install Python 3 to enable live PESMASTER catalogue synchronization.' -ForegroundColor Yellow
Write-Host 'Keep this window open while using PitchLab 21. Press Ctrl+C to stop.'
try { Start-Process $url } catch { Write-Host ('Could not open the browser automatically. Copy this URL: ' + $url) -ForegroundColor Yellow }

function Send-Response($stream, [int]$status, [string]$reason, [string]$contentType, [byte[]]$body) {
  $header = "HTTP/1.1 $status $reason`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-cache`r`nX-Content-Type-Options: nosniff`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}
function Json-Bytes($obj) {
  $text = ConvertTo-Json -InputObject $obj -Depth 80 -Compress
  return ,([System.Text.Encoding]::UTF8.GetBytes($text))
}
function Get-CatalogPayload {
  if (Test-Path -LiteralPath $cacheFile) {
    try {
      $saved = Get-Content -LiteralPath $cacheFile -Raw -Encoding UTF8 | ConvertFrom-Json
      $status = if ($saved.partial) { 'partial' } else { 'complete' }
      $errorText = 'Compatibility mode is serving the saved catalogue. Live refresh requires Python 3.'
      return [ordered]@{ status=$status; phase='Saved catalogue loaded; live refresh requires Python 3'; leagueCount=@($saved.leagues).Count; leaguesProcessed=@($saved.leagues).Count; teamCount=@($saved.teams).Count; startedAt=$null; updatedAt=$saved.generatedAt; error=$errorText; teams=@($saved.teams); leagues=@($saved.leagues) }
    } catch { }
  }
  return [ordered]@{ status='unavailable'; phase='Website is open in compatibility mode; install Python 3 for live PESMASTER sync'; leagueCount=0; leaguesProcessed=0; teamCount=0; startedAt=$null; updatedAt=$null; error='The compatibility server can open the site, but live PESMASTER catalogue sync requires Python 3.'; teams=@(); leagues=@() }
}
try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) { $client.Close(); continue }
      while ($true) { $line = $reader.ReadLine(); if ($null -eq $line -or $line -eq '') { break } }
      $parts = $requestLine.Split(' ')
      if ($parts.Length -lt 2) { Send-Response $stream 400 'Bad Request' 'text/plain; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes('Bad Request')); $client.Close(); continue }
      $target = $parts[1]
      $rawPath = ($target -split '\?', 2)[0]
      $path = [System.Uri]::UnescapeDataString($rawPath)
      if ($path -eq '/api/health') {
        $body = Json-Bytes ([ordered]@{ ok=$true; server='PitchLab 21 compatibility'; catalogStatus='unavailable'; mode='static-fallback' })
        Send-Response $stream 200 'OK' 'application/json; charset=utf-8' $body
      } elseif ($path -eq '/api/team-catalog' -or $path -eq '/api/team-catalog/refresh') {
        $body = Json-Bytes (Get-CatalogPayload)
        $statusCode = if ($path -eq '/api/team-catalog/refresh') { 202 } else { 200 }
        $reason = if ($statusCode -eq 202) { 'Accepted' } else { 'OK' }
        Send-Response $stream $statusCode $reason 'application/json; charset=utf-8' $body
      } else {
        if ($path -eq '/') { $path = '/index.html' }
        $relative = $path.TrimStart('/') -replace '/', [System.IO.Path]::DirectorySeparatorChar
        $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
        $rootPrefix = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
        if (-not ($fullPath.Equals($root, [System.StringComparison]::OrdinalIgnoreCase) -or $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase))) {
          $bytes = [System.Text.Encoding]::UTF8.GetBytes('Forbidden')
          Send-Response $stream 403 'Forbidden' 'text/plain; charset=utf-8' $bytes
        } elseif (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
          $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
          Send-Response $stream 404 'Not Found' 'text/plain; charset=utf-8' $bytes
        } else {
          $ext = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
          $mime = switch ($ext) {
            '.html' { 'text/html; charset=utf-8' }
            '.js' { 'text/javascript; charset=utf-8' }
            '.css' { 'text/css; charset=utf-8' }
            '.json' { 'application/json; charset=utf-8' }
            '.svg' { 'image/svg+xml' }
            '.png' { 'image/png' }
            '.jpg' { 'image/jpeg' }
            '.jpeg' { 'image/jpeg' }
            '.webp' { 'image/webp' }
            '.ico' { 'image/x-icon' }
            '.txt' { 'text/plain; charset=utf-8' }
            default { 'application/octet-stream' }
          }
          $bytes = [System.IO.File]::ReadAllBytes($fullPath)
          Send-Response $stream 200 'OK' $mime $bytes
        }
      }
      $reader.Dispose()
      $stream.Dispose()
      $client.Close()
    } catch {
      try { $client.Close() } catch { }
    }
  }
} finally {
  try { $listener.Stop() } catch { }
  try { Remove-Item -LiteralPath $portFile -Force -ErrorAction SilentlyContinue } catch { }
}
