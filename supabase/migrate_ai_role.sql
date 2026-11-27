-- 보조AI 등급 (2026-11-27)
-- 승인 대기 명단을 보고 승인·거절만 할 수 있는 등급. 사이트에서는 아무도 못 주고, 여기(SQL)에서만 줄 수 있음.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('member','manager','owner','ai'));

-- 상회장·보조AI 계정은 상회장만 건드릴 수 있음
create or replace function public.guard_target(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 할 수 있어'; end if;
  if not is_owner() and exists (select 1 from profiles where id = target and role in ('owner','ai')) then
    raise exception '상회장·보조AI 계정은 상회장만 바꿀 수 있어';
  end if;
end $$;

-- 등급 바꾸기: 보조AI 는 여기서 줄 수도, 뺏을 수도 없음
create or replace function public.admin_set_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception '상회장만 할 수 있어'; end if;
  if new_role not in ('member','manager') then raise exception '없는 등급이야'; end if;
  if target = auth.uid() then raise exception '자기 등급은 못 바꿔'; end if;
  update profiles set role = new_role where id = target and role not in ('owner','ai');
end $$;

-- 승인 대기 명단 (닉네임·본캐·신청 시각만. 아이디·연락처는 안 나감)
drop function if exists public.pending_signups();
create or replace function public.pending_signups()
returns table (id uuid, char_name text, main_char text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where profiles.id = auth.uid() and status = 'approved' and role in ('ai','manager','owner')) then
    raise exception '볼 수 없어';
  end if;
  return query select p.id, p.char_name, p.main_char, p.created_at from profiles p where p.status = 'pending' order by p.created_at desc;
end $$;
revoke all on function public.pending_signups() from public, anon;
grant execute on function public.pending_signups() to authenticated;

-- 승인 대기 중인 사람만 승인·거절 (보조AI 는 이것만 할 수 있음. 이미 승인된 사람은 못 건드림)
create or replace function public.pending_decide(target uuid, approve boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and status = 'approved' and role in ('ai','manager','owner')) then
    raise exception '할 수 없어';
  end if;
  update profiles set status = case when approve then 'approved' else 'rejected' end where id = target and status = 'pending' and role = 'member';
  if not found then raise exception '승인 대기 중인 사람이 아니야'; end if;
end $$;
revoke all on function public.pending_decide(uuid, boolean) from public, anon;
grant execute on function public.pending_decide(uuid, boolean) to authenticated;

-- 보조AI 는 상회원 기능(글·레이드·쪽지)을 못 씀. 승인 대기 일만 함
create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved' and role <> 'ai');
$$;
