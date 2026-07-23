/* VaultKey — Storage abstraction */
import { STORAGE_KEY, SETTINGS_KEY, DEFAULT_SETTINGS } from './constants.js';
import { base32Decode } from './totp.js';

function ensureArray(val) {
  if (!Array.isArray(val)) return [];
  return val.map((a) => {
    if (a.secret instanceof Uint8Array) return a;
    if (Array.isArray(a.secret)) {
      a.secret = new Uint8Array(a.secret);
    } else if (typeof a.secret === 'string' && a.secret.length > 0) {
      a.secret = base32Decode(a.secret);
    }
    return a;
  });
}

export async function getAccounts() {
  const data = await browser.storage.local.get(STORAGE_KEY);
  return ensureArray(data[STORAGE_KEY] || []);
}

export async function saveAccounts(accounts) {
  const serialisable = accounts.map((a) => ({
    ...a,
    secret: a.secret instanceof Uint8Array ? Array.from(a.secret) : a.secret,
  }));
  await browser.storage.local.set({ [STORAGE_KEY]: serialisable });
}

export async function addAccount(account) {
  const accounts = await getAccounts();
  // Ensure secret is Uint8Array before saving
  const acc = { ...account };
  if (typeof acc.secret === 'string') {
    acc.secret = base32Decode(acc.secret);
  }
  accounts.push({ ...acc, id: crypto.randomUUID() });
  await saveAccounts(accounts);
  return accounts;
}

export async function updateAccount(id, updates) {
  const accounts = await getAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) return accounts;
  accounts[idx] = { ...accounts[idx], ...updates };
  // Ensure secret is Uint8Array before saving
  if (typeof accounts[idx].secret === 'string') {
    accounts[idx].secret = base32Decode(accounts[idx].secret);
  }
  await saveAccounts(accounts);
  return accounts;
}

export async function deleteAccount(id) {
  const accounts = await getAccounts();
  const filtered = accounts.filter((a) => a.id !== id);
  await saveAccounts(filtered);
  return filtered;
}

export async function importAccounts(newAccounts) {
  const existing = await getAccounts();
  const existingSecrets = new Set(existing.map((a) => {
    if (a.secret instanceof Uint8Array) return Array.from(a.secret).join(',');
    return String(a.secret);
  }));
  for (const a of newAccounts) {
    // Ensure secret is Uint8Array before saving
    if (typeof a.secret === 'string') {
      a.secret = base32Decode(a.secret);
    }
    const secretKey = (a.secret instanceof Uint8Array) ? Array.from(a.secret).join(',') : String(a.secret);
    if (!existingSecrets.has(secretKey)) {
      existing.push({ ...a, id: crypto.randomUUID() });
    }
  }
  await saveAccounts(existing);
  return existing;
}

export async function getSettings() {
  const data = await browser.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
}

export async function saveSettings(settings) {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function resetAll() {
  await browser.storage.local.remove([STORAGE_KEY, SETTINGS_KEY]);
}
