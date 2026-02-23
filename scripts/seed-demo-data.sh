#!/usr/bin/env bash
# ============================================================================
# seed-demo-data.sh
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

set -euo pipefail

GATEWAY_URL="${1:-http://localhost:8080}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_FILE="$SCRIPT_DIR/../data/seed.json"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

echo ""
echo -e "${CYAN}=== Seeding Demo Backend Services ===${NC}"
echo -e "${GRAY}  Gateway:   $GATEWAY_URL${NC}"
echo -e "${GRAY}  Seed file: $SEED_FILE${NC}"
echo ""

if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required. Install with: sudo apt install jq${NC}"
    exit 1
fi

if [ ! -f "$SEED_FILE" ]; then
    echo -e "${RED}Error: Seed file not found at $SEED_FILE${NC}"
    exit 1
fi

# ── Seed Payments (direct debit records) ─────────────────────────────────────
echo -e "${YELLOW}── Seeding Payments Service ──${NC}"

CUSTOMER_COUNT=$(jq '.customers | length' "$SEED_FILE")

for i in $(seq 0 $(( CUSTOMER_COUNT - 1 ))); do
    CUSTOMER_ID=$(jq -r ".customers[$i].customer_id" "$SEED_FILE")
    CUSTOMER_NAME=$(jq -r ".customers[$i].name" "$SEED_FILE")
    IBAN=$(jq -r ".customers[$i].iban" "$SEED_FILE")
    MANDATE=$(jq -r ".customers[$i].mandate_reference" "$SEED_FILE")

    BODY=$(jq -n \
        --arg cid "$CUSTOMER_ID" \
        --arg iban "$IBAN" \
        --arg mandate "$MANDATE" \
        '{customer_id: $cid, iban: $iban, mandate_reference: $mandate}')

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "$GATEWAY_URL/payments/direct-debit" \
        -H "Content-Type: application/json" \
        -H "x-correlation-id: seed-$CUSTOMER_ID" \
        -H "x-verification-token: vtok_seed_bypass" \
        -d "$BODY")

    if [ "$HTTP_CODE" -eq 200 ]; then
        echo -e "  ${GREEN}[OK]${NC} $CUSTOMER_ID — $CUSTOMER_NAME ($IBAN)"
    else
        echo -e "  ${RED}[FAIL]${NC} $CUSTOMER_ID — HTTP $HTTP_CODE"
    fi
done

# ── Verify seed ──────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}── Verifying Seed Data ──${NC}"

for i in $(seq 0 $(( CUSTOMER_COUNT - 1 ))); do
    CUSTOMER_ID=$(jq -r ".customers[$i].customer_id" "$SEED_FILE")

    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X GET "$GATEWAY_URL/payments/direct-debit/$CUSTOMER_ID" \
        -H "x-correlation-id: seed-verify")

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" -eq 200 ]; then
        IBAN=$(echo "$BODY" | jq -r '.iban')
        MANDATE=$(echo "$BODY" | jq -r '.mandate_reference')
        echo -e "  ${GREEN}[OK]${NC} $CUSTOMER_ID → IBAN: $IBAN, Mandate: $MANDATE"
    else
        echo -e "  ${RED}[FAIL]${NC} $CUSTOMER_ID — HTTP $HTTP_CODE"
    fi
done

echo ""
echo -e "${GREEN}=== Seed Complete ===${NC}"
echo ""
echo -e "${GRAY}  Customers seeded: $CUSTOMER_COUNT"
echo ""
echo "  Ready to run demos:"
echo "    cust-001  Happy path"
echo "    cust-002  High-value DD (€5k gate)"
echo "    cust-003  Low-confidence dispute"
echo "    cust-004  IDV failure"
echo "    cust-005  High-value dispute (€1k gate)"
echo -e "    cust-006  Policy violation${NC}"
echo ""
