// Utility: escape HTML
function escHtml(str) {
  if (str == null) return '—';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Date helpers
function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function today() {
  return toDateStr(new Date());
}

// Format time only: "2024-01-15T10:30:00" → "10:30"
function formatTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return escHtml(str);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Format date: "2024-01-15T10:30:00" → "15.01.2024"
function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// Format phone: "79991234567" → "+7-999-123-45-67"
function formatPhone(str) {
  if (!str) return '—';
  const digits = String(str).replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '7') {
    return `+7-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  return escHtml(str);
}

// Convert phone to tel: href format: "79991234567" → "+79991234567"
function toTelHref(str) {
  if (!str) return null;
  const digits = String(str).replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '7') return `+${digits}`;
  return digits || null;
}

const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2v1"/></svg>`;

// Icon for device option based on zone name
function deviceIcon(zoneName) {
  const z = (zoneName || '').toLowerCase();
  if (z.includes('паркинг')) return '🅿️';
  if (z.includes('двор')) return '🚗';
  return '';
}

// State
let allDevices = [];      // flat list: { id, name, zoneName }
let currentDeviceId = null;
let currentPage = 0;
let currentTotal = 0;
const PAGE_SIZE = 50;

function getFilters() {
  const date = document.getElementById('filter-date').value || today();
  return { from: date, to: date };
}

// Load devices from /api/private/devices
async function loadDevices() {
  const sel = document.getElementById('device-select');
  sel.innerHTML = '<option value="">Загрузка...</option>';
  sel.disabled = true;

  try {
    const data = await api.get('/api/private/devices');
    allDevices = [];
    (data.zones || []).forEach(zone => {
      (zone.devices || []).forEach(device => {
        allDevices.push({ id: device.id, name: device.label || device.name, zoneName: zone.name });
      });
    });

    sel.innerHTML = '';
    if (allDevices.length === 0) {
      sel.innerHTML = '<option value="">Нет устройств</option>';
      return;
    }

    // Find default device: zone "Двор", name contains "Заехать"
    let defaultDevice = allDevices.find(d =>
      d.zoneName.toLowerCase().includes('двор') && d.name.toLowerCase().includes('заехать')
    ) || allDevices[0];

    allDevices.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      const icon = deviceIcon(d.zoneName);
      opt.textContent = `${icon ? icon + ' ' : ''}${d.zoneName} / ${d.name}`;
      if (d.id === defaultDevice.id) opt.selected = true;
      sel.appendChild(opt);
    });

    sel.disabled = false;
    currentDeviceId = defaultDevice.id;
    await loadLogs(0);
  } catch (err) {
    sel.innerHTML = '<option value="">Ошибка загрузки</option>';
    showLogsError(err.message || 'Не удалось загрузить устройства');
  }
}

// Load logs for selected device
async function loadLogs(page) {
  const deviceId = document.getElementById('device-select').value;
  if (!deviceId) return;

  currentDeviceId = deviceId;
  currentPage = page;

  const { from, to } = getFilters();
  const path = `/api/private/devices/${encodeURIComponent(deviceId)}/event-log` +
    `?page=${page}&pageSize=${PAGE_SIZE}&from=${from}&to=${to}`;

  setLogsLoading(true);
  try {
    const data = await api.get(path);
    currentTotal = data.total || 0;
    renderLogs(data.entries || [], page, currentTotal);
  } catch (err) {
    showLogsError(err.message || 'Не удалось загрузить логи');
  } finally {
    setLogsLoading(false);
  }
}

function setLogsLoading(loading) {
  document.getElementById('logs-loading').classList.toggle('hidden', !loading);
  document.getElementById('logs-table-wrap').classList.toggle('hidden', loading);
  document.getElementById('logs-error').classList.add('hidden');
  document.getElementById('sync-btn').disabled = loading;
}

function showLogsError(msg) {
  const el = document.getElementById('logs-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  document.getElementById('logs-table-wrap').classList.add('hidden');
}

function renderLogs(entries, page, total) {
  const tbody = document.getElementById('logs-tbody');

  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="logs-empty">Нет записей за выбранный период</td></tr>';
  } else {
    // Group entries by date for date separators
    let lastDate = null;
    const rows = [];
    entries.forEach(e => {
      const date = formatDate(e.dateTime);
      if (date && date !== lastDate) {
        rows.push(`<tr class="date-separator"><td colspan="3">${date}</td></tr>`);
        lastDate = date;
      }
      const tel = toTelHref(e.phoneNumber);
      const phoneFormatted = formatPhone(e.phoneNumber);
      const phoneCell = tel
        ? `<a href="tel:${tel}" class="phone-link">${phoneFormatted}</a><button class="copy-btn" data-copy="${tel}" title="Копировать">${COPY_ICON}</button>`
        : phoneFormatted;
      rows.push(`
      <tr>
        <td class="col-time">${formatTime(e.dateTime)}</td>
        <td class="col-name">${escHtml(e.userName)}</td>
        <td class="col-phone">${phoneCell}</td>
      </tr>`);
    });
    tbody.innerHTML = rows.join('');
  }

  // Pagination info
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  document.getElementById('page-info').textContent = `Стр. ${page + 1} из ${totalPages} (${total} записей)`;
  document.getElementById('page-prev').disabled = page === 0;
  document.getElementById('page-next').disabled = page >= totalPages - 1;
}

// Sync event log for current device
async function syncLogs() {
  const deviceId = document.getElementById('device-select').value;
  if (!deviceId) return;

  const { from, to } = getFilters();
  const syncBtn = document.getElementById('sync-btn');
  syncBtn.disabled = true;
  syncBtn.textContent = 'Синхронизация...';

  document.getElementById('sync-message').classList.add('hidden');

  try {
    await api.post(
      `/api/private/devices/${encodeURIComponent(deviceId)}/event-log/sync?from=${from}&to=${to}`
    );
    const msg = document.getElementById('sync-message');
    msg.textContent = 'Синхронизация завершена';
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 3000);
    await loadLogs(0);
  } catch (err) {
    showLogsError(err.message || 'Ошибка синхронизации');
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = 'Синхронизировать';
  }
}

function initLogs() {
  const filterDate = document.getElementById('filter-date');
  filterDate.value = today();
  filterDate.max = today();

  document.getElementById('device-select').addEventListener('change', () => loadLogs(0));
  document.getElementById('filter-date').addEventListener('change', () => loadLogs(0));
  document.getElementById('sync-btn').addEventListener('click', syncLogs);
  document.getElementById('logs-tbody').addEventListener('click', e => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;
    navigator.clipboard.writeText(btn.dataset.copy);
  });
  document.getElementById('page-prev').addEventListener('click', () => loadLogs(currentPage - 1));
  document.getElementById('page-next').addEventListener('click', () => loadLogs(currentPage + 1));
}
