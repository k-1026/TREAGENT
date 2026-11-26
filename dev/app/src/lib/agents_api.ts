// 에이전트 서버 호출 (미션·이야기하기·일기·카드·도장). 서버 /agents/* (plan/spec/agent_architecture_v2.md).
// 좌표(position)는 요청 본문으로만 보내고 저장하지 않는다. 서버는 도착·판정 계산에만 쓰고 기록하지 않는다. 오류 내용은 로그에 남기지 않는다.
// 서버는 로그인이 필요하다. 토큰은 supabase 세션에서 붙인다.
import { supabase } from './supabase';

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL;

export type AgentResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string };

async function call<T>(path: string, body?: unknown, method: 'POST' | 'GET' = 'POST', timeoutMs = 30000): Promise<AgentResult<T>> {
  if (!SERVER_URL) return { ok: false, status: 0, code: 'NO_SERVER_URL' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    const res = await fetch(`${SERVER_URL}/agents${path}`, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (res.ok) return { ok: true, data: json as T };
    return { ok: false, status: res.status, code: typeof json?.error === 'string' ? json.error : 'SERVER' };
  } catch (e) {
    return { ok: false, status: 0, code: e instanceof Error && e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' };
  } finally {
    clearTimeout(timer);
  }
}

export type Position = { latitude: number; longitude: number };

// ---- 하랑이와 이야기하기 ----
export type ChatReply = { reply: string; kind: 'answer' | 'safety' | 'unknown' | 'fixed' | 'empty' };
export const askHarangi = (question: string, placeIds?: string[]) => call<ChatReply>('/chat', { question, ...(placeIds?.length ? { placeIds } : {}) });

// ---- 미션 ----
export type MissionKind = 'quiz' | 'photo' | 'receipt';
export type Mission = { ticketId: string; kind: MissionKind; explanation: string; task: string; submitsLeft: number };
export type MissionStart = { status: 'waiting'; fallback: boolean; mission: Mission; place: { id: string; name: string } };
export type MissionSubmit = { status: 'stamped' | 'retry' | 'held'; code: string | null; stamp: { id: number } | null; submitsLeft: number | null };

export const startMission = (placeId: string, position: Position) => call<MissionStart>('/mission/start', { placeId, position }, 'POST', 45000);
export const submitQuizAnswer = (ticketId: string, answer: string, position?: Position) =>
  call<MissionSubmit>('/mission/submit', { ticketId, answer, ...(position ? { position } : {}) }, 'POST', 45000);
export const submitPhoto = (ticketId: string, imageBase64: string, position?: Position) =>
  call<MissionSubmit>('/mission/submit', { ticketId, imageBase64, ...(position ? { position } : {}) }, 'POST', 60000);
export const askHint = (ticketId: string) => call<{ hint: string }>('/mission/hint', { ticketId });
export const replayTask = (ticketId: string) => call<{ task: string }>('/mission/replay', { ticketId });

// ---- 도장·일기·카드 ----
export const getStamps = () => call<{ stamps: { placeId: string; kind: MissionKind }[] }>('/stamps', undefined, 'GET');
export const makeDiary = (courseTitle: string, date: string, placeIds: string[]) => call<{ text: string; source: 'llm' | 'template' }>('/diary', { courseTitle, date, placeIds }, 'POST', 45000);
export type CardResult = { card: { placeName: string; caption: string; stamp: boolean; date: string; source: 'generated' | 'fixed'; image: { base64: string; mime: string } | null } };
export const makeCard = (courseTheme: string, date: string, placeId: string) => call<CardResult>('/card', { courseTheme, date, placeId }, 'POST', 60000);

// 서버 오류 코드를 이용자에게 보여 줄 문장으로 바꾼다 (원인은 밝히지 않는 것은 그대로 둔다).
export function missionErrorText(code: string): string {
  switch (code) {
    case 'GPS_OUT': return '아직 장소에 도착하지 않았어요. 장소 가까이에서 다시 눌러 주세요.';
    case 'NO_POSITION': return '내 위치를 읽지 못했어요. 위치 권한을 확인해 주세요.';
    case 'AGENT_OFF': return '지금은 미션을 준비하지 못했어요. 잠시 뒤에 다시 해 주세요.';
    case 'ALREADY_STAMPED': return '이미 도장을 받은 장소예요.';
    case 'IMAGE_FORMAT': return '사진 형식을 읽지 못했어요. JPEG 사진으로 다시 찍어 주세요.';
    case 'DAILY_LIMIT': return '오늘 쓸 수 있는 횟수를 모두 썼어요.';
    case 'UNAUTHORIZED': return '로그인이 필요해요.';
    default: return '문제가 생겼어요. 잠시 뒤에 다시 해 주세요.';
  }
}
