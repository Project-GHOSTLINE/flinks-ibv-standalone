# 🏦 Flinks IBV Module - Standalone

Module d'authentification bancaire Flinks IBV isolé.

## 📁 Structure

```
Flinks-alone/
├── src/
│   ├── app/
│   │   ├── (site)/
│   │   │   ├── IBV_FLINKS_SANDBOX/    # Page sandbox (test)
│   │   │   └── IBV_FLINKS/            # Page production
│   │   ├── ibv/
│   │   │   └── callback/              # Callback après auth
│   │   └── api/
│   │       └── ibv/
│   │           ├── complete/          # Compléter l'IBV
│   │           └── status/            # Vérifier statut
│   └── lib/
│       └── supabase.ts                # Helper Supabase
```

## 🚀 Installation

```bash
cd /Users/xunit/Desktop/Flinks-alone
npm install
```

## ⚙️ Configuration

Copier `.env.local` et remplir les variables:

```env
# Flinks Production
FLINKS_CUSTOMER_ID=...
FLINKS_API_DOMAIN=https://api.flinks.com
FLINKS_X_API_KEY=...
NEXT_PUBLIC_FLINKS_CONNECT_DOMAIN=https://iframe.flinks.com

# Flinks Sandbox
FLINKS_SANDBOX_CUSTOMER_ID=...
FLINKS_SANDBOX_API_DOMAIN=https://toolbox-api.private.fin.ag
FLINKS_SANDBOX_API_KEY=...
NEXT_PUBLIC_FLINKS_SANDBOX_CONNECT_DOMAIN=https://toolbox-iframe.private.fin.ag/v2/?demo=true

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

## 🏃 Démarrage

```bash
npm run dev
```

Puis ouvrir:
- **Sandbox**: http://localhost:3000/IBV_FLINKS_SANDBOX
- **Production**: http://localhost:3000/IBV_FLINKS

## 📦 Build Production

```bash
npm run build
npm start
```

## 🔑 Fichiers Clés

- `src/app/(site)/IBV_FLINKS_SANDBOX/page.tsx` - Interface sandbox Flinks
- `src/app/(site)/IBV_FLINKS/page.tsx` - Interface production Flinks
- `src/app/ibv/callback/page.tsx` - Gestion du callback après auth
- `src/app/api/ibv/complete/route.ts` - API pour compléter l'IBV
- `src/app/api/ibv/status/route.ts` - API pour vérifier le statut
- `src/lib/supabase.ts` - Utilitaire Supabase

## 🔧 Fonctionnalités

✅ Détection automatique sandbox/production
✅ Gestion du callback Flinks
✅ Intégration Supabase
✅ Interface moderne avec Tailwind CSS
