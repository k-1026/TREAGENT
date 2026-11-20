// 메모리에만 저장하는 프로필 저장소. 테스트와 DB 없는 시연에 쓴다. 서버를 다시 켜면 사라진다.
// profile_store.js(DB)와 같은 약속(함수 이름, 결과 모양, 중복 시 23505 오류)을 지킨다.
export function createMemoryProfileStore() {
  const profiles = new Map(); // userId → { nickname, ageGroup }

  return {
    async find(userId) {
      const p = profiles.get(userId);
      return p ? { ...p } : null;
    },

    async findNicknames(userIds) {
      return new Map(userIds.filter((id) => profiles.has(id)).map((id) => [id, profiles.get(id).nickname]));
    },

    async isNicknameTaken(nickname, exceptUserId) {
      for (const [id, p] of profiles) {
        if (id !== exceptUserId && p.nickname?.toLowerCase() === nickname.toLowerCase()) return true;
      }
      return false;
    },

    async save({ userId, nickname, ageGroup }) {
      const current = profiles.get(userId);
      const next = current?.nickname ?? nickname ?? null; // 이미 있는 닉네임은 그대로 둔다
      if (next !== null && next !== current?.nickname) {
        for (const [id, p] of profiles) {
          if (id !== userId && p.nickname?.toLowerCase() === next.toLowerCase()) {
            throw Object.assign(new Error('duplicate nickname'), { code: '23505' });
          }
        }
      }
      const saved = { nickname: next, ageGroup };
      profiles.set(userId, saved);
      return { ...saved };
    },
  };
}