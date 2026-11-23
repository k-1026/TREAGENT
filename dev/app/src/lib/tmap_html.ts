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
  path: LatLng[]; // 지도에 그릴 경로선. 지나온 부분은 앱이 미리 빼서 보낸다
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
  var markers = [], line = null, meMarker = null;
  var placesKey = '', pathKey = '', lastFocusN = 0, following = false;

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

    // 내 위치 마커: 위치만 갱신한다
    if (s.me) {
      if (meMarker) meMarker.setPosition(toLL(s.me));
      else meMarker = new Tmapv2.Marker({ position: toLL(s.me), map: map });
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