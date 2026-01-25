import { ORBS_LOGO } from '@orbs-network/spot-ui'
import { ROUTES } from '@/lib/routes'
import Link from 'next/link'
import React from 'react'

export function Navbar() {
  return (
    <div className='flex flex-row justify-between items-center bg-background border-b border-border p-4'>
        <Link href={ROUTES.HOME} className='flex flex-row items-center gap-2'>
            <img src={ORBS_LOGO} alt="logo"  />
            <p className='text-white text-xl font-bold'>Orbs Explorer</p>
        </Link>
    </div>
  )
}

