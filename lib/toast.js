/* VaultKey — Toast notifications */

export function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  toast.style.cssText = `
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    color: #f0f0f5;
    pointer-events: auto;
    animation: toastIn 0.3s ease, toastOut 0.3s ease 2.7s forwards;
    max-width: 320px;
    text-align: center;
  `;
  const colors = { success: '#34d399', error: '#f87171', warning: '#fbbf24', info: '#a78bfa' };
  toast.style.background = colors[type] || colors.success;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
