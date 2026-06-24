$ErrorActionPreference = "Stop"
$appRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $appRoot
$source = Join-Path $repoRoot "notebook\mingyu\outputs\clustering"
$target = Join-Path $appRoot "api\models"

if (-not (Test-Path (Join-Path $source "kmeans_pipeline.pkl"))) {
    throw "kmeans_pipeline.pkl 원본을 찾을 수 없습니다: $source"
}

New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item -LiteralPath (Join-Path $source "kmeans_pipeline.pkl") -Destination $target -Force
Copy-Item -LiteralPath (Join-Path $source "dong_cluster_result.csv") -Destination $target -Force
Write-Host "모델 준비 완료: $target"
