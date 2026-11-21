[CmdletBinding()]
param(
  [string]$BackendImage='pulsecart-backend:local',
  [string]$FrontendImage='pulsecart-frontend:local',
  [string]$KafkaBootstrap='kafka:9092',
  [ValidateSet('PLAINTEXT','SASL_SSL','SSL')][string]$KafkaProtocol='PLAINTEXT',
  [string]$KafkaUsername='',
  [string]$KafkaCaFile='',
  [string]$KafkaCertFile='',
  [string]$KafkaKeyFile='',
  [string]$OpenSearchUrl='http://opensearch:9200',
  [string]$OpenSearchUsername='',
  [string]$SmtpHost='',
  [string]$SmtpUser='',
  [string]$CorsOrigins='http://localhost:3000'
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$namespace='pulsecart'
$postgresPassword=Read-Host 'Postgres administrator password'
$appPassword=Read-Host 'PulseCart application database password'
$adminKey=Read-Host 'Admin API key'
$kafkaPassword=''; $openSearchPassword=''; $smtpPassword=''
if ($KafkaProtocol -ne 'PLAINTEXT') {
  if (-not $KafkaCaFile) { throw 'Pass -KafkaCaFile when Kafka TLS is enabled.' }
  $kafkaPassword=Read-Host 'Kafka SASL password'
}
if ($KafkaProtocol -eq 'SSL' -and (-not $KafkaCertFile -or -not $KafkaKeyFile)) { throw 'SSL requires Kafka client cert/key files; use SASL_SSL for SASL authentication.' }
if ($OpenSearchUsername) { $openSearchPassword=Read-Host 'OpenSearch password' }
if ($SmtpUser) { $smtpPassword=Read-Host 'SMTP password' }
$verify=if ($OpenSearchUrl -like 'https://*') {'true'} else {'false'}

Write-Host 'Building backend image...'
docker build -t $BackendImage (Join-Path $root 'backend')
if ($LASTEXITCODE -ne 0) { throw 'Backend image build failed.' }
Write-Host 'Building frontend image...'
docker build --build-arg 'BACKEND_URL=http://backend:8000' -t $FrontendImage (Join-Path $root 'frontend')
if ($LASTEXITCODE -ne 0) { throw 'Frontend image build failed.' }

kubectl create namespace $namespace --dry-run=client -o yaml | kubectl apply -f -
if ($LASTEXITCODE -ne 0) { throw 'Could not create Kubernetes namespace.' }
$secretArgs=@('create','secret','generic','pulsecart-secrets','-n',$namespace,'--dry-run=client','-o','yaml',"--from-literal=POSTGRES_PASSWORD=$postgresPassword","--from-literal=PG_PASSWORD=$appPassword","--from-literal=ADMIN_KEY=$adminKey","--from-literal=KAFKA_SASL_USERNAME=$KafkaUsername","--from-literal=KAFKA_SASL_PASSWORD=$kafkaPassword","--from-literal=OPENSEARCH_USERNAME=$OpenSearchUsername","--from-literal=OPENSEARCH_PASSWORD=$openSearchPassword","--from-literal=SMTP_USER=$SmtpUser","--from-literal=SMTP_PASSWORD=$smtpPassword")
& kubectl @secretArgs | kubectl apply -f -
if ($LASTEXITCODE -ne 0) { throw 'Could not create Kubernetes secrets.' }
if ($KafkaCaFile) {
  $tlsArgs=@('create','secret','generic','kafka-tls','-n',$namespace,"--from-file=ca_kafka.pem=$KafkaCaFile",'--dry-run=client','-o','yaml')
  if ($KafkaCertFile -and $KafkaKeyFile) { $tlsArgs += "--from-file=service.cert=$KafkaCertFile"; $tlsArgs += "--from-file=service.key=$KafkaKeyFile" }
  & kubectl @tlsArgs | kubectl apply -f -
  if ($LASTEXITCODE -ne 0) { throw 'Could not create Kafka TLS secret.' }
}

& (Join-Path $PSScriptRoot 'db-init.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Could not create PostgreSQL schema ConfigMap.' }
$configPath=Join-Path $PSScriptRoot 'pulsecart.yaml'
$text=Get-Content -LiteralPath $configPath -Raw
$text=$text.Replace('KAFKA_BOOTSTRAP: kafka:9092',"KAFKA_BOOTSTRAP: `"$KafkaBootstrap`"")
$text=$text.Replace('KAFKA_SECURITY_PROTOCOL: PLAINTEXT',"KAFKA_SECURITY_PROTOCOL: `"$KafkaProtocol`"")
$text=$text.Replace('OPENSEARCH_URL: http://opensearch:9200',"OPENSEARCH_URL: `"$OpenSearchUrl`"")
$text=$text.Replace('OPENSEARCH_VERIFY_CERTS: "false"',"OPENSEARCH_VERIFY_CERTS: `"$verify`"")
$text=$text.Replace('API_CORS_ORIGINS: http://localhost:3000',"API_CORS_ORIGINS: `"$CorsOrigins`"")
$tempConfig=Join-Path $env:TEMP 'pulsecart-k8s-config.yaml'
[IO.File]::WriteAllText($tempConfig,$text,[Text.UTF8Encoding]::new($false))
kubectl apply -f $tempConfig
if ($LASTEXITCODE -ne 0) { throw 'Could not apply configuration.' }
Remove-Item -LiteralPath $tempConfig -ErrorAction SilentlyContinue
kubectl apply -f $configPath
if ($LASTEXITCODE -ne 0) { throw 'Could not apply workloads.' }
kubectl set image deployment/backend backend=$BackendImage -n $namespace
if ($LASTEXITCODE -ne 0) { throw 'Backend image update failed.' }
kubectl set image deployment/relay relay=$BackendImage -n $namespace
if ($LASTEXITCODE -ne 0) { throw 'Relay image update failed.' }
kubectl set image deployment/search-sync search-sync=$BackendImage -n $namespace
if ($LASTEXITCODE -ne 0) { throw 'Search-sync image update failed.' }
kubectl set image deployment/notification notification=$BackendImage -n $namespace
if ($LASTEXITCODE -ne 0) { throw 'Notification image update failed.' }
kubectl set image deployment/frontend frontend=$FrontendImage -n $namespace
if ($LASTEXITCODE -ne 0) { throw 'Frontend image update failed.' }
kubectl rollout status deployment/postgres -n $namespace --timeout=5m
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL did not become ready.' }
kubectl rollout status deployment/backend -n $namespace --timeout=5m
if ($LASTEXITCODE -ne 0) { throw 'Backend did not become ready.' }
kubectl get pods,services -n $namespace
Write-Host 'Run: kubectl port-forward service/frontend 3000:3000 -n pulsecart'
