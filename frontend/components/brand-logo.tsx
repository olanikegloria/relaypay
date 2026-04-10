import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
/** Static import (Next.js): resolved at build time; works with any `basePath` / host. */
import logoFile from '../public/relaypay-logo.svg'

/** Intrinsic size from `public/relaypay-logo.svg` (`width` / `height` on root `<svg>`). */
const LOGO_W = 687
const LOGO_H = 176

const VARIANT = {
  compact: {
    width: LOGO_W,
    height: LOGO_H,
    className: 'h-7 sm:h-8 w-auto scale-[1.18] sm:scale-[1.28] origin-left',
  },
  nav: {
    width: LOGO_W,
    height: LOGO_H,
    className: 'h-9 sm:h-10 w-auto scale-[1.2] sm:scale-[1.32] origin-left',
  },
  hero: {
    width: LOGO_W,
    height: LOGO_H,
    className: 'h-[4.25rem] sm:h-[5.5rem] md:h-[6.25rem] w-auto max-w-[min(92vw,22rem)] scale-[1.12] sm:scale-[1.22]',
  },
  auth: {
    width: LOGO_W,
    height: LOGO_H,
    className: 'h-12 sm:h-14 w-auto scale-110',
  },
} as const

export type BrandLogoVariant = keyof typeof VARIANT

type Props = {
  className?: string
  /** Omit or pass null to disable link wrapper */
  href?: string | null
  variant?: BrandLogoVariant
  priority?: boolean
  'aria-label'?: string
}

export function BrandLogo({
  className,
  href = '/',
  variant = 'nav',
  priority,
  'aria-label': ariaLabel,
}: Props) {
  const v = VARIANT[variant]
  const img = (
    <Image
      src={logoFile}
      alt="RelayPay"
      width={v.width}
      height={v.height}
      className={cn(v.className, className)}
      priority={priority ?? variant === 'hero'}
    />
  )
  if (href === null) {
    return <span className="inline-flex items-center justify-center">{img}</span>
  }
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {img}
    </Link>
  )
}
