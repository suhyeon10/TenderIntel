-- Legal 서비스 전용으로 테이블 정리 마이그레이션
-- Legal 관련 테이블만 유지하고 나머지 모든 테이블 삭제
-- 
-- 유지할 테이블 (Legal 관련):
-- - legal_documents: 법률 문서 메타데이터
-- - legal_document_bodies: 법률 문서 본문
-- - legal_chunks: 법률 문서 청크 및 임베딩 (RAG용)
-- - contract_analyses: 계약서 분석 결과
--
-- 삭제할 테이블:
-- - accounts 관련: accounts, account_educations, account_work_experiences, account_license, account_portfolios, career_verification_requests
-- - teams 관련: teams, team_members, team_proposals, team_counsel, team_project, team_embeddings, estimate_templates
-- - payment 관련: payment, payments, milestone
-- - estimate 관련: estimate, estimate_version, estimate_embeddings
-- - counsel 관련: counsel, counsel_status_events, project_members
-- - client 관련: client
-- - announcements 관련: announcements, announcement_bodies, announcement_chunks, announcement_analysis, public_announcements, announcement_embeddings, announcement_team_matches, announcement_estimates
-- - chat 관련: chat, chat_message
-- - subscriptions 관련: subscriptions
-- - notifications
-- - magazine
-- - manager_bookmarks
-- - rag_audit_logs

-- 외래키 의존성을 고려하여 역순으로 삭제

-- 1. 가장 하위 테이블들부터 삭제 (외래키를 참조하는 테이블들)

-- Chat 관련
DROP TABLE IF EXISTS public.chat_message CASCADE;
DROP TABLE IF EXISTS public.chat CASCADE;

-- Estimate 관련
DROP TABLE IF EXISTS public.estimate_embeddings CASCADE;
DROP TABLE IF EXISTS public.estimate_version CASCADE;
DROP TABLE IF EXISTS public.estimate CASCADE;

-- Milestone 및 Payment 관련
DROP TABLE IF EXISTS public.payment CASCADE;
DROP TABLE IF EXISTS public.milestone CASCADE;

-- Payments (구독 결제)
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;

-- Project 관련
DROP TABLE IF EXISTS public.project_members CASCADE;
DROP TABLE IF EXISTS public.team_project CASCADE;

-- Counsel 관련
DROP TABLE IF EXISTS public.counsel_status_events CASCADE;
DROP TABLE IF EXISTS public.counsel CASCADE;

-- Announcements 관련 (하위 테이블부터)
DROP TABLE IF EXISTS public.announcement_estimates CASCADE;
DROP TABLE IF EXISTS public.announcement_team_matches CASCADE;
DROP TABLE IF EXISTS public.announcement_embeddings CASCADE;
DROP TABLE IF EXISTS public.announcement_analysis CASCADE;
DROP TABLE IF EXISTS public.announcement_chunks CASCADE;
DROP TABLE IF EXISTS public.announcement_bodies CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.public_announcements CASCADE;

-- Team 관련
DROP TABLE IF EXISTS public.team_embeddings CASCADE;
DROP TABLE IF EXISTS public.estimate_templates CASCADE;
DROP TABLE IF EXISTS public.team_proposals CASCADE;
DROP TABLE IF EXISTS public.team_counsel CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;

-- Account 관련 (하위 테이블부터)
DROP TABLE IF EXISTS public.career_verification_requests CASCADE;
DROP TABLE IF EXISTS public.account_portfolios CASCADE;
DROP TABLE IF EXISTS public.account_license CASCADE;
DROP TABLE IF EXISTS public.account_work_experiences CASCADE;
DROP TABLE IF EXISTS public.account_educations CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;

-- Client 관련
DROP TABLE IF EXISTS public.client CASCADE;

-- Notifications
DROP TABLE IF EXISTS public.notifications CASCADE;

-- 기타
DROP TABLE IF EXISTS public.magazine CASCADE;
DROP TABLE IF EXISTS public.manager_bookmarks CASCADE;
DROP TABLE IF EXISTS public.rag_audit_logs CASCADE;

