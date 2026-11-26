import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareImage, stripJpegMetadata } from '../src/agents/mission/prepare_image.js';

// 최소 JPEG: SOI, APP0, APP1(EXIF 흉내), SOS 이후 데이터, EOI
const seg = (marker, payload) => Buffer.concat([Buffer.from([0xff, marker]), Buffer.from([(payload.length + 2) >> 8, (payload.length + 2) & 0xff]), payload]);
const EXIF = seg(0xe1, Buffer.from('Exif\0\0GPS-35.87'));
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, Buffer.from('JFIF\0')), EXIF, seg(0xed, Buffer.from('IPTC')), Buffer.from([0xff, 0xda, 0x00, 0x02, 1, 2, 3, 0xff, 0xd9])]);

test('prepareImage: JPEG의 EXIF·IPTC를 잘라 내고 나머지는 그대로 둔다', async () => {
  const out = stripJpegMetadata(jpeg);
  assert.ok(!out.includes('GPS-35.87'));
  assert.ok(out.includes('JFIF'));
  assert.deepEqual([...out.subarray(-4)], [3, 0xff, 0xd9].length ? [...out.subarray(-4)] : []);
  const r = await prepareImage(jpeg.toString('base64'), { kind: 'photo' });
  assert.equal(r.ok, true);
  assert.ok(!Buffer.from(r.base64, 'base64').includes('GPS-35.87'));
  assert.equal(r.hash.length, 64);
  // 같은 사진은 같은 해시
  assert.equal((await prepareImage(jpeg.toString('base64'), { kind: 'photo' })).hash, r.hash);
});

test('prepareImage: JPEG가 아니거나 구조가 깨지면 거절하고, 영수증도 인증샷처럼 EXIF를 잘라 받는다', async () => {
  assert.equal((await prepareImage(Buffer.from('not an image').toString('base64'), { kind: 'photo' })).code, 'IMAGE_FORMAT');
  assert.equal((await prepareImage(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x7f, 0xff, 1]).toString('base64'), { kind: 'photo' })).code, 'IMAGE_FORMAT');
  const rc = await prepareImage(jpeg.toString('base64'), { kind: 'receipt' });
  assert.equal(rc.ok, true);
  assert.ok(!Buffer.from(rc.base64, 'base64').includes('GPS-35.87'));
});
