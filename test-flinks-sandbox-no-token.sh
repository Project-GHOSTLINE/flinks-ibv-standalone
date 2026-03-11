#!/bin/bash

# Test Flinks Sandbox API SANS authorize token
echo "🧪 Test Flinks Sandbox API (NO TOKEN)"
echo "================================"

# Variables sandbox
CUSTOMER_ID="43387ca6-0391-4c82-857d-70d95f087ecb"
API_DOMAIN="https://toolbox-api.private.fin.ag"
API_KEY="3d5266a8-b697-48d4-8de6-52e2e2662acc"

# Test LoginId (doit être un GUID/UUID valide)
LOGIN_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"

echo ""
echo "📋 Configuration:"
echo "  Customer ID: $CUSTOMER_ID"
echo "  API Domain: $API_DOMAIN"
echo "  API Key: ${API_KEY:0:8}..."
echo "  LoginId: $LOGIN_ID"
echo "  Token: NONE (testing without token)"
echo ""

# Test: Authorize endpoint WITHOUT token
echo "🔐 Test: POST Authorize (NO TOKEN)"
echo "================================"
AUTHORIZE_URL="$API_DOMAIN/v3/$CUSTOMER_ID/BankingServices/Authorize"
echo "URL: $AUTHORIZE_URL"
echo ""

AUTHORIZE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$AUTHORIZE_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"LoginId\": \"$LOGIN_ID\",
    \"Save\": true,
    \"MostRecentCached\": true
  }")

HTTP_CODE=$(echo "$AUTHORIZE_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$AUTHORIZE_RESPONSE" | sed '/HTTP_CODE:/d')

echo "Response Code: $HTTP_CODE"
echo "Response Body:"
echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
echo ""

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "✅ SUCCESS! Le sandbox fonctionne SANS authorize token!"
else
  echo "❌ FAILED (HTTP $HTTP_CODE)"
fi

echo ""
echo "================================"
