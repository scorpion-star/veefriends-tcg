'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

export type NeonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning' | 'metal'
export type NeonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: NeonVariant
  size?: NeonSize
  fullWidth?: boolean
}

const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth = false, className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={[
          'neon-btn',
          `neon-btn--${variant}`,
          `neon-btn--${size}`,
          fullWidth ? 'neon-btn--full' : '',
          className,
        ].filter(Boolean).join(' ')}
        {...props}
      >
        {children}
      </button>
    )
  }
)
NeonButton.displayName = 'NeonButton'

export default NeonButton
