/* VaultKey — Background service worker */
const GITHUB_REPO = 'Ark-Lino/VaultKey';
const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

async function checkForUpdates() {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    if (!response.ok) return;
    const release = await response.json();
    const latestVersion = release.tag_name.replace(/^v/, '');
    const currentVersion = browser.runtime.getManifest().version;

    if (latestVersion !== currentVersion) {
      browser.storage.local.set({
        vaultkey_update: {
          available: true,
          version: latestVersion,
          url: release.html_url,
          name: release.name,
          checkedAt: Date.now(),
        },
      });
    } else {
      browser.storage.local.set({
        vaultkey_update: { available: false, version: currentVersion, checkedAt: Date.now() },
      });
    }
  } catch (_) {
    // Offline or rate-limited — silently skip
  }
}

// Check on install and periodically
browser.runtime.onInstalled.addListener(() => {
  checkForUpdates();
});

browser.alarms.create('vaultkey-update-check', { periodInMinutes: 360 });
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'vaultkey-update-check') {
    checkForUpdates();
  }
});

// Also check when browser starts
checkForUpdates();
