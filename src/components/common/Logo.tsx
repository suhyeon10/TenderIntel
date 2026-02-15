import React from 'react'
// import { useRouter } from 'next/navigation'
import Link from 'next/link'

const Logo = () => {
  // const router = useRouter()

  return (
    <Link
      href="/"
      className="text-subtitle1 hover:cursor-pointer"
    >
      LINKUS
    </Link>
  )
}

export default Logo
