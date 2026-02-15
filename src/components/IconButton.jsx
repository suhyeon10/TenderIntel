'use client'

import React from 'react'

const Icon = ({ icon, onClickIcon = () => {} }) => {
  return (
    <div
      onClick={onClickIcon}
      className="flex justify-center items-center w-9 h-9 hover:text-primaryText rounded-full cursor-pointer"
    >
      {icon ? icon : 'icon'}
    </div>
  )
}

export default Icon
