'use client'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Props = {
  variant?: 'default' | 'ghost' | 'outline' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
  className?: string
  label?: string
}

export function LogoutButton({
  variant = 'ghost',
  size = 'sm',
  className,
  label = 'Log out',
}: Props) {
  const router = useRouter()

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={async () => {
        await createClient().auth.signOut()
        router.push('/')
        router.refresh()
      }}
    >
      {label}
    </Button>
  )
}
