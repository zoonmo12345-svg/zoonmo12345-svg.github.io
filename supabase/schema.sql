-- 슈고상회 DB 설정 (Supabase → SQL Editor 에 통째로 붙여넣고 Run 한 번)
-- 여러 번 실행해도 괜찮게 만들어 둠.

create extension if not exists pgcrypto;

-- ───────── 회원 ─────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  char_name text not null default '',
  job text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  role text not null default 'member' check (role in ('member','manager','owner','ai')),
  created_at timestamptz not null default now()
);

-- 본캐 닉네임(인증용). 사이트 닉네임은 char_name
alter table public.profiles add column if not exists main_char text not null default '';

-- 비상연락처: 본인과 관리자만 볼 수 있게 따로 둠
create table if not exists public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  contact text not null default '' check (char_length(contact) <= 100)
);
alter table public.profile_private enable row level security;

-- 가입하면 자동으로 회원 줄 생성 (승인 대기 상태)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, char_name, main_char)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'username', new.id::text),
          coalesce(new.raw_user_meta_data->>'char_name', ''),
          coalesce(new.raw_user_meta_data->>'main_char', ''));
  insert into public.profile_private (id, contact)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'contact', ''), 100));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved' and role <> 'ai');
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved' and role in ('manager','owner'));
$$;

alter table public.profiles enable row level security;
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using (id = auth.uid());
-- 본인은 닉네임·직업·프로필 사진만 고칠 수 있음 (승인 상태·관리자 권한은 못 건드림)
revoke update on public.profiles from authenticated, anon;
alter table public.profiles add column if not exists avatar_url text;
grant update (char_name, job, avatar_url) on public.profiles to authenticated;

-- 관리자 전용 기능
-- 상회장(owner)인지
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved' and role = 'owner');
$$;
-- 관리슈고가 상회장 계정을 건드리지 못하게 막는 검사
create or replace function public.guard_target(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 할 수 있어'; end if;
  if not is_owner() and exists (select 1 from profiles where id = target and role = 'owner') then
    raise exception '상회장 계정은 상회장만 바꿀 수 있어';
  end if;
end $$;

-- 가입 승인·거절·승인 취소 (상회장, 관리슈고)
create or replace function public.admin_set_status(target uuid, new_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform guard_target(target);
  update profiles set status = new_status where id = target;
end $$;

-- 관리슈고 임명·해제는 상회장만. 관리슈고는 다른 사람을 임명할 수 없음
create or replace function public.admin_set_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception '상회장만 할 수 있어'; end if;
  if new_role not in ('member','manager') then raise exception '없는 등급이야'; end if;
  if target = auth.uid() then raise exception '자기 등급은 못 바꿔'; end if;
  update profiles set role = new_role where id = target and role <> 'owner';
end $$;

create or replace function public.admin_reset_password(target uuid, new_password text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  perform guard_target(target);
  if length(new_password) < 6 then raise exception '비밀번호는 6자 이상이라거.'; end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')) where id = target;
end $$;

drop policy if exists "private read" on public.profile_private;
create policy "private read" on public.profile_private for select using (id = auth.uid() or is_admin());
drop policy if exists "private insert" on public.profile_private;
create policy "private insert" on public.profile_private for insert with check (id = auth.uid());
drop policy if exists "private update" on public.profile_private;
create policy "private update" on public.profile_private for update using (id = auth.uid());

-- ───────── 쪽지 (상회원끼리) ─────────
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  from_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_to_idx on public.messages (to_id, read_at);
alter table public.messages enable row level security;
drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages for select using (from_id = auth.uid() or to_id = auth.uid());
drop policy if exists "messages send" on public.messages;
create policy "messages send" on public.messages for insert with check (is_approved() and from_id = auth.uid());
drop policy if exists "messages mark read" on public.messages;
create policy "messages mark read" on public.messages for update using (to_id = auth.uid());
revoke update on public.messages from authenticated, anon;
grant update (read_at) on public.messages to authenticated;
-- 새 쪽지 실시간 알림
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;

-- ───────── 게시판 ─────────
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  cat text not null,
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 5000),
  images text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select using (true);
drop policy if exists "posts write" on public.posts;
create policy "posts write" on public.posts for insert with check (is_approved() and author_id = auth.uid());
drop policy if exists "posts edit" on public.posts;
create policy "posts edit" on public.posts for update using (author_id = auth.uid());
drop policy if exists "posts delete" on public.posts;
create policy "posts delete" on public.posts for delete using (author_id = auth.uid() or is_admin());

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
drop policy if exists "comments read" on public.comments;
create policy "comments read" on public.comments for select using (true);
drop policy if exists "comments write" on public.comments;
create policy "comments write" on public.comments for insert with check (is_approved() and author_id = auth.uid());
drop policy if exists "comments delete" on public.comments;
create policy "comments delete" on public.comments for delete using (author_id = auth.uid() or is_admin());

-- ───────── 레이드 모집 (상회원만 보기·쓰기) ─────────
create table if not exists public.raids (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  dungeon text not null default '',
  starts_at timestamptz not null,
  slots int not null default 10 check (slots between 2 and 24),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
alter table public.raids enable row level security;
drop policy if exists "raids read" on public.raids;
create policy "raids read" on public.raids for select using (is_approved());
drop policy if exists "raids write" on public.raids;
create policy "raids write" on public.raids for insert with check (is_approved() and author_id = auth.uid());
drop policy if exists "raids delete" on public.raids;
create policy "raids delete" on public.raids for delete using (author_id = auth.uid() or is_admin());

create table if not exists public.raid_members (
  raid_id bigint not null references public.raids(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default '딜러',
  created_at timestamptz not null default now(),
  primary key (raid_id, user_id)
);
alter table public.raid_members enable row level security;
drop policy if exists "raid members read" on public.raid_members;
create policy "raid members read" on public.raid_members for select using (is_approved());
drop policy if exists "raid members join" on public.raid_members;
create policy "raid members join" on public.raid_members for insert with check (is_approved() and user_id = auth.uid());
drop policy if exists "raid members change" on public.raid_members;
create policy "raid members change" on public.raid_members for update using (user_id = auth.uid());
drop policy if exists "raid members leave" on public.raid_members;
create policy "raid members leave" on public.raid_members for delete using (user_id = auth.uid() or is_admin());

-- ───────── 폰 알림 ─────────
create table if not exists public.push_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  offsets int[] not null default '{60,10}'          -- 출발 몇 분 전에 받을지
);
create table if not exists public.push_subs (
  endpoint text primary key,                         -- 기기 하나 = 한 줄
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  p256dh text not null, auth text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.push_sent (
  raid_id bigint not null references public.raids(id) on delete cascade,
  user_id uuid not null, offset_min int not null, sent_at timestamptz not null default now(),
  primary key (raid_id, user_id, offset_min)
);
alter table public.push_prefs enable row level security;
alter table public.push_subs enable row level security;
alter table public.push_sent enable row level security;
drop policy if exists "push prefs own" on public.push_prefs;
create policy "push prefs own" on public.push_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "push subs own" on public.push_subs;
create policy "push subs own" on public.push_subs for all using (user_id = auth.uid()) with check (user_id = auth.uid() and is_approved());

-- 지금 보내야 할 알림을 골라서 '보냄' 표시까지 하고 돌려줌 (서버 함수 raid-push 가 1분마다 부름)
create or replace function public.push_due() returns table (raid_id bigint, user_id uuid, offset_min int, title text, dungeon text, starts_at timestamptz, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select r.id as raid_id, m.user_id, o.offset_min, r.title, r.dungeon, r.starts_at
    from raids r
    join raid_members m on m.raid_id = r.id
    left join push_prefs p on p.user_id = m.user_id
    cross join lateral unnest(coalesce(p.offsets, '{60,10}'::int[])) as o(offset_min)
    where r.starts_at > now()
      and r.starts_at - make_interval(mins => o.offset_min) <= now()
      and r.starts_at - make_interval(mins => o.offset_min) > now() - interval '5 minutes'
  ), fresh as (
    insert into push_sent (raid_id, user_id, offset_min)
    select d.raid_id, d.user_id, d.offset_min from due d
    on conflict do nothing
    returning push_sent.raid_id, push_sent.user_id, push_sent.offset_min
  )
  select d.raid_id, d.user_id, d.offset_min, d.title, d.dungeon, d.starts_at, s.endpoint, s.p256dh, s.auth
  from fresh f join due d using (raid_id, user_id, offset_min) join push_subs s on s.user_id = d.user_id;
end $$;
revoke all on function public.push_due() from public, anon, authenticated;

-- ───────── 홈 공지 (관리자만 수정) ─────────
create table if not exists public.site_notice (
  id int primary key default 1 check (id = 1),
  text text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.site_notice (id) values (1) on conflict (id) do nothing;
alter table public.site_notice enable row level security;
drop policy if exists "notice read" on public.site_notice;
create policy "notice read" on public.site_notice for select using (true);
create or replace function public.admin_set_notice(new_text text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 할 수 있다거.'; end if;
  update site_notice set text = left(new_text, 300), updated_at = now() where id = 1;
end $$;

-- ───────── 사진 저장소 ─────────
insert into storage.buckets (id, name, public) values ('images', 'images', true)
  on conflict (id) do nothing;
drop policy if exists "images upload" on storage.objects;
create policy "images upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text
              and (public.is_approved() or storage.filename(name) like 'avatar-%'));
drop policy if exists "images delete" on storage.objects;
create policy "images delete" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and owner = auth.uid());

-- ═════════ 보안 강화 (2026-11-27) ═════════
-- 1) 로그인 계정 이름(username)은 남에게 안 보이게: 본인·관리자만 함수로 조회
--    본캐 닉네임(main_char)은 로그인한 사람에게만 보임
revoke select on public.profiles from anon, authenticated;
grant select (id, char_name, job, avatar_url, status, role, created_at) on public.profiles to anon, authenticated;
grant select (main_char) on public.profiles to authenticated;

create or replace function public.my_profile() returns setof public.profiles
language sql stable security definer set search_path = public as $$
  select * from profiles where id = auth.uid();
$$;

create or replace function public.admin_list_profiles()
returns table (id uuid, username text, char_name text, main_char text, job text, avatar_url text, status text, role text, created_at timestamptz, contact text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 할 수 있어'; end if;
  return query select p.id, p.username, p.char_name, p.main_char, p.job, p.avatar_url, p.status, p.role, p.created_at, coalesce(v.contact, '')
    from profiles p left join profile_private v on v.id = p.id order by p.created_at desc;
end $$;
revoke all on function public.admin_list_profiles() from public, anon;
grant execute on function public.admin_list_profiles() to authenticated;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- 2) 관리자 전용 함수는 로그인한 사람만 부를 수 있게 (안에서 다시 등급 검사)
revoke all on function public.admin_set_status(uuid, text), public.admin_set_role(uuid, text), public.admin_reset_password(uuid, text), public.admin_set_notice(text), public.guard_target(uuid) from public, anon;
grant execute on function public.admin_set_status(uuid, text), public.admin_set_role(uuid, text), public.admin_reset_password(uuid, text), public.admin_set_notice(text) to authenticated;

-- 3) 사진: 5MB 이하 그림 파일만
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/webp','image/png','image/jpeg','image/gif'] where id = 'images';

-- 4) 레이드는 정원까지만 참여 가능 (화면을 건너뛰고 직접 넣는 것도 막음)
drop policy if exists "raid members join" on public.raid_members;
create policy "raid members join" on public.raid_members for insert with check (
  is_approved() and user_id = auth.uid()
  and (select count(*) from public.raid_members m where m.raid_id = raid_members.raid_id) < (select r.slots from public.raids r where r.id = raid_members.raid_id)
);

-- 5) 글·댓글 길이와 분류 제한
alter table public.posts drop constraint if exists posts_cat_check;
alter table public.posts add constraint posts_cat_check check (cat in ('free','loot','house','info'));
alter table public.posts drop constraint if exists posts_images_check;
alter table public.posts add constraint posts_images_check check (coalesce(array_length(images, 1), 0) <= 6);
alter table public.profiles drop constraint if exists profiles_len_check;
alter table public.profiles add constraint profiles_len_check check (char_length(char_name) <= 20 and char_length(main_char) <= 20 and char_length(job) <= 10 and char_length(username) <= 40);

-- ───────── 첫 상회장 지정 ─────────
-- 사이트에서 네 아이디로 가입한 뒤, 아래 줄의 '내아이디' 를 바꿔서 이 줄만 다시 Run.
-- update public.profiles set status = 'approved', role = 'owner' where username = '내아이디';

-- 보조AI 등급 (2026-11-27)
-- 승인 대기 명단을 보고 승인·거절만 할 수 있는 등급. 사이트에서는 아무도 못 주고, 여기(SQL)에서만 줄 수 있음.

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

-- 보조AI 등급 주기 (사이트에선 못 줌):
-- update public.profiles set status = 'approved', role = 'ai' where username = '아이디';

-- 거절된 계정 지우기 (2026-11-27). target 을 주면 그 사람만, 안 주면 거절된 사람 전부. 계정째로 지워짐(되돌릴 수 없음)
create or replace function public.admin_delete_rejected(target uuid default null) returns integer
language plpgsql security definer set search_path = public, auth as $$
declare n integer;
begin
  if not is_admin() then raise exception '관리자만 할 수 있어'; end if;
  delete from auth.users u where u.id in (select p.id from profiles p where p.status = 'rejected' and p.role = 'member' and (target is null or p.id = target));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.admin_delete_rejected(uuid) from public, anon;
grant execute on function public.admin_delete_rejected(uuid) to authenticated;
