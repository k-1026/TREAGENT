-- 엑셀 「중구 장소표」 50곳 중 아직 없는 43곳을 추가한다. 이미 있는 행(담당자가 고친 값 포함)은 건드리지 않는다.
insert into public.places
  (id, name, district, place_kind, type, indoor, open_hour, close_hour, closed_weekdays,
   fee_type, fee_estimated, status, verify_state, permission_state, role, source)
select v.id, v.name, '중구', v.place_kind, v.type, v.indoor::boolean,
       v.open_hour::smallint, v.close_hour::smallint, v.closed_weekdays::smallint[],
       v.fee_type, v.fee_estimated::boolean, v.status, v.verify_state, v.permission_state, v.role,
       'research/tourism_data/tourism_data_jung_v7.xlsx 중구 장소 #' || ltrim(substr(v.id, 2), '0')
from (values
  ('J02', '약전골목 (약령시 거리)', '거리·시장', 'outdoor', false, null, null, '{}', 'free', true, 'open', 'partial', 'not_needed', 'visit'),
  ('J05', '청라언덕·선교사 스윗즈 주택', '역사 주택·언덕', 'outdoor', null, null, null, '{}', 'free', false, 'open', 'partial', 'not_needed', 'visit'),
  ('J07', '3호선 모노레일 (이동 수단)', '이동 수단', 'indoor', true, null, null, '{}', 'paid', false, 'unknown', 'partial', 'not_needed', 'hub'),
  ('J08', '스파크랜드 (동성로 옥상 기종 포함)', '놀이 시설', 'indoor', null, null, null, '{}', 'paid', false, 'unknown', 'partial', 'unknown', 'visit'),
  ('J10', '계산성당', '성당 (종교시설)', 'indoor', null, null, null, '{}', 'free', false, 'open', 'partial', 'not_needed', 'visit'),
  ('J11', '이상화·서상돈 고택', '고택 (역사)', 'outdoor', null, null, null, '{}', 'unknown', false, 'open', 'partial', 'not_needed', 'visit'),
  ('J12', '반월당역', '지하철 역 (허브)', 'indoor', true, null, null, '{}', 'na', false, 'unknown', 'unverified', 'not_needed', 'hub'),
  ('J13', '대구예술발전소', '문화예술 공간', 'exhibit', null, null, null, '{}', 'free', false, 'unknown', 'partial', 'unknown', 'visit'),
  ('J14', '대구근대역사관', '역사 박물관', 'exhibit', true, null, null, '{1}', 'free', false, 'open', 'partial', 'not_needed', 'visit'),
  ('J15', '북성로사람들', '카페 (레트로)', 'indoor', true, null, null, '{}', 'paid', true, 'unknown', 'partial', 'unknown', 'visit'),
  ('J16', '피플스커피', '카페', 'indoor', true, 8, 21, '{}', 'paid', true, 'unknown', 'partial', 'unknown', 'visit'),
  ('J17', '김광석 다시그리기길', '도보 거리·벽화·공연', 'outdoor', false, 0, 24, '{}', 'free', false, 'open', 'partial', 'not_needed', 'visit'),
  ('J18', '봉산문화거리', '문화거리', 'outdoor', false, null, null, '{}', 'free', true, 'unknown', 'unverified', 'not_needed', 'visit'),
  ('J19', '국채보상운동기념공원 (경관조명)', '공원 (야간 조명)', 'outdoor', false, null, null, '{}', 'free', true, 'unknown', 'unverified', 'not_needed', 'visit'),
  ('J20', '달성공원 (동물원)', '공원·동물원', 'outdoor', null, null, null, '{}', 'free', true, 'unknown', 'unverified', 'not_needed', 'visit'),
  ('J22', '대구콘서트하우스', '공연장', 'indoor', true, null, null, '{}', 'paid', false, 'unknown', 'partial', 'unknown', 'visit'),
  ('J23', '봉산문화회관', '문화회관 (전시·프로그램)', 'exhibit', true, null, null, '{}', 'free', false, 'unknown', 'partial', 'unknown', 'visit'),
  ('J24', '보이드 갤러리', '미술관 (대봉동)', 'exhibit', true, 10, 19, '{}', 'unknown', false, 'unknown', 'confirmed', 'unknown', 'visit'),
  ('J25', '동원화랑', '화랑 (전시)', 'exhibit', true, 10, 18, '{0}', 'free', false, 'unknown', 'unverified', 'unknown', 'visit'),
  ('J26', '갤러리 신라 (대구)', '갤러리 (전시)', 'exhibit', true, null, null, '{}', 'unknown', false, 'unknown', 'unverified', 'unknown', 'visit'),
  ('J27', '리안갤러리', '갤러리 (전시)', 'exhibit', true, null, null, '{}', 'unknown', false, 'unknown', 'unverified', 'unknown', 'visit'),
  ('J29', '향촌문화관', '문화관 (전시)', 'exhibit', true, null, null, '{}', 'unknown', false, 'unknown', 'unverified', 'unknown', 'visit'),
  ('J30', '관덕정 순교 기념관', '기념관 (남산동)', 'exhibit', true, null, null, '{}', 'unknown', false, 'unknown', 'unverified', 'not_needed', 'visit'),
  ('J31', '더현대 대구 (현대백화점 대구점)', '백화점 (쇼핑·식당)', 'indoor', true, null, null, '{}', 'na', false, 'unknown', 'partial', 'unknown', 'visit'),
  ('J32', '국채보상운동기념도서관', '도서관 (기록전시관 1~2층 · 도서관 3~4층)', 'exhibit', true, null, null, '{}', 'free', true, 'open', 'partial', 'not_needed', 'visit'),
  ('J33', '중구노인복지관도서관', '도서관 (복지관 5층)', 'indoor', true, 9, 17, '{0,6}', 'free', true, 'unknown', 'partial', 'unknown', 'visit'),
  ('J34', '남산휴먼시아 2단지 마을도서관', '마을도서관', 'indoor', true, 15, 17, '{0,1,2,6}', 'free', true, 'unknown', 'partial', 'unknown', 'visit'),
  ('J35', '남산작은도서관', '작은도서관', 'indoor', true, 9, 18, '{0,6}', 'free', true, 'unknown', 'partial', 'unknown', 'visit'),
  ('J36', '대구수필작은도서관', '작은도서관', 'indoor', true, 10, 17, '{0,6}', 'free', true, 'unknown', 'partial', 'unknown', 'visit'),
  ('J37', '대구중구영어도서관', '영어도서관', 'indoor', true, 9, 18, '{0}', 'free', true, 'open', 'partial', 'not_needed', 'visit'),
  ('J38', '남산그린타운 작은도서관', '작은도서관', 'indoor', true, 15, 17, '{0,2,4,6}', 'free', true, 'unknown', 'partial', 'unknown', 'visit'),
  ('J39', '길을 찾는 작은도서관', '작은도서관', 'indoor', true, 9, 18, '{0,6}', 'free', true, 'unknown', 'partial', 'unknown', 'visit'),
  ('J40', '남산기독교종합사회복지관 작은도서관', '작은도서관 (복지관 4층)', 'indoor', true, null, null, '{0}', 'free', true, 'unknown', 'partial', 'unknown', 'visit'),
  ('J41', '고맙습니다 이삭 작은도서관', '작은도서관 (5층)', 'indoor', true, null, null, '{0,1}', 'free', true, 'unknown', 'partial', 'unknown', 'visit'),
  ('J42', '교동시장', '전통시장 (먹자골목)', 'outdoor', null, null, null, '{}', 'free', true, 'open', 'partial', 'not_needed', 'visit'),
  ('J43', '교동 귀금속 골목', '상점가 (귀금속 업체 약 200여 곳)', 'outdoor', null, null, null, '{}', 'na', false, 'open', 'partial', 'not_needed', 'visit'),
  ('J44', '교동 전자상가 골목', '상가 골목', 'outdoor', null, null, null, '{}', 'na', false, 'open', 'partial', 'not_needed', 'visit'),
  ('J45', '아트플러스씨어터', '소극장 (연극 상설 공연)', 'indoor', true, null, null, '{1}', 'paid', false, 'unknown', 'partial', 'unknown', 'visit'),
  ('J46', '하모니아 아트홀 (1관·2관)', '소극장', 'indoor', true, null, null, '{}', 'unknown', false, 'unknown', 'unverified', 'unknown', 'visit'),
  ('J47', '송죽씨어터 (송죽빌딩 2층 · 250석)', '소극장', 'indoor', true, null, null, '{}', 'unknown', false, 'unknown', 'partial', 'unknown', 'visit'),
  ('J48', '문화예술전용극장 CT', '전용 극장 (271석 · 검색 요약)', 'indoor', true, null, null, '{}', 'paid', false, 'unknown', 'partial', 'unknown', 'visit'),
  ('J49', '떼아뜨르 중구', '소극장 (이름만 확인)', 'indoor', true, null, null, '{}', 'unknown', false, 'unknown', 'unverified', 'unknown', 'visit'),
  ('J50', '예술극장 ''온''', '소극장', 'indoor', true, null, null, '{}', 'unknown', false, 'unknown', 'unverified', 'unknown', 'visit')
) as v(id, name, place_kind, type, indoor, open_hour, close_hour, closed_weekdays,
       fee_type, fee_estimated, status, verify_state, permission_state, role)
on conflict (id) do nothing;

-- 기존 7곳 중 엑셀에서 요금이 "(추정)"인 곳만 표시한다 (다른 값은 건드리지 않음).
update public.places set fee_estimated = true
where id in ('J03', 'J06') and fee_estimated = false;

-- 새로 넣은 43곳 중 아직 숨겨져 있는 32곳을 노출한다 (status가 unknown인 것만).
update public.places set status = 'open'
where status = 'unknown'
  and id in ('J07', 'J08', 'J12', 'J13', 'J15', 'J16', 'J18', 'J19', 'J20',
             'J22', 'J23', 'J24', 'J25', 'J26', 'J27', 'J29', 'J30', 'J31',
             'J33', 'J34', 'J35', 'J36', 'J38', 'J39', 'J40', 'J41',
             'J45', 'J46', 'J47', 'J48', 'J49', 'J50');