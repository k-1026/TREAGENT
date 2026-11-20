// 일행 저장소(Supabase PostgreSQL). 모든 SQL은 값을 $1, $2처럼 따로 넘겨서(파라미터) 입력값이 SQL 글자에 섞이지 않는다.
// 사용자 좌표는 어디에도 저장하지 않는다. 길(party_routes)은 버전마다 새 행을 추가만 하고 고치거나 지우지 않는다.
//   query: async (sql, params) => rows  (createPgQuery로 만든 함수, 테스트에서는 가짜 함수)
// 메모리로 같은 약속을 지키는 구현은 memory_party_store.js에 있다.
const PARTY_COLUMNS = `
  id,
  host_user_id as "hostUserId",
  invite_code  as "inviteCode",
  companion, theme, zone, variant,
  started_at   as "startedAt",
  expires_at   as "expiresAt"`;

export function createPgPartyStore({ query }) {
  return {
    // 일행을 만들고 만든 사람을 host로 등록한다. 한 문장(CTE)이라 둘 다 되거나 둘 다 안 된다.
    // 초대 코드가 겹치면 DB가 unique 오류(코드 23505)를 던진다. 호출한 쪽이 새 코드로 다시 시도한다.
    async createParty({ hostUserId, inviteCode, ageGroup, companion, theme, zone, variant, expiresAt }) {
      const rows = await query(
        `with p as (
           insert into public.parties (host_user_id, invite_code, companion, theme, zone, variant, expires_at)
           values ($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::timestamptz)
           returning id, invite_code, expires_at
         ), m as (
           insert into public.party_members (party_id, user_id, age_group, role)
           select id, $1::uuid, $8::text, 'host' from p
         )
         select id, invite_code as "inviteCode", expires_at as "expiresAt" from p`,
        [hostUserId, inviteCode, companion ?? null, theme ?? null, zone ?? null, variant ?? 'B', expiresAt.toISOString(), ageGroup],
      );
      return rows[0];
    },

    async findByCode(inviteCode) {
      const rows = await query(`select ${PARTY_COLUMNS} from public.parties where invite_code = $1::text`, [inviteCode]);
      return rows[0] ?? null;
    },

    async findById(id) {
      const rows = await query(`select ${PARTY_COLUMNS} from public.parties where id = $1::uuid`, [id]);
      return rows[0] ?? null;
    },

    async listMembers(partyId) {
      return query(
        `select user_id as "userId", age_group as "ageGroup", role
         from public.party_members where party_id = $1::uuid order by joined_at, user_id`,
        [partyId],
      );
    },

    // 일행에 참여한다. 인원 상한을 넘으면 넣지 않는다. 결과: 'JOINED' | 'ALREADY'(이미 참여) | 'FULL'
    // [확인 필요] 동시에 여러 명이 마지막 자리에 들어오면 상한을 1명 넘을 수 있다 (데모 수준에서는 허용).
    async addMember({ partyId, userId, ageGroup, maxMembers }) {
      const inserted = await query(
        `insert into public.party_members (party_id, user_id, age_group, role)
         select p.id, $2::uuid, $3::text, 'member'
         from public.parties p
         where p.id = $1::uuid
           and (select count(*) from public.party_members m where m.party_id = p.id) < $4::int
         on conflict (party_id, user_id) do nothing
         returning party_id`,
        [partyId, userId, ageGroup, maxMembers],
      );
      if (inserted.length > 0) return 'JOINED';
      const existing = await query(
        `select 1 from public.party_members where party_id = $1::uuid and user_id = $2::uuid`,
        [partyId, userId],
      );
      return existing.length > 0 ? 'ALREADY' : 'FULL';
    },

    // 그 모드의 가장 최신 길. 없으면 null.
    async latestRoute(partyId, mode) {
      const rows = await query(
        `select version, title, reason, picker, place_ids as "placeIds"
         from public.party_routes
         where party_id = $1::uuid and mode = $2::text
         order by version desc limit 1`,
        [partyId, mode],
      );
      return rows[0] ?? null;
    },

    // 새 버전의 길을 추가한다. 같은 (일행, 모드, 버전)이 이미 있으면 넣지 않고 false (다른 사람이 먼저 저장한 것).
    async saveRoute({ partyId, mode, version, title, reason, picker, placeIds }) {
      const rows = await query(
        `insert into public.party_routes (party_id, mode, version, title, reason, picker, place_ids)
         values ($1::uuid, $2::text, $3::int, $4::text, $5::text, $6::text, $7::text[])
         on conflict (party_id, mode, version) do nothing
         returning id`,
        [partyId, mode, version, title, reason ?? null, picker, placeIds],
      );
      return rows.length > 0;
    },
    // 일행이 길을 하나라도 정했는가 (어떤 모드든)
    async hasRoute(partyId) {
      const rows = await query(`select 1 from public.party_routes where party_id = $1::uuid limit 1`, [partyId]);
      return rows.length > 0;
    },

    // 일행에 후보 길이 하나라도 있는가 (있으면 팀원이 길을 먼저 만들지 못하게 막는 데 쓴다)
    async hasCandidates(partyId) {
      const rows = await query(`select 1 from public.party_route_candidates where party_id = $1::uuid limit 1`, [partyId]);
      return rows.length > 0;
    },

    // 그 모드의 가장 최신 후보 묶음. 없으면 null. 결과: { setNo, candidates: [{ title, reason, picker, placeIds }] } (순번 순서)
    async latestCandidates(partyId, mode) {
      const rows = await query(
        `select set_no as "setNo", idx, title, reason, picker, place_ids as "placeIds"
         from public.party_route_candidates
         where party_id = $1::uuid and mode = $2::text
           and set_no = (select max(set_no) from public.party_route_candidates where party_id = $1::uuid and mode = $2::text)
         order by idx`,
        [partyId, mode],
      );
      if (rows.length === 0) return null;
      return {
        setNo: rows[0].setNo,
        candidates: rows.map(({ title, reason, picker, placeIds }) => ({ title, reason, picker, placeIds })),
      };
    },

    // 새 후보 묶음을 추가한다. 같은 (일행, 모드, 묶음 번호)가 이미 있으면 넣지 않고 false.
    // 장소 id는 쉼표로 이어 한 글자열로 넘기고 DB에서 다시 나눈다(id는 영문·숫자·밑줄·하이픈만 쓴다).
    async saveCandidates({ partyId, mode, setNo, candidates }) {
      const rows = await query(
        `insert into public.party_route_candidates (party_id, mode, set_no, idx, title, reason, picker, place_ids)
         select $1::uuid, $2::text, $3::int, t.n - 1, t.title, nullif(t.reason, ''), t.picker, string_to_array(t.ids, ',')
         from unnest($4::text[], $5::text[], $6::text[], $7::text[]) with ordinality as t(title, reason, picker, ids, n)
         on conflict (party_id, mode, set_no, idx) do nothing
         returning id`,
        [
          partyId,
          mode,
          setNo,
          candidates.map((c) => c.title),
          candidates.map((c) => c.reason ?? ''),
          candidates.map((c) => c.picker),
          candidates.map((c) => c.placeIds.join(',')),
        ],
      );
      return rows.length === candidates.length;
    },

    // 시작 처리. 이미 시작했으면 처음 시각을 그대로 돌려준다.
    async markStarted(partyId) {
      const rows = await query(
        `update public.parties set started_at = coalesce(started_at, now())
         where id = $1::uuid returning started_at as "startedAt"`,
        [partyId],
      );
      return rows[0]?.startedAt ?? null;
    },
  };
}