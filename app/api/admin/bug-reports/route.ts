import { NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase())

export async function GET() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADMIN_EMAILS.includes(user.email!.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bug_reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reports: data })
}
