$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$files = @{}
$files['001-schema.sql'] = Get-Content -LiteralPath (Join-Path $root 'db/schema.sql') -Raw
foreach ($migration in Get-ChildItem -LiteralPath (Join-Path $root 'db/migrations') -Filter '*.sql' | Sort-Object Name) {
    $files[$migration.Name] = Get-Content -LiteralPath $migration.FullName -Raw
}
$files['999-app-role.sh'] = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'postgres-app-role.sh') -Raw
$temp = Join-Path $env:TEMP 'pulsecart-db-init.yaml'
$binaryData = @{}
foreach ($entry in $files.GetEnumerator()) {
    $binaryData[$entry.Key] = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($entry.Value))
}
$object = @{ apiVersion='v1'; kind='ConfigMap'; metadata=@{name='pulsecart-db-init';namespace='pulsecart'}; binaryData=$binaryData }
$json = $object | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($temp, $json, [Text.UTF8Encoding]::new($false))
kubectl apply -f $temp
if ($LASTEXITCODE -ne 0) { throw 'Failed to create database schema ConfigMap.' }
Remove-Item -LiteralPath $temp -ErrorAction SilentlyContinue
