# 📊 DIAGRAMME DE FLOW - Flinks IBV

## 🎯 Flow Complet End-to-End

```
┌─────────────────────────────────────────────────────────────────────┐
│                         1. PHASE INITIALE                            │
│                      (Frontend - Pages)                              │
└─────────────────────────────────────────────────────────────────────┘

   Utilisateur visite:
   /IBV_FLINKS_SANDBOX  OU  /IBV_FLINKS
           │
           ├─ Génère: state = UUID
           ├─ Construit: redirect URL avec state + sandbox flag
           └─ Ouvre: Iframe Flinks Connect
                      ↓
                Flinks Connect UI
                (user login bancaire)
                      ↓
                  Redirect vers:
                /ibv/callback?loginId=xxx&state=yyy&sandbox=true


┌─────────────────────────────────────────────────────────────────────┐
│                       2. PHASE CALLBACK                              │
│                    (Frontend - Callback)                             │
└─────────────────────────────────────────────────────────────────────┘

   Page: /ibv/callback
           │
           ├─ Parse params: loginId, state, sandbox
           ├─ Valide: state match original
           └─ Appelle: POST /api/ibv/complete
                         ↓
                    HTTP 200 OK
                    { success: true, session_id: "..." }
                         ↓
                    Polling: GET /api/ibv/status?state=xxx
                    (toutes les 2 secondes)


┌─────────────────────────────────────────────────────────────────────┐
│                    3. PHASE TRAITEMENT API                           │
│                     (Backend - Complete)                             │
└─────────────────────────────────────────────────────────────────────┘

POST /api/ibv/complete
    │
    ├─ [1] Check Supabase disponible
    │       ↓
    │   SELECT * FROM flinks_ibv_sessions WHERE state = ?
    │       ↓
    ├─ [2] Session existe? → Return existing
    │       ↓ Non
    │   INSERT INTO flinks_ibv_sessions
    │   (state, login_id, status='processing', ...)
    │       ↓
    ├─ [3] Return HTTP 200 immédiatement
    │       ↓
    └─ [4] Lance processFlinksData() en background
            (async - ne bloque pas la réponse)


┌─────────────────────────────────────────────────────────────────────┐
│                  4. TRAITEMENT BACKGROUND                            │
│                 (Async Job - Flinks API)                             │
└─────────────────────────────────────────────────────────────────────┘

processFlinksData() {

  ┌────────────────────────────────────────────┐
  │ STEP 1: Authorize                          │
  └────────────────────────────────────────────┘
  POST {apiDomain}/v3/{customerId}/BankingServices/Authorize
  Body: { LoginId, Save: true, MostRecentCached: true }
       ↓
  Response: { RequestId: "xxx-yyy-zzz", ... }
       ↓
  UPDATE flinks_ibv_sessions SET request_id = ? WHERE id = ?

  ┌────────────────────────────────────────────┐
  │ STEP 2: GetAccountsDetail                  │
  └────────────────────────────────────────────┘
  POST {apiDomain}/v3/{customerId}/BankingServices/GetAccountsDetail
  Body: { RequestId, WithAccountIdentity: true, WithTransactions: true }
       ↓
  Response codes:
    • 200 → Data ready ✅
    • 202 → Async processing (retry loop)
         ↓
    [RETRY LOOP si 202]
    Max 120 tentatives (3 minutes)
    Wait 1.5s entre chaque
         ↓
    Nouvelle Authorize + GetAccountsDetail
         ↓
    200 OK → Continue
         ↓
  Accounts data: { Accounts: [...], Login: {...} }

  ┌────────────────────────────────────────────┐
  │ STEP 3: GetAllAttributes (Enriched)        │
  └────────────────────────────────────────────┘
  GET {apiDomain}/v3/.../GetAllAttributes
       ↓
  Response: { Card: { 2,245 champs enrichis } }
  Contient:
    • Income analysis
    • Risk scoring
    • Lending attributes
    • Balance trends
    • NSF fees
    • Cash flow

  ┌────────────────────────────────────────────┐
  │ STEP 4: Store Combined Data                │
  └────────────────────────────────────────────┘
  UPDATE flinks_ibv_sessions
  SET
    status = 'ready',
    accounts_detail_json = {
      ...accountsData,
      EnrichedAttributes: { 2,245 fields },
      _enriched: true,
      _enriched_fields_count: 2245
    },
    fetched_at = NOW()
  WHERE id = ?

}


┌─────────────────────────────────────────────────────────────────────┐
│              5. AUTO-TRACKING & EMAIL                                │
│             (Après stockage des données)                             │
└─────────────────────────────────────────────────────────────────────┘

createTrackingAndSendEmail() {

  ├─ [1] Extract client info
  │      Name: accounts[0].Holder.Name
  │      Email: accounts[0].Holder.Email
  │      Phone: accounts[0].Holder.PhoneNumber
  │
  ├─ [2] Check tracking existe
  │      SELECT id FROM client_tracking WHERE ibv_session_id = ?
  │      → Existe? Skip
  │
  ├─ [3] Create tracking
  │      INSERT INTO client_tracking
  │      (ibv_session_id, client_name, client_email, ...)
  │
  ├─ [4] Generate magic link
  │      Token: 'mlk-' + 32 random chars
  │      Expires: +7 days
  │      INSERT INTO magic_links
  │      (token, tracking_id, expires_at, is_active)
  │
  ├─ [5] Send email (Resend API)
  │      From: Solution Argent Rapide
  │      To: client_email
  │      Subject: Suivez votre demande
  │      Body: HTML responsive avec magic link
  │      Link: {baseUrl}/suivi/{token}
  │
  └─ [6] Log event
         INSERT INTO tracking_events
         (tracking_id, event_type='auto_tracking_created', ...)

}


┌─────────────────────────────────────────────────────────────────────┐
│                    6. POLLING STATUS                                 │
│                  (Frontend - Status Check)                           │
└─────────────────────────────────────────────────────────────────────┘

GET /api/ibv/status?state=xxx
(toutes les 2 secondes depuis callback page)
    │
    ├─ SELECT id, status, fetched_at, error_message
    │  FROM flinks_ibv_sessions WHERE state = ?
    │
    └─ Response:
       {
         status: "processing" → Continue polling
         status: "ready" → ✅ Redirect /analyse
         status: "failed" → ❌ Show error
       }


┌─────────────────────────────────────────────────────────────────────┐
│                      7. FIN DU FLOW                                  │
└─────────────────────────────────────────────────────────────────────┘

Status = "ready"
    ↓
Utilisateur redirigé vers page d'analyse
    ↓
Email envoyé avec magic link
    ↓
Client peut suivre via /suivi/{token}


═══════════════════════════════════════════════════════════════════════

## 📊 STATISTIQUES

**Temps moyen total**: 5-30 secondes
  • Authorize: 1-3s
  • GetAccountsDetail immediate: 2-5s
  • GetAccountsDetail async (202): 5-180s (max 3min)
  • GetAllAttributes: 1-3s
  • Email: 1-2s

**Nombre appels API Flinks**: 2-122
  • Best case (immediate): 3 calls
  • Worst case (202 max retry): 122 calls

**Taille données**: ~500KB - 2MB JSON
  • Accounts + Transactions: 200-800KB
  • Enriched Attributes: 300-1200KB

**Tables BD touchées**: 4
  • flinks_ibv_sessions (6 opérations)
  • client_tracking (2 opérations)
  • magic_links (1 opération)
  • tracking_events (1 opération)

═══════════════════════════════════════════════════════════════════════

## 🔄 RETRY LOGIC (202 Handling)

```
POST GetAccountsDetail
    ↓
  [202] Async processing
    ↓
  ┌───────────────────────────────┐
  │    RETRY LOOP (max 3 min)     │
  │                               │
  │  1. Wait 1.5s                 │
  │  2. POST Authorize → Get new RequestId
  │  3. POST GetAccountsDetail    │
  │       ↓                        │
  │     [200] → SUCCESS ✅         │
  │     [202] → Loop again        │
  │     [Other] → Continue        │
  │                               │
  │  Max: 120 iterations          │
  └───────────────────────────────┘
```

═══════════════════════════════════════════════════════════════════════

## ⚠️ POINTS DE DÉFAILLANCE

1. **Flinks API down** → status='failed', error logged
2. **Supabase down** → HTTP 500 immediate
3. **Resend down** → Tracking créé mais pas d'email
4. **Timeout 3min** → status='failed', "Timeout" error
5. **2FA required** → status='failed', "Security Challenge" error
6. **Race condition** → Géré (duplicate key → fetch existing)

═══════════════════════════════════════════════════════════════════════
