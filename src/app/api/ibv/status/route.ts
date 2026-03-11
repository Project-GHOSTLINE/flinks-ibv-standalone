import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/ibv/status?state=<uuid>
 * Check the status of an IBV session
 *
 * Returns:
 * - status: 'pending' | 'processing' | 'ready' | 'failed'
 * - metadata: { fetched_at, record_id } (if ready)
 * - error: error message (if failed)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 500 }
      )
    }

    // Get state from query params
    const { searchParams } = new URL(request.url)
    const state = searchParams.get('state')

    if (!state) {
      return NextResponse.json(
        { error: 'state parameter is required' },
        { status: 400 }
      )
    }

    // Fetch session
    const { data: session, error } = await supabase
      .from('flinks_ibv_sessions')
      .select('id, status, fetched_at, error_message')
      .eq('state', state)
      .maybeSingle()

    if (error) {
      console.error('Failed to fetch session:', error)
      return NextResponse.json(
        { error: 'Failed to fetch session' },
        { status: 500 }
      )
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Return status
    const response: any = {
      status: session.status
    }

    if (session.status === 'ready') {
      response.metadata = {
        fetched_at: session.fetched_at,
        record_id: session.id
      }
    } else if (session.status === 'failed') {
      response.error = session.error_message || 'Unknown error'
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('IBV status error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
