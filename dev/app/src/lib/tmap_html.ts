import { HARANGI_FRAMES } from './harangi_frames';

export type LatLng = { lat: number; lng: number };
export type MapPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status?: 'done' | 'next' | 'todo'; // 핀 색. 없으면 'todo'
};
export type MapState = {
  places: MapPlace[];
  path: LatLng[]; // 지도에 그릴 남은 경로선(붉은 실선). 지나온 부분은 앱이 미리 빼서 보낸다
  passed?: LatLng[]; // 지나온 경로. 점선(점점점)으로 그린다
  full?: LatLng[]; // 전체 경로. 방향 화살표를 한 번만 만들 때 쓴다 (바뀌지 않는 한 다시 만들지 않는다)
  along?: number; // 전체 경로에서 내가 간 거리(m). 이 앞의 화살표는 숨긴다
  steps?: { lat: number; lng: number; turn: number | null }[]; // 길 안내 지점. 좌회전·우회전·유턴 화살표를 그린다
  me: LatLng | null;
  // 보기 지시. n이 바뀔 때마다 한 번 실행한다. target이 있으면 그 점으로 확대, 없으면 points가 다 보이게 맞춘다.
  focus?: { n: number; target: LatLng | null; points: LatLng[] };
  follow?: boolean; // true면 내 위치가 바뀔 때마다 지도 중심을 내 위치로 옮긴다
};
export type TmapViewProps = { appKey: string; center: LatLng; state: MapState };

const TMAP_SCRIPT_URL = 'https://apis.openapi.sk.com/tmap/jsv2?version=1&appKey=';

export function buildTmapHtml(appKey: string, center: LatLng, zoom = 15): string {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body,#map{margin:0;width:100%;height:100%}</style>
<script src="${TMAP_SCRIPT_URL}${appKey}"></script>
</head><body><div id="map"></div>
<script>
(function () {
  var map = new Tmapv2.Map('map', {
    center: new Tmapv2.LatLng(${center.lat}, ${center.lng}),
    width: '100%', height: '100%', zoom: ${zoom}
  });
  var markers = [], line = null, dotted = null, meMarker = null;
  var arrows = [], arrowKey = '', stepMarks = [], stepKey = '', frame = 0;
  var FRAMES = ${JSON.stringify(HARANGI_FRAMES)};
  var placesKey = '', pathKey = '', dottedKey = '', lastFocusN = 0, following = false;

  function toLL(p) { return new Tmapv2.LatLng(p.lat, p.lng); }

  // 목업의 번호 핀: 28px 네모, 잉크색 테두리. 상태에 따라 색이 바뀐다.
  var PIN = { done: ['#9fb58a', '#5b2a22'], next: ['#dc3b30', '#ffffff'], todo: ['#fffaf1', '#5b2a22'] };
  function pinIcon(n, status) {
    var c = PIN[status] || PIN.todo;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">' +
      '<rect x="1.5" y="1.5" width="25" height="25" fill="' + c[0] + '" stroke="#5b2a22" stroke-width="3"/>' +
      '<text x="14" y="19.5" text-anchor="middle" font-size="15" font-weight="800" font-family="sans-serif" fill="' + c[1] + '">' + n + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // 두 점 사이 거리(m)와 방위(도, 북쪽 0 시계 방향). 가까운 거리라서 평면 근사를 쓴다.
  function dist(a, b) { var kx = Math.cos(a.lat * Math.PI / 180) * 111320, ky = 110540; return Math.hypot((b.lng - a.lng) * kx, (b.lat - a.lat) * ky); }
  function bearing(a, b) { var kx = Math.cos(a.lat * Math.PI / 180) * 111320, ky = 110540; return (Math.atan2((b.lng - a.lng) * kx, (b.lat - a.lat) * ky) * 180 / Math.PI + 360) % 360; }
  // 진행 방향 화살표: 붉은 선 위에 흰 테두리 화살촉. deg만큼 돌린다.
  function arrowIcon(deg) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><g transform="rotate(' + deg + ' 11 11)">' +
      '<path d="M11 2 L18 18 L11 14 L4 18 Z" fill="#ffffff" stroke="#5b2a22" stroke-width="2" stroke-linejoin="round"/></g></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  // 길 안내 화살표: 좌회전 ⬅, 우회전 ➡, 유턴 ↩ (TMAP 회전 코드)
  var LEFT = [12, 16, 17, 212, 214, 215], RIGHT = [13, 18, 19, 213, 216, 217];
  function turnIcon(turn) {
    var g = LEFT.indexOf(turn) >= 0 ? '\u2B05' : RIGHT.indexOf(turn) >= 0 ? '\u27A1' : turn === 14 ? '\u21A9' : null;
    if (!g) return null;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><circle cx="15" cy="15" r="13" fill="#fffaf1" stroke="#5b2a22" stroke-width="3"/>' +
      '<text x="15" y="21" text-anchor="middle" font-size="17" font-weight="800" font-family="sans-serif" fill="#dc3b30">' + g + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // 점들이 모두 보이게 맞춘다.
  function fit(points) {
    if (!points.length) return;
    var b = new Tmapv2.LatLngBounds(toLL(points[0]));
    points.forEach(function (q) { b.extend(toLL(q)); });
    map.fitBounds(b, { left: 20, top: 20, right: 20, bottom: 20 });
  }

  // 앱이 보내는 상태(장소·경로·내 위치)를 지도에 그린다. 바뀐 것만 다시 그린다.
  window.__apply = function (s) {
    var places = s.places || [], path = s.path || [];

    // 장소 핀: 장소나 색(상태)이 바뀔 때만 다시 그린다
    var pk = JSON.stringify(places);
    if (pk !== placesKey) {
      placesKey = pk;
      markers.forEach(function (m) { m.setMap(null); });
      markers = places.map(function (p, i) {
        return new Tmapv2.Marker({
          position: toLL(p), map: map,
          icon: pinIcon(i + 1, p.status),
          iconSize: new Tmapv2.Size(28, 28)
        });
      });
    }

    // 경로선: 걸으면서 지나온 부분이 빠진 새 선이 오면 다시 그린다 (지도 위치·확대는 건드리지 않는다)
    var lk = JSON.stringify(path);
    if (lk !== pathKey) {
      pathKey = lk;
      if (line) { line.setMap(null); line = null; }
      if (path.length > 1) {
        line = new Tmapv2.Polyline({
          path: path.map(toLL), strokeColor: '#dc3b30', strokeWeight: 6, map: map
        });
      }
    }

    // 지나온 경로: 점선(점점점)
    var dk = JSON.stringify(s.passed || []);
    if (dk !== dottedKey) {
      dottedKey = dk;
      if (dotted) { dotted.setMap(null); dotted = null; }
      if ((s.passed || []).length > 1) {
        dotted = new Tmapv2.Polyline({ path: s.passed.map(toLL), strokeColor: '#8a7b6e', strokeWeight: 4, strokeStyle: 'dot', map: map });
      }
    }

    // 진행 방향 화살표: 전체 경로가 바뀔 때만 만들고, 내가 지나간 화살표는 숨긴다 (약 70m마다, 최대 60개)
    var full = s.full || [];
    var fk = full.length + ':' + (full[0] ? full[0].lat + ',' + full[0].lng : '') + ':' + (full.length ? full[full.length - 1].lat : '');
    if (fk !== arrowKey) {
      arrowKey = fk;
      arrows.forEach(function (a) { a.m.setMap(null); });
      arrows = [];
      var acc = 0, next = 50;
      for (var i = 1; i < full.length && arrows.length < 60; i++) {
        var d = dist(full[i - 1], full[i]);
        while (acc + d >= next && arrows.length < 60) {
          var t = d === 0 ? 0 : (next - acc) / d;
          var pt = { lat: full[i - 1].lat + (full[i].lat - full[i - 1].lat) * t, lng: full[i - 1].lng + (full[i].lng - full[i - 1].lng) * t };
          arrows.push({ d: next, m: new Tmapv2.Marker({ position: toLL(pt), map: map, icon: arrowIcon(bearing(full[i - 1], full[i])), iconSize: new Tmapv2.Size(22, 22) }) });
          next += 70;
        }
        acc += d;
      }
    }
    var along = typeof s.along === 'number' ? s.along : 0;
    arrows.forEach(function (a) { a.m.setMap(a.d > along ? map : null); });

    // 길 안내 화살표(회전 지점)
    var steps = (s.steps || []).filter(function (x) { return turnIcon(x.turn); });
    var sk = JSON.stringify(steps);
    if (sk !== stepKey) {
      stepKey = sk;
      stepMarks.forEach(function (m) { m.setMap(null); });
      stepMarks = steps.map(function (x) { return new Tmapv2.Marker({ position: toLL(x), map: map, icon: turnIcon(x.turn), iconSize: new Tmapv2.Size(30, 30) }); });
    }

    // 내 위치: 하랑이 걷기 4컷. 위치만 갱신하고, 그림은 아래 타이머가 돌려 가며 바꾼다.
    if (s.me) {
      if (meMarker) meMarker.setPosition(toLL(s.me));
      else meMarker = new Tmapv2.Marker({ position: toLL(s.me), map: map, icon: FRAMES[0], iconSize: new Tmapv2.Size(64, 66) });
    } else if (meMarker) { meMarker.setMap(null); meMarker = null; }

    // 보기 지시: 장소를 눌렀으면 그 장소로 확대, 아니면 경로 전체가 보이게
    if (s.focus && s.focus.n !== lastFocusN) {
      lastFocusN = s.focus.n;
      if (s.focus.target) {
        map.setCenter(toLL(s.focus.target)); // 중심을 먼저 옮기고
        map.setZoom(17);                      // 그다음 확대 (확대 중에는 setZoom이 무시된다)
      } else {
        fit(s.focus.points && s.focus.points.length ? s.focus.points : places);
      }
    }

    // 따라가기: 켜질 때 한 번 내 위치로 확대하고, 이후에는 내 위치가 바뀔 때마다 부드럽게 옮긴다
    if (s.follow && s.me) {
      if (!following) { map.setCenter(toLL(s.me)); map.setZoom(17); }
      else { map.panTo(toLL(s.me)); }
    }
    following = !!(s.follow && s.me);
  };

  // 하랑이 걷기: 0.15초마다 그림을 바꾼다
  setInterval(function () { if (meMarker) { frame = (frame + 1) % FRAMES.length; try { meMarker.setIcon(FRAMES[frame]); } catch (_) {} } }, 150);

  function send(o) {
    var t = JSON.stringify(o);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(t); // 폰
    else window.parent.postMessage(t, '*');                                  // 웹(iframe)
  }
  function onMsg(e) { try { window.__apply(JSON.parse(e.data)); } catch (_) {} }
  window.addEventListener('message', onMsg);
  document.addEventListener('message', onMsg);
  window.addEventListener('resize', function () { try { map.resize(); } catch (_) {} });
  send({ type: 'ready' });
})();
</script></body></html>`;
}