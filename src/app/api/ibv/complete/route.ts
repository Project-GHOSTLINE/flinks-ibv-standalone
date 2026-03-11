import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/ibv/complete
 * Called by /ibv/callback page after Flinks Connect redirect
 *
 * Steps:
 * 1. Validate loginId and state
 * 2. Create session record with status='processing'
 * 3. Call Flinks Authorize
 * 4. Call Flinks GetAccountsDetail
 * 5. Store result and update status='ready'
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 500 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { loginId, state, useSandbox } = body

    // Validation
    if (!loginId || !state) {
      return NextResponse.json(
        { error: 'loginId and state are required' },
        { status: 400 }
      )
    }

    // Auto-detect environment and select appropriate credentials
    const isUsingSandbox = useSandbox === true

    // Get env vars based on environment
    const customerId = isUsingSandbox
      ? (process.env.FLINKS_SANDBOX_CUSTOMER_ID || process.env.FLINKS_CUSTOMER_ID)
      : process.env.FLINKS_CUSTOMER_ID

    const apiDomain = isUsingSandbox
      ? (process.env.FLINKS_SANDBOX_API_DOMAIN || 'https://toolbox-api.private.fin.ag')
      : process.env.FLINKS_API_DOMAIN

    const apiKey = isUsingSandbox
      ? (process.env.FLINKS_SANDBOX_API_KEY || process.env.FLINKS_X_API_KEY)
      : process.env.FLINKS_X_API_KEY

    const authorizeToken = isUsingSandbox
      ? process.env.FLINKS_SANDBOX_AUTHORIZE_TOKEN
      : process.env.FLINKS_AUTHORIZE_TOKEN

    if (!customerId || !apiDomain || !apiKey) {
      console.error('Missing Flinks env vars:', {
        environment: isUsingSandbox ? 'SANDBOX' : 'PRODUCTION',
        customerId,
        apiDomain,
        apiKey: !!apiKey,
        authorizeToken: !!authorizeToken
      })
      return NextResponse.json(
        { error: 'Flinks configuration missing' },
        { status: 500 }
      )
    }

    console.log('[IBV] Environment:', isUsingSandbox ? 'SANDBOX' : 'PRODUCTION')
    console.log('[IBV] Customer ID:', customerId)
    console.log('[IBV] API Domain:', apiDomain)
    console.log('[IBV] Authorize Token configured:', !!authorizeToken)

    // Get client metadata
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Check if session already exists
    const { data: existing } = await supabase
      .from('flinks_ibv_sessions')
      .select('id, status')
      .eq('state', state)
      .maybeSingle()

    if (existing) {
      // Session already exists, return current status
      return NextResponse.json({
        success: true,
        message: 'Session already exists',
        status: existing.status,
        session_id: existing.id
      })
    }

    // Create session record
    const { data: session, error: insertError } = await supabase
      .from('flinks_ibv_sessions')
      .insert({
        state,
        login_id: loginId,
        status: 'processing',
        ip_address: ip,
        user_agent: userAgent
      })
      .select('id')
      .single()

    if (insertError) {
      // Check if it's a duplicate key error (session already exists - race condition)
      if (insertError.code === '23505') {
        // Session was created by another request, fetch it and return
        const { data: raceSession } = await supabase
          .from('flinks_ibv_sessions')
          .select('id, status')
          .eq('state', state)
          .single()

        return NextResponse.json({
          success: true,
          message: 'Session already being processed',
          session_id: raceSession?.id
        })
      }
      console.error('Failed to create session:', insertError)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    // Start async processing (don't await - let it run in background)
    processFlinksData(session.id, state, loginId, customerId, apiDomain, apiKey, authorizeToken)
      .catch(err => {
        console.error('Background processing failed:', err)
      })

    // Return success immediately
    return NextResponse.json({
      success: true,
      message: 'Processing started',
      session_id: session.id
    })

  } catch (error: any) {
    console.error('IBV complete error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Fetch ALL Flinks Enrich Attributes (2,245 fields - most complete)
 * GET /v3/{customerId}/insight/login/{loginId}/attributes/{requestId}/GetAllAttributes
 *
 * Includes: Income, Risk, Lending, Activity, Balance analysis, and more
 */
async function fetchAllAttributes(
  apiDomain: string,
  customerId: string,
  loginId: string,
  requestId: string,
  headers: Record<string, string>
): Promise<any | null> {
  const url = `${apiDomain}/v3/${customerId}/insight/login/${loginId}/attributes/${requestId}/GetAllAttributes`
  console.log('[IBV] Step 3: Fetching ALL Enriched Attributes (2,245 fields)...')
  console.log('[IBV] URL:', url)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers
    })

    console.log('[IBV] GetAllAttributes status:', response.status)

    if (response.status !== 200) {
      console.log('[IBV] ⚠️ GetAllAttributes failed, status:', response.status)
      return null
    }

    const text = await response.text()

    // Check for HTML response (404 disguised)
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html') || text.startsWith('<!doctype')) {
      console.log('[IBV] ⚠️ GetAllAttributes returned HTML (endpoint not available)')
      return null
    }

    const data = JSON.parse(text)

    if (data.Card) {
      const fieldCount = Object.keys(data.Card).length
      console.log('[IBV] ✅ Got ALL Enriched Attributes:', fieldCount, 'fields')
      console.log('[IBV] Key metrics:')
      console.log('   💰 Employer Income:', data.Card.average_monthly_employer_income_complex)
      console.log('   🏛️ Government Income:', data.Card.average_monthly_government_income_complex)
      console.log('   💵 Non-Employer Income:', data.Card.average_monthly_non_employer_income_complex)
      console.log('   📊 Free Cash Flow:', data.Card.average_monthly_free_cash_flow)
      console.log('   💳 Loan Payments:', data.Card.average_monthly_loan_payments_complex)
      console.log('   ⚠️ NSF Count:', data.Card.average_monthly_nsf_fees_count)
      console.log('   📈 Balance Trend:', data.Card.balance_trend_simple)
      console.log('   📅 Active Days:', data.Card.count_active_days)
    }

    return data
  } catch (error: any) {
    console.log('[IBV] ⚠️ GetAllAttributes error:', error.message)
    return null
  }
}

/**
 * Store combined IBV data (accounts + ALL enriched attributes)
 * Then auto-create tracking and send magic link email
 */
async function storeIBVData(
  supabase: any,
  sessionId: string,
  requestId: string,
  accountsData: any,
  enrichedData: any | null
) {
  // Combine data into final JSON structure
  const combinedData = {
    ...accountsData,
    // Add ALL enriched attributes (2,245 fields) if available
    EnrichedAttributes: enrichedData?.Card || null,
    EnrichedLogin: enrichedData?.Login || null,
    _enriched: enrichedData !== null,
    _enriched_fields_count: enrichedData?.Card ? Object.keys(enrichedData.Card).length : 0
  }

  await supabase
    .from('flinks_ibv_sessions')
    .update({
      status: 'ready',
      request_id: requestId,
      accounts_detail_json: combinedData,
      fetched_at: new Date().toISOString()
    })
    .eq('id', sessionId)

  console.log('[IBV] ✅ Data stored with lending attributes:', enrichedData !== null)

  // Auto-create tracking and send email
  await createTrackingAndSendEmail(supabase, sessionId, combinedData)
}

/**
 * Auto-create tracking record and send magic link email
 */
async function createTrackingAndSendEmail(
  supabase: any,
  sessionId: string,
  accountsData: any
) {
  try {
    // Extract client info from Flinks data
    let clientName = 'Client'
    let clientEmail = ''
    let clientPhone = ''

    const accounts = accountsData?.Accounts as Array<{
      Holder?: { Name?: string; Email?: string; PhoneNumber?: string }
    }> | undefined

    if (accounts && accounts.length > 0) {
      const holder = accounts[0]?.Holder
      if (holder) {
        clientName = holder.Name || clientName
        clientEmail = holder.Email || ''
        clientPhone = holder.PhoneNumber || ''
      }
    }

    // Try Login.AccountIdentity as fallback
    const login = accountsData?.Login as {
      AccountIdentity?: { Name?: string; Email?: string; PhoneNumber?: string }
    } | undefined

    if (login?.AccountIdentity) {
      clientName = login.AccountIdentity.Name || clientName
      clientEmail = login.AccountIdentity.Email || clientEmail
      clientPhone = login.AccountIdentity.PhoneNumber || clientPhone
    }

    console.log('[IBV] Client info extracted:', { clientName, clientEmail: clientEmail ? 'YES' : 'NO' })

    if (!clientEmail || !clientEmail.includes('@')) {
      console.log('[IBV] ⚠️ No client email found, skipping auto-tracking')
      return
    }

    // Check if tracking already exists
    const { data: existingTracking } = await supabase
      .from('client_tracking')
      .select('id')
      .eq('ibv_session_id', sessionId)
      .single()

    if (existingTracking) {
      console.log('[IBV] Tracking already exists, skipping')
      return
    }

    // Create tracking record
    const { data: newTracking, error: trackingError } = await supabase
      .from('client_tracking')
      .insert({
        ibv_session_id: sessionId,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        step_ibv_done: true,
        step_analysis_in_progress: true,
      })
      .select('id')
      .single()

    if (trackingError) {
      console.error('[IBV] Failed to create tracking:', trackingError)
      return
    }

    console.log('[IBV] ✅ Tracking created:', newTracking.id)

    // Generate magic link token
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let token = 'mlk-'
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await supabase.from('magic_links').insert({
      token,
      tracking_id: newTracking.id,
      expires_at: expiresAt.toISOString(),
      is_active: true,
    })

    console.log('[IBV] ✅ Magic link created:', token.substring(0, 12) + '...')

    // Send email via Resend
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      console.log('[IBV] ⚠️ RESEND_API_KEY not configured, skipping email')
      return
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const magicLink = `${baseUrl}/suivi/${token}`
    const firstName = clientName.split(' ')[0] || clientName

    const { Resend } = await import('resend')
    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Solution Argent Rapide <noreply@solutionargentrapide.ca>'

    await resend.emails.send({
      from: fromEmail,
      to: [clientEmail],
      subject: 'Suivez votre demande de prêt - Solution Argent Rapide',
      html: generateTrackingEmailHtml(firstName, magicLink),
    })

    console.log('[IBV] ✅ Email sent to:', clientEmail)

    // Log event
    await supabase.from('tracking_events').insert({
      tracking_id: newTracking.id,
      event_type: 'auto_tracking_created',
      actor_type: 'system',
      metadata: { ibv_session_id: sessionId, email_sent: true },
    })

  } catch (error: any) {
    console.error('[IBV] Error creating tracking:', error.message)
  }
}

/**
 * Generate HTML email for magic link
 */
function generateTrackingEmailHtml(firstName: string, magicLink: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td align="center" style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Solution Argent Rapide</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Votre partenaire financier de confiance</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #1e3a8a; font-size: 24px;">Bonjour ${firstName},</h2>
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Merci d'avoir complété votre vérification bancaire. Votre demande est maintenant en cours de traitement.
              </p>
              <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Vous pouvez suivre l'avancement de votre demande en temps réel :
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px 0;">
                    <a href="${magicLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%); color: #ffffff; text-decoration: none; font-size: 18px; font-weight: 600; border-radius: 8px;">
                      Voir mon suivi
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>Important :</strong> Ce lien est valide pendant 7 jours.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} Solution Argent Rapide. Tous droits réservés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

/**
 * Background job to fetch data from Flinks
 */
async function processFlinksData(
  sessionId: string,
  state: string,
  loginId: string,
  customerId: string,
  apiDomain: string,
  apiKey: string,
  authorizeToken?: string
) {
  const supabase = getSupabase()
  if (!supabase) return

  console.log('[IBV] ========== START PROCESSING ==========')
  console.log('[IBV] SessionId:', sessionId)
  console.log('[IBV] State:', state)
  console.log('[IBV] LoginId:', loginId)

  try {
    // Step 1: Authorize
    const authorizeUrl = `${apiDomain}/v3/${customerId}/BankingServices/Authorize`
    console.log('[IBV] Step 1: Calling Authorize...')
    console.log('[IBV] URL:', authorizeUrl)

    // Build headers with optional authorize token
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    }
    if (authorizeToken) {
      headers['Authorization'] = `Bearer ${authorizeToken}`
      console.log('[IBV] Using Authorization header with token')
    }

    // Build request body - include token if available
    const authorizeBody: Record<string, any> = {
      LoginId: loginId,
      Save: true,
      MostRecentCached: true  // Try to use cached data to skip 2FA
    }
    if (authorizeToken) {
      authorizeBody.Token = authorizeToken
      authorizeBody.AuthToken = authorizeToken
    }
    console.log('[IBV] Authorize body:', JSON.stringify(authorizeBody))

    const authorizeRes = await fetch(authorizeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(authorizeBody)
    })

    console.log('[IBV] Authorize response status:', authorizeRes.status)

    const authorizeText = await authorizeRes.text()
    console.log('[IBV] Authorize response body:', authorizeText.substring(0, 500))

    let authorizeData
    try {
      authorizeData = JSON.parse(authorizeText)
    } catch (e) {
      throw new Error(`Authorize returned non-JSON: ${authorizeText.substring(0, 200)}`)
    }

    console.log('[IBV] Authorize HttpStatusCode:', authorizeData.HttpStatusCode)
    console.log('[IBV] Authorize FlinksCode:', authorizeData.FlinksCode)

    if (authorizeData.SecurityChallenges) {
      console.log('[IBV] ⚠️ Security Challenge required:', JSON.stringify(authorizeData.SecurityChallenges))
      throw new Error(`Security Challenge required (2FA): ${authorizeData.SecurityChallenges[0]?.Prompt || 'MFA needed'}`)
    }

    const requestId = authorizeData.RequestId
    console.log('[IBV] RequestId:', requestId)

    if (!requestId) {
      throw new Error(`No RequestId returned from Authorize. Response: ${JSON.stringify(authorizeData)}`)
    }

    // Update session with requestId
    console.log('[IBV] Updating session with requestId...')
    await supabase
      .from('flinks_ibv_sessions')
      .update({ request_id: requestId })
      .eq('id', sessionId)

    // Step 2: GetAccountsDetail
    const detailUrl = `${apiDomain}/v3/${customerId}/BankingServices/GetAccountsDetail`
    console.log('[IBV] Step 2: Calling GetAccountsDetail...')
    console.log('[IBV] URL:', detailUrl)

    const detailRes = await fetch(detailUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        RequestId: requestId,
        WithAccountIdentity: true,
        WithTransactions: true,
        DaysOfTransactions: 'Days90'
      })
    })

    console.log('[IBV] GetAccountsDetail response status:', detailRes.status)

    // Handle async processing (HTTP 202)
    if (detailRes.status === 202) {
      console.log('[IBV] Got 202 - Data is being fetched async by Flinks...')
      console.log('[IBV] Will retry with fresh Authorize calls...')

      // When we get 202, Flinks is fetching data in background
      // We need to do NEW Authorize + GetAccountsDetail calls to check if ready
      let attempts = 0
      const maxAttempts = 120 // 120 attempts * 1.5s = 3 minutes max

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1500)) // Wait 1.5s
        attempts++
        if (attempts % 10 === 0) {
          console.log(`[IBV] Retry attempt ${attempts}/${maxAttempts}...`)
        }

        // Step A: Get a FRESH RequestId via Authorize
        const retryAuthRes = await fetch(authorizeUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(authorizeBody)
        })

        if (!retryAuthRes.ok) {
          console.log('[IBV] Authorize retry failed, status:', retryAuthRes.status)
          continue
        }

        const retryAuthData = await retryAuthRes.json()
        const freshRequestId = retryAuthData.RequestId

        if (!freshRequestId) {
          console.log('[IBV] No RequestId in retry, continuing...')
          continue
        }

        // Step B: Try GetAccountsDetail with fresh RequestId
        const retryDetailRes = await fetch(detailUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            RequestId: freshRequestId,
            WithAccountIdentity: true,
            WithTransactions: true,
            DaysOfTransactions: 'Days90'
          })
        })

        console.log(`[IBV] Retry GetAccountsDetail status: ${retryDetailRes.status}`)

        if (retryDetailRes.status === 200) {
          const retryText = await retryDetailRes.text()

          if (retryText.startsWith('<!DOCTYPE') || retryText.startsWith('<html')) {
            console.log('[IBV] ❌ Got HTML instead of JSON')
            continue
          }

          const accountsData = JSON.parse(retryText)
          console.log('[IBV] ✅ SUCCESS! Got accounts data')
          console.log('[IBV] Accounts count:', accountsData.Accounts?.length || 0)

          // Step 3: Fetch Lending Attributes (enriched data)
          const enrichedData = await fetchAllAttributes(
            apiDomain, customerId, loginId, freshRequestId, headers
          )

          // Store combined result
          await storeIBVData(supabase, sessionId, freshRequestId, accountsData, enrichedData)

          console.log('[IBV] ========== PROCESSING COMPLETE ==========')
          return // Success
        } else if (retryDetailRes.status === 202) {
          continue
        } else {
          const errorText = await retryDetailRes.text()
          console.log('[IBV] Retry error:', errorText.substring(0, 200))
          continue
        }
      }

      throw new Error('Timeout waiting for data after 3 minutes')
    } else if (detailRes.ok) {
      // Immediate success (HTTP 200)
      const accountsData = await detailRes.json()
      console.log('[IBV] ✅ SUCCESS! Got accounts data immediately')
      console.log('[IBV] Accounts count:', accountsData.Accounts?.length || 0)

      // Step 3: Fetch Lending Attributes (enriched data)
      const enrichedData = await fetchAllAttributes(
        apiDomain, customerId, loginId, requestId, headers
      )

      // Store combined result
      await storeIBVData(supabase, sessionId, requestId, accountsData, enrichedData)

      console.log('[IBV] ========== PROCESSING COMPLETE ==========')
    } else {
      // Error
      const errorText = await detailRes.text()
      console.log('[IBV] ❌ GetAccountsDetail error:', errorText.substring(0, 300))
      throw new Error(`GetAccountsDetail failed: ${detailRes.status} ${errorText.substring(0, 200)}`)
    }

  } catch (error: any) {
    console.error('[IBV] ❌ PROCESSING ERROR:', error.message)
    console.error('[IBV] Full error:', error)

    // Update session with error
    await supabase
      .from('flinks_ibv_sessions')
      .update({
        status: 'failed',
        error_message: error.message || 'Unknown error'
      })
      .eq('id', sessionId)

    console.log('[IBV] ========== PROCESSING FAILED ==========')
  }
}
