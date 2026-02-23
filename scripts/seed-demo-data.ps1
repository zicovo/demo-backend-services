# ============================================================================
# seed-demo-data.ps1
#
# Seeds the demo backend services with customer direct debit records so that
# GET /payments/direct-debit/:customer_id returns data during demos.
#
# The IDV and Cases services don't need seeding:
#   - IDV is stateless (verifies on every call)
#   - Cases auto-creates records on POST
#
# Prerequisites:
#   - docker compose up -d  (backend services running)
#   - Gateway on http://localhost:8080
# ============================================================================

param(
    [string]$GatewayUrl = "http://localhost:8080"
)

$ErrorActionPreference = "Stop"
$seedFile = Join-Path $PSScriptRoot "..\data\seed.json"
$seed = Get-Content $seedFile -Raw | ConvertFrom-Json

Write-Host "`n=== Seeding Demo Backend Services ===" -ForegroundColor Cyan
Write-Host "  Gateway: $GatewayUrl" -ForegroundColor DarkGray
Write-Host "  Seed file: $seedFile`n" -ForegroundColor DarkGray

# ── Seed Payments (direct debit records) ─────────────────────────────────────
Write-Host "── Seeding Payments Service ──" -ForegroundColor Yellow

foreach ($customer in $seed.customers) {
    $body = @{
        customer_id       = $customer.customer_id
        iban              = $customer.iban
        mandate_reference = $customer.mandate_reference
    } | ConvertTo-Json

    $headers = @{
        "Content-Type"         = "application/json"
        "x-correlation-id"     = "seed-$($customer.customer_id)"
        "x-verification-token" = "vtok_seed_bypass"
    }

    try {
        $response = Invoke-RestMethod `
            -Uri "$GatewayUrl/payments/direct-debit" `
            -Method POST `
            -Body $body `
            -Headers $headers `
            -ErrorAction Stop

        Write-Host "  [OK] $($customer.customer_id) — $($customer.name) ($($customer.iban))" -ForegroundColor Green
    }
    catch {
        Write-Host "  [FAIL] $($customer.customer_id) — $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ── Verify seed ──────────────────────────────────────────────────────────────
Write-Host "`n── Verifying Seed Data ──" -ForegroundColor Yellow

foreach ($customer in $seed.customers) {
    try {
        $record = Invoke-RestMethod `
            -Uri "$GatewayUrl/payments/direct-debit/$($customer.customer_id)" `
            -Method GET `
            -Headers @{ "x-correlation-id" = "seed-verify" } `
            -ErrorAction Stop

        Write-Host "  [OK] $($customer.customer_id) → IBAN: $($record.iban), Mandate: $($record.mandate_reference)" -ForegroundColor Green
    }
    catch {
        Write-Host "  [FAIL] $($customer.customer_id) — $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Seed Complete ===" -ForegroundColor Green
Write-Host @"

  Customers seeded: $($seed.customers.Count)
  
  Ready to run demos:
    .\scripts\run-happy.ps1          # Happy path (cust-001)
    .\scripts\run-whatif-model.ps1   # High-value DD (cust-002)
    .\scripts\run-whatif-prompt.ps1  # Low-confidence dispute (cust-003)

"@ -ForegroundColor DarkGray
