insert into public.courses
  (id, title, theme, district, duration_min, start_place_id, published, note)
values
('C01', '중구 근대골목 걷기', null, '중구', 60, 'J03', true,
 '제목은 후보 A(후보 B: 중구 약령시 한 바퀴). 소요 60분은 임시 [확인 필요]. 이야기 제목은 [창작] 대기.');

insert into public.course_routes (course_id, type, ordered_place_ids, note) values
('C01', 'explore', '{J03,J04,J01}', '기존 데모 코스 A의 앞 3곳. 야외 연속 이동 15분 이하는 [확인 필요].'),
('C01', 'indoor',  '{J01,J21,J09}', '전시 3곳. 이동 거리 [확인 필요]. J09는 민감 역사 caution.');