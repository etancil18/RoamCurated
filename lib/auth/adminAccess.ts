// lib/auth/adminAccess.ts
export const ALLOWED_ADMIN_EMAILS = [
  'evantancil@gmail.com',
  'etancil92@gmail.com',
  'evantancil@roamcurated.com',
  'fyejono@gmail.com',
  'jonathangordon@roamcurated.com',
]

export function isAllowedAdminEmail(email?: string | null) {
  if (!email) return false
  return ALLOWED_ADMIN_EMAILS.includes(email.toLowerCase())
}