// 서버 호출 모음. 좌표는 요청 본문(body)으로만 보내고, 본문·좌표·오류 내용은 로그에 남기지 않는다.

// EXPO_PUBLIC_ 값은 반드시 이렇게 점(.)으로 직접 읽어야 앱에 들어간다 (공식 문서).
const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL;
const TIMEOUT_MS = 10000;

export type ApiError =
  | 'NO_SERVER_URL' | 'NETWORK' | 'TIMEOUT' | 'UNAVAILABLE' | 'NOT_FOUND' | 'INVALID' | 'RATE_LIMIT' | 'SERVER';
  export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export type CourseCard = {
  id: string;
  title: string;
  theme: string | null;
  district: string | null;
  durationMin: number;
  types: string[];
};

export type Station = {
  order: number;
  id: string;
  name: string;
  district: string | null;
  type: string;
  open: boolean;
  hoursText: string | null;
  closedText: string | null;
  caution: string | null;
};

export type RouteResult = {
  courseId: string;
  title: string;
  durationMin: number;
  mode: string;
  routeType: string | null;
  available: boolean;
  reason: string;
  stations: Station[];
  closedPlaceIds: string[];
  modeReason: string;
  asOf: { hour: number; baseTime: string | null };
  weather:
    | { status: 'ok'; temperatureC: number; apparentTemperatureC: number | null }
    | { status: 'unavailable' };
};

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  if (!SERVER_URL) return { ok: false, error: 'NO_SERVER_URL' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVER_URL}${path}`, { ...init, signal: controller.signal });
    if (res.ok) return { ok: true, data: (await res.json()) as T };
    if (res.status === 404) return { ok: false, error: 'NOT_FOUND' };
    if (res.status === 400) return { ok: false, error: 'INVALID' };
    if (res.status === 503) return { ok: false, error: 'UNAVAILABLE' };
    if (res.status === 429) return { ok: false, error: 'RATE_LIMIT' };
    return { ok: false, error: 'SERVER' };
  } catch (e) {
    // 오류 내용은 남기지 않고 종류만 구분한다.
    return { ok: false, error: e instanceof Error && e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' };
  } finally {
    clearTimeout(timer);
  }
}

export async function getCourses(): Promise<ApiResult<CourseCard[]>> {
  const r = await request<{ courses: CourseCard[] }>('/courses');
  return r.ok ? { ok: true, data: r.data.courses } : r;
}

export function getRoute(courseId: string, latitude: number, longitude: number) {
  return request<RouteResult>(`/courses/${encodeURIComponent(courseId)}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude, longitude }),
  });
}
// ---- 오늘의 길 (AI 길 구성) ----
export type AgeGroup = '10s' | '20s' | '30s' | '40s' | '50s' | '60s';
export type Theme = 'history' | 'culture' | 'nature';
export type Companion = 'solo' | 'friends' | 'kids';
export type TodayPrefs = { ageGroup: AgeGroup; theme: Theme; companion: Companion };

export type TodayPlace = {
  id: string;
  name: string;
  district: string | null;
  type: string;
  zone: string | null;
  hoursText: string | null;
  caution: string | null;
};

export type TodayRoute = {
  picker: 'ai' | 'rules';
  title: string;
  reason: string;
  places: TodayPlace[];
  durationMin: number | null;
  isNew: boolean;
  briefing?: { text: string; picker: 'ai' | 'rules' } | null;
};

export type TodayResult = {
  mode: string;
  reason: string;
  route: TodayRoute | null;
  routeReason?: string;
};

// refreshFrom을 주면 "새로고침". 지금 보고 있는 장소 id를 excludePlaceIds로 보내 다른 조합을 받는다.
export function getTodayRoute(latitude: number, longitude: number, prefs: TodayPrefs, refreshFrom?: string[]) {
  return request<TodayResult>('/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude,
      longitude,
      ...prefs,
      briefing: true,
      ...(refreshFrom ? { refresh: true, excludePlaceIds: refreshFrom } : {}),
    }),
  });
}