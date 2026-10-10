'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../../core.js');
const REF = new Date(2026, 9, 9); // 9 Okt 2026

test('parseAmount: format Indonesia, Amerika, tanda, dan akhiran DB/CR', () => {
  const n = s => { const r = C.parseAmount(s); return r && r.n };
  assert.equal(n('1.234.567,89'), 1234568);
  assert.equal(n('1,234,567.89'), 1234568);
  assert.equal(n('Rp 50.000'), 50000);
  assert.equal(n('Rp50.000,00'), 50000);
  assert.equal(n('50000.00'), 50000);
  assert.equal(n('50000'), 50000);
  assert.equal(n('1.000'), 1000);      // satu pemisah + 3 digit = ribuan
  assert.equal(n('12.50'), 13);        // satu pemisah + 2 digit = desimal
  assert.equal(n('5.000.000'), 5000000);
  assert.equal(n(''), null);
  assert.equal(n('abc'), null);
  assert.deepEqual(C.parseAmount('10.000,00 DB'), { n: 10000, neg: false, dc: 'D' });
  assert.deepEqual(C.parseAmount('50000.00 CR'), { n: 50000, neg: false, dc: 'C' });
  assert.deepEqual(C.parseAmount('(25.000)'), { n: 25000, neg: true, dc: null });
  assert.deepEqual(C.parseAmount('-75.000'), { n: 75000, neg: true, dc: null });
  assert.deepEqual(C.parseAmount('Rp -75.000'), { n: 75000, neg: true, dc: null });
  assert.deepEqual(C.parseAmount('75.000-'), { n: 75000, neg: true, dc: null });
  assert.equal(C.parseAmount('2.500.000 KR').dc, 'C');
});

test('parseDate: berbagai format, hari lebih dulu', () => {
  const d = s => C.parseDate(s, REF);
  assert.equal(d('05/10/2026'), '2026-10-05');
  assert.equal(d('5-10-2026'), '2026-10-05');
  assert.equal(d('05.10.26'), '2026-10-05');
  assert.equal(d('2026-10-05'), '2026-10-05');
  assert.equal(d('2026-10-05 14:32:10'), '2026-10-05');
  assert.equal(d('05/10/2026 14:32'), '2026-10-05');
  assert.equal(d('05 Okt 2026'), '2026-10-05');
  assert.equal(d('5 October 2026'), '2026-10-05');
  assert.equal(d('Oct 5, 2026'), '2026-10-05');
  assert.equal(d('17 Agu 2026'), '2026-08-17');
  assert.equal(d('10/25/2026'), '2026-10-25');   // bulan/hari bila bagian kedua > 12
  assert.equal(d('05/10'), '2026-10-05');        // tanpa tahun: tahun ini
  assert.equal(d('25/12'), '2025-12-25');        // jatuh di masa depan -> tahun lalu
  assert.equal(d('31/02/2026'), null);
  assert.equal(d('Saldo Awal'), null);
  assert.equal(d(''), null);
});

test('parseCSV: pemisah, kutip, kutip ganda, BOM, baris kosong', () => {
  assert.deepEqual(C.parseCSV('a,b,c\n1,2,3'), [['a', 'b', 'c'], ['1', '2', '3']]);
  assert.deepEqual(C.parseCSV('a;b;c\r\n1;2;3\r\n'), [['a', 'b', 'c'], ['1', '2', '3']]);
  assert.deepEqual(C.parseCSV('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(C.parseCSV('\uFEFF"x, y","he said ""hi""",z\n\n1,2,3'), [['x, y', 'he said "hi"', 'z'], ['1', '2', '3']]);
  assert.equal(C.detectDelim('Tanggal;Keterangan;Debet;Kredit\n01/10/2026;Beli;10.000,00;0,00'), ';');
  // koma di dalam angka berkutip tidak boleh dianggap pemisah
  assert.deepEqual(C.parseCSV('"05/10","KARTU DEBIT INDOMARET","10,000.00 DB"'), [['05/10', 'KARTU DEBIT INDOMARET', '10,000.00 DB']]);
});

function run(csv, opts) { const rows = C.parseCSV(csv), { head, map } = C.detectColumns(rows, REF); return { head, map, ...C.extractRows(rows, head, map, Object.assign({ ref: REF }, opts)) } }

test('impor: format dua kolom debit/kredit dengan titik koma (gaya Mandiri/BRI)', () => {
  const r = run('Rekening;1234\nTanggal;Keterangan;Debet;Kredit;Saldo\n01/10/2026;INDOMARET JKT;25.000,00;0,00;975.000,00\n02/10/2026;GAJI OKT;0,00;5.000.000,00;5.975.000,00\nTotal;;25.000,00;5.000.000,00;');
  assert.equal(r.head, 1);
  assert.deepEqual(r.items.map(x => [x.date, x.type, x.amt]), [['2026-10-01', 'out', 25000], ['2026-10-02', 'in', 5000000]]);
  assert.equal(r.skipped.length, 1); // baris "Total"
});

test('impor: satu kolom jumlah dengan akhiran DB/CR dan tanpa tahun (gaya BCA)', () => {
  const r = run('Tanggal Transaksi,Keterangan,Cabang,Jumlah,Saldo\n05/10,"KARTU DEBIT INDOMARET",0000,"10,000.00 DB","990,000.00"\n06/10,"TRSF E-BANKING CR GAJI",0000,"5,000,000.00 CR","5,990,000.00"');
  assert.deepEqual(r.items.map(x => [x.date, x.type, x.amt, x.desc]), [['2026-10-05', 'out', 10000, 'KARTU DEBIT INDOMARET'], ['2026-10-06', 'in', 5000000, 'TRSF E-BANKING CR GAJI']]);
});

test('impor: jumlah bertanda negatif dan kolom tipe DB/CR terpisah', () => {
  let r = run('Date,Description,Amount\n2026-10-01,Kopi,-35000\n2026-10-02,Transfer masuk,150000', { defType: 'in' });
  assert.deepEqual(r.items.map(x => [x.type, x.amt]), [['out', 35000], ['in', 150000]]);
  r = run('Tanggal,Uraian,Nominal,D/C\n01/10/2026,Parkir,5000,D\n01/10/2026,Refund,12000,C');
  assert.deepEqual(r.items.map(x => [x.type, x.amt]), [['out', 5000], ['in', 12000]]);
});

test('impor: tanpa baris judul, kolom ditebak dari isi', () => {
  const r = run('01/10/2026,Makan siang,25.000\n02/10/2026,Ojek online,18.000', { defType: 'out' });
  assert.equal(r.head, -1);
  assert.deepEqual(r.items.map(x => [x.date, x.desc, x.amt, x.type]), [['2026-10-01', 'Makan siang', 25000, 'out'], ['2026-10-02', 'Ojek online', 18000, 'out']]);
});

test('markDuplicates: sadar jumlah kejadian, transfer diabaikan', () => {
  const items = [{ date: '2026-10-01', type: 'out', amt: 5000 }, { date: '2026-10-01', type: 'out', amt: 5000 }, { date: '2026-10-01', type: 'out', amt: 7000 }];
  C.markDuplicates(items, [{ date: '2026-10-01', type: 'out', amt: 5000 }, { date: '2026-10-01', type: 'out', amt: 7000, tr: 1 }]);
  assert.deepEqual(items.map(x => x.dup), [true, false, false]);
});

test('matchRule: kata kunci terpanjang menang, batas kategori, banyak kata kunci', () => {
  const rules = [{ k: 'grab', c: 'Transportasi' }, { k: 'grabfood, gofood', c: 'Makanan' }, { k: 'indomaret', c: 'Belanja' }, { k: 'gaji', c: 'Gaji' }];
  assert.equal(C.matchRule(rules, 'INDOMARET JKT 123').c, 'Belanja');
  assert.equal(C.matchRule(rules, 'GrabFood Ayam Geprek').c, 'Makanan');
  assert.equal(C.matchRule(rules, 'Grab Car ke bandara').c, 'Transportasi');
  assert.equal(C.matchRule(rules, 'Gaji Oktober', ['Makanan', 'Belanja']), null);
  assert.equal(C.matchRule(rules, 'Gaji Oktober', ['Gaji']).c, 'Gaji');
  assert.equal(C.matchRule(rules, 'toko kelontong'), null);
  assert.equal(C.matchRule([], 'apa saja'), null);
});

test('presetRuleList: hanya kategori yang ada', () => {
  const l = C.presetRuleList(['Belanja', 'Gaji']);
  assert.ok(l.length >= 2 && l.every(r => ['Belanja', 'Gaji'].includes(r.c)));
});

test('makeNid: selalu naik walau jam sama', () => {
  const n = C.makeNid(() => 1000); const a = [n(), n(), n()];
  assert.deepEqual(a, [1000, 1001, 1002]);
});

/* ---------- merge3 ---------- */
const tx = (id, amt, extra) => Object.assign({ id, w: 'w2', date: '2026-10-01', type: 'out', cat: 'Makanan', desc: 'x' + id, amt }, extra);
const base = () => ({ T: [tx(1, 100), tx(2, 200)], B: { Makanan: 1e6, Belanja: 2e6 }, OUT: ['Makanan', 'Belanja'], OP: 500, EM: false, W: [{ id: 'w1', n: 'Tunai', o: 0 }] });

test('merge3: tambahan di dua perangkat sama-sama bertahan', () => {
  const b = base(), l = base(), r = base(); l.T.push(tx(3, 300)); r.T.push(tx(4, 400));
  const m = C.merge3(b, l, r); assert.deepEqual(m.T.map(x => x.id).sort(), [1, 2, 3, 4]);
});
test('merge3: hapus lokal diterapkan, perubahan jauh pada catatan lain tetap', () => {
  const b = base(), l = base(), r = base(); l.T = l.T.filter(x => x.id != 1); r.T[1].amt = 250;
  const m = C.merge3(b, l, r); assert.deepEqual(m.T.map(x => [x.id, x.amt]), [[2, 250]]);
});
test('merge3: hapus-vs-ubah dimenangkan ubah (tidak ada data hilang)', () => {
  const b = base(), l = base(), r = base(); l.T = l.T.filter(x => x.id != 2); r.T[1].amt = 999;
  assert.deepEqual(C.merge3(b, l, r).T.map(x => [x.id, x.amt]), [[1, 100], [2, 999]]);
});
test('merge3: kolom berbeda pada catatan sama digabung; kolom sama dimenangkan lokal', () => {
  const b = base(), l = base(), r = base(); l.T[0].desc = 'lokal'; r.T[0].cat = 'Belanja'; l.T[1].amt = 1; r.T[1].amt = 2;
  const m = C.merge3(b, l, r); assert.equal(m.T[0].desc, 'lokal'); assert.equal(m.T[0].cat, 'Belanja'); assert.equal(m.T[1].amt, 1);
});
test('merge3: anggaran per kunci, skalar, dan daftar kategori', () => {
  const b = base(), l = base(), r = base(); l.B.Makanan = 1500000; r.B.Belanja = 3e6; l.OP = 900; l.OUT.push('Hobi'); r.OUT.push('Rumah'); r.OUT = r.OUT.filter(x => x != 'Belanja');
  const m = C.merge3(b, l, r); assert.deepEqual(m.B, { Makanan: 1500000, Belanja: 3e6 }); assert.equal(m.OP, 900);
  assert.deepEqual(m.OUT.sort(), ['Hobi', 'Makanan', 'Rumah']);
});
test('merge3: urutan kunci berbeda (jsonb) tidak dianggap perubahan', () => {
  const b = { T: [{ id: 1, a: 1, b: 2 }] }, l = { T: [{ b: 2, id: 1, a: 1 }] }, r = { T: [{ id: 1, a: 1, b: 2 }, { id: 2 }] };
  assert.equal(C.diffCount(b, l), 0); assert.equal(C.merge3(b, l, r).T.length, 2);
});
test('merge3: pembayaran bersarang di utang yang sama digabung', () => {
  const d0 = { id: 7, who: 'Budi', amt: 1e6, pays: [] }, b = { DT: [d0] }, l = { DT: [{ ...d0, pays: [{ id: 'p1', amt: 100 }] }] }, r = { DT: [{ ...d0, pays: [{ id: 'p2', amt: 200 }] }] };
  assert.deepEqual(C.merge3(b, l, r).DT[0].pays.map(p => p.id).sort(), ['p1', 'p2']);
});
test('merge3: tanpa perubahan lokal = ambil jauh; tanpa perubahan jauh = ambil lokal', () => {
  const b = base(), l = base(), r = base(); r.T.push(tx(9, 9)); assert.equal(C.merge3(b, l, r).T.length, 3);
  const l2 = base(); l2.T.push(tx(8, 8)); assert.equal(C.merge3(b, l2, base()).T.length, 3);
});
test('merge3: LK memakai kunci p', () => {
  const b = { LK: [] }, l = { LK: [{ p: 'dana', b: 1 }] }, r = { LK: [{ p: 'bca', b: 2 }] };
  assert.deepEqual(C.merge3(b, l, r).LK.map(x => x.p).sort(), ['bca', 'dana']);
});
test('Tabungan Amal: saldo = disisihkan - disalurkan; data kosong/rusak aman', () => {
  const ch = [{ k: 'in', amt: 100000 }, { k: 'in', amt: 50000 }, { k: 'out', amt: 30000 }];
  assert.equal(C.amalSum(ch, 'in'), 150000); assert.equal(C.amalSum(ch, 'out'), 30000); assert.equal(C.amalBal(ch), 120000);
  assert.equal(C.amalBal([]), 0); assert.equal(C.amalBal(undefined), 0); assert.equal(C.amalBal([{ k: 'out', amt: 5 }]), -5);
});
test('merge3: AMAL digabung lewat id (dua perangkat menambah catatan amal)', () => {
  const b = { AMAL: [] }, l = { AMAL: [{ id: 'h1', k: 'in', amt: 1 }] }, r = { AMAL: [{ id: 'h2', k: 'out', amt: 2 }] };
  assert.deepEqual(C.merge3(b, l, r).AMAL.map(x => x.id).sort(), ['h1', 'h2']);
});
test('diffCount: hitung tambah, ubah, hapus, dan skalar', () => {
  const b = base(), l = base(); l.T.push(tx(5, 5)); l.T[0].amt = 7; l.T = l.T.filter(x => x.id != 2); l.OP = 1;
  assert.equal(C.diffCount(b, l), 4);
  assert.equal(C.diffCount(b, base()), 0);
});

/* ---------- utang & cicilan ---------- */
test('utang dan cicilan: sisa dan tanggal bulan berikutnya', () => {
  assert.equal(C.debtLeft({ amt: 1000, pays: [{ amt: 300 }, { amt: 200 }] }), 500);
  assert.equal(C.debtLeft({ amt: 100, pays: [{ amt: 300 }] }), 0);
  assert.equal(C.instLeft({ per: 250000, months: 12, n0: 3, pays: [{ id: 1 }] }), 2000000);
  assert.equal(C.instNext({ first: '2026-10-31', dd: 31, pays: [{ id: 1 }] }), '2026-11-30');
  assert.equal(C.addMonths('2026-01-31', 1, 31), '2026-02-28');
  assert.equal(C.addMonths('2026-02-28', 1, 31), '2026-03-31');
  assert.equal(C.addMonths('2026-12-15', 1, 15), '2027-01-15');
});
