'use client'

import { ChevronDown } from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'

type MultiSelectorProps = {
  values: string[]
  onChange: (values: string[]) => void
  options: { label: string; value: string }[]
  placeholder?: string
}

const MultiSelector = ({
  values,
  onChange,
  options,
  placeholder,
}: MultiSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleSelectChange = (value: string) => {
    const newValues = values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value]
    onChange(newValues)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div
      className="relative"
      ref={dropdownRef}
    >
      {/* Trigger */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between px-4 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 min-w-[140px] text-sm"
      >
        <span className="text-gray-700">
          {values.length > 0
            ? `${values.length}개 선택됨`
            : placeholder || '선택'}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {/* Dropdown Select */}
      {isOpen && (
        <ul className="absolute z-10 w-full bg-white rounded-md border border-gray-200 shadow-lg mt-1 max-h-60 overflow-auto">
          {options.map((option) => (
            <li
              key={option.value}
              className="flex items-center px-4 py-2 cursor-pointer hover:bg-gray-50 text-sm"
              onClick={() => handleSelectChange(option.value)}
            >
              <input
                type="checkbox"
                checked={values.includes(option.value)}
                readOnly
                className="mr-2"
              />
              <span className="text-gray-700">{option.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MultiSelector
