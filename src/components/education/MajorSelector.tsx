import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MAJOR_OPTIONS } from '@/utils/education'

interface MajorSelectorProps {
  value: string[]
  onChange: (majors: string[]) => void
  placeholder?: string
}

export const MajorSelector: React.FC<MajorSelectorProps> = ({
  value,
  onChange,
  placeholder = '전공 또는 부전공을 입력하세요.',
}) => {
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const normalizedValue = useMemo(
    () => value.map((item) => item.trim()).filter(Boolean),
    [value],
  )

  const filteredOptions = useMemo(() => {
    const query = inputValue.trim().toLowerCase()

    if (query.length < 2) {
      return []
    }

    return MAJOR_OPTIONS.filter(
      (option) =>
        option.toLowerCase().includes(query) &&
        !normalizedValue.some((selected) => selected === option),
    )
  }, [inputValue, normalizedValue])

  const showCustomOption = useMemo(() => {
    const query = inputValue.trim()

    if (query.length < 2) {
      return false
    }

    return (
      !MAJOR_OPTIONS.some(
        (option) => option.toLowerCase() === query.toLowerCase(),
      ) && !normalizedValue.some((selected) => selected.toLowerCase() === query.toLowerCase())
    )
  }, [inputValue, normalizedValue])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleAddMajor = (major: string) => {
    const trimmed = major.trim()
    if (!trimmed) return

    if (
      normalizedValue.some(
        (selected) => selected.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setInputValue('')
      return
    }

    onChange([...normalizedValue, trimmed])
    setInputValue('')
  }

  const handleRemoveMajor = (major: string) => {
    onChange(
      normalizedValue.filter(
        (selected) => selected.toLowerCase() !== major.toLowerCase(),
      ),
    )
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && inputValue === '' && normalizedValue.length) {
      event.preventDefault()
      handleRemoveMajor(normalizedValue[normalizedValue.length - 1])
      return
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      if (inputValue.trim().length < 2) {
        return
      }

      event.preventDefault()

      if (filteredOptions.length > 0) {
        handleAddMajor(filteredOptions[0])
      } else if (showCustomOption) {
        handleAddMajor(inputValue)
      }
    }
  }

  const renderDropdown = () => {
    if (!isFocused || (filteredOptions.length === 0 && !showCustomOption)) {
      return null
    }

    return (
      <div className="mt-2 max-h-48 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
        {filteredOptions.map((option) => (
          <button
            type="button"
            key={option}
            className="flex w-full items-center justify-start px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => handleAddMajor(option)}
          >
            {option}
          </button>
        ))}
        {showCustomOption && (
          <button
            type="button"
            className="flex w-full items-center justify-start px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => handleAddMajor(inputValue)}
          >
            직접 입력: {inputValue.trim()}
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      className="relative"
      ref={containerRef}
    >
      <div
        className="flex min-h-[44px] w-full flex-wrap items-center gap-2 rounded-md border border-gray-300 px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200"
        onClick={() => {
          setIsFocused(true)
        }}
      >
        {normalizedValue.map((major) => (
          <span
            key={major}
            className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700"
          >
            {major}
            <button
              type="button"
              className="text-blue-500 hover:text-blue-700"
              aria-label={`${major} 삭제`}
              onClick={(event) => {
                event.stopPropagation()
                handleRemoveMajor(major)
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onFocus={() => setIsFocused(true)}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={normalizedValue.length === 0 ? placeholder : undefined}
          className="flex-1 min-w-[120px] border-none bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
        />
      </div>
      {renderDropdown()}
    </div>
  )
}
