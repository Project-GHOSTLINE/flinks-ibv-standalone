# 🔍 AUDIT COMPLET - Module Flinks IBV

## 📊 Vue d'ensemble

**Projet**: Flinks-alone
**Date**: 2026-03-11
**Fichiers analysés**: 6
**Routes API**: 2
**Appels BD**: 11 opérations distinctes

---

## 🚀 ROUTES API

### 1. POST /api/ibv/complete
**Fichier**: `src/app/api/ibv/complete/route.ts`
**Fonction**: Compléter l'authentification bancaire Flinks
**Méthode**: POST
**Config**: `dynamic: 'force-dynamic'`, `runtime: 'nodejs'`

#### Flow d'exécution:
```
Client → POST /api/ibv/complete → Background Processing → Email
   ↓                                        ↓
[1] Check DB                          [Async Job]
[2] Insert session                    ├─ Flinks Authorize
[3] Return immediately                ├─ Flinks GetAccountsDetail
                                      ├─ Flinks GetAllAttributes (2,245 fields)
                                      ├─ Update session (status=ready)
                                      ├─ Create tracking
                                      ├─ Generate magic link
                                      └─ Send email
```

#### Paramètres:
- `loginId` (string, required) - ID de connexion Flinks
- `state` (string, required) - Token de sécurité unique
- `useSandbox` (boolean, optional) - Mode sandbox ou production

#### Variables d'environnement utilisées:
**Production:**
- `FLINKS_CUSTOMER_ID`
- `FLINKS_API_DOMAIN`
- `FLINKS_X_API_KEY`
- `FLINKS_AUTHORIZE_TOKEN` (optional)

**Sandbox:**
- `FLINKS_SANDBOX_CUSTOMER_ID`
- `FLINKS_SANDBOX_API_DOMAIN`
- `FLINKS_SANDBOX_API_KEY`
- `FLINKS_SANDBOX_AUTHORIZE_TOKEN` (optional)

**Autres:**
- `RESEND_API_KEY` (pour emails)
- `RESEND_FROM_EMAIL` (expéditeur)
- `NEXT_PUBLIC_SITE_URL` (magic links)

---

### 2. GET /api/ibv/status
**Fichier**: `src/app/api/ibv/status/route.ts`
**Fonction**: Vérifier le statut d'une session IBV
**Méthode**: GET
**Config**: `dynamic: 'force-dynamic'`, `runtime: 'nodejs'`

#### Paramètres:
- `state` (query string, required) - Token de la session

#### Réponse:
```json
{
  "status": "pending|processing|ready|failed",
  "metadata": {
    "fetched_at": "ISO timestamp",
    "record_id": "uuid"
  },
  "error": "message si failed"
}
```

---

## 🗄️ APPELS À LA BASE DE DONNÉES

### Table: `flinks_ibv_sessions`

#### 1. SELECT - Vérifier session existante
**Route**: `/api/ibv/complete`
**Ligne**: 86-90
```sql
SELECT id, status
FROM flinks_ibv_sessions
WHERE state = ?
```
**But**: Éviter les doublons (idempotence)

---

#### 2. INSERT - Créer nouvelle session
**Route**: `/api/ibv/complete`
**Ligne**: 103-113
```sql
INSERT INTO flinks_ibv_sessions (
  state,
  login_id,
  status,           -- 'processing'
  ip_address,
  user_agent
) RETURNING id
```
**But**: Créer le record de session avec status='processing'

---

#### 3. SELECT - Session après race condition
**Route**: `/api/ibv/complete`
**Ligne**: 119-123
```sql
SELECT id, status
FROM flinks_ibv_sessions
WHERE state = ?
```
**But**: Gérer la race condition (code 23505 - duplicate key)

---

#### 4. UPDATE - Ajouter requestId
**Route**: `/api/ibv/complete` (background)
**Ligne**: 538-541
```sql
UPDATE flinks_ibv_sessions
SET request_id = ?
WHERE id = ?
```
**But**: Stocker le RequestId Flinks après Authorize

---

#### 5. UPDATE - Stocker résultat final
**Route**: `/api/ibv/complete` (background)
**Ligne**: 242-250
```sql
UPDATE flinks_ibv_sessions
SET
  status = 'ready',
  request_id = ?,
  accounts_detail_json = ?,  -- JSONB avec 2,245+ champs
  fetched_at = NOW()
WHERE id = ?
```
**But**: Stocker les données bancaires complètes + enriched attributes

---

#### 6. UPDATE - Marquer échec
**Route**: `/api/ibv/complete` (background)
**Ligne**: 671-677
```sql
UPDATE flinks_ibv_sessions
SET
  status = 'failed',
  error_message = ?
WHERE id = ?
```
**But**: Logger l'erreur si le traitement échoue

---

#### 7. SELECT - Vérifier statut session
**Route**: `/api/ibv/status`
**Ligne**: 38-42
```sql
SELECT id, status, fetched_at, error_message
FROM flinks_ibv_sessions
WHERE state = ?
```
**But**: Retourner le statut au client (polling)

---

### Table: `client_tracking`

#### 8. SELECT - Vérifier tracking existant
**Route**: `/api/ibv/complete` (background)
**Ligne**: 304-308
```sql
SELECT id
FROM client_tracking
WHERE ibv_session_id = ?
```
**But**: Éviter créer tracking en double

---

#### 9. INSERT - Créer tracking
**Route**: `/api/ibv/complete` (background)
**Ligne**: 316-327
```sql
INSERT INTO client_tracking (
  ibv_session_id,
  client_name,
  client_email,
  client_phone,
  step_ibv_done,              -- TRUE
  step_analysis_in_progress   -- TRUE
) RETURNING id
```
**But**: Créer le dossier de suivi client

---

### Table: `magic_links`

#### 10. INSERT - Créer magic link
**Route**: `/api/ibv/complete` (background)
**Ligne**: 346-351
```sql
INSERT INTO magic_links (
  token,              -- 'mlk-' + 32 chars random
  tracking_id,
  expires_at,         -- +7 jours
  is_active           -- TRUE
)
```
**But**: Générer lien sécurisé pour suivi client

---

### Table: `tracking_events`

#### 11. INSERT - Logger événement
**Route**: `/api/ibv/complete` (background)
**Ligne**: 380-385
```sql
INSERT INTO tracking_events (
  tracking_id,
  event_type,         -- 'auto_tracking_created'
  actor_type,         -- 'system'
  metadata            -- { ibv_session_id, email_sent }
)
```
**But**: Audit trail des actions système

---

## 🔗 APPELS EXTERNES

### API Flinks

#### 1. POST Authorize
**URL**: `{apiDomain}/v3/{customerId}/BankingServices/Authorize`
**Headers**:
- `x-api-key`: Clé API Flinks
- `Authorization`: Bearer token (optional)

**Body**:
```json
{
  "LoginId": "string",
  "Save": true,
  "MostRecentCached": true,
  "Token": "string (optional)",
  "AuthToken": "string (optional)"
}
```

**Réponse**: `{ RequestId: "uuid", ... }`

---

#### 2. POST GetAccountsDetail
**URL**: `{apiDomain}/v3/{customerId}/BankingServices/GetAccountsDetail`
**Body**:
```json
{
  "RequestId": "uuid",
  "WithAccountIdentity": true,
  "WithTransactions": true,
  "DaysOfTransactions": "Days90"
}
```

**Réponse codes**:
- `200` - Données disponibles immédiatement
- `202` - Traitement async (retry logic activée)

---

#### 3. GET GetAllAttributes (Enriched Data)
**URL**: `{apiDomain}/v3/{customerId}/insight/login/{loginId}/attributes/{requestId}/GetAllAttributes`
**Contient**: 2,245 champs enrichis

**Exemples de champs**:
- `average_monthly_employer_income_complex`
- `average_monthly_government_income_complex`
- `average_monthly_non_employer_income_complex`
- `average_monthly_free_cash_flow`
- `average_monthly_loan_payments_complex`
- `average_monthly_nsf_fees_count`
- `balance_trend_simple`
- `count_active_days`

---

### API Resend (Email)

**Méthode**: `resend.emails.send()`
**Trigger**: Après stockage des données Flinks
**Template**: HTML responsive (table-based)
**Contenu**:
- Nom du client (firstName)
- Magic link (7 jours validité)
- Design branded SAR

---

## 🔐 SÉCURITÉ

### Idempotence
✅ Check de session existante avant insertion
✅ Gestion race condition (code 23505)
✅ Magic link unique par session

### Rate Limiting
⚠️ **NON IMPLÉMENTÉ** - Recommandé d'ajouter

### Validation
✅ Paramètres requis validés
✅ Email validé (contains '@')
✅ Supabase credentials check

### Headers collectés
- `x-forwarded-for` / `x-real-ip` → IP address
- `user-agent` → User agent string

---

## ⚡ PERFORMANCE

### Optimisations
✅ **Processing async** - Réponse immédiate au client
✅ **Retry logic** - 120 tentatives max (3 min)
✅ **Cached data** - `MostRecentCached: true`
✅ **Singleton Supabase** - Instance réutilisée

### Points d'amélioration
⚠️ Pas de queue système (jobs en mémoire)
⚠️ Retry logic bloquant (occupé thread)
⚠️ Pas de circuit breaker Flinks API

---

## 📋 SCHÉMA BASE DE DONNÉES REQUIS

### Table: flinks_ibv_sessions
```sql
CREATE TABLE flinks_ibv_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT UNIQUE NOT NULL,
  login_id TEXT NOT NULL,
  request_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  accounts_detail_json JSONB,
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flinks_sessions_state ON flinks_ibv_sessions(state);
CREATE INDEX idx_flinks_sessions_status ON flinks_ibv_sessions(status);
```

### Table: client_tracking
```sql
CREATE TABLE client_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ibv_session_id UUID UNIQUE REFERENCES flinks_ibv_sessions(id),
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  step_ibv_done BOOLEAN DEFAULT FALSE,
  step_analysis_in_progress BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracking_ibv_session ON client_tracking(ibv_session_id);
CREATE INDEX idx_tracking_email ON client_tracking(client_email);
```

### Table: magic_links
```sql
CREATE TABLE magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  tracking_id UUID NOT NULL REFERENCES client_tracking(id),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_magic_links_token ON magic_links(token);
CREATE INDEX idx_magic_links_tracking_id ON magic_links(tracking_id);
```

### Table: tracking_events
```sql
CREATE TABLE tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id UUID NOT NULL REFERENCES client_tracking(id),
  event_type TEXT NOT NULL,
  actor_type TEXT CHECK (actor_type IN ('system', 'admin', 'client')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracking_events_tracking_id ON tracking_events(tracking_id);
CREATE INDEX idx_tracking_events_type ON tracking_events(event_type);
```

---

## 📈 MÉTRIQUES & MONITORING

### Logs produits
- `[IBV]` - Préfixe pour tous les logs
- Statuts Flinks (200, 202, 401, 403)
- RequestId tracking
- Nombre de comptes récupérés
- Nombre de champs enrichis
- Email sent confirmation

### Points de monitoring recommandés
- Taux de succès Authorize
- Délai moyen traitement (202 → 200)
- Taux échec GetAccountsDetail
- Disponibilité GetAllAttributes
- Taux envoi email réussi
- Distribution temps réponse

---

## ✅ RÉSUMÉ FINAL

**Routes**: 2
**Tables BD**: 4
**Opérations SQL**: 11
**API externes**: 2 (Flinks, Resend)
**Champs enrichis**: 2,245
**Max retry**: 120 tentatives (3 min)
**Magic link validité**: 7 jours

**Dépendances critiques**:
- ✅ Supabase (4 tables)
- ✅ Flinks API (3 endpoints)
- ✅ Resend (email transactionnel)

**Variables env requises**: 12 (6 Flinks + 3 Supabase + 3 Email)
