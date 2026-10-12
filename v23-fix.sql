-- v23-fix.sql: tempel SELURUH isi berkas ini di Supabase > SQL Editor > Run. Aman dijalankan ulang; tidak menghapus data.
-- Syarat: bagian v22 di schema.sql sudah pernah dijalankan (fungsi session_ok() dan tabel user_devices sudah ada).
-- Isi: tabel email_otps + session_2fa, fungsi email_otp_issue / email_otp_check / email_2fa_ok, authed() baru, hak akses service_role, reload cache API.

-- v23 (jalankan SELURUH bagian ini sekali di SQL Editor, setelah v22 di atas). Aman dijalankan ulang.
-- 2FA lewat kode email: sesi yang memasukkan kode benar dicatat di session_2fa dan diakui sama seperti aal2 (autentikator).
-- Wajib: RESEND_API_KEY, FROM_EMAIL, RECOVERY_SECRET di server (lihat docs/SETUP-V22.md, bagian v23).
-- =====================================================================================================

-- Kode yang sedang berlaku (hanya HMAC-nya) beserta penghitung tebakan dan batas kirim. Tanpa policy: hanya service role (api/twofa).
create table if not exists public.email_otps (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_at timestamptz not null default now(),
  sent_count int not null default 1,
  window_start timestamptz not null default now()
);
alter table public.email_otps enable row level security;

-- Sesi (claim session_id pada JWT) yang sudah lolos 2FA lewat kode email. Tanpa policy: hanya service role (api/twofa).
create table if not exists public.session_2fa (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  verified_at timestamptz not null default now(),
  primary key (user_id, session_id)
);
alter table public.session_2fa enable row level security;

-- Menyiapkan kode baru secara atomik: jeda minimal 30 detik dan paling banyak 6 kode per jam.
-- Hasil: 'ok' | 'wait:<detik>' | 'cap:<menit>'.
create or replace function public.email_otp_issue(p_user uuid, p_hash text, p_ttl_min int) returns text
language plpgsql security definer set search_path = public as $$
declare r public.email_otps%rowtype; n int := 1; ws timestamptz := now();
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));      -- serialkan permintaan paralel untuk pengguna yang sama
  select * into r from public.email_otps where user_id = p_user;
  if found then
    if r.sent_at > now() - interval '30 seconds' then
      return 'wait:' || greatest(1, ceil(extract(epoch from (r.sent_at + interval '30 seconds' - now()))))::int;
    end if;
    if r.window_start > now() - interval '1 hour' then
      if r.sent_count >= 6 then
        return 'cap:' || greatest(1, ceil(extract(epoch from (r.window_start + interval '1 hour' - now())) / 60))::int;
      end if;
      n := r.sent_count + 1; ws := r.window_start;
    end if;
  end if;
  insert into public.email_otps (user_id, code_hash, expires_at, attempts, sent_at, sent_count, window_start)
  values (p_user, p_hash, now() + make_interval(mins => p_ttl_min), 0, now(), n, ws)
  on conflict (user_id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0,
    sent_at = excluded.sent_at, sent_count = excluded.sent_count, window_start = excluded.window_start;
  return 'ok';
end $$;

-- Memeriksa kode secara atomik (FOR UPDATE): maksimal 5 tebakan per kode, kode benar langsung dihapus (sekali pakai).
-- Hasil: 'ok' | 'bad:<sisa>' | 'locked' | 'expired'.
create or replace function public.email_otp_check(p_user uuid, p_hash text) returns text
language plpgsql security definer set search_path = public as $$
declare r public.email_otps%rowtype;
begin
  select * into r from public.email_otps where user_id = p_user for update;
  if not found or r.expires_at < now() then return 'expired'; end if;
  if r.attempts >= 5 then return 'locked'; end if;
  if r.code_hash = p_hash then
    delete from public.email_otps where user_id = p_user;
    return 'ok';
  end if;
  update public.email_otps set attempts = attempts + 1 where user_id = p_user;
  if r.attempts + 1 >= 5 then return 'locked'; end if;
  return 'bad:' || (5 - r.attempts - 1);
end $$;
revoke all on function public.email_otp_issue(uuid, text, int), public.email_otp_check(uuid, text) from public, anon, authenticated;
grant execute on function public.email_otp_issue(uuid, text, int), public.email_otp_check(uuid, text) to service_role;

-- Sesi ini sudah memasukkan kode email dengan benar?
create or replace function public.email_2fa_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.session_2fa s
    where s.user_id = auth.uid() and s.session_id = (auth.jwt() ->> 'session_id'))
$$;
revoke all on function public.email_2fa_ok() from public, anon;
grant execute on function public.email_2fa_ok() to authenticated;

-- Gerbang akses tunggal (dipakai semua policy dan RPC): login + lolos 2FA (autentikator = aal2, ATAU kode email) + sesi belum dikeluarkan.
create or replace function public.authed() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and ((auth.jwt() ->> 'aal') = 'aal2' or public.email_2fa_ok())
    and public.session_ok()
$$;
revoke all on function public.authed() from public, anon;
grant execute on function public.authed() to authenticated;


-- =====================================================================================================
-- v23.1 (jalankan setelah v23; sudah termasuk bila Anda menjalankan seluruh berkas ini). Aman dijalankan ulang.
-- Hak akses eksplisit untuk server (service_role, dipakai api/*). Proyek Supabase yang dibuat dengan "Default privileges for new
-- entities" dimatikan TIDAK memberi hak akses otomatis pada tabel/fungsi baru di schema public, sehingga api/twofa gagal menulis
-- session_2fa dan email_otps. Tidak memberi hak apa pun kepada anon/authenticated: akses mereka tetap diatur policy RLS di atas.
-- =====================================================================================================
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.email_otp_issue(uuid, text, int), public.email_otp_check(uuid, text) to service_role;
-- Muat ulang cache skema PostgREST supaya fungsi/tabel baru langsung terlihat oleh API.
notify pgrst, 'reload schema';
