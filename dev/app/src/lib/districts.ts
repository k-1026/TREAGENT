/*
 * [districts.ts] 대구 구·군 목록 (임시 고정 데이터)
 *
 * 역할
 *  - 구·군 선택 화면이 보여 줄 9개 구·군의 코드와 이름을 가진다.
 *
 * 동작
 *  - DISTRICTS: 화면에 그릴 목록 (7개 구 + 달성군 + 군위군)
 *  - findDistrict(code): 코드로 항목을 찾는다. 없거나 알 수 없는 코드면 undefined.
 *
 * 근거: plan/spec/treagent_tech_spec_v1.md F-23 (9개 구·군)
 * [확인 필요] code는 임시 영문 표기다. 서버 추천 API의 "구·군 코드"(spec 911행)
 *             체계가 정해지면 맞춰야 한다. 결정 필요 항목으로 올린다.
 */
export type District = {
  code: string;
  name: string;
  // 날씨 조회용 지역 기준점(사용자 좌표 아님). 코스가 있는 지역만 둔다.
  center?: { latitude: number; longitude: number };
};
export const DISTRICTS: District[] = [
    // [확인 필요] 임시 기준점: 테스트에서 쓴 대구 시내 좌표. 중구 안인지와 출처 확인 필요.
  { code: 'jung', name: '중구', center: { latitude: 35.8714, longitude: 128.6014 } },
  // { code: 'dong', name: '동구' },
  // { code: 'seo', name: '서구' },
  // { code: 'nam', name: '남구' },
  // { code: 'buk', name: '북구' },
  // { code: 'suseong', name: '수성구' },
  // { code: 'dalseo', name: '달서구' },
  // { code: 'dalseong', name: '달성군' },
  // { code: 'gunwi', name: '군위군' },
];

export function findDistrict(code: string | undefined): District | undefined {
  return DISTRICTS.find((d) => d.code === code);
}