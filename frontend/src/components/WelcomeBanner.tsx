import { BookOpen, ChartNoAxesCombined, Compass, Sunrise } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { timeGreeting } from '../lib/greeting'
import styles from './WelcomeBanner.module.css'

export function WelcomeBanner() {
  const [hour, setHour] = useState(() => new Date().getHours())
  useEffect(() => {
    const updateGreeting = () => {
      if (!document.hidden) setHour(new Date().getHours())
    }
    const interval = window.setInterval(updateGreeting, 60_000)
    document.addEventListener('visibilitychange', updateGreeting)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', updateGreeting)
    }
  }, [])
  return <section className={styles.banner} aria-label="Welcome to your investing workspace">
    <div className={styles.copy}>
      <div className={styles.greeting}>
        <Sunrise size={22} aria-hidden />
        <h1><span className="sr-only">Your portfolio</span><span aria-hidden>{timeGreeting(hour)}</span></h1>
      </div>
      <p className={styles.intro}>A little clarity for whatever comes next.</p>
      <p className={styles.support}>Explore your investments, ask a question, or start with the basics.</p>
      <nav className={styles.actions} aria-label="Choose your next step">
        <Link to="/advisor?q=Help%20me%20understand%20what%20I%20own%20in%20plain%20language."><ChartNoAxesCombined size={17} aria-hidden />Understand my holdings</Link>
        <Link to="/markets"><Compass size={17} aria-hidden />Explore investments</Link>
        <Link to="/learn"><BookOpen size={17} aria-hidden />Learn the basics</Link>
      </nav>
    </div>
    <img className={styles.landscape} src="/images/coastal-morning.webp" width="2172" height="724" alt="" fetchPriority="high" />
  </section>
}
