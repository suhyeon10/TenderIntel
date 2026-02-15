'use client'

interface Chunk {
  id: number
  doc_id: number | string
  score: number
  content?: string
}

interface EvidencePanelProps {
  chunks: Chunk[]
  onChunkClick?: (chunkId: number) => void
}

export default function EvidencePanel({
  chunks,
  onChunkClick,
}: EvidencePanelProps) {
  if (!chunks || chunks.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm sticky top-24">
        <h3 className="text-lg font-semibold mb-4">사용된 근거</h3>
        <p className="text-sm text-slate-500">근거가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200/60 p-6 bg-white shadow-sm sticky top-24">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
        <h3 className="text-lg font-bold text-gray-900">사용된 근거</h3>
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
          {chunks.length}
        </span>
      </div>
      <div className="space-y-2.5 max-h-[calc(100vh-200px)] overflow-y-auto">
        {chunks.map((chunk) => (
          <button
            key={chunk.id}
            onClick={() => onChunkClick?.(chunk.id)}
            className="w-full text-left p-3 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 text-sm transition-all duration-200 group"
          >
            <div className="font-mono text-blue-600 text-xs mb-1 group-hover:text-blue-700">[id:{chunk.id}]</div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
              <span>문서 {chunk.doc_id}</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <span className="font-semibold text-blue-600">{(chunk.score * 100).toFixed(1)}%</span>
            </div>
            {chunk.content && (
              <div className="text-xs text-slate-600 mt-1.5 line-clamp-2 group-hover:text-slate-700">
                {chunk.content}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

