import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const REPORTS_DIR = join(process.cwd(), 'bug-reports')

export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description } = await req.json()
  if (!title?.trim())       return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  if (!description?.trim()) return NextResponse.json({ error: 'Description is required.' }, { status: 400 })
  if (title.trim().length > 120)        return NextResponse.json({ error: 'Title too long (max 120 chars).' }, { status: 400 })
  if (description.trim().length > 2000) return NextResponse.json({ error: 'Description too long (max 2000 chars).' }, { status: 400 })

  // Fetch username
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('username')
    .eq('user_id', user.id)
    .single()

  const username = profile?.username ?? 'unknown'
  const now = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, '-')
  const safeUser = username.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30)
  const filename = `${timestamp}_${safeUser}.txt`

  const content = [
    `Date:     ${now.toUTCString()}`,
    `Username: ${username}`,
    `Email:    ${user.email}`,
    `User ID:  ${user.id}`,
    ``,
    `Title:`,
    title.trim(),
    ``,
    `Description:`,
    description.trim(),
    ``,
    `${'─'.repeat(60)}`,
  ].join('\n')

  try {
    await mkdir(REPORTS_DIR, { recursive: true })
    await writeFile(join(REPORTS_DIR, filename), content, 'utf8')
  } catch (err: any) {
    console.error('Bug report write failed:', err)
    return NextResponse.json({ error: 'Failed to save report.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
