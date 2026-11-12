# TREAGENT 리서치 데이터

## 현재 자료

| 자료 | 위치 | 이용할 때 확인할 점 |
| --- | --- | --- |
| 지도·블로그·SNS 리뷰 수집 파일 | [reviews/raw/](reviews/raw/) | 파일마다 수집 단위가 다르다. SNS 파일에는 헤더만 있다. |
| 여정 분석용 리뷰 묶음 | [reviews.csv](reviews/analysis/reviews.csv) | 20건. 이 파일은 여정 분석에 사용한 묶음이다. |
| 여정·주제·감정 태그 | [reviews_tagged.csv](reviews/analysis/reviews_tagged.csv) | 20건. 같은 분석 묶음 안에서 `id`로 연결한다. |
| 리뷰 분석 결과 | [리포트](reviews/analysis/report.md), [차트](reviews/analysis/charts/summary.html), [표본 검사](reviews/review_log.md) | 차트나 건수를 인용할 때 사용한 표본과 한계를 함께 표시한다. |
| 페인포인트 분류용 VOC | [voc_classified.csv](../../painpoint/voc_classified.csv) | 별도 분류 자료 52건. 여정 분석 20건과 `id`가 같아도 같은 행으로 간주할 수 없다. |

## 새 데이터 추가

- 장소·운영 정보는 `data/places/`, 날씨 자료는 `data/weather/`, 기타 데이터는 `data/<주제>/` 아래에 추가한다. 새 폴더는 실제 데이터가 들어올 때 만든다.
- 수집 파일과 분석용으로 가공한 파일을 구별한다. 데이터와 함께 `sources.md` 또는 데이터 설명에 출처, 확인·수집일, 사용 조건, 열의 뜻과 단위, 비어 있는 값의 의미를 적는다. 저장소의 자료 메타데이터에도 파일을 등록한다.
- 실측, 외부 수집, 시연용 샘플은 이름이나 설명에서 구분한다. 출처와 사용 조건을 확인할 수 없는 자료는 공유 범위를 먼저 확인한다.

## 출처

- [리뷰 수집 계획과 기록](reviews/README.md), [분류 기준](reviews/analysis/tag_criteria.md), [아카이브 메타데이터](../../archive/metadata.csv).
