import Link from 'next/link'
import React from 'react'

const GlobalNavigator = () => {
  return (
    <section className="w-full flex items-center h-[32px] border-b-[1px] border-solid border-[rgba(0,0,0,0.08)] px-3">
      <div className="flex justify-start items-center w-full mx-auto max-w-[1024px] gap-2">
        <Link href="/job-magazine">
          <span className="text-p3 font-bold text-palette-coolNeutral-40">
            매거진
          </span>
        </Link>
      </div>
    </section>
  )
}

export default GlobalNavigator
