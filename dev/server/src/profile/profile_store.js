// 프로필 저장소(Supabase PostgreSQL). 값은 $1, $2처럼 따로 넘겨서(파라미터) 입력값이 SQL 글자에 섞이지 않는다.
//   query: async (sql, params) => rows
export function createPgProfileStore({ query }) {
  return {
    async find(userId) {
      const rows = await query(
        `select nickname, age_group as "ageGroup" from public.profiles where user_id = $1::uuid`,
        [userId],
      );
      return rows[0] ?? null;
    },

    // 다른 사람이 이미 쓰는 닉네임인가 (대소문자 무시). exceptUserId는 내 닉네임을 겹침으로 보지 않으려고 뺀다.
    async isNicknameTaken(nickname, exceptUserId) {
      const rows = await query(
        `select 1 from public.profiles where lower(nickname) = lower($1::text) and user_id <> $2::uuid limit 1`,
        [nickname, exceptUserId],
      );
      return rows.length > 0;
    },

    // 프로필을 만들거나 고친다.

    // 프로필을 만들거나 고친다. 닉네임이 이미 있으면 DB가 그대로 둔다(coalesce).
    // 다른 사람이 쓰는 닉네임이면 DB가 unique 오류(코드 23505)를 던진다. 호출한 쪽이 409로 바꾼다.
    async save({ userId, nickname, ageGroup }) {
      const rows = await query(
        `insert into public.profiles (user_id, nickname, age_group)
         values ($1::uuid, $2::text, $3::text)
         on conflict (user_id) do update
           set nickname = coalesce(public.profiles.nickname, excluded.nickname),
               age_group = excluded.age_group,
               updated_at = now()
         returning nickname, age_group as "ageGroup"`,
        [userId, nickname, ageGroup],
      );
      return rows[0];
    },
  };
}