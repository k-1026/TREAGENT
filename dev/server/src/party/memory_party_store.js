import crypto from 'node:crypto';

// 메모리에만 저장하는 일행 저장소. 테스트와 DB 없는 시연에 쓴다. 서버를 다시 켜면 사라진다.
// party_store.js(DB)와 같은 약속(함수 이름, 결과 모양)을 지킨다.
//   now: 시작 처리 시각에 쓰는 시계
export function createMemoryPartyStore({ now = () => new Date() } = {}) {
  const parties = new Map(); // id → party
  const members = new Map(); // partyId → [{ userId, ageGroup, role }]
  const routes = new Map(); // `${partyId}|${mode}` → [길 버전들]
  const candidateSets = new Map(); // `${partyId}|${mode}` → [후보 묶음들 { setNo, candidates }]
  
  return {
    async createParty({ hostUserId, inviteCode, ageGroup, companion, theme, zone, variant, expiresAt }) {
      // DB의 unique 제약과 같게, 코드가 겹치면 코드 23505 오류를 던진다.
      for (const p of parties.values()) {
        if (p.inviteCode === inviteCode) throw Object.assign(new Error('duplicate invite code'), { code: '23505' });
      }
      const id = crypto.randomUUID();
      parties.set(id, {
        id,
        hostUserId,
        inviteCode,
        companion: companion ?? null,
        theme: theme ?? null,
        zone: zone ?? null,
        variant: variant ?? 'B',
        startedAt: null,
        expiresAt,
      });
      members.set(id, [{ userId: hostUserId, ageGroup, role: 'host' }]);
      return { id, inviteCode, expiresAt };
    },

    async findByCode(inviteCode) {
      for (const p of parties.values()) if (p.inviteCode === inviteCode) return { ...p };
      return null;
    },

    async findById(id) {
      const p = parties.get(id);
      return p ? { ...p } : null;
    },

    async listMembers(partyId) {
      return (members.get(partyId) ?? []).map((m) => ({ ...m }));
    },

    async addMember({ partyId, userId, ageGroup, maxMembers }) {
      const list = members.get(partyId);
      if (!list) return 'FULL';
      if (list.some((m) => m.userId === userId)) return 'ALREADY';
      if (list.length >= maxMembers) return 'FULL';
      list.push({ userId, ageGroup, role: 'member' });
      return 'JOINED';
    },

    async latestRoute(partyId, mode) {
      const versions = routes.get(`${partyId}|${mode}`) ?? [];
      const last = versions[versions.length - 1];
      return last ? { ...last, placeIds: [...last.placeIds] } : null;
    },

    async saveRoute({ partyId, mode, version, title, reason, picker, placeIds }) {
      const key = `${partyId}|${mode}`;
      const versions = routes.get(key) ?? [];
      if (versions.some((v) => v.version === version)) return false;
      versions.push({ version, title, reason: reason ?? null, picker, placeIds: [...placeIds] });
      versions.sort((a, b) => a.version - b.version);
      routes.set(key, versions);
      return true;
    },

    async hasRoute(partyId) {
      for (const [key, versions] of routes) if (key.startsWith(`${partyId}|`) && versions.length > 0) return true;
      return false;
    },

    async hasCandidates(partyId) {
      for (const key of candidateSets.keys()) if (key.startsWith(`${partyId}|`)) return true;
      return false;
    },

    async latestCandidates(partyId, mode) {
      const sets = candidateSets.get(`${partyId}|${mode}`) ?? [];
      const last = sets[sets.length - 1];
      return last
        ? { setNo: last.setNo, candidates: last.candidates.map((c) => ({ ...c, placeIds: [...c.placeIds] })) }
        : null;
    },

    async saveCandidates({ partyId, mode, setNo, candidates }) {
      const key = `${partyId}|${mode}`;
      const sets = candidateSets.get(key) ?? [];
      if (sets.some((s) => s.setNo === setNo)) return false;
      sets.push({
        setNo,
        candidates: candidates.map((c) => ({
          title: c.title,
          reason: c.reason ?? null,
          picker: c.picker,
          placeIds: [...c.placeIds],
        })),
      });
      sets.sort((a, b) => a.setNo - b.setNo);
      candidateSets.set(key, sets);
      return true;
    },

    async markStarted(partyId) {
      const p = parties.get(partyId);
      if (!p) return null;
      p.startedAt ??= now();
      return p.startedAt;
    },
  };
}