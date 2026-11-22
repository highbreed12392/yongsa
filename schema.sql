-- 용사의 주간 계획표 · Supabase 데이터베이스 설정
-- Supabase 대시보드 → SQL Editor → New query 에 이 파일 전체를 붙여넣고 Run 하세요. (여러 번 실행해도 안전)

create table if not exists public.docs (
  path       text primary key,          -- 예: heroes/<내 id>, guilds/abc/feed/xyz
  parent     text not null,             -- 예: heroes, guilds/abc/feed
  data       jsonb not null default '{}'::jsonb,
  owner      uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create index if not exists docs_parent_idx on public.docs (parent);
create index if not exists docs_target_idx on public.docs ((data->>'target')) where parent = 'raids';

-- 누가 어떤 경로에 쓸 수 있는지
--  data/users/<내 id>/...  : 나만 읽고 쓰기 (내 세이브)
--  heroes/<내 id>          : 모두 읽기, 나만 쓰기 (랭킹)
--  guilds/..., raids/...   : 로그인한 사람 모두 읽고 쓰기 (길드·습격)
create or replace function public.docs_can_write(p text) returns boolean
language sql stable as $$
  select case
    when p like 'data/users/%' then split_part(p,'/',3) = auth.uid()::text
    when p like 'heroes/%'     then split_part(p,'/',2) = auth.uid()::text and split_part(p,'/',3) = ''
    when p like 'guilds/%' or p like 'raids/%' then auth.uid() is not null
    else false end
$$;
create or replace function public.docs_can_read(p text) returns boolean
language sql stable as $$
  select case
    when p like 'data/users/%' then split_part(p,'/',3) = auth.uid()::text
    else auth.uid() is not null end
$$;

alter table public.docs enable row level security;
drop policy if exists docs_read on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;
create policy docs_read   on public.docs for select to authenticated using (public.docs_can_read(path));
create policy docs_insert on public.docs for insert to authenticated with check (public.docs_can_write(path) and parent = array_to_string((string_to_array(path,'/'))[1:array_length(string_to_array(path,'/'),1)-1],'/'));
create policy docs_update on public.docs for update to authenticated using (public.docs_can_write(path)) with check (public.docs_can_write(path));
create policy docs_delete on public.docs for delete to authenticated using (public.docs_can_write(path));

-- 문서 일부만 고치기 (게임의 doc.update())
create or replace function public.docs_merge(p text, patch jsonb) returns void
language sql security invoker as $$
  insert into public.docs (path, parent, data, updated_at)
  values (p, array_to_string((string_to_array(p,'/'))[1:array_length(string_to_array(p,'/'),1)-1],'/'), patch, now())
  on conflict (path) do update set data = public.docs.data || excluded.data, updated_at = now();
$$;

-- 너무 큰 문서 막기 (세이브 1개 최대 약 1MB)
alter table public.docs drop constraint if exists docs_size;
alter table public.docs add constraint docs_size check (pg_column_size(data) < 1000000);

-- 실시간 반영 켜기
alter table public.docs replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='docs') then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;
