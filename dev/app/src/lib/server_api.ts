// 서버 호출 모음. 좌표는 요청 본문(body)으로만 보내고, 본문·좌표·오류 내용은 로그에 남기지 않는다.

// EXPO_PUBLIC_ 값은 반드시 이렇게 점(.)으로 직접 읽어야 앱에 들어간다 (공식 문서).
const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL;
const TIMEOUT_MS = 10000;

export type ApiError =
  | 'NO_SERVER_URL' | 'NETWORK' | 'TIMEOUT' | 'UNAVAILABLE' | 'NOT_FOUND' | 'INVALID' | 'RATE_LIMIT' | 'SERVER'
  | 'UNAUTHORIZED' | 'NICKNAME_TAKEN' | 'NICKNAME_LOCKED';
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

async function request<T>(path: string, init?: RequestInit, timeoutMs: number = TIMEOUT_MS): Promise<ApiResult<T>> {
  if (!SERVER_URL) return { ok: false, error: 'NO_SERVER_URL' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SERVER_URL}${path}`, { ...init, signal: controller.signal });
    if (res.ok) return { ok: true, data: (await res.json()) as T };
    if (res.status === 404) return { ok: false, error: 'NOT_FOUND' };
    if (res.status === 400) return { ok: false, error: 'INVALID' };
    if (res.status === 401) return { ok: false, error: 'UNAUTHORIZED' };
    if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error === 'NICKNAME_LOCKED' ? 'NICKNAME_LOCKED' : 'NICKNAME_TAKEN' };
    }
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
  route: TodayRoute | null; // routes[0]과 같다 (예전 응답 호환)
  routes?: TodayRoute[]; // 후보 길들 (count를 보냈을 때)
  routeReason?: string;
  weather?: { status: 'ok'; temperatureC: number; apparentTemperatureC: number | null } | { status: 'unavailable' };
};

// 후보 길 3개를 한 번에 받는다. AI를 여러 번 부르므로 시간 제한을 길게 둔다.
// refreshFrom을 주면 "다른 길 새로 불러오기": 지금 보여 준 장소 id들을 빼고 새 조합을 받는다.
export function getTodayRoutes(latitude: number, longitude: number, prefs: TodayPrefs, refreshFrom?: string[]) {
  return request<TodayResult>(
    '/recommend',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude,
        longitude,
        ...prefs,
        count: 3,
        briefing: true,
        ...(refreshFrom ? { refresh: true, excludePlaceIds: refreshFrom.slice(0, 12) } : {}),
      }),
    },
    45000,
  );
}
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

// ---- 프로필 ----
export type ProfileData = { nickname: string | null; ageGroup: AgeGroup };

const authHeaders = (accessToken: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${accessToken}`,
});

// 내 프로필. 아직 없으면 NOT_FOUND
export function getProfile(accessToken: string) {
  return request<ProfileData>('/profile', { headers: authHeaders(accessToken) });
}

// 프로필 저장. 닉네임이 겹치면 NICKNAME_TAKEN, 이미 정한 닉네임을 바꾸려 하면 NICKNAME_LOCKED
export function saveProfile(accessToken: string, p: { nickname: string | null; ageGroup: AgeGroup }) {
  return request<ProfileData>('/profile', { method: 'PUT', headers: authHeaders(accessToken), body: JSON.stringify(p) });
}

// 닉네임이 비어 있는지 미리 확인한다. 저장할 때 서버가 한 번 더 막으므로 참고용이다.
export function checkNicknameAvailable(accessToken: string, nickname: string) {
  return request<{ available: boolean }>('/profile/check', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ nickname }),
  });
}