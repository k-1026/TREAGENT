# 카카오 흐름도 v0 — 상품·돈·데이터

작성일: 2026-11-06 · 입력: [stakeholders.md](stakeholders.md), [activities_v0.md](activities_v0.md), [onepager.md](../onepager.md)

## 표기 약속
| 선 | 뜻 | 라벨 |
|---|---|---|
| `A --> B` 실선 | 상품·활동의 흐름 | 무엇이 넘어가는지 |
| `B ==> A` 굵은 선 | 돈의 흐름 | 수수료·정산 |
| `B -.-> A` 점선 | 데이터의 흐름 | 데이터 이름과 보유자 |

색 상자: 주황 = 병목 · 연두 = 기회 · 빨강 = 비용

겹침을 막으려고 같은 두 노드 사이에 화살표가 양방향으로 가지 않게 했다. 판매 수수료·정산은 `정산 처리` 노드를 따로 두고, 구매·이용 데이터와 광고 반응 데이터는 보유자를 담은 데이터 노드로 보냈다.

```mermaid
flowchart LR
  artist["이모티콘 작가"]
  ip["카카오 IP<br/>춘식이·카카오프렌즈"]
  extip["외부 IP<br/>넷플릭스 등"]
  daegu["대구시<br/>도달쑤 IP 소유"]
  make["콘텐츠 제작<br/>이모티콘·웹툰·굿즈"]
  camp["캠페인<br/>톡비즈 광고·기획전"]
  adv["광고주"]
  seller["입점 판매자"]
  comm["커머스 판매<br/>선물하기·톡스토어"]
  buyer["구매자·수령자<br/>자기구매 포함"]
  pay["카카오페이<br/>결제"]
  payout["판매자 정산<br/>판매액 − 수수료"]
  cost["매출연동비<br/>7,900억 원(3Q26)"]
  dataBuyer["구매·이용 데이터<br/>카카오 커머스 보유"]
  dataAd["광고 반응 데이터<br/>카카오 톡비즈 보유 [I]"]

  artist -->|"이모티콘 원안"| make
  ip -->|"IP 활용"| make
  extip -->|"협업 IP"| make
  daegu -->|"IP 사용 허가"| make
  make -->|"상품·콘텐츠"| camp
  camp -->|"기획전 노출"| comm
  seller -->|"상품 등록"| comm
  comm -->|"상품·선물 전달"| buyer

  adv ==>|"광고비(톡비즈)"| camp
  buyer ==>|"결제"| pay
  pay ==>|"결제 대금"| comm
  comm ==>|"판매액 − 수수료"| payout
  payout ==>|"정산 지급"| seller
  comm ==>|"매출 연동 지급 [U]"| cost

  buyer -.->|"구매·이용 이력"| dataBuyer
  camp -.->|"광고 반응"| dataAd

  classDef bottleneck fill:#FEF3DC,stroke:#E89B00
  classDef opp fill:#EEF7E2,stroke:#9BD24B
  classDef cost fill:#FCEBE5,stroke:#E8603C
  class make bottleneck
  class seller,daegu opp
  class cost cost
```

## 색 상자가 뜻하는 것
| 색 | 노드 | 이유 | 근거 |
|---|---|---|---|
| 병목 (주황) | 콘텐츠 제작 | 웹툰·웹소설 성장 둔화, 스토리 매출 −17% | [출처 03][출처 13][출처 14] |
| 기회 (연두) | 입점 판매자 | 선물하기·톡스토어 입점, 지역 상품이 들어갈 자리 | [출처 01] [I] |
| 기회 (연두) | 대구시 | 도달쑤 IP 협업 가능성. 상업 이용은 서면 확인 전까지 불가 | [출처 12] |
| 비용 (빨강) | 매출연동비 | 3Q26 7,900억 원. 지급 상대는 원페이지에 없음 | [출처 03] [U] |

## 점검
- 실선·굵은 선·점선 세 종류를 모두 썼다.
- 판매 수수료 요율, 매출연동비 수취인, 판매자가 보는 데이터 범위는 원페이지에 없어 [U]로 표시했다. 판매자가 보는 데이터 화살표는 겹침을 피하려고 뺐다.
- 광고 반응 데이터는 원페이지에 근거가 없어 [I]로 표시했다.
- 도달쑤 상업 이용은 서면 확인 전 판매·협업이 가능하다고 쓰지 않는다 [CLAUDE.md 1절].
