import { clsx } from 'clsx'
import { ReactNode } from 'react'

// ── Button ────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: 'sm' | 'md'
  loading?: boolean
}
export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1',
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm',
        variant === 'primary' && 'bg-teal-500 text-white hover:bg-teal-600 focus:ring-teal-500',
        variant === 'secondary' && 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-300',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        variant === 'ghost' && 'text-gray-600 hover:bg-gray-100 focus:ring-gray-300',
        (disabled || loading) && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {loading && <Spinner size="sm" className="mr-2" />}
      {children}
    </button>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white rounded-xl border border-gray-200 shadow-sm', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('px-6 py-4 border-b border-gray-100', className)}>{children}</div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('px-6 py-4', className)}>{children}</div>
}

// ── Badge ─────────────────────────────────────────────────────────────────────
type BadgeColor = 'green' | 'yellow' | 'red' | 'gray' | 'blue'
export function Badge({ color = 'gray', children }: { color?: BadgeColor; children: ReactNode }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      color === 'green' && 'bg-teal-50 text-teal-700',
      color === 'yellow' && 'bg-yellow-50 text-yellow-700',
      color === 'red' && 'bg-red-50 text-red-700',
      color === 'gray' && 'bg-gray-100 text-gray-600',
      color === 'blue' && 'bg-blue-50 text-blue-700',
    )}>
      {children}
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <svg
      className={clsx(
        'animate-spin text-teal-500',
        size === 'sm' && 'h-4 w-4',
        size === 'md' && 'h-6 w-6',
        size === 'lg' && 'h-10 w-10',
        className,
      )}
      fill="none" viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
    </svg>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
      </CardBody>
    </Card>
  )
}

// ── Session status badge ──────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, BadgeColor> = {
  DRAFT: 'gray',
  ACTIVE: 'green',
  COUNTING_COMPLETE: 'blue',
  PENDING_REVIEW: 'yellow',
  SUBMITTED: 'blue',
  CLOSED: 'gray',
}
export function StatusBadge({ status }: { status: string }) {
  return <Badge color={STATUS_COLORS[status] ?? 'gray'}>{status.replace('_', ' ')}</Badge>
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ message }: { message: string }) {
  return (
    <div className="py-16 text-center text-gray-400 text-sm">{message}</div>
  )
}
