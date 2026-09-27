import styles from './RouteFeedback.module.css'

export function PageLoading() {
  return <div className={styles.loading} role="status">Opening ClearVest…</div>
}

export function RouteFailure() {
  return <main className={styles.failure}>
    <h1>This page couldn’t open.</h1>
    <p>Check your connection, then reload to try again. Your saved progress stays in this browser.</p>
    <button type="button" onClick={() => window.location.reload()}>Reload page</button>
    <a href="/">Return home</a>
  </main>
}
