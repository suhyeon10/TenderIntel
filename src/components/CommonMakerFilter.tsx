import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import MultiSelectButton from '@/components/MultiSelector'
import { XCircle } from 'lucide-react'
import { JOB_CATEGORIES, EXPERTISE_OPTIONS } from '@/constants/job-options'

interface ExperienceFilterProps {
  value: [number, number]
  onChange: (value: [number, number]) => void
}

export const ExperienceFilter = ({
  value,
  onChange,
}: ExperienceFilterProps) => {
  const [open, setOpen] = useState(false)
  const [localValue, setLocalValue] = useState<[number, number]>(value)

  useEffect(() => {
    if (!open) {
      setLocalValue(value)
    }
  }, [value, open])

  const handleApply = () => {
    onChange(localValue)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-10 px-4 text-sm whitespace-nowrap min-w-[140px]"
        >
          경력 {value[0]}~{value[1]}년
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>경력 선택</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <Slider
            value={localValue}
            onValueChange={(newValue) =>
              setLocalValue(newValue as [number, number])
            }
            min={0}
            max={20}
            step={1}
            className="w-full"
          />
          <p className="text-sm text-gray-600 text-center">
            {localValue[0]}년 ~ {localValue[1]}년
          </p>
        </div>

        <DialogFooter>
          <Button size="sm" onClick={handleApply}>
            적용
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface JobFilterProps {
  value: string[]
  onChange: (value: string[]) => void
}

// JOB_CATEGORIES는 상수 파일에서 import

export const JobFilter = ({ value, onChange }: JobFilterProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [localValue, setLocalValue] = useState<string[]>(value)

  useEffect(() => {
    if (!open) {
      setLocalValue(value)
    }
  }, [value, open])

  const handleToggleJob = (job: string) => {
    if (localValue.length >= 3 && !localValue.includes(job)) return
    const newJobs = localValue.includes(job)
      ? localValue.filter((j) => j !== job)
      : [...localValue, job]
    setLocalValue(newJobs)
  }

  const handleApply = () => {
    onChange(localValue)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-10 px-4 text-sm whitespace-nowrap min-w-[120px]"
        >
          {value.length > 0 ? `직무 ${value.length}개` : '직무'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>직무 선택</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_1.5fr] gap-4 py-4">
          <div className="border-r border-gray-200 pr-4">
            <h4 className="text-sm font-medium mb-3 text-gray-700">분류</h4>
            <div className="space-y-1">
              {JOB_CATEGORIES.map((category) => (
                <button
                  key={category.category}
                  onClick={() => setSelectedCategory(category.category)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    selectedCategory === category.category
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {category.category}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3 text-gray-700">직무</h4>
            {selectedCategory ? (
              <div className="space-y-1">
                {JOB_CATEGORIES.find((c) => c.category === selectedCategory)
                  ?.jobs.map((job) => (
                    <label
                      key={job}
                      className="flex items-center justify-between px-3 py-2 text-sm rounded-md hover:bg-gray-50 cursor-pointer"
                    >
                      <span className="text-gray-700">{job}</span>
                      <input
                        type="checkbox"
                        checked={localValue.includes(job)}
                        onChange={() => handleToggleJob(job)}
                        className="w-4 h-4"
                      />
                    </label>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-4">분류를 선택해주세요</p>
            )}
          </div>
        </div>

        {localValue.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">
                선택된 직무 ({localValue.length}/3)
              </span>
              <button
                onClick={() => setLocalValue([])}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                전체 삭제
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {localValue.map((job) => (
                <div
                  key={job}
                  className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md text-sm"
                >
                  <span>{job}</span>
                  <XCircle
                    className="h-3 w-3 cursor-pointer text-gray-400 hover:text-gray-600"
                    onClick={() =>
                      setLocalValue((prev) => prev.filter((j) => j !== job))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                취소
              </Button>
            </DialogClose>
            <Button size="sm" onClick={handleApply}>
              적용
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface SpecializationFilterProps {
  value: string[]
  onChange: (value: string[]) => void
}

export const SpecializationFilter = ({
  value,
  onChange,
}: SpecializationFilterProps) => {
  return (
    <MultiSelectButton
      values={value}
      onChange={onChange}
      placeholder="전문분야"
      options={EXPERTISE_OPTIONS.map((exp) => ({
        label: exp,
        value: exp,
      }))}
    />
  )
}
