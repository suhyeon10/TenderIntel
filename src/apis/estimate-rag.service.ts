import { createSupabaseBrowserClient } from '@/supabase/supabase-client';

// 공통 에러 핸들링 함수
const handleError = (message: string, error?: any) => {
  console.error(message, error);
  throw new Error(message);
};

// Supabase 클라이언트 생성
const supabase = createSupabaseBrowserClient();

// 세션 확인 함수
const checkSession = async (): Promise<string> => {
  const { data: sessionData, error } = await supabase.auth.getSession();

  if (error || !sessionData || !sessionData.session) {
    handleError('인증되지 않은 사용자입니다.', error);
    throw new Error('Unreachable code');
  }

  return sessionData.session.user.id;
};

/**
 * OpenAI API를 사용하여 텍스트를 벡터 임베딩으로 변환
 * @param text 임베딩할 텍스트
 * @returns 벡터 임베딩 배열
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    // OpenAI API 호출 (서버 사이드에서만 실행되어야 함)
    const response = await fetch('/api/rag/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`임베딩 생성 실패: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    handleError('임베딩 생성 중 오류 발생', error);
    throw error;
  }
};

/**
 * 견적서 데이터를 텍스트로 변환
 * @param estimateVersion 견적서 버전 데이터
 * @param milestones 마일스톤 데이터
 * @returns 변환된 텍스트
 */
export const formatEstimateContent = (
  estimateVersion: any,
  milestones: any[] = []
): string => {
  const parts: string[] = [];

  // 견적서 상세 내용
  if (estimateVersion.detail) {
    parts.push(`견적서 상세: ${estimateVersion.detail}`);
  }

  // 총 금액
  if (estimateVersion.total_amount) {
    parts.push(`총 금액: ${estimateVersion.total_amount.toLocaleString()}원`);
  }

  // 기간
  if (estimateVersion.start_date && estimateVersion.end_date) {
    parts.push(`프로젝트 기간: ${estimateVersion.start_date} ~ ${estimateVersion.end_date}`);
  }

  // 마일스톤 정보
  if (milestones && milestones.length > 0) {
    parts.push('\n마일스톤:');
    milestones.forEach((milestone, index) => {
      if (milestone.title) parts.push(`  ${index + 1}. ${milestone.title}`);
      if (milestone.detail) parts.push(`     상세: ${milestone.detail}`);
      if (milestone.output) parts.push(`     산출물: ${milestone.output}`);
      if (milestone.payment_amount) {
        parts.push(`     금액: ${milestone.payment_amount.toLocaleString()}원`);
      }
    });
  }

  return parts.join('\n');
};

/**
 * 견적서 데이터를 벡터 임베딩으로 변환하고 저장
 * @param estimateId 견적서 ID
 * @param estimateVersionId 견적서 버전 ID
 */
export const createEstimateEmbedding = async (
  estimateId: number,
  estimateVersionId: number
): Promise<void> => {
  try {
    await checkSession();

    // 견적서 버전 데이터 조회
    const { data: estimateVersion, error: versionError } = await supabase
      .from('estimate_version')
      .select('*')
      .eq('estimate_version_id', estimateVersionId)
      .single();

    if (versionError || !estimateVersion) {
      handleError('견적서 버전을 찾을 수 없습니다.', versionError);
      return;
    }

    // 마일스톤 데이터 조회
    const { data: milestones, error: milestoneError } = await supabase
      .from('milestone')
      .select('*')
      .eq('estimate_version_id', estimateVersionId);

    if (milestoneError) {
      console.warn('마일스톤 조회 실패:', milestoneError);
    }

    // 텍스트로 변환
    const contentText = formatEstimateContent(estimateVersion, milestones || []);

    // 벡터 임베딩 생성
    const embedding = await generateEmbedding(contentText);

    // 기존 임베딩 삭제 (있을 경우)
    await supabase
      .from('estimate_embeddings')
      .delete()
      .eq('estimate_id', estimateId)
      .eq('estimate_version_id', estimateVersionId)
      .eq('content_type', 'detail');

    // 새 임베딩 저장
    // Supabase는 vector 타입을 배열로 직접 받을 수 있음
    const { error: insertError } = await supabase
      .from('estimate_embeddings')
      .insert({
        estimate_id: estimateId,
        estimate_version_id: estimateVersionId,
        embedding: embedding, // 배열을 직접 전달
        content_text: contentText,
        content_type: 'detail',
        metadata: {
          total_amount: estimateVersion.total_amount,
          start_date: estimateVersion.start_date,
          end_date: estimateVersion.end_date,
          milestone_count: milestones?.length || 0,
        },
      });

    if (insertError) {
      handleError('임베딩 저장 실패', insertError);
    }
  } catch (error) {
    handleError('견적서 임베딩 생성 중 오류 발생', error);
  }
};

/**
 * 벡터 유사도 검색을 통해 관련 견적서 찾기
 * @param query 검색 쿼리 텍스트
 * @param options 검색 옵션
 * @returns 검색 결과
 */
export const searchEstimatesByRAG = async (
  query: string,
  options: {
    matchThreshold?: number; // 유사도 임계값 (0~1)
    matchCount?: number; // 반환할 결과 수
    filterEstimateIds?: number[]; // 특정 견적서만 검색
  } = {}
): Promise<Array<{
  estimate_id: number;
  estimate_version_id: number;
  content_text: string;
  content_type: string;
  similarity: number;
  metadata: any;
}>> => {
  try {
    await checkSession();

    const {
      matchThreshold = 0.7,
      matchCount = 10,
      filterEstimateIds = null,
    } = options;

    // 쿼리 텍스트를 벡터로 변환
    const queryEmbedding = await generateEmbedding(query);

    // Supabase RPC 함수 호출하여 벡터 검색
    // vector 타입은 배열로 직접 전달 가능
    const { data, error } = await supabase.rpc('match_estimate_embeddings', {
      query_embedding: queryEmbedding, // 배열을 직접 전달
      match_threshold: matchThreshold,
      match_count: matchCount,
      filter_estimate_ids: filterEstimateIds,
    });

    if (error) {
      handleError('벡터 검색 실패', error);
      return [];
    }

    return data || [];
  } catch (error) {
    handleError('RAG 검색 중 오류 발생', error);
    return [];
  }
};

/**
 * 견적서 삭제 시 관련 임베딩도 삭제
 * @param estimateId 견적서 ID
 */
export const deleteEstimateEmbedding = async (
  estimateId: number
): Promise<void> => {
  try {
    await checkSession();

    const { error } = await supabase
      .from('estimate_embeddings')
      .delete()
      .eq('estimate_id', estimateId);

    if (error) {
      handleError('임베딩 삭제 실패', error);
    }
  } catch (error) {
    handleError('견적서 임베딩 삭제 중 오류 발생', error);
  }
};

