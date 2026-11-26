-- 좌표가 비어 있던 장소 9곳에 T맵 장소 검색(POI) 결과의 중심 좌표를 채운다 (2026-11-26 조회, WGS84).
-- 이 좌표는 "장소의 좌표"다. 사용자 좌표가 아니다 (절대 규칙 1).
-- 이름이 같거나 거의 같고, 대구 중구 안이며, 후보가 하나로 정해지는 곳만 넣었다. 좌표가 비어 있을 때만 바꾼다 (다시 실행해도 안전).
-- 넣지 않은 곳(13곳 중 이름이 다르거나 후보가 여럿이거나 검색 결과가 없음): J07 3호선 모노레일, J15 북성로사람들, J16 피플스커피(중구에 2곳),
--   J25 동원화랑(검색 결과는 "동원갤러리"), J33·J34·J36·J38·J39·J40·J41 작은도서관들, J43 교동 귀금속 골목, J49 떼아뜨르 중구. 직접 조사해서 채운다 [확인 필요].
-- 실행 순서: 14번. 5번(alter_places)과 7번(seed_places_jung) 뒤에 실행한다.

update public.places set lat = 35.867595, lng = 128.590785, updated_at = now() where id = 'J02' and (lat is null or lng is null); -- 약전골목 (T맵: 약전골목, 장관동)
update public.places set lat = 35.867928, lng = 128.595396, updated_at = now() where id = 'J03' and (lat is null or lng is null); -- 동성로 (T맵: 동성로, 봉산동)
update public.places set lat = 35.866817, lng = 128.585314, updated_at = now() where id = 'J05' and (lat is null or lng is null); -- 청라언덕·선교사 스윗즈 주택 (T맵: 청라언덕, 동산동. 스윗즈주택은 바로 옆)
update public.places set lat = 35.868651, lng = 128.598590, updated_at = now() where id = 'J08' and (lat is null or lng is null); -- 스파크랜드 (T맵: 스파크랜드, 공평동)
update public.places set lat = 35.867262, lng = 128.587980, updated_at = now() where id = 'J11' and (lat is null or lng is null); -- 이상화·서상돈 고택 (T맵: 이상화고택. 서상돈고택은 바로 옆)
update public.places set lat = 35.864290, lng = 128.593341, updated_at = now() where id = 'J12' and (lat is null or lng is null); -- 반월당역 (T맵: 반월당역[대구1호선])
update public.places set lat = 35.873372, lng = 128.598673, updated_at = now() where id = 'J44' and (lat is null or lng is null); -- 교동 전자상가 골목 (T맵: 교동전자상가)
update public.places set lat = 35.867623, lng = 128.594979, updated_at = now() where id = 'J46' and (lat is null or lng is null); -- 하모니아 아트홀 (T맵: 하모니아아트홀)
update public.places set lat = 35.873400, lng = 128.595451, updated_at = now() where id = 'J47' and (lat is null or lng is null); -- 송죽씨어터 (T맵: 송죽씨어터)
