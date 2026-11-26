// 내비게이션 지도(HTML)를 로그인 없이 확인하는 시험용 페이지를 만든다. 서버 호출 없이 가짜 경로로 지도만 그린다.
//   사용: dev/app 폴더에서  node --env-file=.env scripts/map_preview.mjs  → 같은 폴더의 map_preview.html 이 생긴다 (커밋하지 않는다).
//   그 파일을 브라우저로 열면 하랑이 걷기, 점선(지나온 길), 방향 화살표, 회전 화살표를 볼 수 있다.
//   TypeScript 파일(tmap_html.ts, harangi_frames.ts)은 typescript 패키지로 잠깐 변환해서 쓴다.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(join(tmpdir(), 'map-preview-'));
for (const name of ['tmap_html', 'harangi_frames']) {
  const src = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  writeFileSync(join(dir, `${name}.mjs`), js.replace("'./harangi_frames'", "'./harangi_frames.mjs'"));
}
const { buildTmapHtml } = await import(pathToFileURL(join(dir, 'tmap_html.mjs')).href);

const key = process.env.EXPO_PUBLIC_TMAP_APP_KEY ?? '';
const start = { lat: 35.8686, lng: 128.5948 };
// 동성로 → 약령시 쪽으로 걷는 가짜 경로 (직선 몇 구간)
const path = [start, { lat: 35.8686, lng: 128.5925 }, { lat: 35.8668, lng: 128.5925 }, { lat: 35.8668, lng: 128.59 }, { lat: 35.8651, lng: 128.59 }];
const html = buildTmapHtml(key, start, 17).replace(
  "send({ type: 'ready' });",
  `send({ type: 'ready' });
  window.__apply({
    places: [{ id: 'a', name: 'A', lat: 35.8686, lng: 128.5925, status: 'done' }, { id: 'b', name: 'B', lat: 35.8651, lng: 128.59, status: 'next' }],
    path: ${JSON.stringify(path.slice(1))}, passed: ${JSON.stringify([path[0], path[1]])}, full: ${JSON.stringify(path)}, along: 180,
    steps: [{ lat: 35.8686, lng: 128.5925, turn: 13 }, { lat: 35.8668, lng: 128.5925, turn: 12 }],
    me: ${JSON.stringify({ lat: 35.8686, lng: 128.5925 })}, follow: true
  });`,
);
writeFileSync(new URL('../map_preview.html', import.meta.url), html);
console.log('만들었어요: dev/app/map_preview.html');
