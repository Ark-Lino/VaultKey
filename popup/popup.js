/* VaultKey — Popup logic */
import { getAccounts, addAccount, updateAccount, deleteAccount, importAccounts, getSettings, saveSettings } from '../lib/storage.js';
import { generateTOTP, getTimeRemaining, getProgress, totpUrl, validateBase32, base32Encode } from '../lib/totp.js';
import { parseMigrationUrl } from '../lib/proto.js';
import { generateQR } from '../lib/qr.js';
import { showToast } from '../lib/toast.js';

// DOM refs
const accountsList = document.getElementById('accounts-list');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search');
const fabBtn = document.getElementById('fab-add');
const overlay = document.getElementById('overlay');
const bottomSheet = document.getElementById('bottom-sheet');
const themeToggle = document.getElementById('theme-toggle');
const settingsBtn = document.getElementById('settings-btn');
const selectToggle = document.getElementById('select-toggle');
const deleteBar = document.getElementById('delete-bar');
const deleteCount = document.getElementById('delete-count');
const btnDeleteSelected = document.getElementById('btn-delete-selected');

// Modal refs
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const accountForm = document.getElementById('account-form');
const accName = document.getElementById('acc-name');
const accIssuer = document.getElementById('acc-issuer');
const accSecret = document.getElementById('acc-secret');
const accDigits = document.getElementById('acc-digits');
const accPeriod = document.getElementById('acc-period');
const secretStatus = document.getElementById('secret-status');
const btnDelete = document.getElementById('btn-delete');
const btn_cancel = document.getElementById('btn-cancel');
const modalClose = document.getElementById('modal-close');

// QR Modal
const qrOverlay = document.getElementById('qr-modal-overlay');
const qrCanvas = document.getElementById('qr-canvas');
const qrLabel = document.getElementById('qr-label');
const qrClose = document.getElementById('qr-modal-close');

// Import Modal
const importOverlay = document.getElementById('import-modal-overlay');
const importLink = document.getElementById('import-link');
const importPreview = document.getElementById('import-preview');
const importPreviewList = document.getElementById('import-preview-list');
const importDecode = document.getElementById('import-decode');
const importConfirm = document.getElementById('import-confirm');
const importCancel = document.getElementById('import-cancel');
const importClose = document.getElementById('import-modal-close');

let accounts = [];
let settings = {};
let editingId = null;
let timerTimeouts = [];
let pendingImport = [];
let selectMode = false;
let selectedIds = new Set();

// Theme
async function applyTheme() {
  settings = await getSettings();
  const root = document.documentElement;
  if (settings.theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', settings.theme);
  }
}

themeToggle.addEventListener('click', async () => {
  // Cycle through visually: dark → light → auto (skip if auto looks same as current)
  const currentVisual = document.documentElement.getAttribute('data-theme');
  const autoResolvesTo = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  // Determine next theme that produces a different visual
  const cycle = ['dark', 'light', 'auto'];
  let nextTheme;
  const currentIdx = cycle.indexOf(settings.theme);
  // Try next theme, skip if it would look the same
  for (let i = 1; i <= cycle.length; i++) {
    const candidate = cycle[(currentIdx + i) % cycle.length];
    const visual = candidate === 'auto' ? autoResolvesTo : candidate;
    if (visual !== currentVisual) {
      nextTheme = candidate;
      break;
    }
  }
  if (!nextTheme) nextTheme = cycle[(currentIdx + 1) % cycle.length];
  settings.theme = nextTheme;
  await saveSettings(settings);
  await applyTheme();
});

// Settings page
settingsBtn.addEventListener('click', () => {
  browser.runtime.openOptionsPage();
});

// Select mode
selectToggle.addEventListener('click', () => {
  selectMode = !selectMode;
  selectedIds.clear();
  document.body.classList.toggle('select-mode', selectMode);
  deleteBar.classList.remove('active');
  renderAccounts();
});

btnDeleteSelected.addEventListener('click', async () => {
  if (selectedIds.size === 0) return;
  for (const id of selectedIds) {
    await deleteAccount(id);
  }
  selectedIds.clear();
  selectMode = false;
  document.body.classList.remove('select-mode');
  deleteBar.classList.remove('active');
  await renderAccounts();
  showToast('Deleted selected accounts');
});

function updateDeleteBar() {
  const count = selectedIds.size;
  deleteCount.textContent = count + ' selected';
  deleteBar.classList.toggle('active', count > 0);
}

// Search
searchInput.addEventListener('input', () => renderAccounts());

// FAB + bottom sheet
fabBtn.addEventListener('click', () => {
  overlay.classList.add('active');
  bottomSheet.classList.add('active');
});

overlay.addEventListener('click', closeSheet);

function closeSheet() {
  overlay.classList.remove('active');
  bottomSheet.classList.remove('active');
}

document.getElementById('option-enter').addEventListener('click', () => {
  closeSheet();
  openModal();
});

document.getElementById('option-import').addEventListener('click', () => {
  closeSheet();
  openImportModal();
});

// Modal
function openModal(account = null) {
  editingId = account ? account.id : null;
  modalTitle.textContent = account ? 'Edit Account' : 'Enter Setup Key';
  accName.value = account ? account.name : '';
  accIssuer.value = account ? account.issuer : '';
  accSecret.value = account ? base32EncodeAccount(account.secret) : '';
  accDigits.value = account ? account.digits : 6;
  accPeriod.value = account ? account.period : 30;
  btnDelete.style.display = account ? 'block' : 'none';
  secretStatus.textContent = '';
  modalOverlay.classList.add('active');
}

function closeModal() {
  modalOverlay.classList.remove('active');
  editingId = null;
  accountForm.reset();
  secretStatus.textContent = '';
}

modalClose.addEventListener('click', closeModal);
btn_cancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

// Secret validation
accSecret.addEventListener('input', () => {
  const val = accSecret.value.trim().replace(/\s/g, '');
  if (!val) {
    secretStatus.textContent = '';
    secretStatus.className = 'secret-status';
    return;
  }
  if (validateBase32(val)) {
    secretStatus.textContent = 'Valid Base32';
    secretStatus.className = 'secret-status secret-valid';
  } else {
    secretStatus.textContent = 'Invalid Base32 (A-Z, 2-7 only)';
    secretStatus.className = 'secret-status secret-invalid';
  }
});

// Form submit
accountForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const secret = accSecret.value.trim().replace(/\s/g, '').toUpperCase();
  if (!validateBase32(secret)) {
    showToast('Invalid Base32 secret', 'error');
    return;
  }
  const data = {
    name: accName.value.trim(),
    issuer: accIssuer.value.trim(),
    secret,
    digits: Number(accDigits.value),
    period: Number(accPeriod.value),
    algorithm: 'SHA-1',
    type: 'TOTP',
    counter: 0,
  };
  const isEdit = !!editingId;
  if (editingId) {
    accounts = await updateAccount(editingId, data);
  } else {
    accounts = await addAccount(data);
  }
  closeModal();
  renderAccounts();
  showToast(isEdit ? 'Account updated' : 'Account added');
});

// Delete
btnDelete.addEventListener('click', async () => {
  if (!editingId) return;
  accounts = await deleteAccount(editingId);
  closeModal();
  renderAccounts();
  showToast('Account deleted');
});

// QR Modal
function openQRModal(account) {
  const url = totpUrl(account);
  const ok = generateQR(url, qrCanvas, 220);
  qrLabel.textContent = `${account.issuer || ''} ${account.name || ''}`.trim();
  qrOverlay.classList.add('active');
}

qrClose.addEventListener('click', () => qrOverlay.classList.remove('active'));
qrOverlay.addEventListener('click', (e) => { if (e.target === qrOverlay) qrOverlay.classList.remove('active'); });

// Import Modal
function openImportModal() {
  importLink.value = '';
  importPreview.style.display = 'none';
  importConfirm.style.display = 'none';
  importDecode.style.display = 'inline-block';
  pendingImport = [];
  importOverlay.classList.add('active');
}

importClose.addEventListener('click', () => importOverlay.classList.remove('active'));
importCancel.addEventListener('click', () => importOverlay.classList.remove('active'));
importOverlay.addEventListener('click', (e) => { if (e.target === importOverlay) importOverlay.classList.remove('active'); });

importDecode.addEventListener('click', () => {
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
      const nameSpan = document.createElement('span');
      nameSpan.className = 'preview-name';
      nameSpan.textContent = a.name || 'Unnamed';
      const issuerSpan = document.createElement('span');
      issuerSpan.className = 'preview-issuer';
      issuerSpan.textContent = a.issuer || '';
      div.appendChild(nameSpan);
      div.appendChild(issuerSpan);
      importPreviewList.appendChild(div);
    }
    importConfirm.style.display = 'inline-block';
    importDecode.style.display = 'none';
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
  accounts = await importAccounts(toImport);
  importOverlay.classList.remove('active');
  await renderAccounts();
  showToast(`Imported ${pendingImport.length} account(s)`);
});

// Render accounts
async function renderAccounts() {
  accounts = await getAccounts();
  const query = searchInput.value.toLowerCase();
  const filtered = accounts.filter((a) => {
    if (!query) return true;
    return (a.name || '').toLowerCase().includes(query) || (a.issuer || '').toLowerCase().includes(query);
  });

  // Clear old timers
  timerTimeouts.forEach(clearTimeout);
  timerTimeouts = [];

  if (filtered.length === 0) {
    accountsList.innerHTML = '';
    accountsList.appendChild(emptyState);
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  accountsList.innerHTML = '';

  for (const account of filtered) {
    const card = document.createElement('div');
    card.className = 'account-card';

    const circumference = 2 * Math.PI * 14;
    let code = '000000';
    try {
      code = await generateTOTP(account.secret, account);
    } catch (err) {
      console.error('[VaultKey] TOTP failed:', account.name, err);
    }
    const remaining = getTimeRemaining(account.period);

    // Build card via DOMParser to avoid innerHTML warning
    const timerHidden = settings.showTimerCircle === false ? ' hidden' : '';
    const cardHTML = [
      `<div class="account-header">`,
        `<input type="checkbox" class="select-checkbox" data-id="${account.id}">`,
        `<span class="account-name"></span>`,
        `<span class="account-issuer"></span>`,
      `</div>`,
      `<div class="totp-row">`,
        `<span class="totp-code" data-id="${account.id}">${formatCode(code, account.digits)}</span>`,
        `<svg class="timer-ring${timerHidden}" viewBox="0 0 36 36" data-period="${account.period}">`,
          `<circle class="timer-bg" cx="18" cy="18" r="14"/>`,
          `<circle class="timer-progress" cx="18" cy="18" r="14" stroke-dasharray="${circumference}" stroke-dashoffset="0" data-circumference="${circumference}"/>`,
          `<text class="timer-text" x="18" y="18" text-anchor="middle" dominant-baseline="central" data-remaining="${remaining}">${remaining}</text>`,
        `</svg>`,
      `</div>`,
      `<div class="account-actions">`,
        `<button class="action-btn" data-action="copy" data-id="${account.id}">Copy</button>`,
        `<button class="action-btn" data-action="qr" data-id="${account.id}">QR</button>`,
        `<button class="action-btn" data-action="edit" data-id="${account.id}">Edit</button>`,
        `<button class="action-btn" data-action="url" data-id="${account.id}">URL</button>`,
      `</div>`,
    ].join('');
    const parsed = new DOMParser().parseFromString(cardHTML, 'text/html');
    const nameEl = parsed.querySelector('.account-name');
    const issuerEl = parsed.querySelector('.account-issuer');
    nameEl.textContent = account.name || 'Unnamed';
    issuerEl.textContent = account.issuer || '';
    while (parsed.body.firstChild) card.appendChild(parsed.body.firstChild);

    // Timer update
    const timerEl = card.querySelector('.timer-progress');
    const textEl = card.querySelector('.timer-text');
    const period = account.period || 30;

    const updateTimer = async () => {
      const prog = getProgress(period);
      const circ = Number(timerEl.dataset.circumference);
      timerEl.setAttribute('stroke-dashoffset', String(circ * (1 - prog)));
      const rem = getTimeRemaining(period);
      textEl.textContent = rem;
      try {
        const newCode = await generateTOTP(account.secret, account);
        card.querySelector('.totp-code').textContent = formatCode(newCode, account.digits);
      } catch (_) {}
      const tid = setTimeout(updateTimer, 1000);
      timerTimeouts.push(tid);
    };

    updateTimer();

    // Copy on click
    card.querySelector('.totp-code').addEventListener('click', async (e) => {
      const currentCode = e.target.textContent.replace(/\s/g, '');
      try {
        await navigator.clipboard.writeText(currentCode);
        showToast('Code copied!');
      } catch (_) {
        showToast('Copy failed', 'error');
      }
    });

    // Action buttons
    card.querySelector('.account-actions').addEventListener('click', async (e) => {
      const btn = e.target.closest('.action-btn');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const acct = accounts.find((a) => a.id === id);
      if (!acct) return;

      if (action === 'copy') {
        try {
          const c = await generateTOTP(acct.secret, acct);
          await navigator.clipboard.writeText(c);
          showToast('Code copied!');
        } catch (_) { showToast('Copy failed', 'error'); }
      } else if (action === 'qr') {
        openQRModal(acct);
      } else if (action === 'edit') {
        openModal(acct);
      } else if (action === 'url') {
        const url = totpUrl(acct);
        try {
          await navigator.clipboard.writeText(url);
          showToast('URL copied!');
        } catch (_) { showToast('Copy failed', 'error'); }
      }
    });

    accountsList.appendChild(card);
  }

  // Show select toggle when accounts exist
  selectToggle.style.display = accounts.length > 0 ? 'flex' : 'none';

  // Wire up checkboxes
  accountsList.querySelectorAll('.select-checkbox').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) {
        selectedIds.add(id);
        e.target.closest('.account-card').classList.add('selected');
      } else {
        selectedIds.delete(id);
        e.target.closest('.account-card').classList.remove('selected');
      }
      updateDeleteBar();
    });
  });

  // Card click in select mode toggles checkbox
  if (selectMode) {
    accountsList.querySelectorAll('.account-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.select-checkbox') || e.target.closest('.action-btn') || e.target.closest('.totp-code')) return;
        const cb = card.querySelector('.select-checkbox');
        if (cb) {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change'));
        }
      });
    });
  }
}

function formatCode(code, digits) {
  if (digits === 6) return code.slice(0, 3) + ' ' + code.slice(3);
  if (digits === 8) return code.slice(0, 4) + ' ' + code.slice(4);
  return code;
}

function base32EncodeAccount(secret) {
  if (typeof secret === 'string') return secret;
  if (secret instanceof Uint8Array) return base32Encode(secret);
  return '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (importOverlay.classList.contains('active')) { importOverlay.classList.remove('active'); return; }
    if (qrOverlay.classList.contains('active')) { qrOverlay.classList.remove('active'); return; }
    if (modalOverlay.classList.contains('active')) { closeModal(); return; }
    if (bottomSheet.classList.contains('active')) { closeSheet(); return; }
    if (selectMode) {
      selectMode = false;
      selectedIds.clear();
      document.body.classList.remove('select-mode');
      deleteBar.classList.remove('active');
      renderAccounts();
      return;
    }
  }
});

// Update check
async function checkUpdate() {
  try {
    const data = await browser.storage.local.get('vaultkey_update');
    const update = data.vaultkey_update;
    if (update && update.available) {
      const banner = document.getElementById('update-banner');
      const text = document.getElementById('update-text');
      const link = document.getElementById('update-link');
      text.textContent = `New version v${update.version} available`;
      link.href = update.url;
      banner.style.display = 'flex';
    }
  } catch (_) {}
}

// Init
(async () => {
  await applyTheme();
  await renderAccounts();
  checkUpdate();
})();
