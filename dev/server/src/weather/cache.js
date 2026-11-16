// 메모리 캐시: 키로 결과를 잠깐 보관한다. DB에 저장하지 않고, 서버를 껐다 켜면 비워진다.
// now를 바꿔 끼울 수 있게 해서 테스트에서 시간을 흉내 낼 수 있다.
export function createCache({ now = () => Date.now() } = {}) {
  const store = new Map(); // 키 → { value, expiresAt }
  const inflight = new Map(); // 키 → 지금 진행 중인 호출(Promise)

  // 만료된 항목을 지운다. 지우지 않으면 오래 켜 둘수록 메모리가 쌓인다.
  function purgeExpired() {
    const t = now();
    for (const [key, entry] of store) {
      if (entry.expiresAt <= t) store.delete(key);
    }
  }

  // 캐시에 있으면 그대로 돌려주고, 없으면 loader를 호출해서 보관한 뒤 돌려준다.
  // ttlOf(value): 이 결과를 몇 밀리초 보관할지 (성공은 길게, 실패는 짧게)
  async function getOrLoad(key, loader, ttlOf) {
    const hit = store.get(key);
    if (hit && hit.expiresAt > now()) return hit.value;

    // 같은 키로 이미 호출 중이면 새로 호출하지 않고 그 결과를 같이 기다린다.
    if (inflight.has(key)) return inflight.get(key);

    const promise = (async () => {
      try {
        const value = await loader();
        purgeExpired();
        store.set(key, { value, expiresAt: now() + ttlOf(value) });
        return value;
      } finally {
        inflight.delete(key); // 끝나면(성공이든 실패든) 진행 중 표시를 지운다
      }
    })();
    inflight.set(key, promise);
    return promise;
  }

  return { getOrLoad, size: () => store.size };
}