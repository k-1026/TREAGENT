/*
 * [use_home_weather.ts] 지금 위치의 날씨와 홈 상태를 함께 구하는 훅 — 홈과 날씨 상세가 같이 쓴다
 *
 * - 서버 POST /weather를 부른다. 좌표는 요청 본문으로만 보내고, 화면이나 로그에 남기지 않는다.
 * - 날씨를 못 읽으면 "날씨 확인 불가"(unknown) 상태가 된다 (이전 값으로 추측하지 않음).
 * - 개발 중(__DEV__)에만 주소의 ?state=이름 으로 다른 상태를 미리 본다.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { DISTRICTS } from './districts';
import { HomeStateKey, isHomeStateKey, pickHomeState } from './home_state';
import { usePlace } from './place_context';
import { getWeatherNow } from './server_api';

// 받은 날씨. key는 어느 위치로 받은 값인지 표시한다 (위치가 바뀌면 다시 "확인 중"이 된다)
type WeatherView = { key: string; status: 'ok'; temp: number; hour: number } | { key: string; status: 'unavailable' };

export type HomeWeather = {
  stateKey: HomeStateKey;
  preview: boolean; // 미리보기로 정한 상태인가
  loading: boolean;
  // 실제로 받은 값 (status가 ok일 때만)
  temp: number | null;
  hour: number | null;
};

export function useHomeWeather(): HomeWeather {
  const { place, setPlace } = usePlace();
  const params = useLocalSearchParams<{ state?: string }>();
  const [weather, setWeather] = useState<WeatherView | null>(null);

  // 위치를 아직 정하지 않았으면 기본 지역(중구 기준점)을 쓴다. MVP는 중구만 안내한다 (districts.ts).
  // 홈이 아니라 날씨 상세 주소로 바로 열어도 위치가 있게 여기서 정한다.
  useEffect(() => {
    const jung = DISTRICTS.find((d) => d.code === 'jung');
    if (!place && jung?.center) setPlace({ kind: 'district', code: jung.code, ...jung.center });
  }, [place, setPlace]);

  const lat = place?.latitude;
  const lng = place?.longitude;
  const placeKey = lat !== undefined && lng !== undefined ? `${lat},${lng}` : '';

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const key = `${lat},${lng}`;
    let alive = true;
    getWeatherNow(lat, lng).then((r) => {
      if (!alive) return;
      if (r.ok && r.data.status === 'ok') setWeather({ key, status: 'ok', temp: r.data.temperatureC, hour: r.data.hour });
      else setWeather({ key, status: 'unavailable' });
    });
    return () => {
      alive = false;
    };
  }, [lat, lng]);

  const current = weather && weather.key === placeKey ? weather : null; // 지금 위치의 값만 쓴다
  const previewKey = __DEV__ && isHomeStateKey(params.state) ? params.state : null;
  const ok = current?.status === 'ok' ? current : null;
  return {
    stateKey: previewKey ?? pickHomeState(!current ? 'loading' : current.status),
    preview: previewKey !== null,
    loading: !current,
    temp: ok ? ok.temp : null,
    hour: ok ? ok.hour : null,
  };
}

// 날씨 상세 화면의 날씨 종류 (목업 shelter_weather_mockup_v1.html의 WX: 보통·폭염·호우·확인 불가)
export type WeatherKind = 'normal' | 'heat' | 'storm' | 'unknown';

export function weatherKindOf(state: HomeStateKey): WeatherKind {
  return state === 'heat' || state === 'storm' || state === 'unknown' ? state : 'normal';
}
