import { NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase-server'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

const REPORTS_DIR = join(process.cwd(), 'bug-reports')
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase())

export async function GET() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADMIN_EMAILS.includes(user.email!.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let files: string[]
  try {
    files = await readdir(REPORTS_DIR)
  } catch {
    // Directory doesn't exist yet — no reports filed
    return NextResponse.json({ reports: [] })
  }

  const txtFiles = files.filter(f => f.endsWith('.txt')).sort().reverse() // newest first

  const reports = await Promise.all(
    txtFiles.map(async filename => {
      const content = await readFile(join(REPORTS_DIR, filename), 'utf8')
      return { filename, content }
    })
  )

  return NextResponse.json({ reports })
}
