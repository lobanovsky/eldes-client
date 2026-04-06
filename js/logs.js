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

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return toDateStr(d);
}

function defaultTo() {
  return toDateStr(new Date());
}

// Format datetime: "2024-01-15T10:30:00" → "15.01.2024 10:30"
function formatDateTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return escHtml(str);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// State
let allDevices = [];      // flat list: { id, name, zoneName }
let currentDeviceId = null;
let currentPage = 0;
let currentTotal = 0;
const PAGE_SIZE = 50;

function getFilters() {
  return {
    from: document.getElementById('filter-from').value || defaultFrom(),
    to: document.getElementById('filter-to').value || defaultTo(),
  };
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

    allDevices.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.zoneName} / ${d.name}`;
      sel.appendChild(opt);
    });

    sel.disabled = false;
    currentDeviceId = allDevices[0].id;
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
  document.getElementById('apply-btn').disabled = loading;
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
    tbody.innerHTML = '<tr><td colspan="6" class="logs-empty">Нет записей за выбранный период</td></tr>';
  } else {
    tbody.innerHTML = entries.map(e => `
      <tr>
        <td class="col-datetime">${formatDateTime(e.dateTime)}</td>
        <td class="col-status">${escHtml(e.status)}</td>
        <td>${escHtml(e.userName)}</td>
        <td>${escHtml(e.cell)}</td>
        <td>${escHtml(e.method)}</td>
        <td>${escHtml(e.phoneNumber)}</td>
      </tr>`).join('');
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
  // Set default date range
  document.getElementById('filter-from').value = defaultFrom();
  document.getElementById('filter-to').value = defaultTo();

  document.getElementById('device-select').addEventListener('change', () => loadLogs(0));
  document.getElementById('apply-btn').addEventListener('click', () => loadLogs(0));
  document.getElementById('sync-btn').addEventListener('click', syncLogs);
  document.getElementById('page-prev').addEventListener('click', () => loadLogs(currentPage - 1));
  document.getElementById('page-next').addEventListener('click', () => loadLogs(currentPage + 1));
}
