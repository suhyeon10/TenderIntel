"""
팀 임베딩 동기화 스크립트
기존 팀들의 임베딩을 생성/업데이트합니다.
"""

import os
import sys
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
backend_root = Path(__file__).parent.parent
sys.path.insert(0, str(backend_root))

from supabase import create_client
from core.orchestrator_v2 import Orchestrator

def generate_team_summary(team_data):
    """팀 데이터에서 summary 생성"""
    parts = []
    
    if team_data.get('name'):
        parts.append(f"팀명: {team_data['name']}")
    
    if team_data.get('bio'):
        parts.append(f"소개: {team_data['bio']}")
    
    if team_data.get('specialty'):
        specialty = team_data['specialty']
        if isinstance(specialty, list) and len(specialty) > 0:
            parts.append(f"전문 분야: {', '.join(specialty)}")
    
    if team_data.get('sub_specialty'):
        sub_specialty = team_data['sub_specialty']
        if isinstance(sub_specialty, list) and len(sub_specialty) > 0:
            parts.append(f"세부 전문 분야: {', '.join(sub_specialty)}")
    
    if team_data.get('prefered'):
        prefered = team_data['prefered']
        if isinstance(prefered, list) and len(prefered) > 0:
            parts.append(f"선호 기술: {', '.join(prefered)}")
    
    summary = '\n'.join(parts)
    
    meta = {
        'specialty': team_data.get('specialty'),
        'sub_specialty': team_data.get('sub_specialty'),
        'prefered': team_data.get('prefered'),
    }
    
    return summary, meta


def sync_all_teams():
    """모든 팀의 임베딩 동기화"""
    # Supabase 클라이언트
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경 변수가 필요합니다.")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Orchestrator 초기화
    orchestrator = Orchestrator()
    
    # 모든 팀 조회
    print("📋 팀 목록 조회 중...")
    result = supabase.table("teams")\
        .select("*")\
        .is("deleted_at", None)\
        .execute()
    
    teams = result.data if result.data else []
    print(f"✅ {len(teams)}개 팀 발견")
    
    # 각 팀의 임베딩 생성/업데이트
    success_count = 0
    error_count = 0
    
    for i, team in enumerate(teams, 1):
        team_id = team['id']
        team_name = team.get('name', f'팀 #{team_id}')
        
        print(f"\n[{i}/{len(teams)}] 팀 처리 중: {team_name} (ID: {team_id})")
        
        try:
            # Summary 생성
            summary, meta = generate_team_summary(team)
            
            if not summary.strip():
                print(f"  ⚠️  팀 정보가 비어있어 임베딩을 건너뜁니다.")
                continue
            
            # 임베딩 저장
            orchestrator.store.upsert_team_embedding(
                team_id=team_id,
                summary=summary,
                meta=meta
            )
            
            print(f"  ✅ 임베딩 저장 완료")
            success_count += 1
            
        except Exception as e:
            print(f"  ❌ 오류: {str(e)}")
            error_count += 1
    
    print(f"\n{'='*50}")
    print(f"✅ 성공: {success_count}개")
    print(f"❌ 실패: {error_count}개")
    print(f"📊 총 처리: {len(teams)}개")


if __name__ == "__main__":
    sync_all_teams()

