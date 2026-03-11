#!/bin/bash

# Test Flinks Sandbox API directement
echo "🧪 Test Flinks Sandbox API"
echo "================================"

# Variables sandbox
CUSTOMER_ID="43387ca6-0391-4c82-857d-70d95f087ecb"
API_DOMAIN="https://toolbox-api.private.fin.ag"
API_KEY="3d5266a8-b697-48d4-8de6-52e2e2662acc"
AUTHORIZE_TOKEN="O2r9FLhO7PBqz9L"

# Test LoginId (doit être un GUID/UUID valide)
# Le Connect iframe génère un vrai LoginId après authentification
# Pour ce test, on utilise un UUID valide
LOGIN_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"

echo ""
echo "📋 Configuration:"
echo "  Customer ID: $CUSTOMER_ID"
echo "  API Domain: $API_DOMAIN"
echo "  API Key: ${API_KEY:0:8}..."
echo "  Authorize Token: ${AUTHORIZE_TOKEN:0:8}..."
echo ""

# Test 1: Authorize endpoint
echo "🔐 Test 1: POST Authorize"
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
  echo "✅ Authorize: SUCCESS"
  REQUEST_ID=$(echo "$RESPONSE_BODY" | jq -r '.RequestId' 2>/dev/null)
  echo "   RequestId: $REQUEST_ID"

  # Test 2: GetAccountsDetail avec le RequestId
  if [ -n "$REQUEST_ID" ] && [ "$REQUEST_ID" != "null" ]; then
    echo ""
    echo "📊 Test 2: POST GetAccountsDetail"
    echo "================================"
    ACCOUNTS_URL="$API_DOMAIN/v3/$CUSTOMER_ID/BankingServices/GetAccountsDetail"
    echo "URL: $ACCOUNTS_URL"
    echo "RequestId: $REQUEST_ID"
    echo ""

    ACCOUNTS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$ACCOUNTS_URL" \
      -H "Content-Type: application/json" \
      -H "x-api-key: $API_KEY" \
      -d "{
        \"RequestId\": \"$REQUEST_ID\",
        \"WithAccountIdentity\": true,
        \"WithTransactions\": true,
        \"DaysOfTransactions\": \"Days90\"
      }")

    HTTP_CODE2=$(echo "$ACCOUNTS_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
    RESPONSE_BODY2=$(echo "$ACCOUNTS_RESPONSE" | sed '/HTTP_CODE:/d')

    echo "Response Code: $HTTP_CODE2"
    echo "Response Body:"
    echo "$RESPONSE_BODY2" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY2"
    echo ""

    if [ "$HTTP_CODE2" = "200" ]; then
      echo "✅ GetAccountsDetail: SUCCESS"
    elif [ "$HTTP_CODE2" = "202" ]; then
      echo "⏳ GetAccountsDetail: ASYNC (202) - needs retry"
    else
      echo "❌ GetAccountsDetail: FAILED (HTTP $HTTP_CODE2)"
    fi
  fi
else
  echo "❌ Authorize: FAILED (HTTP $HTTP_CODE)"
  echo ""
  echo "🔍 Diagnostics possibles:"
  if [ "$HTTP_CODE" = "401" ]; then
    echo "  - API Key incorrect ou non autorisé"
    echo "  - Customer ID n'a pas accès au sandbox"
    echo "  - Authorize Token manquant ou incorrect"
  elif [ "$HTTP_CODE" = "403" ]; then
    echo "  - Permissions insuffisantes"
    echo "  - Customer ID incorrect pour ce endpoint"
  elif [ "$HTTP_CODE" = "404" ]; then
    echo "  - URL incorrecte"
    echo "  - Customer ID n'existe pas"
  else
    echo "  - Erreur réseau ou serveur"
  fi
fi

echo ""
echo "================================"
echo "Test terminé!"
