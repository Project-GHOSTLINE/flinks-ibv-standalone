#!/bin/bash

# Test Flinks PRODUCTION API pour vérifier que curl fonctionne
echo "🧪 Test Flinks PRODUCTION API"
echo "================================"
echo "⚠️  WARNING: Testing with PRODUCTION credentials!"
echo ""

# Variables PRODUCTION
CUSTOMER_ID="aeca04b8-0164-453f-88f7-07252d7042bd"
API_DOMAIN="https://solutionargentrapide-api.private.fin.ag"
API_KEY="ca640342-86cc-45e4-b3f9-75dbda05b0ae"
AUTHORIZE_TOKEN="e517dd46-6ac6-4f86-abd6-eed1cc8a2194"

# Test LoginId
LOGIN_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"

echo "📋 Configuration:"
echo "  Customer ID: $CUSTOMER_ID"
echo "  API Domain: $API_DOMAIN"
echo "  API Key: ${API_KEY:0:8}..."
echo "  Authorize Token: ${AUTHORIZE_TOKEN:0:8}..."
echo "  LoginId: $LOGIN_ID"
echo ""

# Test: Authorize endpoint
echo "🔐 Test: POST Authorize (PRODUCTION)"
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
    \"MostRecentCached\": true,
    \"Token\": \"$AUTHORIZE_TOKEN\",
    \"AuthToken\": \"$AUTHORIZE_TOKEN\"
  }")

HTTP_CODE=$(echo "$AUTHORIZE_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$AUTHORIZE_RESPONSE" | sed '/HTTP_CODE:/d')

echo "Response Code: $HTTP_CODE"
echo "Response Body:"
echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
echo ""

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "✅ PRODUCTION API: SUCCESS!"
  echo "   Cela prouve que notre méthode curl fonctionne!"
elif [ "$HTTP_CODE" = "401" ]; then
  echo "❌ PRODUCTION API: 401 Unauthorized"
  echo "   Le token production a aussi un problème!"
else
  echo "❌ PRODUCTION API: HTTP $HTTP_CODE"
fi

echo ""
echo "================================"
