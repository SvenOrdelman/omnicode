import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-accent text-white hover:bg-accent-hover active:brightness-90',
    secondary: 'bg-surface-3 text-text-primary hover:bg-surface-3/80 active:brightness-90',
    ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-3 active:bg-surface-3/80',
    danger: 'bg-danger text-white hover:bg-danger/90 active:brightness-90',
    icon: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-3 active:bg-surface-3/80 rounded-lg',
  };

  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  const iconSizes = { sm: 14, md: 16, lg: 18 };

  const isIconOnly = variant === 'icon';
  const iconOnlySizes = { sm: 'h-7 w-7', md: 'h-8 w-8', lg: 'h-10 w-10' };

  return (
    <button
      className={`${base} ${variants[variant]} ${isIconOnly ? iconOnlySizes[size] : sizes[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={iconSizes[size]} />}
      {children}
      {IconRight && <IconRight size={iconSizes[size]} />}
    </button>
  );
}
