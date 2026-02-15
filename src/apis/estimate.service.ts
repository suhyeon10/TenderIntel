import { createSupabaseBrowserClient } from '@/supabase/supabase-client';

// 공통 에러 핸들링 함수
const handleError = (message: string, error?: any) => {
    console.error(message, error);
    throw new Error(message);
};

// Supabase 클라이언트 생성
const supabase = createSupabaseBrowserClient();

// 세션 확인 함수 (예외 처리 추가)
const checkSession = async (): Promise<string> => {
    const { data: sessionData, error } = await supabase.auth.getSession();

    if (error || !sessionData || !sessionData.session) {
        handleError('인증되지 않은 사용자입니다.', error);
        throw new Error('Unreachable code'); // 명확하게 throw
    }

    return sessionData.session.user.id;
};

// Estimate 데이터 조회 (null 허용)
const fetchEstimate = async (clientId: string, counselId: number, status: string[]) => {
    const { data, error } = await supabase
        .from('estimate')
        .select('*')
        .eq('client_id', clientId)
        .eq('counsel_id', counselId)
        .in('estimate_status', status)
        .maybeSingle(); // null 허용

    if (error) handleError('견적 데이터 조회 실패', error);
    return data;
};

// 가장 최신의 Estimate Version 가져오기
const fetchLatestEstimateVersion = async (estimateId: number | null) => {
    if (!estimateId) return null; // `null`인 경우 null 반환

    const { data, error } = await supabase
        .from('estimate_version')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('version_date', { ascending: false }) // 최신 버전이 가장 위로 오게 정렬
        .limit(1) // 최신 1개만 가져옴
        .maybeSingle();

    if (error) handleError('최신 견적 버전 데이터 조회 실패', error);
    return data;
};

// Team 데이터 조회
const fetchTeam = async (teamId: number) => {
    if (!teamId) return null;
    const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .maybeSingle(); // null 허용

    if (error) handleError('팀 정보를 찾을 수 없습니다.', error);
    return data;
};

// Milestone 데이터 조회
const fetchMilestones = async (estimateId: number | null) => {
    if (!estimateId) return []; // `null`인 경우 빈 배열 반환
    const { data, error } = await supabase
        .from('milestone')
        .select('*')
        .eq('estimate_id', estimateId);

    if (error) handleError('마일스톤 데이터를 찾을 수 없습니다.', error);
    return data ;
};

// ClientId & CounselId로 Team, Milestone, 최신 Estimate Version 정보 가져오기
export const getClientTeamAndMilestones = async (clientId: string, counselId: number, estimateStatus: string[]) => {
    try {
        const managerId = await checkSession(); // 세션 체크
        console.log('Fetching team, estimate version, and milestones for:', { clientId, counselId, managerId });

        const estimate = await fetchEstimate(clientId, counselId, estimateStatus);

        if (!estimate) {
            console.warn('진행 중인 estimate가 없습니다.');
            throw new Error('진행 중인 estimate가 없습니다.');
        }

        const team = await fetchTeam(estimate.team_id);
        const milestones = await fetchMilestones(estimate.estimate_id);
        const latestEstimateVersion = await fetchLatestEstimateVersion(estimate.estimate_id);

        return { team, estimate, estimateVersion: latestEstimateVersion, milestones };
    } catch (error) {
        handleError('팀 및 마일스톤 데이터 조회 중 오류 발생', error);
    }
};

// 특정 estimate_version 조회
const fetchEstimateVersion = async (estimateVersionId: number) => {

    console.log("estimate_version", estimateVersionId)
    const { data, error } = await supabase
        .from('estimate_version')
        .select('*')
        .eq('estimate_version_id', estimateVersionId)
        .maybeSingle();

    if (error || !data) {
        handleError('해당 estimate_version을 찾을 수 없습니다.', error);
    }

    return data;
};

// estimate status 업데이트 함수
const updateEstimateStatus = async (estimateId: number) => {
    const { error } = await supabase
        .from('estimate')
        .update({ estimate_status: 'accept' })
        .eq('estimate_id', estimateId);

    if (error) {
        handleError('Estimate 상태 업데이트 실패', error);
    }
};

// estimate_version_id를 받아 estimate의 status를 'accept'로 변경하는 API
export const acceptEstimateVersion = async (estimateVersionId: number) => {
    try {
        await checkSession(); // 인증 확인
        console.log(`Updating estimate status to 'accept' for estimate_version_id: ${estimateVersionId}`);

        // estimate_version 조회
        const estimateVersion = await fetchEstimateVersion(estimateVersionId);
        const estimateId = estimateVersion?.estimate_id;
        console.log("estimateID:: ", estimateId)
        if (!estimateId) {
            throw new Error('연결된 estimate가 없습니다.');
        }

        // estimate status를 'accept'로 변경
        await updateEstimateStatus(estimateId);

        return { success: true, message: 'Estimate이 accept 상태로 변경되었습니다.' };
    } catch (error) {
        handleError('Estimate status 업데이트 중 오류 발생', error);
    }
};

// 새로운 estimate 생성 함수
export const insertEstimate = async (estimateData: {
    clientId: string;
    counselId: number;
    projectStartDate: string;
    projectEndDate: string;
    budget: number;
    detailEstimate: string;
    milestones: any[];
    teamId?: number; // 팀 ID를 선택적으로 받음
}) => {
    try {
        const managerId = await checkSession(); // 세션 체크
        
        console.log('Creating new estimate:', estimateData);

        // 팀 ID가 제공되지 않은 경우, 사용자의 팀 조회
        let finalTeamId: number
        if (estimateData.teamId) {
            // 제공된 팀 ID가 사용자의 팀인지 확인
            const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .select('id')
                .eq('id', estimateData.teamId)
                .maybeSingle()

            if (teamError || !teamData) {
                handleError('유효하지 않은 팀입니다.', teamError);
                return;
            }
            finalTeamId = teamData.id
        } else {
            // 현재 사용자의 FREELANCER 프로필 조회
            const { data: managerProfile, error: profileError } = await supabase
                .from('accounts')
                .select('profile_id')
                .eq('user_id', managerId)
                .eq('profile_type', 'FREELANCER')
                .maybeSingle()

            if (profileError || !managerProfile) {
                handleError('프리랜서 프로필을 찾을 수 없습니다.', profileError);
                return;
            }

            // 팀 정보 가져오기 (manager_profile_id로 조회)
            const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .select('id')
                .eq('manager_profile_id', managerProfile.profile_id)
                .maybeSingle()

            if (teamError || !teamData) {
                handleError('팀 정보를 찾을 수 없습니다. 먼저 팀을 생성해주세요.', teamError);
                return;
            }
            finalTeamId = teamData.id
        }

        // 1. estimate 테이블에 기본 정보 삽입
        const { data: estimate, error: estimateError } = await supabase
            .from('estimate')
            .insert({
                client_id: estimateData.clientId,
                counsel_id: estimateData.counselId,
                manager_id: managerId,
                team_id: finalTeamId,
                estimate_status: 'pending',
                estimate_start_date: estimateData.projectStartDate,
                estimate_due_date: estimateData.projectEndDate,
                estimate_date: new Date().toISOString().split('T')[0]
            })
            .select('*')
            .single();

        if (estimateError || !estimate) {
            handleError('Estimate 생성 실패', estimateError);
            return; // 명시적으로 return 추가
        }

        // 2. estimate_version 테이블에 상세 정보 삽입
        const { data: estimateVersion, error: versionError } = await supabase
            .from('estimate_version')
            .insert({
                estimate_id: estimate.estimate_id,
                total_amount: estimateData.budget,
                detail: estimateData.detailEstimate,
                start_date: estimateData.projectStartDate,
                end_date: estimateData.projectEndDate,
                version_date: new Date().toISOString().split('T')[0]
            })
            .select('*')
            .single();

        if (versionError || !estimateVersion) {
            handleError('Estimate version 생성 실패', versionError);
            return; // 명시적으로 return 추가
        }

        // 3. milestone 테이블에 마일스톤 정보 삽입
        if (estimateData.milestones && estimateData.milestones.length > 0) {
            const milestoneData = estimateData.milestones.map((milestone, index) => ({
                estimate_id: estimate.estimate_id,
                estimate_version_id: estimateVersion.estimate_version_id,
                title: milestone.title || `마일스톤 ${index + 1}`,
                detail: milestone.detail || '',
                output: milestone.output || '',
                payment_amount: milestone.cost ? parseFloat(milestone.cost) : 0,
                progress: milestone.progress ? parseInt(milestone.progress) : 0,
                milestone_start_date: estimateData.projectStartDate,
                milestone_due_date: estimateData.projectEndDate,
                milestone_status: 'pending' as const
            }));

            const { error: milestoneError } = await supabase
                .from('milestone')
                .insert(milestoneData);

            if (milestoneError) {
                handleError('Milestone 생성 실패', milestoneError);
            }
        }

        // 4. RAG를 위한 벡터 임베딩 생성 (비동기, 실패해도 견적서 생성은 성공)
        // 동적 import를 사용하여 순환 참조 방지
        if (typeof window !== 'undefined') {
            // 클라이언트 사이드에서만 실행
            import('@/apis/estimate-rag.service').then(({ createEstimateEmbedding }) => {
                createEstimateEmbedding(estimate.estimate_id, estimateVersion.estimate_version_id)
                    .catch((error) => {
                        console.warn('견적서 임베딩 생성 실패 (견적서는 정상 생성됨):', error);
                    });
            }).catch((error) => {
                console.warn('RAG 서비스 로드 실패:', error);
            });
        }

        return { 
            success: true, 
            message: 'Estimate가 성공적으로 생성되었습니다.',
            estimate,
            estimateVersion
        };
    } catch (error) {
        handleError('Estimate 생성 중 오류 발생', error);
    }
};