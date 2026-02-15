-- 계약서 분석 디버깅 쿼리
-- "앞부분에만 이슈/조항이 몰린다" 문제 진단용

-- 1. 해당 파일의 분석 레코드 확인
SELECT 
    id, 
    doc_id, 
    file_name,
    LENGTH(contract_text) as contract_text_length,
    created_at
FROM contract_analyses
WHERE file_name = 'a type 근로계약 한글 2021.7.5.pdf'  -- 여기에 실제 파일명 입력
ORDER BY created_at DESC
LIMIT 1;

-- 2. 이슈 개수 및 생성 시간 확인
SELECT 
    COUNT(*) as issue_count,
    MIN(created_at) as first_issue_time,
    MAX(created_at) as last_issue_time
FROM contract_issues
WHERE contract_analysis_id = '<위에서 나온 id 입력>';

-- 3. 이슈의 originalText 확인 (뒷부분 조항 포함 여부 체크)
SELECT 
    issue_id,
    category,
    severity,
    SUBSTRING(original_text, 1, 100) as original_text_preview,
    LENGTH(original_text) as original_text_length
FROM contract_issues
WHERE contract_analysis_id = '<위에서 나온 id 입력>'
ORDER BY created_at;

-- 4. contract_chunks 확인 (조항 번호 분포)
SELECT 
    article_number,
    paragraph_index,
    chunk_index,
    chunk_type,
    LENGTH(content) as content_length,
    SUBSTRING(content, 1, 60) as content_preview
FROM contract_chunks
WHERE contract_id = '<위에서 나온 doc_id 입력>'
ORDER BY chunk_index
LIMIT 30;

-- 5. 조항 번호 분포 확인 (article_number가 전부 1인지 체크)
SELECT 
    article_number,
    COUNT(*) as chunk_count,
    MIN(chunk_index) as min_chunk_index,
    MAX(chunk_index) as max_chunk_index
FROM contract_chunks
WHERE contract_id = '<위에서 나온 doc_id 입력>'
GROUP BY article_number
ORDER BY article_number;

-- 6. clauses JSONB 확인
SELECT 
    jsonb_pretty(clauses) as clauses_json
FROM contract_analyses
WHERE id = '<위에서 나온 id 입력>';

-- 7. highlighted_texts JSONB 확인 (offset 값 확인)
SELECT 
    jsonb_pretty(highlighted_texts) as highlighted_texts_json
FROM contract_analyses
WHERE id = '<위에서 나온 id 입력>';

-- 8. 전체 텍스트 길이 vs 이슈 위치 확인
SELECT 
    ca.id,
    LENGTH(ca.contract_text) as total_text_length,
    COUNT(ci.id) as issue_count,
    MIN(ci.created_at) as first_issue,
    MAX(ci.created_at) as last_issue,
    -- originalText에 "제2조", "제3조" 등 뒷부분 조항이 포함되어 있는지 확인
    COUNT(CASE WHEN ci.original_text LIKE '%제2조%' OR ci.original_text LIKE '%제3조%' OR ci.original_text LIKE '%제4조%' THEN 1 END) as back_section_issues
FROM contract_analyses ca
LEFT JOIN contract_issues ci ON ci.contract_analysis_id = ca.id
WHERE ca.file_name = 'a type 근로계약 한글 2021.7.5.pdf'  -- 여기에 실제 파일명 입력
GROUP BY ca.id, ca.contract_text;

