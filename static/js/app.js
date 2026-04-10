// ───────────────────────────────────────────────────────────────
// PIHPS Dashboard — App.js
// ───────────────────────────────────────────────────────────────

// ── State ────────────────────────────────────────────────────────
let kabkotaTags = [];
let komoditasList = [];
let currentJobId = null;
let pollTimer = null;
let lastLogCount = 0;

// Data shape validators
const EXPECTED_SHAPES = new Map();

// ── Initialize ───────────────────────────────────────────────────
async function init() {
  setupTabNavigation();
  await loadProvinsi();
  await loadKomoditas();
  loadStorageList();
  loadDashboard();
  loadDashboardFileSelector();
}

// ── TAB NAVIGATION ───────────────────────────────────────────────
function setupTabNavigation() {
  document.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Remove active from all sidebar items
  document.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.classList.remove('active', 'text-primary');
    btn.classList.add('text-gray-500');
  });

  // Show selected tab
  const tabElement = document.getElementById(`${tabName}-tab`);
  if (tabElement) {
    tabElement.classList.add('active');
  }

  // Activate sidebar item
  const btnElement = document.querySelector(`.sidebar-item[data-tab="${tabName}"]`);
  if (btnElement) {
    btnElement.classList.remove('text-gray-500');
    btnElement.classList.add('active', 'text-primary');
  }

  // Reload data jika diperlukan
  if (tabName === 'storage') {
    loadStorageList();
  } else if (tabName === 'dashboard') {
    loadDashboard();
    loadDashboardFileSelector();
  }
}

// ── FORM: PROVINSI ───────────────────────────────────────────────
async function loadProvinsi() {
  const select = document.getElementById('provinsi');
  select.innerHTML = '<option value="">— Pilih Provinsi —</option>';

  try {
    const res = await fetch('/api/ref/provinsi');
    const data = await res.json();

    if (Array.isArray(data)) {
      data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;  // Use numeric ID instead of name
        opt.textContent = p.name;
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.error('Error loading provinsi:', e);
  }
}

// ── FORM: KOMODITAS ──────────────────────────────────────────────
async function loadKomoditas() {
  const grid = document.getElementById('kom-grid');
  grid.innerHTML = '<div class="text-xs text-gray-500 text-center py-4">Memuat komoditas...</div>';

  try {
    const res = await fetch('/api/ref/komoditas');
    komoditasList = await res.json();

    if (!Array.isArray(komoditasList)) {
      komoditasList = [];
    }

    renderKomoditasGrid();
    updateKomCount();
  } catch (e) {
    console.error('Error loading komoditas:', e);
    grid.innerHTML = '<div class="text-xs text-danger text-center py-4">Error memuat komoditas</div>';
  }
}

function renderKomoditasGrid() {
  const grid = document.getElementById('kom-grid');
  grid.innerHTML = '';

  komoditasList.forEach((k, idx) => {
    const item = document.createElement('div');
    item.className = 'kom-item flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-dark-600 transition-colors';
    item.innerHTML = `
      <div class="kom-check w-4 h-4 rounded border border-dark-500 flex items-center justify-center transition-all"></div>
      <input type="hidden" value="${k.name}" />
      <label class="kom-label text-xs text-gray-300 cursor-pointer flex-1" onclick="toggleKom(${idx})">${k.name}</label>
    `;
    item.onclick = () => toggleKom(idx);
    grid.appendChild(item);
  });
}

function toggleKom(idx) {
  const items = document.querySelectorAll('#kom-grid .kom-item');
  const item = items[idx];
  const check = item.querySelector('.kom-check');
  
  if (item.classList.contains('checked')) {
    item.classList.remove('checked');
    check.classList.remove('bg-primary', 'border-primary');
    check.classList.add('border-dark-500');
    check.innerHTML = '';
  } else {
    item.classList.add('checked');
    check.classList.remove('border-dark-500');
    check.classList.add('bg-primary', 'border-primary');
    check.innerHTML = '<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>';
  }
  updateKomCount();
}

function setKomChecked(el, checked) {
  const check = el.querySelector('.kom-check');
  if (checked) {
    el.classList.add('checked');
    check.classList.remove('border-dark-500');
    check.classList.add('bg-primary', 'border-primary');
    check.innerHTML = '<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>';
  } else {
    el.classList.remove('checked');
    check.classList.remove('bg-primary', 'border-primary');
    check.classList.add('border-dark-500');
    check.innerHTML = '';
  }
}

function selectAllKom() {
  document.querySelectorAll('#kom-grid .kom-item').forEach(el => {
    setKomChecked(el, true);
  });
  updateKomCount();
}

function selectBeras() {
  document.querySelectorAll('#kom-grid .kom-item').forEach(el => {
    const name = el.querySelector('input').value || '';
    setKomChecked(el, name.toLowerCase().includes('beras'));
  });
  updateKomCount();
}

function selectDagingTelur() {
  document.querySelectorAll('#kom-grid .kom-item').forEach(el => {
    const name = el.querySelector('input').value || '';
    const isDaging = name.toLowerCase().includes('daging');
    const isTelur = name.toLowerCase().includes('telur');
    setKomChecked(el, isDaging || isTelur);
  });
  updateKomCount();
}

function clearAllKom() {
  document.querySelectorAll('#kom-grid .kom-item').forEach(el => {
    setKomChecked(el, false);
  });
  updateKomCount();
}

function updateKomCount() {
  const total = komoditasList.length;
  const checked = document.querySelectorAll('#kom-grid .kom-item.checked').length;
  document.getElementById('kom-count').textContent = checked;
  document.getElementById('kom-total').textContent = total;
}

// ── FORM: REKOMENDASI KAB/KOTA ───────────────────────────────────
async function showRecommendedRegencies(provinceId) {
  if (!provinceId) {
    document.getElementById('recommendation-area').classList.add('hidden');
    kabkotaTags = [];
    document.querySelectorAll('#kabkota-container .tag').forEach(el => el.remove());
    return;
  }

  try {
    const res = await fetch(`/api/recommend/regency/${provinceId}`);
    const data = await res.json();
    const recommendations = data.recommendations || [];

    if (recommendations.length > 0) {
      const area = document.getElementById('recommendation-area');
      const chips = document.getElementById('recommendation-chips');
      chips.innerHTML = '';

      recommendations.forEach(rec => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'px-2 py-0.5 bg-dark-600 hover:bg-primary/20 text-primary text-[10px] font-medium rounded transition-colors';
        chip.textContent = rec;
        chip.onclick = (e) => {
          e.preventDefault();
          addTag(rec);
        };
        chips.appendChild(chip);
      });

      area.classList.remove('hidden');
    } else {
      document.getElementById('recommendation-area').classList.add('hidden');
    }
  } catch (e) {
    console.error('Error fetching recommendations:', e);
  }
}

// ── FORM: KAB/KOTA TAGS ──────────────────────────────────────────
function addTag(value) {
  if (kabkotaTags.includes(value)) return;

  kabkotaTags.push(value);

  const container = document.getElementById('kabkota-container');
  const tag = document.createElement('div');
  tag.className = 'tag flex items-center gap-1 bg-primary/20 border border-primary/30 text-primary px-2 py-0.5 rounded text-xs inline-flex';
  tag.innerHTML = `
    <span class="font-medium">${value}</span>
    <span class="tag-remove cursor-pointer hover:text-danger font-bold ml-0.5 transition-colors" onclick="removeTag(this, '${value}')">×</span>
  `;
  container.insertBefore(tag, container.lastElementChild);
}

function removeTag(el, val) {
  el.closest('.tag').remove();
  kabkotaTags = kabkotaTags.filter(t => t !== val);
  event.stopPropagation();
}

function handleKabkotaInput(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const v = e.target.value.trim();
    if (v) {
      addTag(v);
      e.target.value = '';
    }
  }
  if (e.key === 'Backspace' && !e.target.value) {
    const tags = document.querySelectorAll('#kabkota-container .tag');
    if (tags.length) {
      const last = tags[tags.length - 1];
      const txt = last.childNodes[0].textContent.trim();
      kabkotaTags = kabkotaTags.filter(t => t !== txt);
      last.remove();
    }
  }
}


// ── SCRAPING ─────────────────────────────────────────────────────
function getSelectedKomoditas() {
  return [...document.querySelectorAll('#kom-grid .kom-item.checked')]
    .map(el => el.querySelector('input').value);
}

async function startScraping() {
  const selected = getSelectedKomoditas();
  if (!selected.length) {
    alert('Pilih minimal satu komoditas!');
    return;
  }

  // Capture initial shape
  const tglMulai = document.getElementById('tgl-mulai').value;
  const tglSelesai = document.getElementById('tgl-selesai').value;
  const provinsi = document.getElementById('provinsi').value;

  const payload = {
    tanggal_mulai: tglMulai,
    tanggal_selesai: tglSelesai,
    provinsi: provinsi,
    kabkota_target: kabkotaTags,
    tipe_laporan: document.getElementById('tipe-laporan').value,
    komoditas_filter: selected,
  };

  resetUI();
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-cancel').classList.remove('hidden');
  setStatus('running', 'Menginisialisasi...');

  try {
    const res = await fetch('/api/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    currentJobId = data.job_id;

    // Store initial shape info
    EXPECTED_SHAPES.set(currentJobId, {
      provinsi: provinsi,
      period: `${tglMulai}_to_${tglSelesai}`,
      komoditas: selected,
      komoditasCount: selected.length,
      startTime: new Date().toISOString(),
    });

    lastLogCount = 0;
    pollTimer = setInterval(pollStatus, 1200);
  } catch (e) {
    setStatus('error', 'Error: ' + e.message);
    document.getElementById('btn-start').disabled = false;
  }
}

async function cancelScraping() {
  if (!currentJobId) return;
  if (!confirm('Batalkan scraping?')) return;
  await fetch(`/api/cancel/${currentJobId}`, { method: 'POST' });
}

async function pollStatus() {
  if (!currentJobId) return;

  try {
    const res = await fetch(`/api/status/${currentJobId}`);
    const d = await res.json();

    // Append new logs
    d.logs.slice(lastLogCount).forEach(appendLog);
    lastLogCount = d.logs.length;

    // Progress
    if (d.total > 0) {
      const pct = Math.round((d.current / d.total) * 100);
      document.getElementById('prog-bar').style.width = pct + '%';
      document.getElementById('prog-label').textContent = `${d.current} / ${d.total} komoditas (${pct}%)`;
      document.getElementById('progress-meta').textContent = pct + '%';
    }
    if (d.current_komoditas) {
      document.getElementById('current-kom').classList.remove('hidden');
      document.getElementById('kom-name').textContent = d.current_komoditas;
    }
    if (d.status === 'running') {
      setStatus('running', 'Scraping berlangsung...');
    }

    if (d.status === 'done' || d.status === 'done_empty') {
      clearInterval(pollTimer);
      setStatus('done', 'Selesai!');
      document.getElementById('btn-start').disabled = false;
      document.getElementById('btn-cancel').classList.add('hidden');
      document.getElementById('current-kom').classList.add('hidden');
      document.getElementById('prog-bar').style.width = '100%';
      document.getElementById('stats-row').classList.remove('hidden');
      document.getElementById('stats-row').classList.add('grid');
      document.getElementById('stat-berhasil').textContent = d.berhasil;
      document.getElementById('stat-gagal').textContent = d.gagal.length;
      document.getElementById('stat-rows').textContent = d.total_rows;

      if (d.total_rows > 0) {
        document.getElementById('download-filename').textContent = d.filename;
        document.getElementById('download-section').classList.remove('hidden');
        renderPreview(d.df_columns, d.df_preview);
        renderKomStats(d.df_stats);

        // Validate shape
        validateDataShape(currentJobId, d.df_columns, d.df_preview);
      }
    }
    if (d.status === 'error') {
      clearInterval(pollTimer);
      setStatus('error', 'Error: ' + d.error);
      document.getElementById('btn-start').disabled = false;
      document.getElementById('btn-cancel').classList.add('hidden');
    }
  } catch (e) {
    console.error('Poll error:', e);
  }
}

// ── DATA SHAPE VALIDATION ────────────────────────────────────────
function validateDataShape(jobId, columns, preview) {
  const shapeInfo = EXPECTED_SHAPES.get(jobId);
  if (!shapeInfo) return;

  const validation = {
    jobId: jobId,
    timestamp: new Date().toISOString(),
    expectedColumns: ['Komoditas', 'pasar_id', 'pasar_nama', 'price', 'tgl', 'tipe'],
    actualColumns: columns,
    columnMatch: true,
    rowCount: preview.length,
    issues: [],
  };

  // Check columns
  shapeInfo.expectedColumns = columns;

  if (!columns.includes('Komoditas')) {
    validation.issues.push('Missing "Komoditas" column');
    validation.columnMatch = false;
  }

  if (preview.length === 0) {
    validation.issues.push('No data rows in preview');
  }

  // Store validation
  shapeInfo.validation = validation;
  EXPECTED_SHAPES.set(jobId, shapeInfo);

  console.log('✅ Data Shape Validation:', validation);
}

// ── DOWNLOAD ─────────────────────────────────────────────────────
function downloadFile() {
  if (currentJobId) {
    window.location.href = `/api/download/${currentJobId}`;
  }
}

// ── SAVE TO STORAGE ──────────────────────────────────────────────
async function saveJobToStorage() {
  if (!currentJobId) {
    alert('Tidak ada data untuk disimpan');
    return;
  }
  
  try {
    const res = await fetch(`/api/jobs/${currentJobId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await res.json();
    
    if (data.ok) {
      // Show success notification
      const btn = document.querySelector('button[onclick="saveJobToStorage()"]');
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i><span>Tersimpan!</span>';
      btn.classList.add('bg-success-light');
      
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('bg-success-light');
      }, 2000);
      
      // Reload storage list if on storage tab
      loadStorageList();
    } else {
      alert('Gagal menyimpan: ' + (data.error || 'Unknown error'));
    }
  } catch (e) {
    console.error('Error saving to storage:', e);
    alert('Gagal menyimpan data');
  }
}

// ── UI HELPERS ───────────────────────────────────────────────────
function setStatus(state, text) {
  const dot = document.getElementById('status-dot');
  dot.className = 'w-2.5 h-2.5 rounded-full status-dot';
  
  if (state === 'running') {
    dot.classList.add('bg-primary', 'running');
  } else if (state === 'done') {
    dot.classList.add('bg-success');
  } else if (state === 'error') {
    dot.classList.add('bg-danger');
  } else {
    dot.classList.add('bg-gray-600');
  }
  
  document.getElementById('status-text').textContent = text;
}

function appendLog(msg) {
  const box = document.getElementById('log-box');
  const div = document.createElement('div');
  
  if (msg.includes('✅') || msg.includes('🏁') || msg.includes('💾'))
    div.className = 'text-xs text-success';
  else if (msg.includes('❌') || msg.includes('Fatal') || msg.includes('Error'))
    div.className = 'text-xs text-danger';
  else if (msg.includes('⚠️')) 
    div.className = 'text-xs text-warning';
  else if (
    msg.includes('🚀') ||
    msg.includes('📡') ||
    msg.includes('📅') ||
    msg.includes('🏙️')
  )
    div.className = 'text-xs text-primary';
  else 
    div.className = 'text-xs text-gray-500';
    
  div.textContent = msg;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function resetUI() {
  document.getElementById('log-box').innerHTML = '';
  document.getElementById('prog-bar').style.width = '0%';
  document.getElementById('prog-label').textContent = '—';
  document.getElementById('progress-meta').textContent = '';
  document.getElementById('stats-row').classList.add('hidden');
  document.getElementById('download-section').classList.add('hidden');
  document.getElementById('preview-area').innerHTML = `
    <div class="flex items-center justify-center h-full text-gray-500">
      <div class="text-center">
        <div class="text-5xl mb-4 opacity-50">📊</div>
        <p class="text-sm">Data hasil scraping akan tampil di sini</p>
        <p class="text-xs mt-2 text-gray-600">Mulai scraping untuk melihat preview</p>
      </div>
    </div>
  `;
  
  const currentKom = document.getElementById('current-kom');
  if (currentKom) currentKom.classList.add('hidden');
  
  setStatus('ready', 'Siap');
  lastLogCount = 0;
}

function renderPreview(cols, rows) {
  if (!rows.length) return;
  const thead = cols.map(c => `<th class="px-4 py-3 text-xs font-medium text-gray-500 uppercase bg-dark-700 border-b border-dark-600 sticky top-0 z-10">${c}</th>`).join('');
  const tbody = rows
    .map(
      row =>
        `<tr class="hover:bg-dark-600/50 transition-colors border-b border-dark-700">${cols
          .map(c => `<td class="px-4 py-2.5 text-sm text-gray-300">${row[c] ?? ''}</td>`)
          .join('')}</tr>`
    )
    .join('');
  document.getElementById('preview-area').innerHTML = `
    <table class="w-full text-left whitespace-nowrap"><thead><tr>${thead}</tr></thead><tbody class="divide-y divide-dark-700">${tbody}</tbody></table>`;
}

function renderKomStats(stats) {
  // Stats komoditas tidak ditampilkan di UI baru
  // Function kept for compatibility
  return;
}

// ── STORAGE TAB ──────────────────────────────────────────────────
async function loadStorageList() {
  try {
    const res = await fetch('/api/storage/list');
    const data = await res.json();

    const list = document.getElementById('storage-list');
    if (!data || data.length === 0) {
      list.innerHTML = `
        <div class="flex items-center justify-center h-full text-gray-500">
          <div class="text-center">
            <div class="text-5xl mb-4 opacity-50">📭</div>
            <p class="text-sm">Tidak ada data tersimpan</p>
          </div>
        </div>
      `;
      return;
    }

    list.innerHTML = data
      .map(
        item => `
      <div class="glass rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-hover transition-all">
        <div class="font-semibold text-white truncate w-full md:max-w-md" title="${item.name}">${item.name}</div>
        <div class="flex flex-wrap gap-2 text-xs">
          <div class="flex items-center gap-1 bg-dark-600 px-2 py-1 rounded-full text-gray-400">
            <i class="fas fa-table text-[10px]"></i> ${item.rows} baris
          </div>
          <div class="flex items-center gap-1 bg-dark-600 px-2 py-1 rounded-full text-gray-400">
            <i class="fas fa-calendar text-[10px]"></i> ${new Date(item.timestamp).toLocaleDateString('id-ID')}
          </div>
          <div class="flex items-center gap-1 bg-dark-600 px-2 py-1 rounded-full text-gray-400">
            <i class="fas fa-layer-group text-[10px]"></i> ${item.komoditas_count}
          </div>
        </div>
        <div class="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
          <button onclick="previewStorage('${item.id}')" class="flex-1 md:flex-none px-4 py-2 bg-success/10 hover:bg-success/20 text-success text-xs font-medium rounded-lg transition-colors flex items-center gap-2">
            <i class="fas fa-eye"></i> Preview
          </button>
          <button onclick="downloadStorage('${item.id}')" class="flex-1 md:flex-none px-4 py-2 bg-primary hover:bg-primary-light text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2">
            <i class="fas fa-download"></i> Download
          </button>
          <button onclick="deleteStorage('${item.id}')" class="flex-1 md:flex-none px-4 py-2 bg-danger/10 hover:bg-danger/20 text-danger text-xs font-medium rounded-lg transition-colors flex items-center gap-2">
            <i class="fas fa-trash"></i> Hapus
          </button>
        </div>
      </div>
    `
      )
      .join('');
  } catch (e) {
    console.error('Error loading storage:', e);
  }
}

async function downloadStorage(id) {
  window.location.href = `/api/storage/download/${id}`;
}

async function deleteStorage(id) {
  if (!confirm('Hapus file ini?')) return;
  try {
    await fetch(`/api/storage/delete/${id}`, { method: 'POST' });
    loadStorageList();
  } catch (e) {
    console.error('Error deleting storage:', e);
  }
}

function clearAllStorage() {
  if (!confirm('Hapus SEMUA data tersimpan?')) return;
  fetch('/api/storage/clear', { method: 'POST' })
    .then(() => loadStorageList())
    .catch(e => console.error('Error clearing storage:', e));
}

// ── STORAGE PREVIEW ─────────────────────────────────────────────
async function previewStorage(fileId) {
  // Show popup
  document.getElementById('storage-preview-popup').classList.remove('hidden');
  
  // Reset content
  document.getElementById('storage-preview-table').innerHTML = `
    <div class="flex items-center justify-center h-full text-gray-500">
      <div class="text-center">
        <i class="fas fa-spinner fa-spin text-3xl mb-4 text-primary"></i>
        <p class="text-sm">Memuat data...</p>
      </div>
    </div>
  `;
  
  try {
    const res = await fetch(`/api/storage/preview/${fileId}`);
    const data = await res.json();
    
    if (data.error) {
      document.getElementById('storage-preview-table').innerHTML = `
        <div class="flex items-center justify-center h-full text-gray-500">
          <div class="text-center">
            <i class="fas fa-exclamation-triangle text-3xl mb-4 text-danger"></i>
            <p class="text-sm">${data.error}</p>
          </div>
        </div>
      `;
      return;
    }
    
    // Update header info
    document.getElementById('storage-preview-filename').textContent = data.filename;
    document.getElementById('storage-preview-rows').textContent = `${data.total_rows} baris`;
    
    // Render table
    renderStoragePreviewTable(data.columns, data.preview);
    
  } catch (e) {
    document.getElementById('storage-preview-table').innerHTML = `
      <div class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <i class="fas fa-exclamation-triangle text-3xl mb-4 text-danger"></i>
          <p class="text-sm">Gagal memuat data</p>
        </div>
      </div>
    `;
    console.error('Error loading preview:', e);
  }
}

function renderStoragePreviewTable(cols, rows) {
  if (!rows || !rows.length) {
    document.getElementById('storage-preview-table').innerHTML = `
      <div class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <p class="text-sm">Tidak ada data</p>
        </div>
      </div>
    `;
    return;
  }
  
  const thead = cols.map(c => 
    `<th class="px-4 py-3 text-xs font-medium text-gray-400 uppercase bg-dark-700 border-b border-dark-600 sticky top-0 z-10 whitespace-nowrap">${escapeHtml(c)}</th>`
  ).join('');
  
  const tbody = rows.map(row => 
    `<tr class="hover:bg-dark-600/30 transition-colors border-b border-dark-700/50">${cols.map(c => 
      `<td class="px-4 py-2 text-sm text-gray-300 whitespace-nowrap">${escapeHtml(String(row[c] ?? ''))}</td>`
    ).join('')}</tr>`
  ).join('');
  
  document.getElementById('storage-preview-table').innerHTML = `
    <table class="w-full text-left">
      <thead class="sticky top-0 z-10">
        <tr>${thead}</tr>
      </thead>
      <tbody>${tbody}</tbody>
    </table>
  `;
}

function closeStoragePreview() {
  document.getElementById('storage-preview-popup').classList.add('hidden');
}

// Close on backdrop click
document.addEventListener('click', (e) => {
  const popup = document.getElementById('storage-preview-popup');
  if (popup && !popup.classList.contains('hidden') && e.target === popup) {
    closeStoragePreview();
  }
});

// ── DASHBOARD TAB ────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard/stats');
    const stats = await res.json();

    // Only update if elements exist (old dashboard stats - now optional)
    const dashTotal = document.getElementById('dash-total');
    const dashRows = document.getElementById('dash-rows');
    const dashFiles = document.getElementById('dash-files');
    
    if (dashTotal) dashTotal.textContent = stats.total_jobs || 0;
    if (dashRows) dashRows.textContent = stats.total_rows || 0;
    if (dashFiles) dashFiles.textContent = stats.total_files || 0;

    // Activity list (optional - only if element exists)
    const activityList = document.getElementById('activity-list');
    if (activityList) {
      const activityHtml =
        stats.recent_jobs && stats.recent_jobs.length > 0
          ? stats.recent_jobs
              .slice(0, 5)
              .map(
                job => `
            <div class="flex justify-between items-center p-3 glass rounded-lg glass-hover transition-all">
              <div class="font-medium text-gray-300 flex items-center gap-2"><i class="fas fa-map-marker-alt text-primary text-xs"></i> ${job.provinsi}</div>
              <div class="text-xs text-gray-500 bg-dark-600 px-2 py-1 rounded">${new Date(job.timestamp).toLocaleDateString('id-ID')}</div>
            </div>
          `
              )
              .join('')
          : '<div class="flex items-center justify-center h-full text-gray-500"><div class="text-center"><div class="text-4xl mb-3 opacity-50">📭</div><p class="text-sm">Belum ada aktivitas</p></div></div>';
      activityList.innerHTML = activityHtml;
    }

    // Popular komoditas (optional)
    const popularKom = document.getElementById('popular-kom');
    if (popularKom) {
      const komHtml =
        stats.popular_komoditas && stats.popular_komoditas.length > 0
          ? stats.popular_komoditas
              .slice(0, 5)
              .map(
                (k, i) => `
            <div class="flex items-center justify-between p-3 glass rounded-lg">
              <div class="flex items-center gap-3">
                <div class="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">${i + 1}</div>
                <span class="font-medium text-gray-300">${k.name}</span>
              </div>
              <div class="text-xs text-gray-500">${k.count}x scrape</div>
            </div>
          `
              )
              .join('')
          : '<div class="flex items-center justify-center h-full text-gray-500"><div class="text-center"><div class="text-4xl mb-3 opacity-50">📭</div><p class="text-sm">Data belum tersedia</p></div></div>';
      popularKom.innerHTML = komHtml;
    }

    // Popular provinsi (optional)
    const popularProv = document.getElementById('popular-prov');
    if (popularProv) {
      const provHtml =
        stats.popular_provinsi && stats.popular_provinsi.length > 0
          ? stats.popular_provinsi
              .slice(0, 5)
              .map(
                (p, i) => `
            <div class="flex items-center justify-between p-3 glass rounded-lg">
              <div class="flex items-center gap-3">
                <div class="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">${i + 1}</div>
                <span class="font-medium text-gray-300">${p.name}</span>
              </div>
              <div class="text-xs text-gray-500">${p.count}x scrape</div>
            </div>
          `
              )
              .join('')
          : '<div class="flex items-center justify-center h-full text-gray-500"><div class="text-center"><div class="text-4xl mb-3 opacity-50">📭</div><p class="text-sm">Data belum tersedia</p></div></div>';
      popularProv.innerHTML = provHtml;
    }
  } catch (e) {
    console.error('Error loading dashboard stats:', e);
  }
}

// ── DASHBOARD ANALYTICS ──────────────────────────────────────────
// Chart instances
// Global chart instances
let trendChart, distributionChart, forecastChart, seasonalityChart, sparklineChart;

// Performance: Cache for processed data
const dataCache = new Map();
// Chart lazy loading observer - disabled for now to prevent conflicts
// Charts are rendered immediately when data loads
const chartObserver = {
  observe: () => {}, // No-op
  unobserve: () => {} // No-op
};

// Performance: Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Performance: Downsample data for charts
function downsampleData(data, labels, maxPoints = 50) {
  if (data.length <= maxPoints) return { data, labels };
  
  const step = Math.ceil(data.length / maxPoints);
  const downsampledData = [];
  const downsampledLabels = [];
  
  for (let i = 0; i < data.length; i += step) {
    // For each chunk, get min and max to preserve extremes
    const chunk = data.slice(i, i + step);
    const chunkLabels = labels.slice(i, i + step);
    const minIdx = chunk.indexOf(Math.min(...chunk.filter(v => v !== null)));
    const maxIdx = chunk.indexOf(Math.max(...chunk.filter(v => v !== null)));
    
    // Add first, min, max, and last points
    const indicesToAdd = new Set([0, chunk.length - 1, minIdx, maxIdx].filter(idx => idx >= 0 && idx < chunk.length));
    indicesToAdd.forEach(idx => {
      downsampledData.push(chunk[idx]);
      downsampledLabels.push(chunkLabels[idx]);
    });
  }
  
  return { data: downsampledData, labels: downsampledLabels };
}

// File selector loader
async function loadFileSelector() {
  try {
    const res = await fetch('/api/storage/list');
    if (!res.ok) {
      console.error('API error:', res.status, res.statusText);
      return;
    }
    const files = await res.json();
    
    const select = document.getElementById('dashboard-file-select');
    if (!select) {
      console.warn('dashboard-file-select element not found');
      return;
    }
    
    select.innerHTML = '<option value="">-- Pilih file dari Storage --</option>';
    
    if (!Array.isArray(files)) {
      console.warn('Invalid files data:', files);
      return;
    }
    
    files.forEach(file => {
      if (file && file.id && file.name) {
        const option = document.createElement('option');
        option.value = file.id;
        option.textContent = `${file.name} (${file.rows || 0} baris)`;
        select.appendChild(option);
      }
    });
  } catch (e) {
    console.error('Error loading file selector:', e.message || e);
  }
}

// Alias for backward compatibility
const loadDashboardFileSelector = loadFileSelector;

// Main dashboard analytics loader
async function loadDashboardAnalytics() {
  const fileId = document.getElementById('dashboard-file-select').value;
  console.log('Loading dashboard analytics for file:', fileId);
  
  if (!fileId) {
    document.getElementById('dashboard-empty').classList.remove('hidden');
    document.getElementById('dashboard-content').classList.add('hidden');
    return;
  }
  
  // Show loading state
  document.getElementById('dashboard-empty').classList.add('hidden');
  document.getElementById('dashboard-content').classList.remove('hidden');
  
  try {
    // Fetch file data
    const res = await fetch(`/api/storage/preview/${fileId}`);
    const data = await res.json();
    
    if (data.error) {
      console.error('Error loading data:', data.error);
      return;
    }
    
    console.log('Dashboard data loaded:', data.preview?.length, 'rows');
    currentDashboardData = data;
    
    // Populate komoditas selectors
    populateKomoditasSelectors(data.preview);
    
    // Render all analytics (delay to ensure canvas is visible)
    setTimeout(() => {
      console.log('Rendering dashboard charts...');
      console.log('Chart.js available:', typeof Chart !== 'undefined');
      renderExecutiveSummary(data);
      renderSparkline(data);
      // Trigger chart updates after dropdowns are populated
      updateTrendChart();
      updateForecastChart();
      renderCorrelationMatrix(data);
      renderDistributionChart(data);
      
      // Lazy loading disabled - charts render immediately when visible
    }, 300);
    
  } catch (e) {
    console.error('Error loading dashboard analytics:', e);
  }
}

// Populate komoditas dropdowns
function populateKomoditasSelectors(data) {
  const komoditasList = [...new Set(data.map(row => row.Komoditas))];
  
  const trendSelect = document.getElementById('trend-komoditas');
  const forecastSelect = document.getElementById('forecast-komoditas');
  
  trendSelect.innerHTML = '<option value="">Pilih Komoditas</option>';
  forecastSelect.innerHTML = '<option value="">Pilih Komoditas</option>';
  
  komoditasList.forEach(kom => {
    if (kom) {
      trendSelect.add(new Option(kom, kom));
      forecastSelect.add(new Option(kom, kom));
    }
  });
  
  // Auto-select first komoditas
  if (komoditasList.length > 0 && komoditasList[0]) {
    trendSelect.value = komoditasList[0];
    forecastSelect.value = komoditasList[0];
  }
  
  // Populate wilayah checkboxes for both charts
  populateWilayahCheckboxes(data, komoditasList[0]);
  populateForecastWilayahCheckboxes(data, komoditasList[0]);
}

// Populate wilayah checkboxes for trend chart
function populateWilayahCheckboxes(data, selectedKom) {
  const container = document.getElementById('trend-wilayah-container');
  if (!container) return;
  
  // Get unique wilayah (NAME column) for this komoditas, excluding national level
  const allKeys = Object.keys(data[0] || {});
  const komKey = allKeys.find(k => !k.match(/\d{4}/));
  
  const wilayahList = [];
  data.forEach(row => {
    if (row[komKey] === selectedKom) {
      const name = row.NAME || row.name;
      const level = parseInt(row.LEVEL || row.level || -1);
      // Only include Level 1 (Provinsi) and Level 2 (Kab/Kota), not Level 0 (Nasional)
      if (name && level !== 0 && !wilayahList.includes(name)) {
        wilayahList.push(name);
      }
    }
  });
  
  // Sort and limit to reasonable number
  wilayahList.sort();
  const displayWilayah = wilayahList.slice(0, 10); // Limit to 10 for UI space
  
  // Build checkbox HTML
  let html = '';
  displayWilayah.forEach((wilayah, index) => {
    const checked = index < 3 ? 'checked' : ''; // Auto-check first 3
    html += `
      <label class="flex items-center gap-1.5 px-2 py-1 bg-dark-600/50 rounded cursor-pointer hover:bg-dark-500/50 transition-colors text-xs">
        <input type="checkbox" class="trend-wilayah-checkbox w-3 h-3 rounded border-dark-500 text-primary focus:ring-primary" 
               value="${wilayah}" ${checked} onchange="updateTrendChart()">
        <span class="text-gray-300 whitespace-nowrap">${wilayah.substring(0, 15)}${wilayah.length > 15 ? '..' : ''}</span>
      </label>
    `;
  });
  
  if (wilayahList.length === 0) {
    html = '<div class="text-xs text-gray-500">Tidak ada data wilayah untuk komoditas ini</div>';
  } else if (wilayahList.length > 10) {
    html += `<div class="text-[10px] text-gray-500 w-full">...dan ${wilayahList.length - 10} wilayah lainnya</div>`;
  }
  
  container.innerHTML = html;
}

// Select all wilayah
function selectAllWilayah() {
  document.querySelectorAll('.trend-wilayah-checkbox').forEach(cb => {
    cb.checked = true;
  });
  updateTrendChart();
}

// Clear all wilayah selection
function clearAllWilayah() {
  document.querySelectorAll('.trend-wilayah-checkbox').forEach(cb => {
    cb.checked = false;
  });
  updateTrendChart();
}

// Populate wilayah checkboxes for forecast chart
function populateForecastWilayahCheckboxes(data, selectedKom) {
  const container = document.getElementById('forecast-wilayah-container');
  if (!container) return;
  
  const allKeys = Object.keys(data[0] || {});
  const komKey = allKeys.find(k => !k.match(/\d{4}/));
  
  const wilayahList = [];
  data.forEach(row => {
    if (row[komKey] === selectedKom) {
      const name = row.NAME || row.name;
      const level = parseInt(row.LEVEL || row.level || -1);
      if (name && level !== 0 && !wilayahList.includes(name)) {
        wilayahList.push(name);
      }
    }
  });
  
  wilayahList.sort();
  const displayWilayah = wilayahList.slice(0, 8);
  
  let html = '';
  displayWilayah.forEach((wilayah, index) => {
    const checked = index < 2 ? 'checked' : ''; // Auto-check first 2 for forecast
    html += `
      <label class="flex items-center gap-1.5 px-2 py-1 bg-dark-600/50 rounded cursor-pointer hover:bg-dark-500/50 transition-colors text-xs">
        <input type="checkbox" class="forecast-wilayah-checkbox w-3 h-3 rounded border-dark-500 text-warning focus:ring-warning" 
               value="${wilayah}" ${checked} onchange="updateForecastChart()">
        <span class="text-gray-300 whitespace-nowrap">${wilayah.substring(0, 15)}${wilayah.length > 15 ? '..' : ''}</span>
      </label>
    `;
  });
  
  if (wilayahList.length === 0) {
    html = '<div class="text-xs text-gray-500">Tidak ada data wilayah</div>';
  } else if (wilayahList.length > 8) {
    html += `<div class="text-[10px] text-gray-500 w-full">...dan ${wilayahList.length - 8} lainnya</div>`;
  }
  
  container.innerHTML = html;
}

function selectAllWilayahForecast() {
  document.querySelectorAll('.forecast-wilayah-checkbox').forEach(cb => {
    cb.checked = true;
  });
  updateForecastChart();
}

function clearAllWilayahForecast() {
  document.querySelectorAll('.forecast-wilayah-checkbox').forEach(cb => {
    cb.checked = false;
  });
  updateForecastChart();
}

// 1. Executive Summary - Top Gainers & Losers
function renderExecutiveSummary(data) {
  const rows = data.preview;
  
  // Get time period columns for pivoted data
  const allKeys = Object.keys(rows[0] || {});
  const timePeriodKeys = allKeys.filter(k => k.match(/\d{4}/)).sort();
  const komKey = allKeys.find(k => !k.match(/\d{4}/));
  
  if (timePeriodKeys.length < 2) {
    document.getElementById('top-gainers').innerHTML = '<div class="text-xs text-gray-500">Data periode tidak mencukupi</div>';
    document.getElementById('top-losers').innerHTML = '<div class="text-xs text-gray-500">Data periode tidak mencukupi</div>';
    return;
  }
  
  // Calculate price changes for each commodity (first period vs last period)
  // Only use national level data (LEVEL=0 or NAME containing "Semua Provinsi")
  const changes = [];
  rows.forEach(row => {
    const kom = row[komKey];
    if (!kom) return;
    
    // Filter only national level data
    const level = parseInt(row.LEVEL || row.level || -1);
    const name = row.NAME || row.name || '';
    if (level !== 0 && !name.includes('Semua Provinsi')) return;
    
    const firstPeriod = timePeriodKeys[0];
    const lastPeriod = timePeriodKeys[timePeriodKeys.length - 1];
    
    const firstPriceStr = row[firstPeriod];
    const lastPriceStr = row[lastPeriod];
    
    if (firstPriceStr && lastPriceStr) {
      const firstPrice = parseFloat(String(firstPriceStr).replace(/,/g, ''));
      const lastPrice = parseFloat(String(lastPriceStr).replace(/,/g, ''));
      
      if (!isNaN(firstPrice) && !isNaN(lastPrice) && firstPrice > 0) {
        const changePct = ((lastPrice - firstPrice) / firstPrice) * 100;
        changes.push({
          komoditas: kom,
          change: changePct,
          current: lastPrice,
          firstPeriod: firstPeriod,
          lastPeriod: lastPeriod,
          firstPrice: firstPrice,
          location: name
        });
      }
    }
  });
  
  // Sort by change
  changes.sort((a, b) => b.change - a.change);
  
  // Top 3 Gainers
  const gainers = changes.slice(0, 3);
  const gainersHtml = gainers.map(g => `
    <div class="flex items-center justify-between p-3 glass rounded-lg">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <i class="fas fa-caret-up text-success"></i>
          <span class="text-sm font-medium text-gray-300 truncate" title="${g.komoditas}">${g.komoditas}</span>
          <span class="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded">Nasional</span>
        </div>
        <div class="text-[10px] text-gray-500 ml-5">
          ${g.firstPeriod} → ${g.lastPeriod}
        </div>
      </div>
      <div class="text-right ml-3">
        <div class="text-sm font-bold text-success">+${g.change.toFixed(1)}%</div>
        <div class="text-xs text-gray-400">Rp ${g.firstPrice.toLocaleString()} → Rp ${g.current.toLocaleString()}</div>
      </div>
    </div>
  `).join('') || '<div class="text-xs text-gray-500 p-3">Data tidak mencukupi</div>';
  
  // Top 3 Losers
  const losers = changes.slice(-3).reverse();
  const losersHtml = losers.map(l => `
    <div class="flex items-center justify-between p-3 glass rounded-lg">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <i class="fas fa-caret-down text-danger"></i>
          <span class="text-sm font-medium text-gray-300 truncate" title="${l.komoditas}">${l.komoditas}</span>
          <span class="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded">Nasional</span>
        </div>
        <div class="text-[10px] text-gray-500 ml-5">
          ${l.firstPeriod} → ${l.lastPeriod}
        </div>
      </div>
      <div class="text-right ml-3">
        <div class="text-sm font-bold text-danger">${l.change.toFixed(1)}%</div>
        <div class="text-xs text-gray-400">Rp ${l.firstPrice.toLocaleString()} → Rp ${l.current.toLocaleString()}</div>
      </div>
    </div>
  `).join('') || '<div class="text-xs text-gray-500 p-3">Data tidak mencukupi</div>';
  
  document.getElementById('top-gainers').innerHTML = gainersHtml;
  document.getElementById('top-losers').innerHTML = losersHtml;
}

// 2. Sparkline Chart - Price Index
function renderSparkline(data) {
  const canvas = document.getElementById('sparkline-chart');
  if (!canvas) {
    console.error('Sparkline canvas not found');
    return;
  }
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded yet!');
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Could not get 2D context');
    return;
  }
  console.log('Rendering sparkline... Canvas size:', canvas.width, 'x', canvas.height);
  
  // Ensure canvas has proper size
  if (canvas.width === 0 || canvas.height === 0) {
    console.error('Canvas has zero size!');
    canvas.width = canvas.parentElement?.clientWidth || 300;
    canvas.height = canvas.parentElement?.clientHeight || 120;
  }
  
  // Handle pivoted data format (columns are time periods like "Apr 2020 (I)")
  const rows = data.preview;
  console.log('Total rows:', rows.length);
  console.log('First row sample:', rows[0]);
  
  // Get all column names that look like time periods (e.g., "Apr 2020 (I)")
  const allKeys = Object.keys(rows[0] || {});
  const timePeriodKeys = allKeys.filter(k => k.match(/\d{4}/)); // Keys containing year numbers
  console.log('Time period columns found:', timePeriodKeys);
  
  // Calculate average price for each time period across all commodities
  const periodPrices = {};
  timePeriodKeys.forEach(period => {
    let sum = 0;
    let count = 0;
    rows.forEach(row => {
      const priceStr = row[period];
      if (priceStr) {
        // Remove commas and parse
        const price = parseFloat(String(priceStr).replace(/,/g, ''));
        if (!isNaN(price) && price > 0) {
          sum += price;
          count++;
        }
      }
    });
    if (count > 0) {
      periodPrices[period] = sum / count;
    }
  });
  
  const dates = Object.keys(periodPrices).sort();
  const avgPrices = dates.map(date => periodPrices[date]);
  
  console.log('Data points:', avgPrices.length);
  
  // Update price index value
  if (avgPrices.length > 0) {
    const latest = avgPrices[avgPrices.length - 1];
    document.getElementById('price-index-value').textContent = `Rp ${latest.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
  }
  
  // Destroy existing chart
  if (sparklineChart) sparklineChart.destroy();
  
  // Create sparkline
  try {
    sparklineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          data: avgPrices,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: { display: false }
        }
      }
    });
    console.log('✅ Sparkline chart created successfully');
  } catch (e) {
    console.error('❌ Error creating sparkline chart:', e);
  }
}

// 3. Trend Chart with Multiple Wilayah Comparison
function renderTrendChart(data) {
  const canvas = document.getElementById('trend-chart');
  if (!canvas) {
    console.error('Trend chart canvas not found');
    return;
  }
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded yet!');
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Could not get 2D context for trend chart');
    return;
  }
  console.log('Rendering trend chart with multi-wilayah...');
  
  const selectedKom = document.getElementById('trend-komoditas').value;
  if (!selectedKom || !data.preview) return;
  
  // Get time period columns
  const allKeys = Object.keys(data.preview[0] || {});
  const timePeriodKeys = allKeys.filter(k => k.match(/\d{4}/)).sort();
  const komKey = allKeys.find(k => !k.match(/\d{4}/));
  
  // Get selected wilayah from checkboxes
  const selectedWilayah = [];
  document.querySelectorAll('.trend-wilayah-checkbox:checked').forEach(cb => {
    selectedWilayah.push(cb.value);
  });
  
  // If no wilayah selected, use national level (LEVEL=0)
  if (selectedWilayah.length === 0) {
    const nationalRow = data.preview.find(row => row[komKey] === selectedKom && (parseInt(row.LEVEL || row.level || -1) === 0 || (row.NAME || row.name || '').includes('Semua Provinsi')));
    if (nationalRow) {
      selectedWilayah.push(nationalRow.NAME || nationalRow.name || 'Nasional');
    }
  }
  
  // Collect data for each selected wilayah
  const wilayahData = {};
  const dates = [...timePeriodKeys]; // Use all time periods as labels
  
  selectedWilayah.forEach(wilayahName => {
    // Find row for this wilayah and komoditas
    const row = data.preview.find(r => {
      const name = r.NAME || r.name || '';
      const kom = r[komKey];
      return kom === selectedKom && name === wilayahName;
    });
    
    if (row) {
      const prices = [];
      timePeriodKeys.forEach(period => {
        const priceStr = row[period];
        if (priceStr) {
          const price = parseFloat(String(priceStr).replace(/,/g, ''));
          prices.push(!isNaN(price) && price > 0 ? price : null);
        } else {
          prices.push(null);
        }
      });
      wilayahData[wilayahName] = prices;
    }
  });
  
  if (Object.keys(wilayahData).length === 0) return;
  
  // Build datasets for each wilayah
  const colors = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];
  const datasets = [];
  
  Object.entries(wilayahData).forEach(([wilayahName, prices], index) => {
    const color = colors[index % colors.length];
    datasets.push({
      label: wilayahName.substring(0, 20),
      data: prices,
      borderColor: color,
      backgroundColor: 'transparent',
      fill: false,
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 2
    });
  });
  
  // Show/hide EWS alert (simplified for multi-line)
  const ewsAlert = document.getElementById('ews-alert');
  if (ewsAlert) {
    ewsAlert.classList.add('hidden');
  }
  
  // Destroy existing chart
  if (trendChart) trendChart.destroy();
  
  // Create chart with multi-wilayah support
  try {
    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // Disable animation for performance
        spanGaps: true,   // Connect lines across null values
        plugins: {
          legend: { 
            display: true,
            labels: { color: '#9ca3af', font: { size: 11 } },
            position: 'top'
          }
        },
        scales: {
          x: {
            ticks: { color: '#6b7280', maxTicksLimit: 10, font: { size: 10 } },
            grid: { color: 'rgba(75, 85, 99, 0.2)' }
          },
          y: {
            ticks: { color: '#6b7280', font: { size: 10 } },
            grid: { color: 'rgba(75, 85, 99, 0.2)' }
          }
        }
      }
    });
    console.log('✅ Trend chart created successfully with', datasets.length, 'wilayah');
  } catch (e) {
    console.error('❌ Error creating trend chart:', e);
  }
}

// Debounced version of chart updates
const debouncedUpdateTrendChart = debounce(() => {
  if (currentDashboardData) {
    renderTrendChart(currentDashboardData);
  }
}, 300);

const debouncedUpdateForecastChart = debounce(() => {
  if (currentDashboardData) {
    renderForecastChart(currentDashboardData);
  }
}, 300);

// Update trend chart when komoditas changes
function updateTrendChart() {
  if (currentDashboardData) {
    const selectedKom = document.getElementById('trend-komoditas').value;
    // Refresh wilayah checkboxes for new komoditas
    populateWilayahCheckboxes(currentDashboardData.preview, selectedKom);
    debouncedUpdateTrendChart();
  }
}

// 4. Correlation Matrix - Regional Price Disparity
function renderCorrelationMatrix(data) {
  const rows = data.preview;
  if (!rows || rows.length === 0) return;
  
  // Check for NAME column (contains location info: Semua Provinsi, Sulawesi Tengah, etc.)
  const hasRegionalData = rows[0] && (rows[0].NAME || rows[0].name);
  
  if (!hasRegionalData) {
    // Show message that this feature requires regional data
    document.getElementById('correlation-head').innerHTML = '<tr><th class="p-2 text-left text-gray-400">Fitur tidak tersedia</th></tr>';
    document.getElementById('correlation-body').innerHTML = '<tr><td class="p-4 text-center text-gray-500 text-sm">Data wilayah tidak tersedia.<br>Fitur ini membutuhkan kolom NAME.</td></tr>';
    return;
  }
  
  // Get all keys for time periods
  const allKeys = Object.keys(rows[0] || {});
  const timePeriodKeys = allKeys.filter(k => k.match(/\d{4}/));
  
  // Get the latest time period for comparison
  const latestPeriod = timePeriodKeys[timePeriodKeys.length - 1];
  
  // Group by region (NAME column) - only for Level 1 (Provinsi) and Level 2 (Kab/Kota)
  const regionPrices = {};
  rows.forEach(row => {
    const region = row.NAME || row.name;
    const level = parseInt(row.LEVEL || row.level || 0);
    
    // Skip national level (0) and only use provinces (1) and cities (2)
    if (level === 0 || !region) return;
    
    const priceStr = row[latestPeriod];
    if (priceStr) {
      const price = parseFloat(String(priceStr).replace(/,/g, ''));
      if (!isNaN(price) && price > 0) {
        if (!regionPrices[region]) regionPrices[region] = [];
        regionPrices[region].push(price);
      }
    }
  });
  
  const regions = Object.keys(regionPrices);
  
  if (regions.length < 2) {
    document.getElementById('correlation-head').innerHTML = '<tr><th class="p-2 text-left text-gray-400">Data tidak mencukupi</th></tr>';
    document.getElementById('correlation-body').innerHTML = `<tr><td class="p-4 text-center text-gray-500 text-sm">Hanya ${regions.length} wilayah ditemukan.<br>Diperlukan minimal 2 wilayah untuk perbandingan.</td></tr>`;
    return;
  }
  
  // Limit to 6 regions for display
  const displayRegions = regions.slice(0, 6);
  
  // Create matrix
  let theadHtml = '<tr><th class="p-2 text-left text-xs text-gray-400">Wilayah</th>';
  displayRegions.forEach(r => {
    theadHtml += `<th class="p-2 text-center text-[10px] text-gray-500" title="${r}">${r.substring(0, 8)}${r.length > 8 ? '..' : ''}</th>`;
  });
  theadHtml += '</tr>';
  
  let tbodyHtml = '';
  displayRegions.forEach((r1, i) => {
    tbodyHtml += `<tr class="border-t border-dark-700"><td class="p-2 font-medium text-gray-300 text-xs" title="${r1}">${r1.substring(0, 12)}${r1.length > 12 ? '..' : ''}</td>`;
    displayRegions.forEach((r2, j) => {
      if (i === j) {
        tbodyHtml += '<td class="p-2 text-center text-gray-500">-</td>';
      } else {
        const avg1 = regionPrices[r1].reduce((a, b) => a + b, 0) / regionPrices[r1].length;
        const avg2 = regionPrices[r2].reduce((a, b) => a + b, 0) / regionPrices[r2].length;
        const diff = Math.abs(avg1 - avg2);
        const diffPct = (diff / avg1) * 100;
        
        let colorClass = 'text-success';
        let bgClass = '';
        if (diffPct > 10) { colorClass = 'text-warning'; bgClass = 'bg-warning/10'; }
        if (diffPct > 20) { colorClass = 'text-danger'; bgClass = 'bg-danger/10'; }
        
        tbodyHtml += `<td class="p-2 text-center ${colorClass} text-[10px] ${bgClass} rounded" title="Rp ${avg1.toLocaleString()} vs Rp ${avg2.toLocaleString()}">${diffPct.toFixed(1)}%</td>`;
      }
    });
    tbodyHtml += '</tr>';
  });
  
  document.getElementById('correlation-head').innerHTML = theadHtml;
  document.getElementById('correlation-body').innerHTML = tbodyHtml;
}

// 5. Distribution Chart
function renderDistributionChart(data) {
  const canvas = document.getElementById('distribution-chart');
  if (!canvas) {
    console.error('Distribution chart canvas not found');
    return;
  }
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded yet!');
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Could not get 2D context for distribution chart');
    return;
  }
  console.log('Rendering distribution chart...');
  
  const rows = data.preview;
  const allKeys = Object.keys(rows[0] || {});
  const timePeriodKeys = allKeys.filter(k => k.match(/\d{4}/));
  const komKey = allKeys.find(k => !k.match(/\d{4}/));
  
  // Calculate average price per commodity across all time periods
  const komoditasAvg = {};
  rows.forEach(row => {
    const kom = row[komKey];
    if (!kom) return;
    
    let sum = 0;
    let count = 0;
    timePeriodKeys.forEach(period => {
      const priceStr = row[period];
      if (priceStr) {
        const price = parseFloat(String(priceStr).replace(/,/g, ''));
        if (!isNaN(price) && price > 0) {
          sum += price;
          count++;
        }
      }
    });
    if (count > 0) {
      komoditasAvg[kom] = sum / count;
    }
  });
  
  const commodities = Object.keys(komoditasAvg).slice(0, 6);
  const avgs = commodities.map(k => komoditasAvg[k]);
  
  if (distributionChart) distributionChart.destroy();
  
  try {
    distributionChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: commodities.map(c => c.substring(0, 12)),
        datasets: [{
          label: 'Harga Rata-rata',
          data: avgs,
          backgroundColor: 'rgba(139, 92, 246, 0.7)',
          borderColor: '#8b5cf6',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#6b7280' }, grid: { display: false } },
          y: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(75, 85, 99, 0.2)' } }
        },
        animation: false // Disable animation
      }
    });
    console.log('✅ Distribution chart created successfully');
  } catch (e) {
    console.error('❌ Error creating distribution chart:', e);
  }
}

// 6. Forecast Chart with Multiple Wilayah Comparison
function renderForecastChart(data) {
  const canvas = document.getElementById('forecast-chart');
  if (!canvas) {
    console.error('Forecast chart canvas not found');
    return;
  }
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded yet!');
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Could not get 2D context for forecast chart');
    return;
  }
  console.log('Rendering forecast chart with multi-wilayah...');
  
  const selectedKom = document.getElementById('forecast-komoditas').value;
  if (!selectedKom || !data.preview) return;
  
  // Get time period columns
  const allKeys = Object.keys(data.preview[0] || {});
  const timePeriodKeys = allKeys.filter(k => k.match(/\d{4}/)).sort();
  const komKey = allKeys.find(k => !k.match(/\d{4}/));
  
  // Get selected wilayah from checkboxes
  const selectedWilayah = [];
  document.querySelectorAll('.forecast-wilayah-checkbox:checked').forEach(cb => {
    selectedWilayah.push(cb.value);
  });
  
  // If no wilayah selected, use national level
  if (selectedWilayah.length === 0) {
    const nationalRow = data.preview.find(row => row[komKey] === selectedKom && (parseInt(row.LEVEL || row.level || -1) === 0 || (row.NAME || row.name || '').includes('Semua Provinsi')));
    if (nationalRow) {
      selectedWilayah.push(nationalRow.NAME || nationalRow.name || 'Nasional');
    }
  }
  
  // Collect data and generate forecast for each wilayah
  const colors = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];
  const datasets = [];
  const forecastDays = 8; // Reduced for monthly data
  const dates = [...timePeriodKeys];
  
  selectedWilayah.forEach((wilayahName, index) => {
    // Find row for this wilayah and komoditas
    const row = data.preview.find(r => {
      const name = r.NAME || r.name || '';
      const kom = r[komKey];
      return kom === selectedKom && name === wilayahName;
    });
    
    if (!row) return;
    
    // Extract prices
    const historicalPrices = [];
    timePeriodKeys.forEach(period => {
      const priceStr = row[period];
      if (priceStr) {
        const price = parseFloat(String(priceStr).replace(/,/g, ''));
        historicalPrices.push(!isNaN(price) && price > 0 ? price : null);
      } else {
        historicalPrices.push(null);
      }
    });
    
    // Filter valid prices for regression
    const validPrices = historicalPrices.filter(p => p !== null);
    if (validPrices.length < 3) return;
    
    // Simple linear regression for forecast
    const n = validPrices.length;
    const sumX = validPrices.reduce((a, b, i) => a + i, 0);
    const sumY = validPrices.reduce((a, b) => a + b, 0);
    const sumXY = validPrices.reduce((a, b, i) => a + (i * b), 0);
    const sumXX = validPrices.reduce((a, b, i) => a + (i * i), 0);
    
    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) return;
    
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    
    // Generate forecast
    const forecastPrices = [];
    for (let i = 1; i <= forecastDays; i++) {
      const x = n + i - 1;
      const predicted = slope * x + intercept;
      forecastPrices.push(predicted);
    }
    
    const color = colors[index % colors.length];
    
    // Historical data dataset
    datasets.push({
      label: `${wilayahName.substring(0, 15)} (Historis)`,
      data: [...historicalPrices, ...Array(forecastDays).fill(null)],
      borderColor: color,
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 2,
      tension: 0.3
    });
    
    // Forecast dataset (dashed line)
    const lastValidPrice = validPrices[validPrices.length - 1];
    datasets.push({
      label: `${wilayahName.substring(0, 15)} (Proyeksi)`,
      data: [...Array(historicalPrices.length - 1).fill(null), lastValidPrice, ...forecastPrices],
      borderColor: color,
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      tension: 0.3
    });
  });
  
  if (datasets.length === 0) return;
  
  // Add forecast period labels
  const forecastLabels = [];
  for (let i = 1; i <= forecastDays; i++) {
    forecastLabels.push(`+${i} periode`);
  }
  const allLabels = [...dates, ...forecastLabels];
  
  if (forecastChart) forecastChart.destroy();
  
  try {
    forecastChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // Disable animation for performance
        spanGaps: true,   // Connect lines across null values
        plugins: {
          legend: {
            display: true,
            labels: { color: '#9ca3af', font: { size: 10 }, boxWidth: 12 },
            position: 'top'
          }
        },
        scales: {
          x: { ticks: { color: '#6b7280', maxTicksLimit: 10, font: { size: 9 } }, grid: { color: 'rgba(75, 85, 99, 0.2)' } },
          y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(75, 85, 99, 0.2)' } }
        }
      }
    });
    console.log('✅ Forecast chart created successfully with', selectedWilayah.length, 'wilayah');
  } catch (e) {
    console.error('❌ Error creating forecast chart:', e);
  }
}

// Update forecast when komoditas changes
function updateForecastChart() {
  if (currentDashboardData) {
    const selectedKom = document.getElementById('forecast-komoditas').value;
    
    // Refresh wilayah checkboxes for new komoditas
    populateForecastWilayahCheckboxes(currentDashboardData.preview, selectedKom);
    
    debouncedUpdateForecastChart();
  }
}

// Helper: Calculate SMA
function calculateSMA(data, period) {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

// Helper: Calculate Standard Deviation
function calculateStd(data, period) {
  const std = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      std.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
      std.push(Math.sqrt(variance));
    }
  }
  return std;
}

// ── AI ASSISTANT POPUP ───────────────────────────────────────────
// Conversation history for context
let aiConversationHistory = [];

function openAIPopup() {
  document.getElementById('ai-popup').classList.remove('hidden');
  document.getElementById('ai-popup-input').focus();
}

function closeAIPopup() {
  document.getElementById('ai-popup').classList.add('hidden');
}

// Close popup on backdrop click
document.addEventListener('click', (e) => {
  const popup = document.getElementById('ai-popup');
  if (popup && !popup.classList.contains('hidden') && e.target === popup) {
    closeAIPopup();
  }
});

async function sendToAIPopup() {
  const input = document.getElementById('ai-popup-input');
  const chatArea = document.getElementById('ai-chat-area');
  const message = input.value.trim();
  if (!message) return;
  
  // Clear input
  input.value = '';
  
  // Add to history
  aiConversationHistory.push({ role: 'user', content: message });
  
  // Add user message to UI
  const userDiv = document.createElement('div');
  userDiv.className = 'flex gap-3 justify-end';
  userDiv.innerHTML = `
    <div class="flex-1 flex justify-end">
      <div class="bg-primary/20 border border-primary/30 rounded-xl rounded-tr-sm p-3 max-w-[80%]">
        <p class="text-sm text-gray-200">${escapeHtml(message)}</p>
      </div>
    </div>
    <div class="w-8 h-8 rounded-full bg-dark-600 flex-shrink-0 flex items-center justify-center">
      <i class="fas fa-user text-gray-400 text-xs"></i>
    </div>
  `;
  chatArea.appendChild(userDiv);
  chatArea.scrollTop = chatArea.scrollHeight;
  
  // Add loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'ai-loading';
  loadingDiv.className = 'flex gap-3';
  loadingDiv.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex-shrink-0 flex items-center justify-center">
      <i class="fas fa-robot text-white text-xs animate-pulse"></i>
    </div>
    <div class="flex-1">
      <div class="glass rounded-xl rounded-tl-sm p-3">
        <p class="text-sm text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>Mengetik...</p>
      </div>
    </div>
  `;
  chatArea.appendChild(loadingDiv);
  chatArea.scrollTop = chatArea.scrollHeight;
  
  try {
    // Call AI API with conversation history
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message, 
        context: 'PIHPS data analysis',
        history: aiConversationHistory.slice(-10) // Keep last 10 messages
      })
    });
    const data = await res.json();
    
    // Remove loading
    document.getElementById('ai-loading')?.remove();
    
    // Add AI response to history
    if (data.response) {
      aiConversationHistory.push({ role: 'model', content: data.response });
    }
    
    // Add AI response to UI
    const aiDiv = document.createElement('div');
    aiDiv.className = 'flex gap-3';
    // Hidden message allows HTML (italic), others are escaped
    const responseText = data.source === 'hidden' 
      ? data.response 
      : formatAIResponse(escapeHtml(data.response || 'Maaf, terjadi kesalahan'));
    aiDiv.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex-shrink-0 flex items-center justify-center">
        <i class="fas fa-robot text-white text-xs"></i>
      </div>
      <div class="flex-1">
        <div class="glass rounded-xl rounded-tl-sm p-3">
          <p class="text-sm text-gray-300">${responseText}</p>
          ${data.source === 'gemini' ? '<p class="text-[10px] text-gray-500 mt-1">Powered by Gemini AI</p>' : ''}
        </div>
      </div>
    `;
    chatArea.appendChild(aiDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
    
  } catch (e) {
    document.getElementById('ai-loading')?.remove();
    
    const errDiv = document.createElement('div');
    errDiv.className = 'flex gap-3';
    errDiv.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex-shrink-0 flex items-center justify-center">
        <i class="fas fa-robot text-white text-xs"></i>
      </div>
      <div class="flex-1">
        <div class="glass rounded-xl rounded-tl-sm p-3 border border-danger/30">
          <p class="text-sm text-danger"><i class="fas fa-exclamation-triangle mr-2"></i>Tidak dapat terhubung ke server</p>
        </div>
      </div>
    `;
    chatArea.appendChild(errDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
  }
}

// Format AI response with line breaks
function formatAIResponse(text) {
  return text.replace(/\n/g, '<br>');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── BOOT ─────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  init();
  
  // Setup kabkota input
  const input = document.getElementById('kabkota-input');
  if (input) {
    input.addEventListener('keydown', handleKabkotaInput);
  }

  // Setup provinsi change
  const provinsi = document.getElementById('provinsi');
  if (provinsi) {
    provinsi.addEventListener('change', (e) => {
      showRecommendedRegencies(e.target.value);
    });
  }
  
});
