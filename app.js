// =========================================================
// KONFIGURASI
// =========================================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby0PZn02hFnay9HM4-KEahvVptTTgsi4AtTL4yp3rGyn_hDJDgYG23In-UgQdEGXLgIsQ/exec"; 

// Pembolehubah Global
let currentUser = null; 
let dbPeserta = [];
let dbRekod = [];
let dbKeputusan = [];
let dbUndian = [];

// =========================================================
// 1. FUNGSI UTILITI & UI
// =========================================================

window.onload = () => {
    fetchData('db_rekod');
    fetchData('db_peserta');
    fetchData('db_keputusan');
    fetchData('db_undian');
};

function toggleLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if(overlay) {
        if (show) overlay.classList.remove('hidden');
        else overlay.classList.add('hidden');
    }
}

// =========================================================
// 2. SISTEM LOGIN & NAVIGASI
// =========================================================

function login() {
    const passInput = document.getElementById('pass-input');
    const pass = passInput ? passInput.value : '';
    let valid = false;

    if (pass === 'admin123') {
        currentUser = 'admin';
        valid = true;
    } else if (pass === 'guru123') {
        currentUser = 'guru';
        valid = true;
    }

    if (valid) {
        const loginSection = document.getElementById('login-section');
        if(loginSection) loginSection.classList.add('hidden');

        const dashboard = document.getElementById('dashboard');
        if(dashboard) dashboard.classList.remove('hidden');

        switchTab('peserta'); 
    } else {
        alert("Kata Laluan Salah!");
    }
}

function logout() {
    location.reload(); 
}

function switchTab(tabName) {
    // 1. Senarai semua tab yang ada
    const tabs = ['peserta', 'borang', 'senarai', 'result'];
    
    tabs.forEach(t => {
        // A. Sembunyikan kandungan tab
        const el = document.getElementById('tab-' + t);
        if (el) el.classList.add('hidden');

        // B. Buang gaya 'highlight' daripada butang navigasi
        // Kita cari butang berdasarkan ID yang kita beri tadi (btn-peserta, dsb)
        const btn = document.getElementById('btn-' + t);
        if (btn) {
            btn.classList.remove('bg-blue-900', 'rounded', 'font-bold');
        }
    });

    // 2. Tunjukkan tab yang dipilih
    const target = document.getElementById('tab-' + tabName);
    if (target) {
        target.classList.remove('hidden');
        
        // 3. Tambah gaya 'highlight' pada butang yang aktif sahaja
        const activeBtn = document.getElementById('btn-' + tabName);
        if (activeBtn) {
            activeBtn.classList.add('bg-blue-900', 'rounded', 'font-bold');
        }
        
        // 4. Refresh data spesifik mengikut tab
        if(tabName === 'result') paparkanAnalisis();
        if(tabName === 'senarai') {
            kemaskiniFilterKeputusan(); 
            renderKeputusanPenuh();     
        }
    }
}

// =========================================================
// 3. KOMUNIKASI DATA (FETCH & UPLOAD)
// =========================================================

async function fetchData(table) {
    if(currentUser) toggleLoading(true); 

    try {
        const res = await fetch(`${SCRIPT_URL}?action=readData&table=${table}`);
        const data = await res.json();
        
        if (table === 'db_peserta') {
            dbPeserta = data;
            kemaskiniDropdownAcara();
            renderPesertaList(); // <--- PANGGIL FUNGSI INI UNTUK PAPAR SENARAI PESERTA
        }
        if (table === 'db_rekod') dbRekod = data;
        if (table === 'db_keputusan') {
            dbKeputusan = data;
            // Jika user sedang di tab senarai, auto refresh table
            const tabSenarai = document.getElementById('tab-senarai');
            if(tabSenarai && !tabSenarai.classList.contains('hidden')) {
                renderKeputusanPenuh();
            }
        }
        if (table === 'db_undian') dbUndian = data;

    } catch (e) { 
        console.log(`Ralat mengambil data ${table}:`, e); 
    } finally {
        if(currentUser) toggleLoading(false);
    }
}

function uploadToSheets(action, rows) {
    toggleLoading(true);

    fetch(SCRIPT_URL, {
        method: "POST",
        mode: 'no-cors', 
        body: JSON.stringify({ action: action, rows: rows })
    })
    .then(() => {
        alert("Berjaya disimpan!");
        if(action === 'saveKeputusan') fetchData('db_keputusan');
        if(action === 'uploadPeserta') fetchData('db_peserta');
        if(action === 'uploadRekod') fetchData('db_rekod');
    })
    .catch(err => {
        console.error(err);
        alert("Ralat sambungan.");
    })
    .finally(() => {
        toggleLoading(false);
    });
}

// =========================================================
// 4. PEMPROSESAN CSV (PESERTA & REKOD)
// =========================================================

function uploadPeserta() {
    const fileInput = document.getElementById('file-peserta');
    if (!fileInput || !fileInput.files[0]) return alert("Sila pilih fail CSV peserta.");
    processCSVFile(fileInput.files[0], 'peserta');
}

function uploadRekod() {
    const fileInput = document.getElementById('file-rekod');
    if (!fileInput || !fileInput.files[0]) return alert("Sila pilih fail CSV rekod.");
    processCSVFile(fileInput.files[0], 'rekod');
}

function processCSVFile(file, type) {
    toggleLoading(true);
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split("\n").map(l => l.trim()).filter(l => l);
        const headers = lines[0].split(",");
        
        const rawRows = lines.slice(1).map(line => {
            const d = line.split(",");
            let obj = {};
            headers.forEach((h, i) => obj[h.trim()] = d[i] ? d[i].trim() : "");
            return obj;
        });

        if (type === 'peserta') {
            let processed = [];
            rawRows.forEach(p => {
                if(p.Senarai_Acara) {
                    const acaraList = p.Senarai_Acara.split(';');
                    acaraList.forEach(ac => {
                        processed.push({
                            Rumah_Sukan: p.Rumah_Sukan, Nama: p.Nama, Kategori: p.Kategori, No_Bib: p.No_Bib, Acara: ac.trim()
                        });
                    });
                }
            });
            uploadToSheets('uploadPeserta', processed);

        } else if (type === 'rekod') {
            dbRekod = rawRows;
            uploadToSheets('uploadRekod', rawRows);
        }
    };
    reader.readAsText(file);
}

// =========================================================
// 5. JANA BORANG (GENERATE FORM)
// =========================================================

function kemaskiniDropdownAcara() {
    const select = document.getElementById('select-acara');
    if(!select) return;
    const unik = [...new Set(dbPeserta.map(p => `${p.Acara}|${p.Kategori}`))];
    select.innerHTML = '<option value="">-- Pilih Acara --</option>';
    unik.sort().forEach(val => {
        const [ac, kat] = val.split('|');
        if(ac && kat) select.innerHTML += `<option value="${val}">${ac} (${kat})</option>`;
    });
}

function shuffleWithConstraint(arr) {
    let result = [];
    let pool = [...arr].sort(() => Math.random() - 0.5); 
    while (pool.length > 0) {
        let index = pool.findIndex(p => result.length === 0 || p.Rumah_Sukan !== result[result.length - 1].Rumah_Sukan);
        if (index === -1) index = 0;
        result.push(pool.splice(index, 1)[0]);
    }
    return result;
}

function generateBorang() {
    const val = document.getElementById('select-acara').value;
    if (!val) return alert("Sila pilih acara dari senarai!");
    toggleLoading(true);

    const [acara, kategori] = val.split('|');
    let susunanFinal = [];

    // 1. CEK UNDIAN
    const undianSediaAda = dbUndian.filter(u => u.Acara === acara && u.Kategori === kategori);
    if (undianSediaAda.length > 0) {
        susunanFinal = undianSediaAda.sort((a, b) => parseInt(a.Lorong) - parseInt(b.Lorong));
    } else {
        let peserta = dbPeserta.filter(p => p.Acara === acara && p.Kategori === kategori);
        
        if (acara.toLowerCase().includes("relay") || acara.toLowerCase().includes("4x")) {
            let rumahGroups = {};
            peserta.forEach(p => {
                if (!rumahGroups[p.Rumah_Sukan]) rumahGroups[p.Rumah_Sukan] = [];
                rumahGroups[p.Rumah_Sukan].push(p.Nama);
            });
            peserta = Object.keys(rumahGroups).map(r => ({
                Rumah_Sukan: r, Nama: `Pasukan ${r}`, No_Bib: "-", Acara: acara, Kategori: kategori
            }));
        }

        const susunanRawak = shuffleWithConstraint(peserta);
        let dataUntukSimpan = [];
        susunanFinal = susunanRawak.map((p, index) => {
            const lorong = index + 1;
            dataUntukSimpan.push({
                Acara: acara, Kategori: kategori, No_Bib: p.No_Bib, Nama: p.Nama, Rumah_Sukan: p.Rumah_Sukan, Lorong: lorong
            });
            return { ...p, Lorong: lorong }; 
        });

        uploadToSheets('saveUndian', dataUntukSimpan);
        dbUndian = [...dbUndian, ...dataUntukSimpan]; 
    }

    // 2. DAPATKAN REKOD
    const infoRekod = dbRekod.find(r => (r.Acara && r.Acara.toLowerCase() === acara.toLowerCase()) && (r.Kategori && r.Kategori.toLowerCase() === kategori.toLowerCase())) || { Rekod: "-", Nama: "-", Jenis: "-" };

    // 3. TENTUKAN JENIS
    let jenis = infoRekod.Jenis; 
    if (acara.toLowerCase().includes("lompat tinggi")) jenis = "Lompat Tinggi";
    else if(!jenis || jenis === "-" || jenis === "") {
        if(acara.toLowerCase().includes("lontar") || acara.toLowerCase().includes("lompat jauh") || acara.toLowerCase().includes("peluru")) jenis = "Padang";
        else jenis = "Balapan";
    }

    renderBorangHTML(acara, kategori, jenis, infoRekod, susunanFinal);
    toggleLoading(false);
}

function renderBorangHTML(acara, kategori, jenis, infoRekod, susunan) {
    let html = `<div class="p-4 border bg-white min-h-[500px]">
        <div class="text-center mb-6">
            <h2 class="font-bold text-2xl uppercase">${acara} - ${kategori}</h2>
            <p class="text-gray-600">Rekod Semasa: <b>${infoRekod.Rekod}</b> oleh ${infoRekod.Nama} (${infoRekod.Tahun || '-'})</p>
        </div>
        <table class="w-full border-collapse border border-gray-400 text-sm md:text-base">
            <thead>
                <tr class="bg-gray-200">
                    <th class="border border-gray-400 p-2 w-12">No.</th>
                    <th class="border border-gray-400 p-2">Nama Peserta / Pasukan</th>
                    <th class="border border-gray-400 p-2 w-24">Rumah</th>
                    ${getHeaderInput(jenis)}
                    <th class="border border-gray-400 p-2 w-16 no-print">Rank</th>
                </tr>
            </thead>
            <tbody>`;

    susunan.forEach((p, i) => {
        const nomborLorong = p.Lorong || (i + 1);
        html += `<tr class="row-peserta hover:bg-gray-50" data-bib="${p.No_Bib}" data-nama="${p.Nama}" data-rumah="${p.Rumah_Sukan}">
            <td class="border border-gray-400 p-2 text-center font-bold">${nomborLorong}</td>
            <td class="border border-gray-400 p-2">
                <div class="font-semibold">${p.Nama}</div>
                <div class="text-xs text-gray-500">${p.No_Bib}</div>
            </td>
            <td class="border border-gray-400 p-2 text-center font-bold">${p.Rumah_Sukan}</td>
            ${getBodyInput(jenis)}
            <td class="border border-gray-400 p-2 no-print text-center">
                <select class="rank-manual border p-1 rounded w-full">
                    <option value="0">-</option>
                    ${Array.from({length: susunan.length}, (_, k) => `<option value="${k+1}">${k+1}</option>`).join('')}
                </select>
            </td>
        </tr>`;
    });

    html += `</tbody></table>
        <div class="mt-8 flex gap-4 no-print">
            <button onclick="window.print()" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded shadow flex items-center gap-2">🖨️ Cetak Borang</button>
            <button onclick="simpanKeputusan('${acara}', '${kategori}', '${jenis}', '${infoRekod.Rekod}')" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow flex items-center gap-2">💾 Simpan Keputusan</button>
        </div>
        <p class="text-xs text-red-500 mt-2 no-print">* Sila pastikan anda mengisi Kedudukan (Rank) sebelum menyimpan.</p>
    </div>`;
    
const previewDiv = document.getElementById('borang-preview'); 
    if(previewDiv) previewDiv.innerHTML = html;
}

function getHeaderInput(jenis) {
    if (jenis === 'Lompat Tinggi') {
        let cols = '';
        for(let i=1; i<=8; i++) cols += `<th class="border border-gray-400 p-1 w-8 bg-gray-50 text-gray-400 text-xs text-center">${i}</th>`;
        return cols + '<th class="border border-gray-400 p-2 w-24 bg-yellow-50">Terbaik (m)</th>';
    }
    if (jenis === 'Padang') return '<th class="border border-gray-400 p-2 w-20">Cubaan 1</th><th class="border border-gray-400 p-2 w-20">Cubaan 2</th><th class="border border-gray-400 p-2 w-20">Cubaan 3</th><th class="border border-gray-400 p-2 w-20 bg-gray-100">Terbaik</th>';
    return '<th class="border border-gray-400 p-2 w-32">Masa (Saat.ms)</th>';
}

function getBodyInput(jenis) {
    if (jenis === 'Lompat Tinggi') {
        let cols = '';
        for(let i=1; i<=8; i++) cols += `<td class="border border-gray-400 p-1 bg-gray-100"></td>`;
        return cols + '<td class="border border-gray-400 p-2"><input type="number" step="0.01" class="input-skor w-full border p-1 text-center font-bold bg-yellow-50" placeholder=""></td>';
    }
    if (jenis === 'Padang') return '<td class="border border-gray-400 p-2"><input type="number" step="0.01" class="p1 w-full border p-1"></td><td class="border border-gray-400 p-2"><input type="number" step="0.01" class="p2 w-full border p-1"></td><td class="border border-gray-400 p-2"><input type="number" step="0.01" class="p3 w-full border p-1"></td><td class="border border-gray-400 p-2 bg-gray-100 text-center font-bold text-lg display-best">-</td>';
    return '<td class="border border-gray-400 p-2"><input type="number" step="0.01" class="input-skor w-full border p-1 text-center text-lg" placeholder=""></td>';
}

// =========================================================
// 6. SIMPAN KEPUTUSAN & KIRA MATA
// =========================================================

function simpanKeputusan(acara, kategori, jenis, rekodLamaStr) {
    const rows = document.querySelectorAll('.row-peserta');
    let dataHantar = [];
    let rekodLama = parseFloat(rekodLamaStr);
    if(isNaN(rekodLama)) rekodLama = (jenis === 'Balapan') ? 9999 : 0; 

    rows.forEach(row => {
        const kedudukan = parseInt(row.querySelector('.rank-manual').value);
        if (kedudukan === 0) return;

        let skor = 0;
        if (jenis === 'Padang') {
            const p1 = parseFloat(row.querySelector('.p1').value) || 0;
            const p2 = parseFloat(row.querySelector('.p2').value) || 0;
            const p3 = parseFloat(row.querySelector('.p3').value) || 0;
            skor = Math.max(p1, p2, p3);
        } else if (jenis === 'Lompat Tinggi') {
            skor = parseFloat(row.querySelector('.input-skor').value) || 0;
        } else {
            skor = parseFloat(row.querySelector('.input-skor').value) || 0;
        }

        let mata = 0;
        if(kedudukan === 1) mata = 7;
        else if(kedudukan === 2) mata = 4;
        else if(kedudukan === 3) mata = 3;
	else if(kedudukan === 4) mata = 2;
        else mata = 1;

        let pecah = false;
        if (skor > 0) {
            if (jenis === 'Balapan') {
                if (skor < rekodLama) pecah = true;
            } else {
                if (skor > rekodLama) pecah = true;
            }
        }

        dataHantar.push({
            Acara: acara, Kategori: kategori, No_Bib: row.dataset.bib, Nama: row.dataset.nama,
            Rumah_Sukan: row.dataset.rumah, Keputusan: skor, Kedudukan: kedudukan,
            Mata: mata, Catatan_Rekod: pecah ? "REKOD BARU" : ""
        });
    });

    if(dataHantar.length === 0) return alert("Sila tetapkan Kedudukan (Rank) peserta!");
    uploadToSheets('saveKeputusan', dataHantar);
}

// =========================================================
// 7. PAPARAN: SENARAI PESERTA & KEPUTUSAN PENUH
// =========================================================

// FUNGSI 1: Render Jadual Peserta di Tab 1
function renderPesertaList() {
    const div = document.getElementById('preview-peserta');
    if(!div) return;

    if(dbPeserta.length === 0) {
        div.innerHTML = '<p class="text-gray-500 italic p-4">Tiada data peserta dijumpai dalam database.</p>';
        return;
    }

    let html = `<table class="w-full border-collapse border border-gray-300 text-sm">
        <thead class="bg-gray-100 sticky top-0">
            <tr>
                <th class="border p-2">Nama</th>
                <th class="border p-2 w-16">Rumah</th>
                <th class="border p-2 w-16">Kat</th>
                <th class="border p-2 w-20">No Bib</th>
                <th class="border p-2">Acara</th>
            </tr>
        </thead><tbody>`;
    
    dbPeserta.forEach(p => {
        html += `<tr class="hover:bg-gray-50">
            <td class="border p-2">${p.Nama}</td>
            <td class="border p-2 text-center">${p.Rumah_Sukan}</td>
            <td class="border p-2 text-center">${p.Kategori}</td>
            <td class="border p-2 text-center">${p.No_Bib}</td>
            <td class="border p-2">${p.Acara}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    div.innerHTML = html;
}

// FUNGSI 2: Kemaskini Filter di Tab Keputusan
function kemaskiniFilterKeputusan() {
    const selAcara = document.getElementById('filter-acara');
    const selKat = document.getElementById('filter-kategori');
    if(!selAcara || !selKat) return;

    // Simpan selection semasa (kalau user tengah pilih, jangan reset)
    const curAcara = selAcara.value;
    const curKat = selKat.value;

    const unikAcara = [...new Set(dbKeputusan.map(d => d.Acara))].sort();
    const unikKat = [...new Set(dbKeputusan.map(d => d.Kategori))].sort();

    selAcara.innerHTML = '<option value="SEMUA">Semua Acara</option>';
    unikAcara.forEach(a => selAcara.innerHTML += `<option value="${a}">${a}</option>`);
    
    selKat.innerHTML = '<option value="SEMUA">Semua Kategori</option>';
    unikKat.forEach(k => selKat.innerHTML += `<option value="${k}">${k}</option>`);

    // Restore selection jika masih valid
    if(unikAcara.includes(curAcara)) selAcara.value = curAcara;
    if(unikKat.includes(curKat)) selKat.value = curKat;
}

// FUNGSI 3: Render Jadual Keputusan Penuh
function renderKeputusanPenuh() {
    const tbody = document.getElementById('tbody-keputusan');
    if(!tbody) return;

    const fAcara = document.getElementById('filter-acara').value;
    const fKat = document.getElementById('filter-kategori').value;

    let filtered = dbKeputusan.filter(d => {
        const matchAcara = (fAcara === 'SEMUA') || (d.Acara === fAcara);
        const matchKat = (fKat === 'SEMUA') || (d.Kategori === fKat);
        return matchAcara && matchKat;
    });

    if(filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">Tiada rekod keputusan dijumpai.</td></tr>';
        return;
    }

    // Sort: Acara -> Kategori -> Rank
    filtered.sort((a,b) => {
        if(a.Acara !== b.Acara) return a.Acara.localeCompare(b.Acara);
        if(a.Kategori !== b.Kategori) return a.Kategori.localeCompare(b.Kategori);
        return a.Kedudukan - b.Kedudukan;
    });

    let html = '';
    filtered.forEach(d => {
        // Cek label rekod baru
        const labelRekod = (d.Catatan_Rekod === 'REKOD BARU') 
            ? '<span class="ml-2 bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded animate-pulse">(Rekod Baru)</span>' 
            : '';

        // Warna pingat
        let bgRank = '';
        if(d.Kedudukan == 1) bgRank = 'bg-yellow-50'; // Emas sikit
        else if(d.Kedudukan == 2) bgRank = 'bg-gray-50'; // Perak sikit
        else if(d.Kedudukan == 3) bgRank = 'bg-orange-50'; // Gangsa sikit

        html += `<tr class="hover:bg-gray-100 border-b ${bgRank}">
            <td class="p-3 border font-semibold text-gray-700">${d.Acara}</td>
            <td class="p-3 border text-center">${d.Kategori}</td>
            <td class="p-3 border text-center font-bold text-lg">${d.Kedudukan}</td>
            <td class="p-3 border">
                <div class="font-bold">${d.Nama}</div>
                <div class="text-xs text-gray-500">${d.No_Bib}</div>
            </td>
            <td class="p-3 border text-center">${d.Rumah_Sukan}</td>
            <td class="p-3 border text-right font-mono text-base">
                ${d.Keputusan} ${labelRekod}
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

// =========================================================
// 8. ANALISIS
// =========================================================

function paparkanAnalisis() {
    toggleLoading(true);
    fetch(`${SCRIPT_URL}?action=readData&table=db_keputusan`)
        .then(res => res.json())
        .then(data => {
            
            // =================================================
            // BAHAGIAN A: KIRA MATA RUMAH SUKAN (TERMASUK RELAY)
            // =================================================
            let skorRumah = {};
            data.forEach(d => {
                const rumah = d.Rumah_Sukan;
                // Mata rumah dikira untuk SEMUA acara termasuk relay
                skorRumah[rumah] = (skorRumah[rumah] || 0) + (parseInt(d.Mata) || 0);
            });

            // Papar Skor Rumah
            let htmlSkor = "";
            const sortedRumah = Object.keys(skorRumah).sort((a,b) => skorRumah[b] - skorRumah[a]);
            const warnaRumah = { 
                'Merah': 'bg-red-100 border-red-500', 
                'Biru': 'bg-blue-100 border-blue-500', 
                'Hijau': 'bg-green-100 border-green-500', 
                'Kuning': 'bg-yellow-100 border-yellow-500' 
            };

            sortedRumah.forEach((r, index) => {
                let colorClass = warnaRumah[r] || 'bg-gray-100 border-gray-500';
                htmlSkor += `<div class="p-4 shadow rounded text-center border-t-4 ${colorClass}">
                    <div class="text-xs text-gray-500 uppercase tracking-widest">No. ${index+1}</div>
                    <h4 class="font-bold text-xl mb-1">${r}</h4>
                    <p class="text-4xl font-extrabold text-gray-800">${skorRumah[r]}</p>
                    <span class="text-xs text-gray-500">mata</span>
                </div>`;
            });
            
            const divScore = document.getElementById('score-summary');
            if(divScore) divScore.innerHTML = htmlSkor;


            // =================================================
            // BAHAGIAN B: OLAHRAGAWAN (TOLAK RELAY / 4x)
            // =================================================
            let atlet = {};
            
            data.forEach(d => {
                // PENAPIS PENTING:
                // Jika nama acara ada perkataan '4x' atau 'Relay', JANGAN kira untuk individu
                if (d.Acara.toLowerCase().includes('4x') || d.Acara.toLowerCase().includes('relay')) {
                    return; 
                }

                if (!atlet[d.Nama]) {
                    atlet[d.Nama] = { 
                        Nama: d.Nama, 
                        Rumah: d.Rumah_Sukan, 
                        Kat: d.Kategori, 
                        E:0, P:0, G:0, R:0 
                    };
                }

                if (d.Catatan_Rekod === "REKOD BARU") atlet[d.Nama].R++;
                
                if (d.Kedudukan == 1) atlet[d.Nama].E++;
                else if (d.Kedudukan == 2) atlet[d.Nama].P++;
                else if (d.Kedudukan == 3) atlet[d.Nama].G++;
            });

            // Sistem Ranking: Rekod > Emas > Perak > Gangsa
            const kriteria = (a) => (a.R * 10000) + (a.E * 1000) + (a.P * 100) + (a.G * 10);
            let senaraiAtlet = Object.values(atlet).sort((a, b) => kriteria(b) - kriteria(a));
            
            // Fungsi paparan kad pemenang
            const renderKat = (katList, label) => {
                // Cari atlet paling atas YANG KATEGORINYA ADA DALAM LIST (katList)
                // Contoh: katList = ['L10', 'L11']. Dia akan cari atlet L10 atau L11 yang paling atas.
                const topAtlet = senaraiAtlet.find(a => katList.includes(a.Kat));
                
                let h = `<div class="mb-4 p-4 border rounded bg-gray-50 shadow-sm">
                            <h4 class="font-bold text-blue-800 border-b pb-2 mb-2 uppercase text-sm tracking-wide">${label}</h4>`;
                
                if(topAtlet) {
                    h += `<div class="flex justify-between items-center">
                            <div>
                                <p class="font-bold text-lg">${topAtlet.Nama}</p>
                                <p class="text-sm text-gray-600">${topAtlet.Rumah} | ${topAtlet.Kat}</p>
                            </div>
                            <div class="text-right text-sm">
                                ${topAtlet.R > 0 ? `<span class="block bg-purple-100 text-purple-800 px-2 py-1 rounded font-bold text-xs mb-1 animate-pulse">⭐ ${topAtlet.R} Rekod</span>` : ''}
                                <div class="space-x-1">
                                    <span class="inline-block bg-yellow-100 text-yellow-800 px-2 rounded font-bold border border-yellow-300">🥇${topAtlet.E}</span>
                                    <span class="inline-block bg-gray-200 text-gray-800 px-2 rounded font-bold border border-gray-400">🥈${topAtlet.P}</span>
                                    <span class="inline-block bg-orange-100 text-orange-800 px-2 rounded font-bold border border-orange-300">🥉${topAtlet.G}</span>
                                </div>
                            </div>
                          </div>`;
                } else {
                    h += `<p class="text-gray-400 text-sm italic py-2">Tiada pemenang atau data belum masuk.</p>`;
                }
                return h + `</div>`;
            };

            const divAtlet = document.getElementById('best-athletes-list');
            if(divAtlet) {
                // DI SINI KITA TETAPKAN KUMPULAN SECARA MANUAL
                // Pastikan ejaan 'L12', 'P12' dsb SAMA SEPERTI DALAM CSV ANDA
                
                divAtlet.innerHTML = 
                    renderKat(['L12'], "🏆 Olahragawan (12 Tahun)") +
                    renderKat(['P12'], "🏆 Olahragawati (12 Tahun)") +
                    // Gabungan L10 & L11
                    renderKat(['L10', 'L11'], "🌟 Olahragawan Harapan (10 & 11 Tahun)") +
                    // Gabungan P10 & P11
                    renderKat(['P10', 'P11'], "🌟 Olahragawati Harapan (10 & 11 Tahun)");
            }
        })
        .catch(err => console.error("Ralat Analisis:", err))
        .finally(() => toggleLoading(false));
}

// =========================================================
// 9. FUNGSI CETAKAN (VERSI FINAL & STABIL)
// =========================================================

// Fungsi Utama: Menguruskan paparan ke dalam print-container
function laksanaCetak(tajuk, contentInput) {
    const container = document.getElementById('print-container');
    const tarikh = new Date().toLocaleString('ms-MY', { hour12: true });

    if (!container) return alert("Ralat: <div id='print-container'> tiada dalam index.html");

    // 1. Bersihkan container dahulu
    container.innerHTML = '';

    // 2. Bina Header Laporan
    const headerDiv = document.createElement('div');
    headerDiv.className = "text-center mb-6 border-b-2 border-gray-800 pb-4";
    headerDiv.innerHTML = `
        <h1 class="text-2xl font-bold uppercase tracking-wider text-black">${tajuk}</h1>
        <p class="text-sm text-gray-600">Tarikh Cetakan: ${tarikh}</p>
    `;
    container.appendChild(headerDiv);

    // 3. Masukkan Kandungan (Boleh terima String atau HTML Element)
    const contentWrapper = document.createElement('div');
    contentWrapper.className = "w-full text-black font-sans";

    if (typeof contentInput === 'string') {
        contentWrapper.innerHTML = contentInput;
    } else {
        contentWrapper.appendChild(contentInput);
    }

    container.appendChild(contentWrapper);

    // 4. Proses Cetakan
    // Beri masa sedikit untuk browser render CSS sebelum dialog print keluar
    setTimeout(() => {
        window.print();
        
        // (Opsional) Kosongkan semula selepas 2 saat untuk kebersihan memori
        setTimeout(() => { container.innerHTML = ''; }, 2000);
    }, 500);
}

// A. Cetak Senarai Peserta (Versi Gabung Acara & Unik)
function cetakSenaraiPeserta() {
    if (!dbPeserta || dbPeserta.length === 0) {
        return alert("Tiada data peserta untuk dicetak.");
    }

    // 1. Kumpulkan data unik & gabungkan acara
    const kelompokRumah = {};

    dbPeserta.forEach(p => {
        let rumah = p.Rumah_Sukan ? p.Rumah_Sukan.trim().toUpperCase() : "TIADA RUMAH";
        let bib = p.No_Bib ? p.No_Bib.trim() : "TIADA-BIB";
        
        if (!kelompokRumah[rumah]) kelompokRumah[rumah] = {};
        
        if (!kelompokRumah[rumah][bib]) {
            // Jika peserta belum ada, cipta entri baru
            kelompokRumah[rumah][bib] = {
                Nama: p.Nama,
                No_Bib: bib,
                Kategori: p.Kategori || "-",
                SenaraiAcara: []
            };
        }

        // Masukkan acara ke dalam array jika belum ada dalam senarai
        if (p.Acara && !kelompokRumah[rumah][bib].SenaraiAcara.includes(p.Acara)) {
            kelompokRumah[rumah][bib].SenaraiAcara.push(p.Acara.trim());
        }
    });

    let htmlKandungan = "";
    const senaraiRumah = Object.keys(kelompokRumah).sort();

    senaraiRumah.forEach((rumah, idx) => {
        const pageBreakClass = idx === 0 ? "" : "style='page-break-before: always; padding-top: 20px;'";
        const ahliRumah = Object.values(kelompokRumah[rumah]);

        htmlKandungan += `
            <div ${pageBreakClass} class="w-full">
                <div class="text-center mb-6">
                    <h2 class="text-2xl font-bold border-2 border-black inline-block px-6 py-1 uppercase">
                        RUMAH: ${rumah}
                    </h2>
                    <p class="text-sm mt-1">Jumlah Peserta: ${ahliRumah.length}</p>
                </div>

                <table class="w-full border-collapse border-2 border-black text-[11px] mb-10">
                    <thead>
                        <tr class="bg-gray-200">
                            <th class="border border-black p-2 w-10">No</th>
                            <th class="border border-black p-2 w-20">No. Bib</th>
                            <th class="border border-black p-2 text-left w-48">Nama Peserta</th>
                            <th class="border border-black p-2 w-16">Kat</th>
                            <th class="border border-black p-2 text-left">Acara Diambil</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Susun nama ikut abjad
        ahliRumah.sort((a, b) => a.Nama.localeCompare(b.Nama));

        ahliRumah.forEach((p, index) => {
            // Gabungkan array acara menjadi string dipisahkan koma
            const acaraString = p.SenaraiAcara.join(", ");

            htmlKandungan += `
                <tr class="break-inside-avoid">
                    <td class="border border-black p-1 text-center">${index + 1}</td>
                    <td class="border border-black p-1 text-center font-bold font-mono">${p.No_Bib}</td>
                    <td class="border border-black p-1 uppercase font-semibold">${p.Nama}</td>
                    <td class="border border-black p-1 text-center">${p.Kategori}</td>
                    <td class="border border-black p-1 italic">${acaraString}</td>
                </tr>
            `;
        });

        htmlKandungan += `
                    </tbody>
                </table>
            </div>
        `;
    });

    laksanaCetak("SENARAI PESERTA MENGIKUT RUMAH SUKAN", htmlKandungan);
}

// B. Cetak Keputusan Penuh (Diselaraskan dengan let dbKeputusan)
function cetakKeputusanPenuh() {
    // Gunakan dbKeputusan (tanpa garis bawah) sesuai dengan isytihar let anda
    const dataSumber = (typeof dbKeputusan !== 'undefined') ? dbKeputusan : [];

    if (dataSumber.length === 0) {
        return alert("Data keputusan belum dimuatkan atau kosong. Sila tunggu sebentar atau pastikan data wujud di tab db_keputusan.");
    }

    const kelompokBesar = {};

    dataSumber.forEach(row => {
        // Guna nama kolum ikut Sheet anda (biasanya huruf besar di depan)
        const acara = (row.Acara || row.Acara_Sukan || "ACARA").trim().toUpperCase();
        const kategori = (row.Kategori || "UMUM").trim().toUpperCase();
        
        let jantina = "LAIN-LAIN";
        if (row.Jantina) {
            jantina = row.Jantina.trim().toUpperCase();
        } else if (kategori.startsWith('L')) {
            jantina = "LELAKI";
        } else if (kategori.startsWith('P')) {
            jantina = "PEREMPUAN";
        }

        const kunciMukaSurat = `${acara} (${jantina})`;

        if (!kelompokBesar[kunciMukaSurat]) {
            kelompokBesar[kunciMukaSurat] = {};
        }

        if (!kelompokBesar[kunciMukaSurat][kategori]) {
            kelompokBesar[kunciMukaSurat][kategori] = [];
        }

        kelompokBesar[kunciMukaSurat][kategori].push(row);
    });

    let htmlKandungan = "";
    const senaraiKunciMukaSurat = Object.keys(kelompokBesar).sort();

    senaraiKunciMukaSurat.forEach((tajukMukaSurat, idx) => {
        const pageBreak = idx === 0 ? "" : "style='page-break-before: always; padding-top: 20px;'";
        
        htmlKandungan += `
            <div ${pageBreak} class="w-full">
                <div class="text-center mb-8">
                    <h1 class="text-2xl font-bold border-2 border-black bg-gray-50 inline-block px-10 py-2 uppercase">
                        ${tajukMukaSurat}
                    </h1>
                </div>
        `;

        const senaraiKategori = Object.keys(kelompokBesar[tajukMukaSurat]).sort();

        senaraiKategori.forEach(kat => {
            const dataPemenang = kelompokBesar[tajukMukaSurat][kat];
            const susunan = { "Johan": 1, "Naib Johan": 2, "Ketiga": 3, "Ke-4": 4, "1": 1, "2": 2, "3": 3 };
            dataPemenang.sort((a, b) => (susunan[a.Kedudukan] || 99) - (susunan[b.Kedudukan] || 99));

            htmlKandungan += `
                <div class="mb-10 avoid-page-break">
                    <h2 class="text-lg font-bold mb-2 bg-black text-white px-4 py-1 inline-block uppercase">
                        KATEGORI: ${kat}
                    </h2>
                    <table class="w-full border-collapse border-2 border-black text-sm">
                        <thead>
                            <tr class="bg-gray-200">
                                <th class="border border-black p-2 w-24">KEDUDUKAN</th>
                                <th class="border border-black p-2 text-left">NAMA PEMENANG</th>
                                <th class="border border-black p-2 w-32">RUMAH</th>
                                <th class="border border-black p-2 w-20">MATA</th>
                            </tr>
                        </thead>
                        // Gantikan bahagian loop data dalam jadual cetakan anda:
<tbody>
    ${dataPemenang.map(p => {
        // 1. Ambil data keputusan/masa (Contoh: 12.11)
        const hasilKeputusan = p.Keputusan || p.Masa || "";
        
        // 2. Kenalpasti Rekod Baru (Cek kolum 'Rekod' atau 'Catatan')
        // Berdasarkan gambar anda, sistem menggunakan teks "(Rekod Baru)"
        const statusRekod = p.Rekod || p.Catatan_Rekod || "";
        const isRB = statusRekod.toUpperCase().includes("REKOD") || statusRekod.toUpperCase().includes("RB");

        return `
        <tr>
            <td class="border border-black p-2 text-center font-bold">${p.Kedudukan || p.Rank || '-'}</td>
            <td class="border border-black p-2 uppercase font-semibold">
                ${p.Nama || '-'}
                ${isRB ? `<br><span class="text-[10px] text-red-600 font-bold italic">[ REKOD BARU ]</span>` : ''}
            </td>
            <td class="border border-black p-2 text-center">${p.Rumah_Sukan || p.Rumah || '-'}</td>
            <td class="border border-black p-2 text-center font-mono">
                ${hasilKeputusan} 
                <div class="text-[9px] text-gray-500">${p.Mata ? `(${p.Mata} Mata)` : ''}</div>
            </td>
            <td class="border border-black p-2 italic text-xs">${statusRekod}</td>
        </tr>
        `;
    }).join('')}
</tbody>
                    </table>
                </div>
            `;
        });
        htmlKandungan += `</div>`; 
    });

    laksanaCetak("REKOD KEPUTUSAN RASMI KEJOHANAN", htmlKandungan);
}

// C. Cetak Analisis (Versi FIX: Senarai Penuh Tanpa Potong)
function cetakAnalisis() {
    const scoreDiv = document.getElementById('score-summary');
    const atletList = document.getElementById('best-athletes-list');

    // Semak jika data kosong
    if (!scoreDiv || scoreDiv.innerHTML.trim() === "") {
        return alert("Data analisis kosong. Sila klik tab 'Analisis & Pemenang' dahulu.");
    }

    // Ambil parent (kotak putih)
    const atletContainer = atletList.parentElement;

    // --- BINA BEKAS GABUNGAN ---
    const wrapper = document.createElement('div');

    // 1. BAHAGIAN MARKAH
    const h2Score = document.createElement('h2');
    h2Score.className = "text-xl font-bold mb-4 uppercase border-b border-gray-400 pb-1 mt-2";
    h2Score.innerText = "1. PUNGUTAN MATA RUMAH SUKAN";
    wrapper.appendChild(h2Score);

    const cloneScore = scoreDiv.cloneNode(true);
    cloneScore.classList.remove('hidden');
    cloneScore.style.display = 'grid';
    // Paksa grid 4 column supaya tak jadi memanjang ke bawah sangat
    cloneScore.className = "grid grid-cols-4 gap-4 mb-8 text-center"; 
    wrapper.appendChild(cloneScore);

    // Spacer
    const spacer = document.createElement('div');
    spacer.className = "my-8 border-t border-dashed border-gray-300";
    wrapper.appendChild(spacer);

    // 2. BAHAGIAN OLAHRAGAWAN
    const h2Atlet = document.createElement('h2');
    h2Atlet.className = "text-xl font-bold mb-4 uppercase border-b border-gray-400 pb-1";
    h2Atlet.innerText = "2. SENARAI OLAHRAGAWAN";
    wrapper.appendChild(h2Atlet);

    // Klon struktur asal
    const cloneAtletParent = atletContainer.cloneNode(true);
    
    // --- LANGKAH PENTING: BUANG SCROLLBAR ---
    // Cari elemen senarai di dalam klon itu
    const scrollableList = cloneAtletParent.querySelector('#best-athletes-list');
    
    if (scrollableList) {
        // Buang class yang menyekat ketinggian (Tailwind classes)
        scrollableList.classList.remove('max-h-[500px]', 'overflow-y-auto');
        
        // Paksa gaya CSS manual supaya ia memanjang ke bawah
        scrollableList.style.maxHeight = 'none';
        scrollableList.style.overflow = 'visible';
        scrollableList.style.height = 'auto';
    }

    // Pastikan font hitam dan jelas
    cloneAtletParent.style.color = 'black';
    cloneAtletParent.classList.remove('shadow'); // Buang shadow kotak supaya clean sikit bila print
    
    wrapper.appendChild(cloneAtletParent);

    // Hantar wrapper yang dah siap ke fungsi cetak
    laksanaCetak("LAPORAN ANALISIS KEJOHANAN", wrapper);
}

// D. Cetak Borang Acara
function cetakBorangSemasa() {
    const div = document.getElementById('borang-preview'); // Pastikan ID ini betul di HTML
    if(!div) return alert("Sila jana borang dahulu.");

    // Klon untuk buang butang 'Simpan' dan 'Cetak' agar tidak masuk kertas
    const clone = div.cloneNode(true);
    const buttons = clone.querySelectorAll('button');
    buttons.forEach(b => b.remove());

    laksanaCetak("BORANG KEPUTUSAN HAKIM", clone);

}
