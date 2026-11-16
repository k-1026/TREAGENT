import test from 'node:test';
import assert from 'node:assert/strict';
import { toGrid } from '../src/weather/kma_grid.js';

test('서울시청 좌표는 격자 (60, 127)이다', () => {
  // 기상청 격자 변환 예제로 널리 쓰이는 값이다 (2차 자료 기준, 공식 문서 확인 전)
  assert.deepEqual(toGrid(37.5665, 126.978), { nx: 60, ny: 127 });
});

test('대구 시내 좌표는 정수 격자이고 대구 부근 범위 안이다', () => {
  // 대구시청 부근 좌표. 정확한 격자값은 기상청 격자표로 확인 전이라 범위만 검사한다.
  const { nx, ny } = toGrid(35.8714, 128.6014);
  assert.ok(Number.isInteger(nx) && Number.isInteger(ny), '정수여야 한다');
  assert.ok(nx >= 85 && nx <= 92, `nx가 대구 부근이 아니다: ${nx}`);
  assert.ok(ny >= 87 && ny <= 94, `ny가 대구 부근이 아니다: ${ny}`);
});