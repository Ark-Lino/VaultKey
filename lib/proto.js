/* VaultKey — Protobuf parser for Google Authenticator migration links */
/* Field mapping matches Google Authenticator's protobuf schema:
   field 1: secret (bytes)
   field 2: name (string)
   field 3: issuer (string)
   field 4: algorithm (enum: 1=SHA1, 2=SHA256, 3=SHA512)
   field 5: digits (enum: 1=6, 2=8)
   field 6: type (enum: 1=HOTP, 2=TOTP)
   field 7: counter (varint)
   field 8: period (varint)
*/

const ALGO_ENUM = { 1: 'SHA-1', 2: 'SHA-256', 3: 'SHA-512' };
const ALGO_NAME_TO_ENUM = { 'SHA-1': 1, 'SHA-256': 2, 'SHA-512': 3 };
const DIGITS_ENUM = { 1: 6, 2: 8 };
const DIGITS_NAME_TO_ENUM = { 6: 1, 8: 2 };
const TYPE_ENUM = { 1: 'HOTP', 2: 'TOTP' };
const TYPE_NAME_TO_ENUM = { 'HOTP': 1, 'TOTP': 2 };

function readVarint(data, offset) {
  let result = 0, shift = 0;
  while (offset < data.length) {
    const byte = data[offset++];
    result |= (byte & 0x7F) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 63) throw new Error('Malformed varint');
  }
  return [result, offset];
}

function readLengthDelimited(data, offset) {
  const [length, newOffset] = readVarint(data, offset);
  if (newOffset + length > data.length) throw new Error('Length exceeds buffer');
  return [data.slice(newOffset, newOffset + length), newOffset + length];
}

function parseOtpParameters(data) {
  let offset = 0;
  const otp = {
    secret: new Uint8Array(0),
    name: '',
    issuer: '',
    algorithm: 1,    // SHA-1
    digits: 1,       // 6 digits
    type: 2,         // TOTP
    counter: 0,
    period: 30,
  };
  while (offset < data.length) {
    const [tag, off1] = readVarint(data, offset);
    offset = off1;
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;
    if (wireType === 2) {
      const [value, off2] = readLengthDelimited(data, offset);
      offset = off2;
      if (fieldNumber === 1) otp.secret = value;
      else if (fieldNumber === 2) otp.name = new TextDecoder().decode(value);
      else if (fieldNumber === 3) otp.issuer = new TextDecoder().decode(value);
    } else if (wireType === 0) {
      const [value, off2] = readVarint(data, offset);
      offset = off2;
      if (fieldNumber === 4) otp.algorithm = value;
      else if (fieldNumber === 5) otp.digits = value;
      else if (fieldNumber === 6) otp.type = value;
      else if (fieldNumber === 7) otp.counter = value;
      else if (fieldNumber === 8) otp.period = value;
    } else if (wireType === 5) { offset += 4; }
    else if (wireType === 1) { offset += 8; }
    else if (wireType === 3) {
      let depth = 1;
      while (offset < data.length && depth > 0) {
        const [innerTag, off2] = readVarint(data, offset);
        offset = off2;
        const innerWT = innerTag & 0x7;
        if (innerWT === 3) depth++;
        else if (innerWT === 4) depth--;
        else if (innerWT === 0) { readVarint(data, offset); offset = data.length; break; }
        else if (innerWT === 1) { offset += 8; }
        else if (innerWT === 2) { readLengthDelimited(data, offset); offset = data.length; break; }
        else if (innerWT === 5) { offset += 4; }
        else { break; }
      }
    }
    else if (wireType === 4) { /* end group */ }
    else { offset++; }
  }
  return otp;
}

function parseMigrationPayload(data) {
  let offset = 0;
  const accounts = [];
  while (offset < data.length) {
    const [tag, off1] = readVarint(data, offset);
    offset = off1;
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;
    if (fieldNumber === 1 && wireType === 2) {
      const [value, off2] = readLengthDelimited(data, offset);
      offset = off2;
      accounts.push(parseOtpParameters(value));
    } else if (wireType === 0) { readVarint(data, offset); offset = data.length; break; }
    else if (wireType === 2) { readLengthDelimited(data, offset); offset = data.length; break; }
    else if (wireType === 5) { offset += 4; }
    else if (wireType === 1) { offset += 8; }
    else if (wireType === 3) {
      let depth = 1;
      while (offset < data.length && depth > 0) {
        const [innerTag, off2] = readVarint(data, offset);
        offset = off2;
        const innerWT = innerTag & 0x7;
        if (innerWT === 3) depth++;
        else if (innerWT === 4) depth--;
        else if (innerWT === 0) { readVarint(data, offset); offset = data.length; break; }
        else if (innerWT === 1) { offset += 8; }
        else if (innerWT === 2) { readLengthDelimited(data, offset); offset = data.length; break; }
        else if (innerWT === 5) { offset += 4; }
        else { break; }
      }
    }
    else if (wireType === 4) { /* end group */ }
    else { offset++; }
  }
  return accounts;
}

/* Base32 encode */
const BASE32_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function bytesToBase32(bytes) {
  let bits = 0, value = 0, output = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHA[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHA[(value << (5 - bits)) & 31];
  return output;
}

/* Decode migration URL — uses URL API for proper percent-encoding handling */
export function parseMigrationUrl(url) {
  let dataB64;
  if (url.startsWith('otpauth-migration://')) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('Invalid URL format'); }
    if (parsed.hostname !== 'offline') throw new Error("Invalid URL — expected 'offline' hostname");
    dataB64 = parsed.searchParams.get('data');
    if (!dataB64) throw new Error("Missing 'data' parameter in URL");
  } else {
    dataB64 = url;
  }
  // decodeURIComponent handles %2B → +, %2F → /, etc.
  dataB64 = decodeURIComponent(dataB64);
  // Support base64url (RFC 4648 §5)
  dataB64 = dataB64.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (dataB64.length % 4 !== 0) dataB64 += '=';
  const binary = Uint8Array.from(atob(dataB64), (c) => c.charCodeAt(0));
  const accounts = parseMigrationPayload(binary);
  if (!accounts.length) throw new Error('No accounts found in data');
  // Convert protobuf enums to human-readable values
  return accounts.map((otp) => ({
    name: otp.name,
    issuer: otp.issuer,
    secret: otp.secret instanceof Uint8Array ? otp.secret : new Uint8Array(otp.secret),
    secretBase32: bytesToBase32(otp.secret),
    algorithm: ALGO_ENUM[otp.algorithm] || 'SHA-1',
    digits: DIGITS_ENUM[otp.digits] || 6,
    type: TYPE_ENUM[otp.type] || 'TOTP',
    counter: otp.counter || 0,
    period: otp.period || 30,
  }));
}

/* Build otpauth URL for a single account */
function buildOtpauthUrl(account) {
  const secret = typeof account.secret === 'string'
    ? account.secret
    : bytesToBase32(account.secret instanceof Uint8Array ? account.secret : new Uint8Array(account.secret));
  const params = [`secret=${secret}`];
  if (account.issuer) params.push(`issuer=${encodeURIComponent(account.issuer)}`);
  const algoName = (account.algorithm || 'SHA-1').replace('-', '');
  if (algoName !== 'SHA1') params.push(`algorithm=${algoName}`);
  if (account.digits && account.digits !== 6) params.push(`digits=${account.digits}`);
  if (account.period && account.period !== 30) params.push(`period=${account.period}`);
  const type = account.type || 'TOTP';
  const name = encodeURIComponent(account.name || '');
  return `otpauth://${type}/${name}?${params.join('&')}`;
}

/* Encode migration URL */
export function buildMigrationUrl(accounts) {
  function encodeVarint(value) {
    const bytes = [];
    while (value > 0x7F) { bytes.push((value & 0x7F) | 0x80); value >>>= 7; }
    bytes.push(value);
    return new Uint8Array(bytes);
  }
  function encodeField(fieldNum, wireType, data) {
    const tag = encodeVarint((fieldNum << 3) | wireType);
    if (wireType === 2) {
      const lenBytes = encodeVarint(data.length);
      const result = new Uint8Array(tag.length + lenBytes.length + data.length);
      result.set(tag, 0); result.set(lenBytes, tag.length); result.set(data, tag.length + lenBytes.length);
      return result;
    } else if (wireType === 0) {
      const valBytes = encodeVarint(data);
      const result = new Uint8Array(tag.length + valBytes.length);
      result.set(tag, 0); result.set(valBytes, tag.length);
      return result;
    }
    return new Uint8Array(0);
  }

  const otpParams = accounts.map((acc) => {
    const parts = [];
    const secret = acc.secret instanceof Uint8Array ? acc.secret : new Uint8Array(acc.secret);
    parts.push(encodeField(1, 2, secret));
    if (acc.name) parts.push(encodeField(2, 2, new TextEncoder().encode(acc.name)));
    if (acc.issuer) parts.push(encodeField(3, 2, new TextEncoder().encode(acc.issuer)));
    parts.push(encodeField(4, 0, ALGO_NAME_TO_ENUM[acc.algorithm] || 1));
    parts.push(encodeField(5, 0, DIGITS_NAME_TO_ENUM[acc.digits] || 1));
    parts.push(encodeField(6, 0, TYPE_NAME_TO_ENUM[acc.type] || 2));
    if (acc.counter) parts.push(encodeField(7, 0, acc.counter));
    if (acc.period && acc.period !== 30) parts.push(encodeField(8, 0, acc.period));
    const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
    const param = new Uint8Array(totalLen);
    let offset = 0;
    for (const p of parts) { param.set(p, offset); offset += p.length; }
    return encodeField(1, 2, param);
  });

  const totalLen = otpParams.reduce((sum, p) => sum + p.length, 0);
  const payload = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of otpParams) { payload.set(p, offset); offset += p.length; }
  const b64 = btoa(String.fromCharCode(...payload));
  return `otpauth-migration://offline?data=${encodeURIComponent(b64)}`;
}
