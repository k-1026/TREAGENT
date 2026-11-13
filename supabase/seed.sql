-- 시드 데이터: 코스 A (app/src/data/courseA.ts 기준 데모 데이터)
-- 주의: 좌표·주소·운영시간·출처는 확인 전이라 비워 둠 [확인 필요]. 장소 사실 확인은 RES 담당 (spec F-04, C-01).
-- 장소 유형(place_type)은 데모용 임시 분류이며 현장 확인 후 수정한다.
-- 운영 상태는 확인 전이므로 모두 'unknown'(미확인)으로 둔다.

insert into public.places (id, name, indoor, place_type) values
  ('dongseongro', '동성로', false, 'outdoor'),
  ('geunDae', '근대골목', false, 'outdoor'),
  ('yangnyeongsi', '약령시 박물관', true, 'exhibit'),
  ('seomun', '서문시장', true, 'indoor')
on conflict (id) do nothing;

insert into public.place_status (place_id, status)
select id, 'unknown' from public.places
on conflict (place_id) do nothing;

insert into public.courses (id, title, subtitle, theme, duration_min, start_place_id, published) values
  ('course_a', '사라진 대구의 비밀 레시피', '중구 · 30분', '근대골목·약령시', 30, 'dongseongro', true)
on conflict (id) do nothing;

-- 폭염 경로(실내 우선)는 기획서 기준 추정값이며 확정 전 [추정]
insert into public.course_routes (id, course_id, route_type, ordered_place_ids) values
  ('course_a_basic', 'course_a', 'basic', array['dongseongro', 'geunDae', 'yangnyeongsi', 'seomun']),
  ('course_a_indoor', 'course_a', 'indoor', array['yangnyeongsi', 'dongseongro', 'seomun'])
on conflict (id) do nothing;
