/**
 * Whether to offer the "Use a sample account" shortcut: POST /plaid/sandbox-link creates a
 * sandbox brokerage account server-side, so there's no Plaid popup, phone number or code.
 * On by default because the backend is Plaid-sandbox-only; set VITE_PLAID_SANDBOX=false
 * at build time once real Plaid accounts are supported.
 */
export function sampleAccountEnabled(flag: string | undefined): boolean {
  return (flag ?? '').trim().toLowerCase() !== 'false'
}
