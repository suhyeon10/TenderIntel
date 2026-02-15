# 💡 Ollama는 선택사항입니다

## 현재 상태

✅ **검색 기능 작동 중**
- 벡터 검색으로 관련 문서 찾기 가능
- 인덱싱된 문서 검색 가능

⚠️ **LLM 답변 생성 불가**
- Ollama가 없으면 검색 결과만 표시
- LLM이 답변을 생성하지 않음

## Ollama 없이 사용하기

### Streamlit에서 검색

1. 질문 입력: "위치도에 대한 내용은?"
2. 검색 결과 확인:
   - 관련 문서 목록
   - 문서 내용 미리보기
   - 유사도 점수

### API 직접 사용

```bash
curl "http://localhost:8000/api/v2/announcements/search?query=위치도&limit=5"
```

응답:
```json
{
  "answer": "검색된 1개의 문서를 찾았습니다.",
  "results": [
    {
      "title": "0. 위치도 및 사진대지(장등천) ★.pdf",
      "content": "...",
      "score": 0.85,
      "announcement_id": "a47596e7-5463-4192-bf7d-0156af22ace3"
    }
  ]
}
```

## Ollama 설치하면

- ✅ 검색 결과 기반 LLM 답변 생성
- ✅ 자연어로 요약된 답변
- ✅ 더 나은 사용자 경험

## 결론

**지금 바로 사용 가능합니다!**
- Ollama 없이도 검색 기능 테스트 가능
- Ollama는 나중에 설치해도 됩니다

