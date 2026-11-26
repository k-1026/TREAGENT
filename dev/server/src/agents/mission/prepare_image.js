import { createHash } from 'node:crypto';

// 사진을 Gemini로 보내기 전에 코드가 준비한다 (plan/spec/agent_architecture_v2.md 4-2장 "사진·영수증 처리").
//   인증샷(photo): JPEG의 EXIF(위치·기기 정보가 든 APP1)와 APP13(IPTC)을 잘라 낸다. 그림 데이터는 건드리지 않는다.
//   영수증(receipt): 인증샷과 같이 EXIF를 잘라 낸다. 결제 정보(카드 번호 등)를 코드가 가리지는 못한다 [확인 필요: 가리는 방법].
//     그래서 앱이 "카드 번호는 가리고 찍어 주세요"라고 안내하고, 판정 LLM에는 결제 정보를 읽지 말라고 지시하며, 사진 원본은 저장하지 않는다 (해시만).
//   JPEG가 아니면 거절한다 (IMAGE_FORMAT). 원본은 저장하지 않고, 같은 사진 중복 검사용 해시만 돌려준다.
//   반환: async (base64, { kind }) => { ok: true, base64, hash } | { ok: false, code }
const STRIP = new Set([0xe1, 0xed]); // APP1(EXIF, XMP), APP13(IPTC)

export function stripJpegMetadata(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null; // JPEG 시작 표시(SOI)가 아니다
  const parts = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null; // 구간 표시가 깨졌다
    const marker = buf[i + 1];
    if (marker === 0xd9) { parts.push(buf.subarray(i)); return Buffer.concat(parts); }
    if (marker === 0xda) { parts.push(buf.subarray(i)); return Buffer.concat(parts); } // 그림 데이터 시작: 나머지는 그대로
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) return null;
    if (!STRIP.has(marker)) parts.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null;
}

export async function prepareImage(base64, { kind }) {
  let buf;
  try {
    buf = Buffer.from(base64, 'base64');
  } catch {
    return { ok: false, code: 'IMAGE_FORMAT' };
  }
  const clean = stripJpegMetadata(buf);
  if (!clean) return { ok: false, code: 'IMAGE_FORMAT' };
  return { ok: true, base64: clean.toString('base64'), hash: createHash('sha256').update(clean).digest('hex') };
}
