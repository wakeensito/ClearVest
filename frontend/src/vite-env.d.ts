/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The API base URL, e.g. the stack's ApiUrl output. Defaults to the Prism mock. */
  readonly VITE_API_BASE_URL?: string
  /** 'false' hides the sandbox sample-account shortcut (on by default). */
  readonly VITE_PLAID_SANDBOX?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
