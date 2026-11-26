// 경로 위 계산 모음. 모두 기기 안에서만 계산하고 어디에도 보내거나 저장하지 않는다.
import type { WalkStep } from './server_api';

export type LatLng = { lat: number; lng: number };
export type Track = { path: LatLng[]; cum: number[]; total: number }; // cum[i] = 출발점에서 i번째 점까지 거리(m)

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

// 두 점의 직선거리(m). 하버사인 공식.
export function distM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function buildTrack(path: LatLng[]): Track {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + distM(path[i - 1], path[i]));
  return { path, cum, total: cum[cum.length - 1] ?? 0 };
}

// 내 위치를 경로선 위의 가장 가까운 점에 댄다.
//  along: 출발점에서 그 점까지 경로를 따라 간 거리(m), off: 경로선에서 떨어진 거리(m)
//  minAlong: 이 거리보다 뒤쪽 구간만 찾는다 (경로가 꼬여 있어도 뒤로 튀지 않게)
export function project(track: Track, me: LatLng, minAlong = 0): { along: number; off: number } {
  const { path, cum } = track;
  if (path.length === 0) return { along: 0, off: 0 };
  if (path.length === 1) return { along: 0, off: distM(path[0], me) };
  const kx = Math.cos(rad(me.lat)) * 111320; // 경도 1도 ≈ m
  const ky = 110540; // 위도 1도 ≈ m
  let best = { along: 0, off: Infinity };
  for (let i = 0; i < path.length - 1; i++) {
    if (cum[i + 1] < minAlong) continue;
    // 내 위치를 원점으로 옮긴 평면 좌표(m)에서 선분 a-b까지의 최단 거리를 구한다
    const ax = (path[i].lng - me.lng) * kx, ay = (path[i].lat - me.lat) * ky;
    const bx = (path[i + 1].lng - me.lng) * kx, by = (path[i + 1].lat - me.lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const off = Math.hypot(ax + t * dx, ay + t * dy);
    if (off < best.off) best = { off, along: cum[i] + t * (cum[i + 1] - cum[i]) };
  }
  return best;
}

// 경로를 따라 along(m) 간 지점 (시뮬레이션용)
export function pointAt(track: Track, along: number): LatLng {
  const { path, cum } = track;
  if (path.length === 0) return { lat: 0, lng: 0 };
  if (along <= 0) return path[0];
  if (along >= track.total) return path[path.length - 1];
  let i = 1;
  while (i < cum.length && cum[i] < along) i++;
  const t = (along - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return { lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t, lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t };
}
// 내 위치(along)에서 끝까지 남은 경로선. 지나온 부분은 뺀다.
export function remainingPath(track: Track, along: number): LatLng[] {
  const { path, cum } = track;
  if (path.length < 2 || along <= 0) return path;
  let i = 1;
  while (i < cum.length && cum[i] <= along) i++;
  if (i >= path.length) return [path[path.length - 1]]; // 도착: 남은 선 없음
  return [pointAt(track, along), ...path.slice(i)]; // 내 위치에서 시작해 다음 꺾임점부터 끝까지
}

// 아직 지나지 않은 첫 안내 지점과 거기까지 남은 거리(m)
export function nextStep(steps: WalkStep[], track: Track, along: number): { step: WalkStep; distance: number } | null {
  for (const s of steps) {
    const at = track.cum[Math.min(s.pathIndex, track.cum.length - 1)] ?? 0;
    if (at >= along - 5) return { step: s, distance: Math.max(0, at - along) };
  }
  return null;
}

// TMAP 회전 코드(turnType) → 화살표. 12·16·17 좌회전 계열, 13·18·19 우회전 계열, 14 유턴, 211~217 횡단보도
export function turnMark(turn: number | null): string {
  if (turn === null) return '';
  if ([12, 16, 17, 212, 214, 215].includes(turn)) return '⬅';
  if ([13, 18, 19, 213, 216, 217].includes(turn)) return '➡';
  if (turn === 14) return '↩';
  return '⬆';
}
// 출발점에서 내 위치(along)까지 지나온 경로선. 지도에 점선으로 그린다.
export function passedPath(track: Track, along: number): LatLng[] {
  const { path, cum } = track;
  if (path.length === 0 || along <= 0) return [];
  const out: LatLng[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    if (cum[i] <= along) out.push(path[i]);
    else {
      out.push(pointAt(track, along));
      break;
    }
  }
  return out;
}
