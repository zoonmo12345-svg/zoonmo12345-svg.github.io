-- 외부 봇(피클)용 읽기 전용 조회 API (2026-11-27 실행함)
-- 호출: GET https://<프로젝트>.supabase.co/rest/v1/rpc/recent_signups[?since=2026-11-27T00:00:00Z]
--   헤더: apikey: <공개 키(sb_publishable_...)>   x-api-key: <봇 키>
-- 봇 키가 틀리면 401. 응답: 최근 가입자 20명 (id, nickname, main_char, created_at, status). 아이디·연락처는 안 나감.
-- 봇 키는 DB에 암호화된 값(sha256)만 저장. 원래 값은 발급할 때 한 번만 보임.

create schema if not exists private;
create table if not exists private.bot_keys (name text primary key, key_hash text not null, created_at timestamptz not null default now());
alter table private.bot_keys enable row level security;
revoke all on schema private from anon, authenticated;
revoke all on private.bot_keys from anon, authenticated;

create or replace function public.recent_signups(since timestamptz default null)
returns table (id uuid, nickname text, main_char text, created_at timestamptz, status text)
language plpgsql stable security definer set search_path = public as $$
declare k text := coalesce(current_setting('request.headers', true)::json->>'x-api-key', '');
begin
  if length(k) < 20 or not exists (select 1 from private.bot_keys b where b.key_hash = encode(sha256(convert_to(k, 'utf8')), 'hex')) then
    raise sqlstate 'PT401' using message = 'invalid api key';
  end if;
  return query select p.id, p.char_name, p.main_char, p.created_at, p.status from profiles p
    where (since is null or p.created_at > since) order by p.created_at desc limit 20;
end $$;
revoke all on function public.recent_signups(timestamptz) from public;
grant execute on function public.recent_signups(timestamptz) to anon, authenticated;

-- 봇 키 발급·교체 (Supabase SQL 편집기에서 실행. 결과에 나온 값을 바로 복사. 다시 실행하면 새 키로 바뀌고 옛 키는 막힘)
-- with k as materialized (select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as k),
-- ins as (insert into private.bot_keys (name, key_hash) select 'pickle', encode(sha256(convert_to(k, 'utf8')), 'hex') from k
--         on conflict (name) do update set key_hash = excluded.key_hash, created_at = now() returning 1)
-- select k.k as bot_api_key from k, ins;

-- 봇 키 막기:  delete from private.bot_keys where name = 'pickle';
