'use client'

import { useMemo } from 'react'

interface MarkdownTableProps {
  content: string
}

/**
 * 마크다운 표를 파싱하여 HTML 표로 렌더링
 */
export function MarkdownTable({ content }: MarkdownTableProps) {
  const tables = useMemo(() => {
    const tableRegex = /(\|.+\|[\n\r]+)+/g
    const matches = content.match(tableRegex)
    
    if (!matches) return []

    return matches.map((match) => {
      const lines = match.split(/[\n\r]+/).filter((line) => line.trim() && line.includes('|'))
      
      if (lines.length < 2) return null

      // 헤더 추출 (첫 번째 줄)
      const headerLine = lines[0]
      const headers = headerLine
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell) => cell && !cell.match(/^[-:]+$/)) // 구분선 제거

      // 구분선 제거 (두 번째 줄이 구분선일 수 있음)
      const dataLines = lines.slice(1).filter(
        (line) => !line.match(/^[\s\|:-\|]+$/)
      )

      // 데이터 행 추출
      const rows = dataLines.map((line) =>
        line
          .split('|')
          .map((cell) => cell.trim())
          .filter((cell) => cell)
      )

      return { headers, rows }
    }).filter((table): table is { headers: string[]; rows: string[][] } => table !== null)
  }, [content])

  if (tables.length === 0) return null

  return (
    <div className="space-y-6">
      {tables.map((table, tableIdx) => (
        <div key={tableIdx} className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {table.headers.map((header, idx) => (
                  <th
                    key={idx}
                    className="px-4 py-3 text-left font-semibold text-slate-700"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  {table.headers.map((_, colIdx) => (
                    <td key={colIdx} className="px-4 py-3 text-slate-700">
                      {row[colIdx] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

