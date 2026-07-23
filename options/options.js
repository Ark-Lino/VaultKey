/* VaultKey — Options page logic */
import { getAccounts, getSettings, saveSettings, importAccounts, resetAll } from '../lib/storage.js';
import { parseMigrationUrl, buildMigrationUrl } from '../lib/proto.js';
import { showToast } from '../lib/toast.js';

const themeSelect = document.getElementById('opt-theme');
const autoCopyToggle = document.getElementById('opt-autocopy');
const timerToggle = document.getElementById('opt-timer');
const generateBtn = document.getElementById('btn-generate-link');
const exportLinkBox = document.getElementById('export-link-box');
const exportLink = document.getElementById('export-link');
const copyLinkBtn = document.getElementById('btn-copy-link');
const importLink = document.getElementById('import-link');
const validateBtn = document.getElementById('btn-validate-import');
const importPreview = document.getElementById('import-preview');
const importPreviewList = document.getElementById('import-preview-list');
const importConfirm = document.getElementById('btn-import-confirm');

let settings = {};
let pendingImport = [];

// Tabs
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// Apply theme to options page
async function applyTheme() {
  settings = await getSettings();
  const root = document.documentElement;
  if (settings.theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', settings.theme);
  }
  themeSelect.value = settings.theme;
  autoCopyToggle.checked = settings.autoCopyFirst;
  timerToggle.checked = settings.showTimerCircle;
}

// Settings changes
themeSelect.addEventListener('change', async () => {
  settings.theme = themeSelect.value;
  await saveSettings(settings);
  await applyTheme();
});

autoCopyToggle.addEventListener('change', async () => {
  settings.autoCopyFirst = autoCopyToggle.checked;
  await saveSettings(settings);
});

timerToggle.addEventListener('change', async () => {
  settings.showTimerCircle = timerToggle.checked;
  await saveSettings(settings);
});

document.getElementById('btn-reset-all').addEventListener('click', async () => {
  if (!confirm('This will delete ALL accounts and reset settings. Continue?')) return;
  await resetAll();
  settings = await getSettings();
  await applyTheme();
  showToast('All data has been reset');
});

// Export
generateBtn.addEventListener('click', async () => {
  const accounts = await getAccounts();
  if (accounts.length === 0) {
    showToast('No accounts to export', 'warning');
    return;
  }
  const url = buildMigrationUrl(accounts);
  exportLink.value = url;
  exportLinkBox.style.display = 'flex';
  showToast('Migration link generated');
});

copyLinkBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(exportLink.value);
    showToast('Link copied!');
  } catch (_) {
    showToast('Copy failed', 'error');
  }
});

// Import
validateBtn.addEventListener('click', () => {
  const url = importLink.value.trim();
  if (!url) {
    showToast('Please paste a migration link', 'error');
    return;
  }
  try {
    pendingImport = parseMigrationUrl(url);
    if (pendingImport.length === 0) {
      showToast('No accounts found in link', 'warning');
      return;
    }
    importPreview.style.display = 'block';
    importPreviewList.innerHTML = '';
    for (const a of pendingImport) {
      const div = document.createElement('div');
      div.className = 'import-preview-item';
      div.innerHTML = `<span class="preview-name">${escapeHtml(a.name || 'Unnamed')}</span><span class="preview-issuer">${escapeHtml(a.issuer || '')}</span>`;
      importPreviewList.appendChild(div);
    }
    showToast(`Found ${pendingImport.length} account(s)`);
  } catch (err) {
    showToast('Invalid migration link: ' + err.message, 'error');
  }
});

importConfirm.addEventListener('click', async () => {
  if (pendingImport.length === 0) return;
  // Convert decoded accounts to storage format (secret as Base32 string)
  const toImport = pendingImport.map((a) => ({
    name: a.name,
    issuer: a.issuer,
    secret: a.secretBase32,
    algorithm: a.algorithm,
    digits: a.digits,
    type: a.type,
    counter: a.counter || 0,
    period: a.period || 30,
  }));
  await importAccounts(toImport);
  importPreview.style.display = 'none';
  importLink.value = '';
  showToast(`Imported ${pendingImport.length} account(s)`);
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Init
applyTheme();
