"""
법률 RAG API 테스트 스크립트
청크 저장이 완료된 후 API가 정상 작동하는지 확인
"""

import requests
import json
from typing import Dict, Any

# 백엔드 API URL
BASE_URL = "http://localhost:8000"
LEGAL_API_BASE = f"{BASE_URL}/api/v1/legal"


def test_search_cases(query: str = "근로시간", limit: int = 5):
    """케이스 검색 테스트"""
    print(f"\n{'='*60}")
    print(f"테스트 1: 케이스 검색")
    print(f"{'='*60}")
    print(f"쿼리: {query}")
    print(f"제한: {limit}")
    
    url = f"{LEGAL_API_BASE}/search-cases"
    params = {"query": query, "limit": limit}
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"\n상태 코드: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ 성공! {len(data.get('cases', []))}개 케이스 발견")
            print(f"\n응답 데이터:")
            print(json.dumps(data, ensure_ascii=False, indent=2))
            return True
        else:
            print(f"\n❌ 실패: {response.status_code}")
            print(f"응답: {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"\n❌ 연결 실패: 백엔드 서버가 실행 중인지 확인하세요.")
        print(f"   서버 URL: {BASE_URL}")
        return False
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")
        return False


def test_analyze_situation(text: str = "회사에서 초과근무를 시키는데 수당을 주지 않습니다"):
    """상황 분석 테스트"""
    print(f"\n{'='*60}")
    print(f"테스트 2: 상황 분석")
    print(f"{'='*60}")
    print(f"상황 설명: {text}")
    
    url = f"{LEGAL_API_BASE}/analyze-situation"
    payload = {"text": text}
    
    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        print(f"\n상태 코드: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ 성공!")
            print(f"\n리스크 점수: {data.get('risk_score', 'N/A')}")
            print(f"리스크 레벨: {data.get('risk_level', 'N/A')}")
            print(f"요약: {data.get('summary', 'N/A')}")
            print(f"이슈 개수: {len(data.get('issues', []))}")
            print(f"권고사항 개수: {len(data.get('recommendations', []))}")
            print(f"근거 청크 개수: {len(data.get('grounding', []))}")
            print(f"\n전체 응답:")
            print(json.dumps(data, ensure_ascii=False, indent=2))
            return True
        else:
            print(f"\n❌ 실패: {response.status_code}")
            print(f"응답: {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"\n❌ 연결 실패: 백엔드 서버가 실행 중인지 확인하세요.")
        return False
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")
        return False


def main():
    """메인 테스트 함수"""
    print("="*60)
    print("법률 RAG API 테스트")
    print("="*60)
    print(f"\n백엔드 서버: {BASE_URL}")
    print(f"API 엔드포인트: {LEGAL_API_BASE}")
    
    # 서버 연결 확인
    try:
        health_check = requests.get(f"{BASE_URL}/", timeout=5)
        if health_check.status_code == 200:
            print(f"\n✅ 백엔드 서버 연결 성공")
        else:
            print(f"\n⚠️  백엔드 서버 응답 이상: {health_check.status_code}")
    except:
        print(f"\n❌ 백엔드 서버에 연결할 수 없습니다.")
        print(f"   서버를 먼저 실행하세요: cd backend && python main.py")
        return
    
    # 테스트 실행
    results = []
    
    # 테스트 1: 케이스 검색
    results.append(("케이스 검색", test_search_cases()))
    
    # 테스트 2: 상황 분석
    results.append(("상황 분석", test_analyze_situation()))
    
    # 결과 요약
    print(f"\n{'='*60}")
    print("테스트 결과 요약")
    print(f"{'='*60}")
    for name, success in results:
        status = "✅ 통과" if success else "❌ 실패"
        print(f"{name}: {status}")
    
    all_passed = all(result[1] for result in results)
    if all_passed:
        print(f"\n🎉 모든 테스트 통과! RAG API가 정상 작동합니다.")
    else:
        print(f"\n⚠️  일부 테스트 실패. 서버 로그를 확인하세요.")


if __name__ == "__main__":
    main()

