'use client'

interface TagChipProps {
  label: string
  variant?: 'tech' | 'risk' | 'region' | 'default'
  onClick?: () => void
}

export function TagChip({ label, variant = 'default', onClick }: TagChipProps) {
  const variantStyles = {
    tech: 'bg-blue-100 text-blue-700 border-blue-200',
    risk: 'bg-amber-100 text-amber-700 border-amber-200',
    region: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    default: 'bg-slate-100 text-slate-700 border-slate-200',
  }

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-xl text-sm font-medium border ${
        variantStyles[variant]
      } ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onClick}
    >
      {label}
    </span>
  )
}

