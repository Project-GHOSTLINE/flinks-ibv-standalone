#!/bin/bash

echo "🚀 Migration vers PRODUCTION credentials"
echo "========================================"
echo ""

# Production credentials
CUSTOMER_ID="aeca04b8-0164-453f-88f7-07252d7042bd"
API_DOMAIN="https://solutionargentrapide-api.private.fin.ag"
API_KEY="ca640342-86cc-45e4-b3f9-75dbda05b0ae"
AUTHORIZE_TOKEN="e517dd46-6ac6-4f86-abd6-eed1cc8a2194"
CONNECT_DOMAIN="https://solutionargentrapide-iframe.private.fin.ag/v2/"

echo "📋 Suppression des variables SANDBOX..."
printf "y\n" | vercel env rm FLINKS_SANDBOX_CUSTOMER_ID production 2>/dev/null || echo "  (déjà supprimé)"
printf "y\n" | vercel env rm FLINKS_SANDBOX_API_KEY production 2>/dev/null || echo "  (déjà supprimé)"
printf "y\n" | vercel env rm FLINKS_SANDBOX_API_DOMAIN production 2>/dev/null || echo "  (déjà supprimé)"
printf "y\n" | vercel env rm FLINKS_SANDBOX_AUTHORIZE_TOKEN production 2>/dev/null || echo "  (déjà supprimé)"
printf "y\n" | vercel env rm NEXT_PUBLIC_FLINKS_SANDBOX_CONNECT_DOMAIN production 2>/dev/null || echo "  (déjà supprimé)"

echo ""
echo "✅ Variables PRODUCTION (déjà configurées):"
echo "  - FLINKS_CUSTOMER_ID"
echo "  - FLINKS_API_DOMAIN"
echo "  - FLINKS_X_API_KEY"
echo "  - FLINKS_AUTHORIZE_TOKEN"
echo "  - NEXT_PUBLIC_FLINKS_CONNECT_DOMAIN"

echo ""
echo "✅ Configuration terminée!"
echo "Les 2 pages utiliseront maintenant les credentials PRODUCTION"
