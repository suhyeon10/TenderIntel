// TODO: Admin auth guard 추가
import { createServerSideClient } from '@/supabase/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const supabase = await createServerSideClient()

    // legal_chunks 업데이트
    const { data, error } = await supabase
      .from('legal_chunks')
      .update({
        external_id: body.external_id,
        source_type: body.source_type,
        title: body.title,
        content: body.content,
        chunk_index: body.chunk_index,
        file_path: body.file_path,
        metadata: body.metadata,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('legal_chunks 업데이트 오류:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('API 오류:', error)
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSideClient()

    // legal_chunks 삭제
    const { error } = await supabase
      .from('legal_chunks')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('legal_chunks 삭제 오류:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API 오류:', error)
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

