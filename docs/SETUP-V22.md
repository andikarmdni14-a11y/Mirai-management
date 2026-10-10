# Setup v22 — langkah wajib dan cara memeriksa

Urutan penting. Bagian **"Belum teruji"** di akhir menjelaskan apa yang tidak bisa diuji di luar proyek Supabase/Vercel/HP Anda; periksa itu sebelum rilis ke pengguna.

## 1. Database (SQL Editor Supabase)
1. Jalankan **bagian v22** di akhir `schema.sql` (dari komentar `-- v22`). Aman dijalankan ulang.
2. Efeknya: tabel `user_devices`, `user_data_history`, `recovery_codes`, `recovery_state`, `spaces`, `space_*`; pemicu `updated_at` + snapshot otomatis; fungsi `session_ok()`, `authed()`, `take_snapshot()`, `create_space()`, `create_invite()`, `peek_invite()`, `join_space()`; policy `user_data` dan `push_subs` diganti agar menolak sesi yang sudah dikeluarkan.
3. Periksa: Table Editor menampilkan tabel baru; `select proname from pg_proc where proname in ('session_ok','authed','take_snapshot','join_space');` mengembalikan 4 baris.

## 2. Environment Vercel
| Nama | Keterangan |
|---|---|
| `RECOVERY_SECRET` | **Baru, wajib.** String acak panjang (`openssl rand -base64 48`). Kunci HMAC kode pemulihan. Jangan diubah setelah ada pengguna membuat kode: mengubahnya membatalkan semua kode. |
| `APP_URL` | Alamat aplikasi, mis. `https://mirai-management.vercel.app` (dipakai di email). |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Sudah ada sejak v19/v20. Dipakai API baru (`api/recovery`, `api/account`). Jangan pernah dimasukkan ke browser. |
| `RESEND_API_KEY`, `FROM_EMAIL` | Sudah ada. Dipakai untuk email login baru, kode pemulihan dipakai, akun dihapus, dan pengingat. Tanpa keduanya fitur tetap jalan, hanya tanpa email. |

Deploy. Fungsi baru: `/api/recovery/{status,generate,use}` dan `/api/account/{device,devices,revoke,logout-all,delete}` (total 4 fungsi, jauh di bawah batas paket Hobby).

## 3. Email Supabase berbahasa Indonesia + SMTP sendiri
1. **Template**: Dashboard → Authentication → Emails. Untuk tiap jenis (Confirm signup, Reset password, Magic link, Invite, Change email, Reauthentication) salin isi `supabase/templates/<jenis>.html` dan subjek dari `supabase/config.toml`. Template `confirmation` dan `reauthentication` menampilkan kode `{{ .Token }}` (aplikasi memakai kode 6 digit, bukan tautan).
2. **Panjang OTP**: Authentication → Providers → Email → *Email OTP Length* = **6** (aplikasi memakai 6 kotak).
3. **SMTP**: Authentication → Emails → SMTP Settings → Enable Custom SMTP. Contoh Resend: host `smtp.resend.com`, port `465`, user `resend`, password = API key Resend, sender `no-reply@domain-anda.id`, nama `Mirai Management`.
4. **DNS domain pengirim** (di Resend → Domains): tambahkan rekaman SPF dan DKIM yang diberikan, serta DMARC (`_dmarc` TXT `v=DMARC1; p=none; rua=mailto:...`). Tunggu status *Verified*.
5. **Batas kirim**: setelah SMTP sendiri aktif, atur Authentication → Rate Limits → *Rate limit for sending emails* sesuai kebutuhan (bawaan Supabase hanya 2 email/jam tanpa SMTP sendiri).
6. Authentication → URL Configuration: *Site URL* dan *Redirect URLs* harus memuat `https://domain-anda/login.html`.
7. Bila memakai Supabase CLI: `supabase/config.toml` sudah berisi semuanya; jalankan `supabase config push`.
8. Uji: daftar dengan email baru, pastikan kode masuk berbahasa Indonesia dengan logo Mirai, dan tidak masuk spam (cek skor di mail-tester.com).

## 4. Sentry (opsional)
Isi `SENTRY_DSN` di `config.js` dengan DSN proyek **Browser JavaScript**. Kosong = tidak aktif. Di `monitor.js` ganti versi bundel ke rilis terbaru dari halaman CDN Sentry dan tambahkan atribut `integrity` (SRI). Aplikasi mengirim galat tanpa PII, tanpa breadcrumb (klik/konsol/jaringan bisa memuat jumlah uang), tanpa replay/tracing, dan URL tanpa query/hash. Bila diaktifkan, pastikan Kebijakan Privasi tetap benar (bagian "Galat teknis").

## 5. CI (GitHub Actions)
`.github/workflows/ci.yml` menjalankan cek sintaks, uji unit, dan uji E2E Playwright di Chromium pada tiap push/PR. Lokal: `npm install`, lalu `npm test` (atau `npm run test:unit` / `npm run test:e2e`). Aktifkan *branch protection → Require status checks → test* di GitHub supaya rilis tidak lolos bila login atau pencatatan patah. Uji E2E memakai Supabase tiruan (tanpa kunci apa pun).

## 6. Dokumen hukum
`syarat.html` dan `privasi.html` adalah **draf yang disusun sesuai perilaku aplikasi**. Sebelum rilis publik: tinjau dengan penasihat hukum (alamat/email kontak sudah diganti ke data Mirai Management sejak v26), dan ubah `TOS_VER` di `config.js` bila isinya berubah (semua pengguna diminta setuju ulang). Pengguna lama akan melihat dialog persetujuan satu kali saat pertama membuka versi ini.

## 7. Memasang di HP
- **Android (Chrome/Edge/Samsung)**: buka situs → muncul spanduk "Pasang Mirai di HP Anda" di halaman masuk (atau menu profil → *Pasang aplikasi*). Tekan lama ikon Mirai → pintasan *Tambah pengeluaran / pemasukan / Tagihan / Laporan*.
- **iPhone/iPad**: tombol *Pasang aplikasi* menampilkan langkah Safari → Bagikan → *Tambah ke Layar Utama* (iOS tidak punya dialog pasang otomatis dan tidak mendukung `shortcuts` manifest di ikon).
- Pengguna yang sudah memasang versi lama: tidak perlu memasang ulang; pintasan ikon baru biasanya muncul setelah Android memperbarui WebAPK (bisa butuh beberapa hari atau pasang ulang).

## Cara kerja yang perlu Anda tahu
- **Offline**: perubahan disimpan di perangkat (`mm_cache_<uid>`) dan "dasar" server terakhir (`mm_base_<uid>`). Perubahan tertunda = selisih keduanya. Saat online, `sync.js` membaca baris server, menggabung tiga arah bila server berubah, lalu menulis dengan syarat `updated_at` masih sama (compare-and-swap). Pengiriman hanya berjalan **saat aplikasi terbuka**; tidak ada Background Sync. Catatan offline yang belum terkirim hilang bila data browser dibersihkan atau keluar akun (aplikasi menanyakan dulu).
- **Aturan gabung**: catatan berbeda dua perangkat digabung; hapus-vs-ubah dimenangkan "ubah" (tidak ada data hilang diam-diam); kolom/catatan yang sama diubah di dua tempat dimenangkan perangkat yang menyinkronkan lebih akhir. Salinan otomatis server: paling banyak 4/hari, 40 terakhir; lihat *Setelan → Riwayat cadangan otomatis*.
- **Penyimpanan lokal berlipat**: salinan dasar menggandakan ukuran data di localStorage (batas ±5 MB per origin). Untuk puluhan ribu transaksi pertimbangkan pindah ke IndexedDB.
- **Utang/piutang**: arus kas dompet dicatat sebagai transaksi bertanda `tr` (seperti transfer): saldo berubah, laporan pemasukan/pengeluaran tidak. Pembayaran cicilan adalah pengeluaran biasa.
- **Perangkat dikeluarkan**: ditegakkan di database lewat `session_ok()` (claim `session_id` di JWT) sehingga data langsung tertutup walau JWT belum kedaluwarsa; *Keluar dari semua perangkat* juga memanggil logout global Supabase.
- **Hapus akun** menghapus pengguna Supabase; semua tabel `on delete cascade`. Token bank/e-wallet di sisi penyedia **tidak** dicabut otomatis (cabut juga di aplikasi penyedia). Pemilik Ruang Bersama yang menghapus akun membubarkan ruangnya.

## Belum teruji (butuh Anda memeriksa)
Saya menguji logika di Node dan alur di Chromium dengan Supabase tiruan (lihat `tests/`). Yang **tidak** bisa saya uji dari sini:
1. **SQL belum dijalankan di Postgres/Supabase sungguhan.** Periksa tiap bagian berjalan tanpa galat, terutama policy `space_*` dan hak kolom (`grant update (...)`). Uji RLS manual dengan dua akun: anggota ruang A tidak boleh membaca ruang B; anggota tidak boleh mengubah `role`.
2. **Admin API Supabase**: `kode pemulihan` memakai `GET /auth/v1/admin/users/{id}` (membaca `factors`) dan `DELETE /auth/v1/admin/users/{id}/factors/{factorId}`. Uji: buat kode → keluar → masuk dengan kata sandi → pakai kode → pastikan diminta memasang autentikator baru. Jika Supabase mengubah route ini, fungsi mengembalikan 502 dan **tidak** menghabiskan kode.
3. **Claim `session_id`** pada JWT (dipakai `session_ok()`): periksa dengan menempel access token di jwt.io. Jika tidak ada, pencabutan perangkat tidak menutup data seketika (daftar dan logout global tetap bekerja).
4. **Email**: pengiriman Resend, SPF/DKIM, tampilan di Gmail/Outlook, dan template Supabase.
5. **Pemasangan di HP asli** (Android dan iOS), pintasan ikon, dan WebAPK. Pengujian saya memakai pemeriksaan instalasi Chromium (`Page.getInstallabilityErrors`) dan peluncuran offline, bukan perangkat nyata.
6. **Sentry** dan notifikasi push untuk pengingat cicilan/utang (kode cron diperluas tetapi tidak dijalankan).
7. **Admin API hapus akun** dan seluruh cascade pada data produksi sungguhan.
