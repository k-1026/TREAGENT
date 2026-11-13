# 여름 기준 장소 후보 풀 v1

- 목적: 여름(폭염 모드 포함) 코스 설계에 쓸 장소 후보를 넓게 모읍니다.
- 범위: 여름만 다룹니다. 다른 계절은 이 문서에서 다루지 않습니다.
- 상태: 후보 단계입니다. 확정이 아닙니다. 장소별 사실 확인은 `summer_place_facts_v1.md`에서 합니다.
- 분류(시간대·날씨 모드 가능 여부)는 사실 확인 뒤에 합니다. 이 문서에는 분류 값을 쓰지 않습니다.

## 1. 선정 기준 (plan/daeprica_hidden_quest_plan.md 3-1장 재사용)

- 대구 테스트: 다른 도시로 옮기면 의미가 사라지는가
- 여름 적합성: 실내이거나 그늘·쉼터가 있거나, 저녁·야간에 갈 수 있는가
- 이동 효율: 3호선 등 대중교통으로 연결되는가
- 시간 완결성: 30·60·90분 코스에 들어가는가
- 안전: 쉼터·화장실·실내 대체 장소가 가까운가

## 2. 후보 목록

- 근거 열: 저장소에서 이미 나온 장소는 파일명을 적었습니다. `추가 제안`은 저장소에 근거가 없어 이번에 새로 넣은 후보입니다. 운영 정보는 모두 아직 미확인입니다.
- 유형은 후보 단계의 1차 구분입니다. 실제 실내·실외 판정은 사실 확인에서 합니다.

| id | 장소 | 1차 유형 | 여름에 넣는 이유 | 근거 |
|---|---|---|---|---|
| P01 | 대구약령시 한의약박물관 | 실내(박물관) | 실내 시설 | plan/daeprica_hidden_quest_plan.md 3-2장, dev/app/src/data/courseA.ts |
| P02 | 약전골목 (약령시 거리) | 야외 거리 | 박물관과 한 동선 | plan/daeprica_hidden_quest_plan.md 3-2장 |
| P03 | 동성로 | 야외 상권 + 실내 상가 | 도심 상권, 실내 상가와 카페가 많은 지역 | plan/daeprica_hidden_quest_plan.md 3-2장, courseA.ts |
| P04 | 근대골목 | 야외 골목 | 코스 A의 야외 구간 (폭염 시 제외 후보) | plan/daeprica_hidden_quest_plan.md 3-2장, courseA.ts |
| P05 | 청라언덕 | 야외 언덕 | 3호선 청라언덕역 하차 지점 | plan/daeprica_hidden_quest_plan.md 5-1장 |
| P06 | 서문시장 | 반실외(시장 내부) + 야시장 | 낮 시장과 저녁 야시장 | plan/daeprica_hidden_quest_plan.md 3-2장, courseA.ts |
| P07 | 칠성시장·칠성야시장 | 반실외 + 야시장 | 여름 야간 후보 | plan/daeprica_hidden_quest_plan.md 3-2장 |
| P08 | 3호선 모노레일 | 이동수단(냉방) | 이동 자체가 콘텐츠, 냉방 | plan/daeprica_hidden_quest_plan.md 3-2장, 5-1장 |
| P09 | 수성못 | 야외 공원 | 나무 그늘이 넓은 도심 공원 | plan/daeprica_hidden_quest_plan.md 3-2장, 5-2장 |
| P10 | 두류공원 (치맥페스티벌 장소) | 야외 공원 | 여름 축제 장소 | archive/story/daeprica_research_note.md |
| P11 | 앞산 해넘이 전망대 | 야외 전망 | 해 질 무렵·야경 | plan/daeprica_hidden_quest_plan.md 3-2장 |
| P12 | 신천 | 야외 하천 | 야간 산책·러닝 | plan/daeprica_hidden_quest_plan.md 3-2장 |
| P13 | 스파크랜드 (동성로 옥상 놀이공원) | 실내·옥상 혼합 | 동성로 안 | research/keyword_map.md (콜라보 후보, 팀 검토) |
| P14 | 국채보상운동기념관 | 실내(기념관) | 대구 고유 역사, 실내 | 추가 제안. research/daegu_history_tour_cases.md 에 전시관 언급 |
| P15 | 대구근대역사관 | 실내(박물관) | 근대골목 인근 실내 | 추가 제안 |
| P16 | 계산성당 | 실내(성당) + 야외 마당 | 근대골목 동선, 야간 프로그램 언급 | research/daegu_history_tour_cases.md |
| P17 | 이상화 고택 | 실내·야외 혼합 | 근대골목 동선 안, 무료 개방 언급 | research/keyword_map.md |
| P18 | 반월당역 (3호선·1호선 환승) | 지하 역사 | 코스 허브 후보 | plan/daeprica_hidden_quest_plan.md 4-1장 |
| P19 | 83타워 (두류공원 안) | 실내(전망·상업시설) | 대구 12경, 두류공원 인근 실내 후보 | 추가 제안. https://tour.daegu.go.kr/index.do?menu_id=00002911 |

## 3. 후보에서 제외하거나 보류한 것

- 팔공산(동화사·갓바위·케이블카): 가을 코스 중심이라 여름 풀에서 뺍니다. 여름 별도 검토가 필요하면 `결정 필요`로 올립니다.
- 이월드 별빛축제: 겨울 야간 후보라 뺍니다.
- 엑스코 연말 행사: 겨울이라 뺍니다.
- 음식(막창, 따로국밥 등): 코스 주제로 쓰지 않고 식사 장소로만 씁니다 (plan/daeprica_hidden_quest_plan.md 3-3장).
- 야구장: 구단 IP 제약이 있어 보조 퀘스트로만 씁니다 (같은 문서 3-3장).

## 4. 주의 (민감한 소재)

- P14, P15, P16, P05 일대는 일제강점기와 국채보상운동 같은 식민지 시기 역사를 다룹니다.
- 공포나 오락 연출 소재로 쓰지 않고, 별도 `주의` 항목으로 표시합니다.

## 5. 결정 필요

- [ ] 추가 제안 후보(P14~P17, P19)를 풀에 유지할지
- [ ] P13 스파크랜드처럼 민간 시설을 코스에 넣을 때 허가 범위를 어떻게 확인할지
- [ ] 여름에 팔공산 계열을 별도로 볼지
- [ ] 국립대구박물관, 대구미술관 같은 중심지 밖 실내 시설을 추가 조사할지 (저장소 근거 없음)

## 출처

- plan/daeprica_hidden_quest_plan.md 3장, 4장, 5장
- dev/app/src/data/courseA.ts
- archive/story/daeprica_research_note.md
- research/keyword_map.md
- research/daegu_history_tour_cases.md
