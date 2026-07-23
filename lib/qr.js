/* VaultKey — QR Code wrapper using qrcode-generator (kazuhikoarase) */

export function generateQR(text, canvas, size = 256) {
  try {
    const qrcode = window.qrcode;
    if (!qrcode) {
      console.error('QR library not loaded');
      return false;
    }

    // Auto-detect best version for the text
    let qr = null;
    for (let typeNumber = 1; typeNumber <= 40; typeNumber++) {
      try {
        qr = qrcode(typeNumber, 'L');
        qr.addData(text);
        qr.make();
        break;
      } catch (_) {
        qr = null;
      }
    }
    if (!qr) return false;

    const moduleCount = qr.getModuleCount();
    const cellSize = Math.floor(size / moduleCount);
    const margin = Math.floor((size - cellSize * moduleCount) / 2);

    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(margin + col * cellSize, margin + row * cellSize, cellSize, cellSize);
        }
      }
    }
    return true;
  } catch (e) {
    console.error('QR generation failed:', e);
    return false;
  }
}
