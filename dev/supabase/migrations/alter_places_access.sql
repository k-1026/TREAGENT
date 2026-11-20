-- 장소의 권역과 접근성(계단·경사·쉴 곳) 열을 추가한다.
-- 이 파일은 열만 추가하고 값은 넣지 않는다. 값은 담당자가 현장이나 공식 자료로 확인해서 따로 입력한다.
-- 비어 있음(null)은 "아직 모름"이다. 서버와 AI는 값이 채워진 항목만 근거로 쓴다.
alter table public.places
  add column if not exists zone text,
  add column if not exists route_order smallint check (route_order >= 1),
  add column if not exists stairs text check (stairs in ('none', 'few', 'many')),
  add column if not exists slope text check (slope in ('flat', 'gentle', 'steep')),
  add column if not exists rest_spots text check (rest_spots in ('none', 'some', 'plenty')),
  add column if not exists edu_fit text check (edu_fit in ('good', 'ok', 'no')),
  add column if not exists access_note text,
  add column if not exists access_source text,
  add column if not exists access_checked_at date;

comment on column public.places.zone is '권역 코드(예: dongseongro, gyodong, daebong, seomun_yangnyeong, namsan, seomun_market). 서버 route_options.js의 ZONES와 맞춘다. 목록과 경계는 팀 확정 전 [미검증]이라 check를 걸지 않았다.';
comment on column public.places.route_order is '[임시] 같은 권역 안에서 걷는 순서 번호(1, 2, 3...). 장소 좌표와 이동 시간(place_links)이 채워지기 전까지만 방문 순서를 정하는 데 쓴다. 서로 다른 권역 사이에는 의미가 없다. 좌표가 들어오면 이 열은 쓰지 않는다. null=모름.';
comment on column public.places.stairs is '계단. none=없음, few=적음, many=많음. null=모름. 판단 기준은 팀 확정 전 [확인 필요].';
comment on column public.places.slope is '경사. flat=평지, gentle=완만, steep=가파름. null=모름. 판단 기준(각도·거리)은 팀 확정 전 [확인 필요].';
comment on column public.places.rest_spots is '쉴 곳(벤치·쉼터 등). none=없음, some=일부, plenty=충분. null=모름. 판단 기준은 팀 확정 전 [확인 필요].';
comment on column public.places.edu_fit is '아이 동반 교육 적합도. good=교육·체험 가치가 큼, ok=보통, no=부적합. null=모름. 동행이 kids일 때 선택 기준으로 쓴다. 판단 기준은 팀 확정 전 [확인 필요].';
comment on column public.places.access_note is '접근성 확인 내용을 한 줄로 적은 메모.';
comment on column public.places.access_source is '접근성·권역을 확인한 곳(현장 방문, 공식 페이지 주소 등). 값을 넣을 때는 반드시 적는다.';
comment on column public.places.access_checked_at is '접근성·권역을 확인한 날짜.';
