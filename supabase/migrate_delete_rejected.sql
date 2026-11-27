-- 거절된 계정 지우기 (2026-11-27). target 을 주면 그 사람만, 안 주면 거절된 사람 전부. 계정째로 지워짐(되돌릴 수 없음)
create or replace function public.admin_delete_rejected(target uuid default null) returns integer
language plpgsql security definer set search_path = public, auth as $$
declare n integer;
begin
  if not is_admin() then raise exception '관리자 전용이라거'; end if;
  delete from auth.users u where u.id in (select p.id from profiles p where p.status = 'rejected' and p.role = 'member' and (target is null or p.id = target));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.admin_delete_rejected(uuid) from public, anon;
grant execute on function public.admin_delete_rejected(uuid) to authenticated;
