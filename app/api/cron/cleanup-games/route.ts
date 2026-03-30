import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

const INACTIVITY_MINUTES = 20

export async function GET(req: NextRequest) {
  // Protect with a secret so only Vercel cron can call this
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - INACTIVITY_MINUTES * 60 * 1000).toISOString()

  const { data, error } = await admin
    .from('game_sessions')
    .update({ status: 'abandoned' })
    .eq('status', 'active')
    .lt('updated_at', cutoff)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    closed: data?.length ?? 0,
    cutoff,
  })
}
