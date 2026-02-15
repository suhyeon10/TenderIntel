import { useState } from 'react'

interface Filters {
  specialization: string[]
  experience: [number, number]
  job: string[]
}

const initialFilters: Filters = {
  specialization: [],
  experience: [0, 20],
  job: [],
}

export const useMakerFilter = () => {
  const [filters, setFilters] = useState<Filters>(initialFilters)

  const handleFilterChange = (
    key: keyof Filters,
    value: string | string[] | number[],
  ) => {
    setFilters((prev) => {
      if (key === 'experience' && Array.isArray(value)) {
        return { ...prev, [key]: value as [number, number] }
      }
      return { ...prev, [key]: value }
    })
  }

  return { filters, handleFilterChange }
}
