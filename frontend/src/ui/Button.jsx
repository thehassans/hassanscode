import React from 'react'

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...props
}){
  const base = 'btn'
  const variantClass = variant === 'secondary' ? 'secondary' : variant === 'danger' ? 'danger' : variant === 'success' ? 'success' : ''
  const sizeClass = size === 'sm' ? 'small' : ''
  const widthClass = fullWidth ? 'w-full' : ''
  return (
    <button
      {...props}
      className={[base, variantClass, sizeClass, widthClass, className].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  )
}
