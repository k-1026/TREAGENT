// 서버 호출 모음. 좌표는 요청 본문(body)으로만 보내고, 본문·좌표·오류 내용은 로그에 남기지 않는다.

// EXPO_PUBLIC_ 값은 반드시 이렇게 점(.)으로 직접 읽어야 앱에 들어간다 (공식 문서).
const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL;
const TIMEOUT_MS = 10000;

export type ApiError =
  | 'NO_SERVER_URL' | 'NETWORK' | 'TIMEOUT' | 'UNAVAILABLE' | 'NOT_FOUND' | 'INVALID' | 'RATE_LIMIT' | 'SERVER'
  | 'UNAUTHORIZED' | 'NICKNAME_TAKEN' | 'NICKNAME_LOCKED'
  | 'NOT_HOST' | 'PARTY_EXPIRED' | 'ALREADY_STARTED' | 'PARTY_FULL' | 'STALE_CANDIDATES' | 'STALE_ROUTE' | 'REFRESH_LIMIT' | 'NO_CANDIDATES';

// 서버가 409로 돌려주는 오류 이름 중 앱이 구분해서 안내하는 것들
const CONFLICT_ERRORS = [
  'NICKNAME_TAKEN', 'NICKNAME_LOCKED', 'ALREADY_STARTED', 'PARTY_FULL',
  'STALE_CANDIDATES', 'STALE_ROUTE', 'REFRESH_LIMIT', 'NO_CANDIDATES',
] as const;
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
    if (res.status === 403) return { ok: false, error: 'NOT_HOST' };
    if (res.status === 410) return { ok: false, error: 'PARTY_EXPIRED' };
    if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: CONFLICT_ERRORS.find((c) => c === body?.error) ?? 'SERVER' };
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


// ---- 팀 (일행) ----
export type PartyMember = { nickname: string | null; role: 'host' | 'member'; isMe: boolean };

export type PartyInfo = {
  partyId: string;
  companion: string | null;
  theme: string | null;
  zone: string | null;
  variant: string;
  startedAt: string | null;
  expiresAt: string;
  memberCount: number;
  ageGroups: AgeGroup[];
  members: PartyMember[];
  routeChosen: boolean; // 방장이 길을 하나라도 골랐는가
  myRole: 'host' | 'member';
  inviteCode?: string; // 방장에게만 보인다
};

// 방장이 받는 후보 길 묶음. refreshed가 false면 새 묶음이 아니라 지금 묶음 그대로다.
export type PartyCandidates = {
  mode: string;
  setNo: number;
  refreshed: boolean;
  routes: TodayRoute[];
  routeReason?: string;
};

// 팀이 정한 길. 방장이 고르기 전이면 route가 null이고 routeReason이 NOT_CHOSEN이다.
export type PartyRoute = {
  mode: string;
  routeVersion?: number;
  route: TodayRoute | null;
  routeReason?: string;
};

export function createParty(accessToken: string, p: { ageGroup: AgeGroup; theme: Theme; companion: Companion }) {
  return request<{ partyId: string; inviteCode: string; expiresAt: string }>('/parties', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(p),
  });
}

export function joinParty(accessToken: string, inviteCode: string, ageGroup: AgeGroup) {
  return request<{ partyId: string; joined: boolean }>('/parties/join', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ inviteCode, ageGroup }),
  });
}

export function getParty(accessToken: string, partyId: string) {
  return request<PartyInfo>(`/parties/${encodeURIComponent(partyId)}`, { headers: authHeaders(accessToken) });
}

// 방장만. more가 true면 "다른 길 새로 받기"(직전 묶음의 장소를 뺀 새 묶음). AI를 여러 번 부르므로 시간 제한을 길게 둔다.
export function getPartyCandidates(accessToken: string, partyId: string, latitude: number, longitude: number, more: boolean) {
  return request<PartyCandidates>(
    `/parties/${encodeURIComponent(partyId)}/candidates`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ latitude, longitude, briefing: true, ...(more ? { more: true } : {}) }),
    },
    45000,
  );
}

// 방장만. 가장 최신 후보 묶음에서 하나를 고른다. 장소 목록은 보내지 않고 번호만 보낸다.
export function choosePartyRoute(accessToken: string, partyId: string, pick: { mode: string; setNo: number; index: number }) {
  return request<{ mode: string; routeVersion: number }>(`/parties/${encodeURIComponent(partyId)}/route`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(pick),
  });
}

// 팀이 정한 길을 읽는다. 좌표는 날씨와 방문 순서 계산에만 쓰이고 저장되지 않는다.
export function getPartyRoute(accessToken: string, partyId: string, latitude: number, longitude: number) {
  return request<PartyRoute>(`/parties/${encodeURIComponent(partyId)}/recommend`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ latitude, longitude, briefing: true }),
  });
}

// 방장만. 시작하면 새로 참여하거나 길을 바꿀 수 없다.
export function startParty(accessToken: string, partyId: string) {
  return request<{ partyId: string; startedAt: string }>(`/parties/${encodeURIComponent(partyId)}/start`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

// ---- 도보 경로 (TMAP, 서버 경유) ----
export type WalkPlace = { id: string; name: string; lat: number; lng: number; coordSource: 'db' | 'tmap_poi' };
export type WalkResult = {
  places: WalkPlace[];
  path: { lat: number; lng: number }[];
  distance: number; // 총 거리 (m)
  time: number; // 총 시간 (초)
  legs: { distance: number; time: number }[]; // 구간별. startIncluded면 legs[0]이 "내 위치 → 첫 장소"
  startIncluded: boolean;
};

// 장소 순서대로 도보 경로를 받는다. start(내 위치)를 주면 내 위치부터 잡는다. 좌표는 본문으로만 보낸다.
export function getWalk(placeIds: string[], start?: { latitude: number; longitude: number }) {
  return request<WalkResult>(
    '/walk',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeIds, ...(start ?? {}) }),
    },
    20000, // 좌표가 없는 장소는 TMAP 검색이 먼저 일어나서 시간 제한을 넉넉히 둔다
  );
}