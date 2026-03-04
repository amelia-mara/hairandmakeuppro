import React from 'react'

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
}

const baseStyles: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  whiteSpace: 'nowrap',
  transition: `all var(--duration-normal) var(--ease-out)`,
  lineHeight: 1,
  border: '1px solid transparent',
}

const sizeMap: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: '0.75rem' },
  md: { padding: '8px 16px', fontSize: '0.8125rem' },
  lg: { padding: '10px 20px', fontSize: '0.875rem' },
}

const variantMap: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, var(--gold-primary), var(--gold-light))',
    color: '#0d0b09',
    borderColor: 'var(--gold-primary)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--gold-primary)',
    borderColor: 'var(--gold-border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    borderColor: 'var(--border-subtle)',
  },
  danger: {
    background: 'transparent',
    color: 'var(--danger)',
    borderColor: 'rgba(232,93,117,0.3)',
  },
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'ghost',
  size = 'md',
  icon,
  children,
  style,
  onMouseEnter,
  onMouseLeave,
  ...props
}) => {
  const [hovered, setHovered] = React.useState(false)

  const hoverStyles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      boxShadow: 'var(--glow-medium)',
      transform: 'translateY(-1px)',
    },
    outline: {
      background: 'var(--gold-muted)',
      borderColor: 'var(--gold-primary)',
      boxShadow: 'var(--glow-subtle)',
    },
    ghost: {
      borderColor: 'var(--border-default)',
      color: 'var(--text-primary)',
      background: 'var(--bg-hover)',
    },
    danger: {
      background: 'rgba(232,93,117,0.08)',
      borderColor: 'var(--danger)',
    },
  }

  return (
    <button
      style={{
        ...baseStyles,
        ...sizeMap[size],
        ...variantMap[variant],
        ...(hovered ? hoverStyles[variant] : {}),
        ...style,
      }}
      onMouseEnter={(e) => {
        setHovered(true)
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        setHovered(false)
        onMouseLeave?.(e)
      }}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
