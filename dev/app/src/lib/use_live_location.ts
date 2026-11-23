// 걷는 동안 내 위치를 계속 받는다 (앱을 쓰는 중에만).
// 규칙 (F-23): 좌표는 화면 안에서만 쓰고 저장·로그·서버 전송을 하지 않는다. 오류 내용도 남기지 않는다.
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type LivePos = { lat: number; lng: number; accuracy: number | null };

export function useLiveLocation(active: boolean): { pos: LivePos | null; denied: boolean } {
  const [pos, setPos] = useState<LivePos | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          if (alive) setDenied(true);
          return;
        }
        const s = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 },
          (p) => {
            if (alive) setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
          },
        );
        if (alive) sub = s;
        else s.remove();
      } catch {
        if (alive) setDenied(true);
      }
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [active]);

  return { pos, denied };
}