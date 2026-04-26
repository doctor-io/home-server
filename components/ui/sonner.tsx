'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "backdrop-blur-2xl !rounded-[var(--system-radius-control)] !border !border-glass-border/50 !shadow-[0_8px_32px_rgba(0,0,0,0.28)]",
          title: "!text-sm !font-medium !text-foreground",
          description: "!text-xs !text-foreground/70",
          error: "!border-status-red/25",
          closeButton:
            "!border-glass-border/40 !bg-transparent backdrop-blur-xl",
        },
      }}
      style={
        {
          '--normal-bg': 'hsl(var(--popover) / 0.9)',
          '--normal-text': 'hsl(var(--popover-foreground))',
          '--normal-border': 'transparent',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
