-- Jalankan di Supabase: SQL Editor > New query > Run
-- Seluruh berkas ini AMAN DIJALANKAN BERULANG (idempoten): tabel memakai "if not exists", policy di-drop lalu dibuat ulang.
-- Boleh ditempel utuh dari atas sampai bawah, baik di proyek baru maupun yang sudah pernah menjalankan v19/v20/v22.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;

-- Hanya pemilik data DAN sesi yang sudah lolos 2FA (aal2) yang bisa membaca atau menulis.
-- (Policy ini diganti oleh versi v22 di bawah; tetap ditulis idempoten agar urutan jalan tidak masalah.)
drop policy if exists "pemilik dengan 2FA" on public.user_data;
create policy "pemilik dengan 2FA" on public.user_data for all to authenticated
  using (auth.uid() = user_id and (auth.jwt() ->> 'aal') = 'aal2')
  with check (auth.uid() = user_id and (auth.jwt() ->> 'aal') = 'aal2');

-- v19: langganan push dan log pengingat (jalankan di SQL Editor)
create table if not exists public.push_subs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "pemilik dengan 2FA" on public.push_subs;
create policy "pemilik dengan 2FA" on public.push_subs for all to authenticated
  using (auth.uid() = user_id and (auth.jwt() ->> 'aal') = 'aal2')
  with check (auth.uid() = user_id and (auth.jwt() ->> 'aal') = 'aal2');

-- Tanpa policy: hanya service role (cron) yang bisa menulis. Kunci unik mencegah pengingat ganda.
create table if not exists public.reminder_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  bill_id text not null, due_date date not null, sent_at timestamptz not null default now(),
  primary key (user_id, bill_id, due_date)
);
alter table public.reminder_log enable row level security;

-- v20: token Open Banking (terenkripsi). Tanpa policy: hanya service role (api/link) yang bisa membaca atau menulis.
create table if not exists public.bank_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null, tokens text not null, updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.bank_links enable row level security;


-- =====================================================================================================
-- v22 (jalankan SELURUH bagian ini sekali di SQL Editor, setelah skema v19/v20 di atas). Aman dijalankan ulang.
-- Berisi: perangkat/sesi dikeluarkan, snapshot otomatis, kode pemulihan 2FA, dan Ruang Bersama sungguhan.
-- =====================================================================================================

-- ---------- 1. Perangkat aktif dan sesi yang dikeluarkan ----------
-- Tanpa policy: hanya service role (api/account) yang membaca/menulis. Dibaca RLS lewat session_ok() di bawah.
create table if not exists public.user_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  session_id text,
  label text, ip text, city text, country text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, device_id)
);
create index if not exists user_devices_session on public.user_devices (user_id, session_id);
alter table public.user_devices enable row level security;

-- Benar bila sesi (claim session_id pada JWT) BELUM dikeluarkan. Perangkat yang dikeluarkan kehilangan akses data seketika,
-- walau JWT-nya masih berlaku sampai kedaluwarsa.
create or replace function public.session_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.user_devices d
    where d.user_id = auth.uid() and d.revoked_at is not null
      and d.session_id is not null and d.session_id = (auth.jwt() ->> 'session_id'))
$$;
-- Syarat akses standar: login, lolos 2FA (aal2), dan sesi belum dikeluarkan.
create or replace function public.authed() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (auth.jwt() ->> 'aal') = 'aal2' and public.session_ok()
$$;
revoke all on function public.session_ok(), public.authed() from public, anon;
grant execute on function public.session_ok(), public.authed() to authenticated;

drop policy if exists "pemilik dengan 2FA" on public.user_data;
create policy "pemilik dengan 2FA" on public.user_data for all to authenticated
  using (auth.uid() = user_id and public.authed())
  with check (auth.uid() = user_id and public.authed());
drop policy if exists "pemilik dengan 2FA" on public.push_subs;
create policy "pemilik dengan 2FA" on public.push_subs for all to authenticated
  using (auth.uid() = user_id and public.authed())
  with check (auth.uid() = user_id and public.authed());

-- ---------- 2. Cegah data tertimpa: updated_at dikendalikan server + snapshot otomatis ----------
create table if not exists public.user_data_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  taken_at timestamptz not null default now(),
  reason text not null default 'auto',     -- 'auto' (berkala) atau 'manual' (sebelum reset/pemulihan)
  tx_count int, size_bytes int
);
create index if not exists user_data_history_user on public.user_data_history (user_id, taken_at desc);
alter table public.user_data_history enable row level security;
drop policy if exists "pemilik baca riwayat" on public.user_data_history;
create policy "pemilik baca riwayat" on public.user_data_history for select to authenticated
  using (auth.uid() = user_id and public.authed());
-- Tidak ada policy tulis: hanya pemicu dan take_snapshot() yang mengisi tabel ini.

create or replace function public.user_data_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare last_at timestamptz;
begin
  if tg_op = 'UPDATE' and new.data is distinct from old.data then
    select max(taken_at) into last_at from public.user_data_history where user_id = old.user_id and reason = 'auto';
    if last_at is null or last_at < now() - interval '6 hours' then   -- paling banyak 4 salinan otomatis per hari
      insert into public.user_data_history (user_id, data, reason, tx_count, size_bytes)
      values (old.user_id, old.data, 'auto',
        case when jsonb_typeof(old.data -> 'T') = 'array' then jsonb_array_length(old.data -> 'T') else 0 end,
        octet_length(old.data::text));
    end if;
    delete from public.user_data_history where user_id = old.user_id and id not in (
      select id from public.user_data_history where user_id = old.user_id order by taken_at desc, id desc limit 40);
  end if;
  new.updated_at := clock_timestamp();    -- versi data ditentukan server, bukan jam perangkat
  return new;
end $$;
drop trigger if exists user_data_write on public.user_data;
create trigger user_data_write before insert or update on public.user_data
  for each row execute function public.user_data_before_write();

-- Salinan paksa sebelum timpa (reset, pulihkan). Dipanggil klien lewat sb.rpc('take_snapshot').
create or replace function public.take_snapshot() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.authed() then raise exception 'not allowed'; end if;
  insert into public.user_data_history (user_id, data, reason, tx_count, size_bytes)
  select user_id, data, 'manual',
    case when jsonb_typeof(data -> 'T') = 'array' then jsonb_array_length(data -> 'T') else 0 end, octet_length(data::text)
  from public.user_data where user_id = auth.uid();
end $$;
revoke all on function public.take_snapshot() from public, anon;
grant execute on function public.take_snapshot() to authenticated;

-- ---------- 3. Kode pemulihan 2FA (hanya service role; api/recovery) ----------
create table if not exists public.recovery_codes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,                 -- HMAC-SHA256, bukan kode asli
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists recovery_codes_user on public.recovery_codes (user_id);
alter table public.recovery_codes enable row level security;
create table if not exists public.recovery_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fails int not null default 0,
  locked_until timestamptz
);
alter table public.recovery_state enable row level security;

-- ---------- 4. Ruang Bersama sungguhan ----------
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  created_by uuid not null references auth.users(id) on delete cascade,   -- pemilik menghapus akun = ruang ikut dibubarkan
  created_at timestamptz not null default now()
);
create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text not null check (char_length(display_name) between 1 and 30),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
create unique index if not exists space_members_one_space_per_user on public.space_members (user_id);   -- satu ruang per pengguna
create table if not exists public.space_invites (
  code text primary key,
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);
create table if not exists public.space_goals (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  target bigint not null check (target > 0),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.space_deposits (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.space_goals(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now()
);
-- Pengeluaran bersama: baris milik pencatat (user_id). client_id = id transaksi di data pribadi pencatat, agar sinkron idempoten.
create table if not exists public.space_tx (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  tx_date date not null, cat text not null, descr text not null default '',
  amount bigint not null check (amount > 0),
  updated_at timestamptz not null default now(),
  unique (space_id, user_id, client_id)
);
create index if not exists space_tx_space on public.space_tx (space_id, tx_date desc);
create index if not exists space_deposits_goal on public.space_deposits (goal_id);
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_invites enable row level security;
alter table public.space_goals enable row level security;
alter table public.space_deposits enable row level security;
alter table public.space_tx enable row level security;

-- security definer agar pengecekan keanggotaan tidak memicu rekursi RLS
create or replace function public.is_member(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.space_members m where m.space_id = sid and m.user_id = auth.uid())
$$;
create or replace function public.is_owner(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.space_members m where m.space_id = sid and m.user_id = auth.uid() and m.role = 'owner')
$$;
revoke all on function public.is_member(uuid), public.is_owner(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.is_owner(uuid) to authenticated;

-- Anggota hanya melihat ruangnya sendiri. Tidak ada policy INSERT untuk spaces/members/invites: pembuatan lewat fungsi di bawah.
drop policy if exists "anggota baca ruang" on public.spaces;
create policy "anggota baca ruang" on public.spaces for select to authenticated using (public.authed() and public.is_member(id));
drop policy if exists "pemilik ubah ruang" on public.spaces;
create policy "pemilik ubah ruang" on public.spaces for update to authenticated using (public.authed() and public.is_owner(id)) with check (public.authed() and public.is_owner(id));
drop policy if exists "pemilik bubarkan ruang" on public.spaces;
create policy "pemilik bubarkan ruang" on public.spaces for delete to authenticated using (public.authed() and public.is_owner(id));

drop policy if exists "anggota baca anggota" on public.space_members;
create policy "anggota baca anggota" on public.space_members for select to authenticated using (public.authed() and public.is_member(space_id));
drop policy if exists "ubah nama sendiri" on public.space_members;
create policy "ubah nama sendiri" on public.space_members for update to authenticated using (public.authed() and user_id = auth.uid()) with check (public.authed() and user_id = auth.uid());
drop policy if exists "keluar atau keluarkan" on public.space_members;
create policy "keluar atau keluarkan" on public.space_members for delete to authenticated
  using (public.authed() and ((user_id = auth.uid() and role <> 'owner') or (public.is_owner(space_id) and user_id <> auth.uid())));

drop policy if exists "anggota baca undangan" on public.space_invites;
create policy "anggota baca undangan" on public.space_invites for select to authenticated using (public.authed() and public.is_member(space_id));
drop policy if exists "pemilik hapus undangan" on public.space_invites;
create policy "pemilik hapus undangan" on public.space_invites for delete to authenticated using (public.authed() and public.is_owner(space_id));

drop policy if exists "anggota baca tujuan" on public.space_goals;
create policy "anggota baca tujuan" on public.space_goals for select to authenticated using (public.authed() and public.is_member(space_id));
drop policy if exists "anggota buat tujuan" on public.space_goals;
create policy "anggota buat tujuan" on public.space_goals for insert to authenticated with check (public.authed() and public.is_member(space_id) and created_by = auth.uid());
drop policy if exists "pembuat atau pemilik ubah tujuan" on public.space_goals;
create policy "pembuat atau pemilik ubah tujuan" on public.space_goals for update to authenticated using (public.authed() and (created_by = auth.uid() or public.is_owner(space_id))) with check (public.authed() and public.is_member(space_id));
drop policy if exists "pembuat atau pemilik hapus tujuan" on public.space_goals;
create policy "pembuat atau pemilik hapus tujuan" on public.space_goals for delete to authenticated using (public.authed() and (created_by = auth.uid() or public.is_owner(space_id)));

drop policy if exists "anggota baca setoran" on public.space_deposits;
create policy "anggota baca setoran" on public.space_deposits for select to authenticated using (public.authed() and public.is_member(space_id));
drop policy if exists "anggota catat setoran sendiri" on public.space_deposits;
create policy "anggota catat setoran sendiri" on public.space_deposits for insert to authenticated with check (public.authed() and public.is_member(space_id) and user_id = auth.uid()
  and exists (select 1 from public.space_goals g where g.id = goal_id and g.space_id = space_deposits.space_id));
drop policy if exists "hapus setoran sendiri" on public.space_deposits;
create policy "hapus setoran sendiri" on public.space_deposits for delete to authenticated using (public.authed() and user_id = auth.uid());

drop policy if exists "anggota baca pengeluaran bersama" on public.space_tx;
create policy "anggota baca pengeluaran bersama" on public.space_tx for select to authenticated using (public.authed() and public.is_member(space_id));
drop policy if exists "catat pengeluaran bersama sendiri" on public.space_tx;
create policy "catat pengeluaran bersama sendiri" on public.space_tx for insert to authenticated with check (public.authed() and public.is_member(space_id) and user_id = auth.uid());
drop policy if exists "ubah pengeluaran bersama sendiri" on public.space_tx;
create policy "ubah pengeluaran bersama sendiri" on public.space_tx for update to authenticated using (public.authed() and user_id = auth.uid()) with check (public.authed() and public.is_member(space_id) and user_id = auth.uid());
drop policy if exists "hapus pengeluaran bersama sendiri" on public.space_tx;
create policy "hapus pengeluaran bersama sendiri" on public.space_tx for delete to authenticated using (public.authed() and user_id = auth.uid());

-- Perlindungan kolom: anggota hanya boleh mengubah kolom yang memang boleh (mencegah mengubah role, space_id, created_by, user_id).
revoke update on public.spaces, public.space_members, public.space_goals, public.space_tx from authenticated, anon;
grant update (name) on public.spaces to authenticated;
grant update (display_name) on public.space_members to authenticated;
grant update (name, target) on public.space_goals to authenticated;
grant update (tx_date, cat, descr, amount, updated_at) on public.space_tx to authenticated;

-- Membuat ruang. Satu ruang per pengguna.
create or replace function public.create_space(p_name text, p_display text) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not public.authed() then raise exception 'not allowed'; end if;
  if exists (select 1 from public.space_members where user_id = auth.uid()) then raise exception 'Anda sudah berada di sebuah Ruang Bersama'; end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 or char_length(trim(coalesce(p_display, ''))) = 0 then raise exception 'Nama ruang dan nama tampilan wajib diisi'; end if;
  insert into public.spaces (name, created_by) values (left(trim(p_name), 40), auth.uid()) returning id into sid;
  insert into public.space_members (space_id, user_id, role, display_name) values (sid, auth.uid(), 'owner', left(trim(p_display), 30));
  return sid;
end $$;

-- Kode undangan sekali pakai, berlaku 7 hari. Ruang maksimal 4 anggota (termasuk undangan yang masih berlaku).
create or replace function public.create_invite(p_space uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text; n int;
begin
  if not public.authed() or not public.is_member(p_space) then raise exception 'not allowed'; end if;
  delete from public.space_invites where space_id = p_space and used_at is null and (expires_at < now() or created_by = auth.uid());
  select (select count(*) from public.space_members where space_id = p_space) + (select count(*) from public.space_invites where space_id = p_space and used_at is null and expires_at > now()) into n;
  if n >= 4 then raise exception 'Ruang sudah penuh (maksimal 4 anggota)'; end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.space_invites (code, space_id, created_by, expires_at) values (c, p_space, auth.uid(), now() + interval '7 days');
  return c;
end $$;

-- Pratinjau undangan sebelum bergabung (hanya nama ruang, pengundang, jumlah anggota).
create or replace function public.peek_invite(p_code text) returns table (space_name text, inviter text, members int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.authed() then raise exception 'not allowed'; end if;
  return query select s.name, coalesce((select m.display_name from public.space_members m where m.space_id = s.id and m.user_id = i.created_by), 'Anggota'),
    (select count(*)::int from public.space_members m2 where m2.space_id = s.id)
  from public.space_invites i join public.spaces s on s.id = i.space_id
  where i.code = upper(trim(p_code)) and i.used_at is null and i.expires_at > now();
end $$;

create or replace function public.join_space(p_code text, p_display text) returns uuid
language plpgsql security definer set search_path = public as $$
declare i public.space_invites; n int;
begin
  if not public.authed() then raise exception 'not allowed'; end if;
  if exists (select 1 from public.space_members where user_id = auth.uid()) then raise exception 'Anda sudah berada di sebuah Ruang Bersama'; end if;
  if char_length(trim(coalesce(p_display, ''))) = 0 then raise exception 'Nama tampilan wajib diisi'; end if;
  select * into i from public.space_invites where code = upper(trim(p_code)) for update;
  if not found or i.used_at is not null or i.expires_at < now() then raise exception 'Kode undangan tidak valid atau sudah kedaluwarsa'; end if;
  select count(*) into n from public.space_members where space_id = i.space_id;
  if n >= 4 then raise exception 'Ruang sudah penuh'; end if;
  insert into public.space_members (space_id, user_id, role, display_name) values (i.space_id, auth.uid(), 'member', left(trim(p_display), 30));
  update public.space_invites set used_by = auth.uid(), used_at = now() where code = i.code;
  return i.space_id;
end $$;
revoke all on function public.create_space(text, text), public.create_invite(uuid), public.peek_invite(text), public.join_space(text, text) from public, anon;
grant execute on function public.create_space(text, text), public.create_invite(uuid), public.peek_invite(text), public.join_space(text, text) to authenticated;
