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
  const [ujianList, setUjianList] = useState([]);
  const [examState, setExamState] = useState(null);
  const [examResult, setExamResult] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/');
    if (user?.role !== 'siswa') router.push('/dashboard');
  }, [user, loading]);

  useEffect(() => {
    if (user) loadUjian();
  }, [user]);

  async function loadUjian() {
    setLoadingData(true);
    const { data } = await supabase
      .from('ujian')
      .select('*, mata_pelajaran(nama)')
      .eq('status', 'aktif')
      .order('waktu_mulai', { ascending: true });
    setUjianList(data || []);
    setLoadingData(false);
  }

  async function startExam(ujian) {
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

    // Acak soal jika diaktifkan
    const finalSoal = ujian.acak_soal
      ? [...soal].sort(() => Math.random() - 0.5)
      : soal;

    // Buat sesi ujian
    const { data: sesi } = await supabase
      .from('sesi_ujian')
      .insert({ ujian_id: ujian.id, siswa_id: user.id, status: 'berlangsung', waktu_mulai: new Date().toISOString() })
      .select()
      .single();

    setExamState({ ujian, soal: finalSoal, sesiId: sesi?.id });
    setExamResult(null);
  }

  function finishExam(result) {
    // Hitung nilai sederhana
    const totalBobot = examState.soal.reduce((s, q) => s + (q.bobot || 1), 0);
    const nilai = Math.round((result.answered / result.totalSoal) * 100);
    setExamState(null);
    setExamResult({ ...result, nilai, ujian: examState.ujian });
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

      {loadingData ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin mr-3" />
          Memuat ujian...
        </div>
      ) : ujianList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-semibold">Tidak ada ujian aktif saat ini</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ujianList.map(u => (
            <div key={u.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-gray-900 text-sm leading-tight flex-1 pr-2">{u.judul}</h3>
                <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">Aktif</span>
              </div>
              <div className="space-y-1.5 mb-4 text-xs text-gray-500">
                <div>📚 {u.mata_pelajaran?.nama || '—'}</div>
                <div>⏱ {u.durasi_menit} menit • {u.jumlah_soal} soal</div>
                <div>🎯 Nilai minimum: {u.passing_grade}</div>
              </div>
              <button
                onClick={() => startExam(u)}
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-lg transition-colors"
              >
                Mulai Ujian →
              </button>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
