// Konfigurasi:
// - Lokal / satu server (backend serve frontend): kosongkan → pakai origin browser.
// - Hybrid (frontend Vercel + backend Render): isi URL Render, mis.
//   'https://iot-backend.onrender.com'
const RENDER_BACKEND_URL = 'https://iot-pulse-monitor.onrender.com';
const BACKEND_BASE = RENDER_BACKEND_URL || window.location.origin;
const API_URL = BACKEND_BASE + '/api';
const SOCKET_URL = BACKEND_BASE;

// State
let chart;
let alertCount = 0;

function setStatus(online) {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = online ? 'Online' : 'Offline';
  el.className = 'status ' + (online ? 'online' : 'offline');
}

// Init Socket.IO (guard if CDN failed)
let socket = null;
try {
  if (typeof io !== 'undefined') {
    socket = io(SOCKET_URL);
    socket.on('connect', () => {
      console.log('Socket connected');
      setStatus(true);
    });
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setStatus(false);
    });
    socket.on('dataBaru', (data) => {
      console.log('Data baru:', data);
      updateCards(data);
      updateChart(data);
      addToTable(data);
    });
    socket.on('alert', (alert) => {
      console.log('Alert:', alert);
      alertCount++;
      document.getElementById('alertCount').textContent = alertCount;
      showToast(alert.pesan, alert.level);
    });
  } else {
    console.warn('socket.io CDN not loaded, running without realtime');
    setStatus(false);
  }
} catch (e) {
  console.error('Socket init failed:', e);
}

// Update kartu
function updateCards(data) {
  if (data.suhu != null) document.getElementById('suhu').textContent = Number(data.suhu).toFixed(1);
  if (data.kelembapan != null) document.getElementById('kelembapan').textContent = Number(data.kelembapan).toFixed(0);
  if (data.deviceId) document.getElementById('deviceId').textContent = data.deviceId;
}

// Chart
function initChart() {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js CDN not loaded. Check internet connection.');
    document.querySelector('.chart-section').innerHTML += '<p style="color:#f87171">Gagal load Chart.js (butuh internet ke cdn.jsdelivr.net)</p>';
    return;
  }
  const ctx = document.getElementById('chart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Suhu (C)',
          data: [],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.1)',
          tension: 0.3
        },
        {
          label: 'Kelembapan (%)',
          data: [],
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6,182,212,0.1)',
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      animation: { duration: 300 },
      plugins: {
        legend: { labels: { color: '#e2e8f0' } }
      },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
      }
    }
  });
}

function updateChart(data) {
  if (!chart) return;
  const time = new Date(data.timestamp).toLocaleTimeString();
  chart.data.labels.push(time);
  chart.data.datasets[0].data.push(data.suhu);
  chart.data.datasets[1].data.push(data.kelembapan);

  // Batasi 20 titik terakhir
  if (chart.data.labels.length > 20) {
    chart.data.labels.shift();
    chart.data.datasets.forEach(ds => ds.data.shift());
  }

  chart.update();
}

// Tabel
function addToTable(data) {
  const tbody = document.getElementById('dataTable');
  if (!tbody) return;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${new Date(data.timestamp).toLocaleTimeString()}</td>
    <td>${data.deviceId}</td>
    <td>${Number(data.suhu).toFixed(1)}C</td>
    <td>${Number(data.kelembapan).toFixed(0)}%</td>
  `;
  tbody.insertBefore(row, tbody.firstChild);

  if (tbody.children.length > 10) {
    tbody.removeChild(tbody.lastChild);
  }
}

// Toast
function showToast(message, level = 'warning') {
  const toast = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = `toast-item ${level}`;
  el.textContent = message;
  toast.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

// Load data awal dari API
async function loadInitialData() {
  try {
    const res = await fetch(`${API_URL}/data?limit=20`);
    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      updateCards(data[0]);
      if (chart) {
        data.reverse().forEach(d => {
          const time = new Date(d.timestamp).toLocaleTimeString();
          chart.data.labels.push(time);
          chart.data.datasets[0].data.push(d.suhu);
          chart.data.datasets[1].data.push(d.kelembapan);
        });
        chart.update();
      }
      data.slice(0, 10).forEach(d => addToTable(d));
    }
  } catch (err) {
    console.error('Gagal load data awal:', err);
    showToast('Backend tidak terjangkau: ' + err.message, 'warning');
  }
}

// Start
initChart();
loadInitialData();
