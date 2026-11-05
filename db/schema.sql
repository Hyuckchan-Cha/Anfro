-- 수학 오개념 진단: Apps Script 시트 구조를 그대로 옮긴 저장소
-- 모든 테이블은 RLS를 켜고 정책을 두지 않는다 → 브라우저(anon 키)로는 읽고 쓸 수 없고, 서버(서비스 키·DB 직접 연결)만 쓴다.

create table if not exists gas_sheets (
  name text primary key,
  created_at timestamptz not null default now()
);

create table if not exists gas_rows (
  sheet text not null references gas_sheets(name) on delete cascade,
  idx integer not null,            -- 시트의 행 번호(1부터, 1행은 머리글)
  vals jsonb not null default '{}', -- {"0": 값, "1": 값, …} 열 번호(0부터) → 값
  primary key (sheet, idx)
);

create table if not exists gas_props (k text primary key, v text not null);          -- 스크립트 속성(API 키 등 비밀값)
create table if not exists gas_cache (k text primary key, v text not null, exp timestamptz not null); -- 로그인 세션 등
create index if not exists gas_cache_exp on gas_cache (exp);
create table if not exists gas_locks (name text primary key, owner text not null, exp timestamptz not null);
create table if not exists gas_folders (path text primary key);
create table if not exists gas_files (
  id text primary key,             -- Storage 객체 키
  folder text not null,
  name text not null,
  mime text,
  size integer,
  created_at timestamptz not null default now()
);
create index if not exists gas_files_folder on gas_files (folder, name);

alter table gas_sheets enable row level security;
alter table gas_rows enable row level security;
alter table gas_props enable row level security;
alter table gas_cache enable row level security;
alter table gas_locks enable row level security;
alter table gas_folders enable row level security;
alter table gas_files enable row level security;

-- 시트를 표처럼 보기 위한 보기(교사·관리자가 Supabase 표 편집기에서 확인용)
create or replace view gas_sheet_view as
  select sheet, idx, vals from gas_rows order by sheet, idx;
