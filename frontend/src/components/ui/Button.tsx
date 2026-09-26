import { ArrowRight } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import styles from './Button.module.css'
import { Dots } from './Dots'

type Variant = 'primary' | 'secondary' | 'tertiary' | 'destructive'
type Size = 'default' | 'compact' | 'large'

interface Common {
  variant?: Variant
  size?: Size
  /** Tertiary "go somewhere" buttons end with an arrow that nudges right on hover (DESIGN.md §4.1). */
  arrow?: boolean
  icon?: ReactNode
  block?: boolean
}

const cx = ({ variant = 'secondary', size = 'default', block }: Common, extra?: string) =>
  [styles.button, styles[variant], styles[size], block && styles.block, extra].filter(Boolean).join(' ')

function Content({ icon, arrow, children }: { icon?: ReactNode; arrow?: boolean; children: ReactNode }) {
  return (
    <>
      {icon}
      <span>{children}</span>
      {arrow && <ArrowRight className={styles.arrow} size={16} aria-hidden />}
    </>
  )
}

export function Button({
  variant,
  size,
  arrow,
  icon,
  block,
  loading,
  loadingLabel,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingLabel?: string }) {
  return (
    <button
      {...rest}
      type={type}
      className={cx({ variant, size, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <Dots />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        <Content icon={icon} arrow={arrow}>
          {children}
        </Content>
      )}
    </button>
  )
}

export function ButtonLink({ variant, size, arrow, icon, block, className, children, ...rest }: Common & LinkProps) {
  return (
    <Link {...rest} className={cx({ variant, size, block }, className)}>
      <Content icon={icon} arrow={arrow}>
        {children}
      </Content>
    </Link>
  )
}
