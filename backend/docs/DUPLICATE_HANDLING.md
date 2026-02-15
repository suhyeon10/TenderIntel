# 중복 데이터 처리 가이드

## 🔄 자동 중복 감지

시스템은 `content_hash`를 사용하여 자동으로 중복을 감지합니다:

1. **같은 내용**: `source` + `external_id` + `content_hash`가 동일하면
   - 기존 `announcement_id` 반환
   - 새로 저장하지 않음

2. **다른 내용**: `source` + `external_id`는 같지만 내용이 다르면
   - 버전을 올려서 새로 저장 (`version` 증가)
   - 기존 데이터는 유지

## 🗑️ 중복 데이터 삭제

### 방법 1: 스크립트 사용 (권장)

```bash
cd backend

# 공고 목록 조회
python scripts/delete_announcement.py --list

# 공고 ID로 삭제
python scripts/delete_announcement.py --delete <announcement_id>

# external_id + source로 삭제
python scripts/delete_announcement.py --external-id "2024-001" --source "나라장터"
```

### 방법 2: Supabase에서 직접 삭제

**주의**: 다음 순서로 삭제해야 외래키 제약 조건을 피할 수 있습니다:

```sql
-- 1. 청크 삭제
DELETE FROM announcement_chunks 
WHERE announcement_id = '<announcement_id>';

-- 2. 본문 삭제
DELETE FROM announcement_bodies 
WHERE announcement_id = '<announcement_id>';

-- 3. 분석 결과 삭제
DELETE FROM announcement_analysis 
WHERE announcement_id = '<announcement_id>';

-- 4. 공고 메타데이터 삭제
DELETE FROM announcements 
WHERE id = '<announcement_id>';
```

### 방법 3: 특정 조건으로 일괄 삭제

```sql
-- 특정 source의 모든 공고 삭제
DELETE FROM announcement_chunks 
WHERE announcement_id IN (
    SELECT id FROM announcements WHERE source = 'batch_upload'
);

DELETE FROM announcement_bodies 
WHERE announcement_id IN (
    SELECT id FROM announcements WHERE source = 'batch_upload'
);

DELETE FROM announcement_analysis 
WHERE announcement_id IN (
    SELECT id FROM announcements WHERE source = 'batch_upload'
);

DELETE FROM announcements 
WHERE source = 'batch_upload';
```

## ⚠️ 주의사항

1. **CASCADE 삭제**: Supabase에서 외래키 CASCADE가 설정되어 있으면 공고 삭제 시 자동으로 관련 데이터가 삭제됩니다.

2. **버전 관리**: 같은 `external_id`의 여러 버전이 있을 수 있으므로, 특정 버전만 삭제하려면 `version` 필드도 확인하세요.

3. **백업**: 삭제 전에 중요한 데이터는 백업하세요.

## 🔍 중복 확인 방법

```bash
# 공고 목록 조회 (버전 포함)
python scripts/delete_announcement.py --list --limit 50

# 특정 external_id의 모든 버전 확인
# (Supabase SQL Editor에서)
SELECT id, version, title, created_at, content_hash
FROM announcements
WHERE external_id = '2024-001' AND source = '나라장터'
ORDER BY version DESC;
```

## 📊 삭제 후 확인

```bash
# 삭제 후 공고 목록 재확인
python scripts/delete_announcement.py --list

# 또는 Supabase에서
SELECT COUNT(*) FROM announcements;
SELECT COUNT(*) FROM announcement_chunks;
```

