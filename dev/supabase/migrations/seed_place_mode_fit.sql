-- 장소당 한 줄: 적합도를 {탐험, 그늘, 실내, 호우} 순서로 적는다. '-'는 값 없음.
insert into public.place_mode_fit (place_id, mode, fit, is_estimated)
select v.place_id, m.mode, v.fits[m.n], v.est
from (values
  ('J01', '{mostly,good,good,good}'::text[], false),
  ('J02', '{good,conditional,bad,bad}', false),
  ('J03', '{good,mostly,good,good}', false),
  ('J04', '{good,conditional,bad,bad}', false),
  ('J05', '{good,mostly,good,bad}', false),
  ('J06', '{mostly,mostly,mostly,conditional}', false),
  ('J07', '{mostly,good,good,good}', false),
  ('J08', '{-,good,good,good}', false),
  ('J09', '{mostly,good,good,good}', false),
  ('J10', '{mostly,mostly,conditional,bad}', false),
  ('J11', '{mostly,mostly,conditional,bad}', false),
  ('J12', '{conditional,mostly,good,good}', false),
  ('J13', '{mostly,mostly,good,good}', false),
  ('J14', '{mostly,good,good,good}', false),
  ('J15', '{conditional,good,good,good}', true),
  ('J16', '{conditional,good,good,good}', true),
  ('J17', '{good,conditional,bad,bad}', false),
  ('J18', '{good,mostly,bad,bad}', false),
  ('J19', '{good,mostly,bad,bad}', false),
  ('J20', '{good,mostly,bad,bad}', false),
  ('J21', '{conditional,good,good,good}', true),
  ('J22', '{conditional,good,good,good}', true),
  ('J23', '{conditional,good,good,good}', true),
  ('J24', '{conditional,good,good,good}', true),
  ('J25', '{conditional,good,good,good}', true),
  ('J26', '{conditional,good,good,good}', true),
  ('J27', '{conditional,good,good,good}', true),
  ('J28', '{conditional,good,good,good}', true),
  ('J29', '{conditional,good,good,good}', true),
  ('J30', '{conditional,good,good,good}', true),
  ('J31', '{conditional,good,good,good}', true),
  ('J32', '{conditional,good,good,good}', true),
  ('J33', '{conditional,good,good,good}', true),
  ('J34', '{conditional,good,good,good}', true),
  ('J35', '{conditional,good,good,good}', true),
  ('J36', '{conditional,good,good,good}', true),
  ('J37', '{conditional,good,good,good}', true),
  ('J38', '{conditional,good,good,good}', true),
  ('J39', '{conditional,good,good,good}', true),
  ('J40', '{conditional,good,good,good}', true),
  ('J41', '{conditional,good,good,good}', true),
  ('J42', '{mostly,conditional,mostly,conditional}', true),
  ('J43', '{good,conditional,bad,bad}', true),
  ('J44', '{mostly,conditional,mostly,conditional}', true),
  ('J45', '{conditional,good,good,good}', true),
  ('J46', '{conditional,good,good,good}', true),
  ('J47', '{conditional,good,good,good}', true),
  ('J48', '{conditional,good,good,good}', true),
  ('J49', '{conditional,good,good,good}', true),
  ('J50', '{conditional,good,good,good}', true)
) as v(place_id, fits, est)
cross join (values (1, 'EXPLORE'), (2, 'SHADE'), (3, 'INDOOR'), (4, 'RAIN')) as m(n, mode)
where v.fits[m.n] <> '-'
on conflict (place_id, mode) do nothing;

-- 값 옆 괄호 설명은 note로 (비어 있는 칸만 채움)
update public.place_mode_fit f set note = v.note
from (values
  ('J05', 'SHADE', '오전'),
  ('J05', 'INDOOR', '내부만'),
  ('J05', 'RAIN', '야외'),
  ('J06', 'RAIN', '지붕 여부 확인 필요'),
  ('J08', 'EXPLORE', '옥상'),
  ('J08', 'SHADE', '실내 층'),
  ('J08', 'INDOOR', '실내 층'),
  ('J08', 'RAIN', '실내 층'),
  ('J10', 'INDOOR', '미사 시간 제한 확인'),
  ('J11', 'INDOOR', '실내 여부 확인'),
  ('J19', 'EXPLORE', '저녁')
) as v(place_id, mode, note)
where f.place_id = v.place_id and f.mode = v.mode and f.note is null;

-- 「모드별 추천」 시트의 활용 구분과 이용 방식 (비어 있는 칸만 채움)
update public.place_mode_fit f
set usage_role = v.usage_role, usage_text = v.usage_text
from (values
  ('J17', 'EXPLORE', '탐험 장소', '한 장소의 짧은 구간만 둘러보기'),
  ('J14', 'EXPLORE', '탐험 중 문화 관람', '관람 후 다음 장소 이동'),
  ('J13', 'EXPLORE', '탐험 중 문화 관람', '관람 후 다음 장소 이동'),
  ('J15', 'SHADE', '실내 휴식·관람 거점', '개방·좌석·냉방 확인 후 실내 이용'),
  ('J16', 'SHADE', '실내 휴식·관람 거점', '개방·좌석·냉방 확인 후 실내 이용'),
  ('J13', 'SHADE', '실내 휴식·관람 거점', '개방·좌석·냉방 확인 후 실내 이용'),
  ('J01', 'INDOOR', '실내 관람', '실내 영역만 이용하고 야외 인증·탐방 제외'),
  ('J14', 'INDOOR', '실내 관람', '실내 영역만 이용하고 야외 인증·탐방 제외'),
  ('J13', 'INDOOR', '실내 관람', '실내 영역만 이용하고 야외 인증·탐방 제외')
) as v(place_id, mode, usage_role, usage_text)
where f.place_id = v.place_id and f.mode = v.mode and f.usage_role is null;