import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPublicPlace } from '../src/ai/compose_route.js';

// 지도 실패 안내용: 장소 주소는 앱에 보내고, 장소 좌표는 보내지 않는다.
test('toPublicPlace는 장소 주소를 담고 좌표는 뺀다', () => {
  const out = toPublicPlace({ id: 'J01', name: '약령시박물관', type: 'exhibit', lat: 35.87, lng: 128.59, address: '대구 중구 [예시 주소]' });
  assert.equal(out.address, '대구 중구 [예시 주소]');
  assert.equal('lat' in out, false);
  assert.equal('lng' in out, false);
});

test('주소가 없으면 null', () => {
  assert.equal(toPublicPlace({ id: 'J02', name: '근대골목', type: 'outdoor' }).address, null);
});
