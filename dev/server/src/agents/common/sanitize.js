import { RECORD_MAX_CHARS } from './config.js';

// 실행 기록에 넣기 전에 개인정보를 걸러낸다 (절대 규칙 1, CLAUDE.md 개인정보).
// 이 함수는 "키 이름"과 "좌표·이메일·이미지 모양 문자열"로 거르는 방어선이다. 모든 개인정보를 잡는다고 보장하지 못하므로,
// 호출하는 쪽도 처음부터 좌표·계정·사진·영수증을 summary에 넣지 않는다.

// 키 이름을 소문자로 바꾸고 영숫자만 남긴 값이 이 목록에 있으면 값을 통째로 버린다.
const FORBIDDEN_KEYS = new Set([
  'lat', 'lng', 'lon', 'long', 'latitude', 'longitude', 'coord', 'coords', 'coordinate', 'coordinates', 'position', 'location',
  'userid', 'uid', 'accountid', 'actorkey', 'email', 'phone',
  'token', 'accesstoken', 'refreshtoken', 'authorization', 'password', 'apikey', 'secret',
  'image', 'imagebase64', 'photo', 'receipt', 'exif',
  'card', 'cardnumber', 'payment',
]);

const COORD_PAIR = /-?\d{1,3}\.\d{3,}\s*[,\s]\s*-?\d{1,3}\.\d{3,}/g;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const DATA_URL = /data:[a-z/+.-]+;base64,[A-Za-z0-9+/=]+/gi;
const MAX_DEPTH = 6;
const MAX_ITEMS = 50;

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanString(text, maxChars) {
  const cleaned = text
    .replace(DATA_URL, '[이미지 제거]')
    .replace(COORD_PAIR, '[좌표 제거]')
    .replace(EMAIL, '[제거]');
  return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars)}…` : cleaned;
}

export function sanitize(value, { maxChars = RECORD_MAX_CHARS } = {}, depth = 0) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return cleanString(value, maxChars);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (depth >= MAX_DEPTH) return '[깊이 초과]';
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((v) => sanitize(v, { maxChars }, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(normalizeKey(key))) continue;
      if (typeof v === 'function' || typeof v === 'symbol') continue;
      out[key] = sanitize(v, { maxChars }, depth + 1);
    }
    return out;
  }
  return null; // function, symbol, bigint 등
}
