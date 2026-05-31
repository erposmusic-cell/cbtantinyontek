import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '../../components/layout/AppLayout';
import ExamScreen from '../../components/exam/ExamScreen';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

function HasilUjian({ result, ujian, siswa, onClose }) {
  const lulus = result.nilai >= ujian.passing_grade;
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-500 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-2xl animate-fade-in">
        <h2 className="text-xl font-extrabold mb-1">{ujian.judul}</h2>
        <p className="text-gray-500 text-sm mb-6">{siswa.nama_lengkap}</p>
        <div className={`w-40 h-40 rounded-full mx-auto mb-6 flex flex-col items-center justify-center border-8
          ${lulus ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
          <span className={`text-5xl font-extrabold ${lulus ? 'text-green-600' : 'text-red-600'}`}>{result.nilai}</span>
          <span className="text-xs text-gray-500">dari 100</span>
        </div>
        <div className={`text-lg font-bold mb-5 ${lulus ? 'text-green-600' : 'text-red-600'}`}>
          {lulus ? '🎉 LULUS' : '😔 TIDAK LULUS'}
        </div>
        <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left space-y-2 text-sm">
          {[
            ['Soal Dijawab', `${result.answered} / ${result.totalSoal}`],
            ['Nilai Minimum', `${ujian.passing_grade}`],
            ['Pelanggaran', `${result.violations?.length || 0} kali`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5 border-b border-gray-200 last:border-0">
              <span className="text-gray-500">{k}</span>
              <span className="font-semibold">{v}</span>
            </div>
          ))}
        </div>
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg p-3 mb-4 text-left">
          📝 Soal essay akan dikoreksi manual oleh guru dan nilai mungkin berubah.
        </div>
        <button
          onClick={onClose}
          className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-colors"
        >
          Kembali ke Beranda
        </button>
      </div>
    </div>
  );
}

export default function SiswaUjianPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ujianList, setUjianList]     = useState([]);
  const [mapelList, setMapelList]     = useState([]);
  const [filterMapel, setFilterMapel] = useState('');
  const [tokenInput, setTokenInput]   = useState({});
  const [tokenError, setTokenError]   = useState({});
  const [sesiMap,    setSesiMap]       = useState({}); // ujian_id -> sesi status
  const [examState, setExamState]     = useState(null);
  const [examResult, setExamResult]   = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/');
    if (user?.role !== 'siswa') router.push('/dashboard');
  }, [user, loading]);

  useEffect(() => {
    if (user) { loadUjian(); loadMapel(); }
  }, [user]);

  async function loadMapel() {
    const { data } = await supabase.from('mata_pelajaran').select('id, nama').order('nama');
    setMapelList(data || []);
  }

  async function loadUjian() {
    setLoadingData(true);

    // Ambil semua ujian aktif
    const { data: semuaUjian } = await supabase
      .from('ujian')
      .select('*, mata_pelajaran(nama)')
      .eq('status', 'aktif')
      .order('waktu_mulai', { ascending: true });

    if (!semuaUjian?.length) { setUjianList([]); setLoadingData(false); return; }

    // Cek ujian mana yang punya daftar peserta terbatas
    const ujianIds = semuaUjian.map(u => u.id);
    const { data: pesertaData } = await supabase
      .from('peserta_ujian')
      .select('ujian_id, siswa_id, diizinkan')
      .in('ujian_id', ujianIds);

    // Kelompokkan peserta per ujian
    const pesertaMap = {};
    (pesertaData || []).forEach(p => {
      if (!pesertaMap[p.ujian_id]) pesertaMap[p.ujian_id] = [];
      pesertaMap[p.ujian_id].push(p);
    });

    // Filter: tampilkan ujian jika (a) tidak ada daftar peserta = terbuka untuk semua,
    // atau (b) siswa ini terdaftar dan diizinkan
    const ujianTersedia = semuaUjian.filter(u => {
      const peserta = pesertaMap[u.id];
      if (!peserta || peserta.length === 0) return true; // terbuka
      return peserta.some(p => p.siswa_id === user.id && p.diizinkan);
    });

    setUjianList(ujianTersedia);

    // Fetch status sesi siswa untuk semua ujian tersedia sekaligus
    if (ujianTersedia.length > 0) {
      const ids = ujianTersedia.map(u => u.id);
      const { data: sesiData } = await supabase
        .from('sesi_ujian')
        .select('ujian_id, status, alasan_kunci')
        .eq('siswa_id', user.id)
        .in('ujian_id', ids);
      const map = {};
      (sesiData || []).forEach(s => { map[s.ujian_id] = s; });
      setSesiMap(map);
    }

    setLoadingData(false);
  }

  async function startExam(ujian) {
    // Validasi token jika ujian memakai token
    if (ujian.token_ujian) {
      const inputToken = (tokenInput[ujian.id] || '').trim().toUpperCase();
      if (inputToken !== ujian.token_ujian.toUpperCase()) {
        setTokenError(prev => ({ ...prev, [ujian.id]: 'Token salah. Periksa kembali.' }));
        return;
      }
      setTokenError(prev => ({ ...prev, [ujian.id]: '' }));
    }
    // Cek apakah siswa sudah punya sesi untuk ujian ini
    const { data: sesiExisting } = await supabase
      .from('sesi_ujian')
      .select('id, status')
      .eq('ujian_id', ujian.id)
      .eq('siswa_id', user.id)
      .maybeSingle();

    if (sesiExisting?.status === 'selesai') {
      alert('Kamu sudah mengerjakan ujian ini. Tidak bisa mengulang.');
      return;
    }

    if (sesiExisting?.status === 'diskualifikasi') {
      alert('Ujian kamu telah dikunci karena pelanggaran. Hubungi pengawas ujian.');
      return;
    }

    // Ambil soal ujian
    const { data: soalUjian } = await supabase
      .from('soal_ujian')
      .select('*, bank_soal(*, pilihan_jawaban(*))')
      .eq('ujian_id', ujian.id)
      .order('urutan');

    const soal = soalUjian?.map(su => ({
      ...su.bank_soal,
      pilihan: su.bank_soal?.pilihan_jawaban || [],
      bobot: su.bobot_override || su.bank_soal?.bobot || 1,
    })) || [];

    const acakSoal = ujian.acak_soal
      ? [...soal].sort(() => Math.random() - 0.5)
      : soal;

    // Acak pilihan jawaban jika acak_pilihan aktif
    // Label A/B/C/D di-reassign ulang setelah shuffle agar tetap berurutan
    const LABELS = ['A', 'B', 'C', 'D', 'E'];
    const finalSoal = ujian.acak_pilihan
      ? acakSoal.map(s => ({
          ...s,
          pilihan: [...(s.pilihan || [])]
            .sort(() => Math.random() - 0.5)
            .map((p, i) => ({ ...p, label: LABELS[i] ?? String(i + 1) })),
        }))
      : acakSoal;

    // Jika sesi berlangsung sudah ada (misal browser crash), lanjutkan sesi itu
    let sesiId = sesiExisting?.id;
    if (!sesiId) {
      const { data: sesi, error: sesiErr } = await supabase
        .from('sesi_ujian')
        .insert({ ujian_id: ujian.id, siswa_id: user.id, status: 'berlangsung', waktu_mulai: new Date().toISOString() })
        .select('id')
        .single();
      if (sesiErr) {
        alert('Gagal memulai ujian. Silakan coba lagi.');
        return;
      }
      sesiId = sesi.id;
    }

    setExamState({ ujian, soal: finalSoal, sesiId });
    setExamResult(null);
  }

  async function finishExam(result) {
    if (!examState) return;

    // Simpan snapshot sebelum setExamState(null) untuk menghindari race condition
    const ujianSnapshot = examState.ujian;
    const soalSnapshot  = examState.soal;
    const sesiId        = examState.sesiId;

    // Tampilkan loading sementara server memproses
    setExamState(null);

    let nilaiAkhir = 0;

    if (sesiId) {
      // 1. Simpan setiap jawaban siswa ke tabel jawaban_siswa
      const jawabanRows = soalSnapshot
        .filter(q => result.jawaban?.[q.id] !== undefined)
        .map(q => {
          const raw  = result.jawaban[q.id];
          const tipe = q.tipe_soal;
          const row  = {
            sesi_id:  sesiId,
            soal_id:  q.id,
            waktu_jawab: new Date().toISOString(),
          };
          if (tipe === 'pilihan_ganda') {
            row.pilihan_id = raw;                      // UUID pilihan
          } else if (tipe === 'mcma') {
            row.pilihan_ids = Array.isArray(raw) ? raw : [raw];
          } else if (tipe === 'benar_salah') {
            row.jawaban_bs = Array.isArray(raw) ? raw : [];
          } else if (tipe === 'essay') {
            row.jawaban_essay = String(raw || '');
          }
          return row;
        });

      if (jawabanRows.length > 0) {
        await supabase.from('jawaban_siswa').insert(jawabanRows);
      }

      // 2. Hitung nilai via RPC server (koreksi otomatis PG/MCMA/BS)
      const { data: nilaiData } = await supabase
        .rpc('hitung_nilai_sesi', { p_sesi_id: sesiId });
      nilaiAkhir = nilaiData ?? 0;

      // 3. Update sesi_ujian: status selesai + waktu_selesai + jumlah_pelanggaran
      await supabase.from('sesi_ujian').update({
        status:               'selesai',
        waktu_selesai:        new Date().toISOString(),
        jumlah_pelanggaran:   result.violations?.length ?? 0,
        nilai_akhir:          nilaiAkhir,
      }).eq('id', sesiId);
    } else {
      // Fallback jika sesiId undefined (Bug #7 belum ter-handle): estimasi dari bobot
      const totalBobot  = soalSnapshot.reduce((s, q) => s + (q.bobot || 1), 0);
      const bobotDijawab = soalSnapshot
        .filter(q => result.jawaban?.[q.id] !== undefined)
        .reduce((s, q) => s + (q.bobot || 1), 0);
      nilaiAkhir = totalBobot > 0 ? Math.round((bobotDijawab / totalBobot) * 100) : 0;
    }

    setExamResult({ ...result, nilai: nilaiAkhir, ujian: ujianSnapshot });
  }

  if (loading || !user) return null;

  if (examState) {
    return (
      <ExamScreen
        ujian={examState.ujian}
        soalList={examState.soal}
        siswa={user}
        sesiId={examState.sesiId}
        onFinish={finishExam}
      />
    );
  }

  if (examResult) {
    return <HasilUjian result={examResult} ujian={examResult.ujian} siswa={user} onClose={() => setExamResult(null)} />;
  }

  return (
    <AppLayout title="Ujian Tersedia">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">📝 Ujian Tersedia</h1>
        <p className="text-gray-500 text-sm mt-1">Daftar ujian yang dapat Anda ikuti</p>
      </div>

      {/* Filter Mata Pelajaran */}
      {mapelList.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilterMapel('')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              filterMapel === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Semua
          </button>
          {mapelList.map(m => (
            <button
              key={m.id}
              onClick={() => setFilterMapel(m.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                filterMapel === m.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {m.nama}
            </button>
          ))}
        </div>
      )}

      {loadingData ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin mr-3" />
          Memuat ujian...
        </div>
      ) : ujianList.filter(u => !filterMapel || u.mata_pelajaran_id === filterMapel).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-semibold">Tidak ada ujian aktif saat ini</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ujianList
            .filter(u => !filterMapel || u.mata_pelajaran_id === filterMapel)
            .map(u => {
              const sesi = sesiMap[u.id];
              const isDiskualifikasi = sesi?.status === 'diskualifikasi';
              const isSelesai        = sesi?.status === 'selesai';
              return (
                <div key={u.id} className={`bg-white rounded-xl border p-5 shadow-sm transition-shadow
                  ${isDiskualifikasi ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:shadow-md'}`}>

                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-gray-900 text-sm leading-tight flex-1 pr-2">{u.judul}</h3>
                    {isDiskualifikasi
                      ? <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">🔒 Dikunci</span>
                      : isSelesai
                        ? <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">✅ Selesai</span>
                        : <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">Aktif</span>
                    }
                  </div>

                  <div className="space-y-1.5 mb-4 text-xs text-gray-500">
                    <div>📚 {u.mata_pelajaran?.nama || '—'}</div>
                    <div>⏱ {u.durasi_menit} menit • {u.jumlah_soal} soal</div>
                    <div>🎯 Nilai minimum: {u.passing_grade}</div>
                  </div>

                  {/* Banner diskualifikasi */}
                  {isDiskualifikasi && (
                    <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2 mb-3 text-xs text-red-700">
                      <span className="shrink-0 text-base">🔒</span>
                      <div>
                        <p className="font-bold">Ujian Anda telah dikunci</p>
                        <p className="text-red-500 mt-0.5">{sesi?.alasan_kunci || 'Pelanggaran melebihi batas yang ditentukan'}</p>
                        <p className="mt-1 text-red-400">Hubungi pengawas ujian.</p>
                      </div>
                    </div>
                  )}

                  {/* Banner selesai */}
                  {isSelesai && (
                    <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 mb-3 text-xs text-gray-600">
                      ✅ Anda sudah mengerjakan ujian ini.
                    </div>
                  )}

                  {/* Input Token — hanya jika belum selesai/dikunci */}
                  {!isDiskualifikasi && !isSelesai && u.token_ujian && (
                    <div className="mb-3">
                      <input
                        type="text"
                        value={tokenInput[u.id] || ''}
                        onChange={e => {
                          setTokenInput(prev => ({ ...prev, [u.id]: e.target.value.toUpperCase() }));
                          setTokenError(prev => ({ ...prev, [u.id]: '' }));
                        }}
                        placeholder="Masukkan token ujian"
                        maxLength={10}
                        className={`w-full px-3 py-2 border rounded-lg text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          tokenError[u.id] ? 'border-red-400 bg-red-50' : 'border-gray-200'
                        }`}
                      />
                      {tokenError[u.id] && (
                        <p className="text-red-500 text-xs mt-1">{tokenError[u.id]}</p>
                      )}
                    </div>
                  )}

                  {/* Tombol — disable jika selesai atau dikunci */}
                  <button
                    onClick={() => !isDiskualifikasi && !isSelesai && startExam(u)}
                    disabled={isDiskualifikasi || isSelesai}
                    className={`w-full py-2.5 text-sm font-bold rounded-lg transition-colors
                      ${isDiskualifikasi
                        ? 'bg-red-200 text-red-400 cursor-not-allowed'
                        : isSelesai
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-primary-600 hover:bg-primary-700 text-white'
                      }`}
                  >
                    {isDiskualifikasi ? '🔒 Ujian Dikunci' : isSelesai ? '✅ Sudah Dikerjakan' : u.token_ujian ? '🔑 Masuk dengan Token →' : 'Mulai Ujian →'}
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </AppLayout>
  );
}
