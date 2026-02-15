import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@/supabase/supabase-server';

/**
 * GET /api/test-supabase
 * Supabase 연결 테스트 API
 * 
 * ⚠️ 주의: 이 API는 쿠키 기반 인증을 사용합니다.
 * 403 에러가 발생하면 브라우저에서 로그아웃 후 재로그인하세요.
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 환경 변수 확인
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          success: false,
          error: '환경 변수가 설정되지 않았습니다.',
          env: {
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseKey,
            url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : '없음',
          },
        },
        { status: 500 }
      );
    }

    // Supabase 클라이언트 생성 (쿠키 파싱 지원)
    const supabase = await createServerSideClient();

    // 1. 연결 테스트 - 간단한 쿼리 실행
    const { data: healthCheck, error: healthError } = await supabase
      .from('accounts')
      .select('count')
      .limit(1);

    if (healthError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Supabase 연결 실패',
          details: healthError.message,
          code: healthError.code,
          hint: healthError.hint,
        },
        { status: 500 }
      );
    }

    // 2. 테이블 목록 조회
    const { data: tables, error: tablesError } = await supabase
      .from('accounts')
      .select('profile_id')
      .limit(1);

    // 3. estimate_embeddings 테이블 존재 확인
    let tableExists: any = null;
    let tableError: any = null;
    try {
      const result = await supabase
        .from('estimate_embeddings')
        .select('id')
        .limit(1);
      tableExists = result.data;
      tableError = result.error;
    } catch (err) {
      tableError = { message: '테이블이 존재하지 않습니다' };
    }

    // 4. estimate 테이블 확인
    let estimateData: any = null;
    let estimateError: any = null;
    try {
      const result = await supabase
        .from('estimate')
        .select('estimate_id')
        .limit(1);
      estimateData = result.data;
      estimateError = result.error;
    } catch (err) {
      // 에러 무시
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase 연결 성공',
      connection: {
        url: supabaseUrl,
        keyPrefix: supabaseKey.substring(0, 20) + '...',
      },
      tests: {
        healthCheck: {
          success: !healthError,
          error: (healthError as any)?.message || null,
        },
        accountsTable: {
          success: !tablesError,
          error: (tablesError as any)?.message || null,
        },
        estimateTable: {
          success: !estimateError,
          error: estimateError?.message || null,
        },
        estimateEmbeddingsTable: {
          exists: !tableError,
          error: tableError?.message || null,
        },
      },
      recommendations: [
        !tableError
          ? null
          : 'estimate_embeddings 테이블이 없습니다. database_estimate_rag_migration.sql을 실행하세요.',
      ].filter(Boolean),
    });
  } catch (error: any) {
    console.error('Supabase 연결 테스트 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '알 수 없는 오류가 발생했습니다.',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

