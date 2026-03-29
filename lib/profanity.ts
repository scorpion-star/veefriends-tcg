// Lightweight profanity filter — add words to the list as needed.
// Words are matched as whole words (case-insensitive) and common leet-speak
// substitutions are normalized before checking.

const BLOCKED: string[] = [
  'fuck', 'shit', 'ass', 'bitch', 'bastard', 'dick', 'pussy', 'cunt',
  'cock', 'whore', 'slut', 'fag', 'nigger', 'nigga', 'retard', 'faggot',
  'kike', 'chink', 'spic', 'wetback', 'tranny', 'rape', 'molest',
]

/** Normalize common leet-speak so filters aren't trivially bypassed */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/8/g, 'b')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/\+/g, 't')
    .replace(/[^a-z]/g, '')   // strip remaining non-alpha for the final check
}

export function containsProfanity(value: string): boolean {
  const normalized = normalize(value)
  return BLOCKED.some(word => normalized.includes(word))
}

/** Returns an error string or null if clean */
export function validateUsername(username: string): string | null {
  if (username.length < 3)  return 'Username must be at least 3 characters.'
  if (username.length > 20) return 'Username must be 20 characters or fewer.'
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return 'Only letters, numbers, and underscores are allowed.'
  if (containsProfanity(username)) return 'That username is not allowed.'
  return null
}
