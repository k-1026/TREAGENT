// 위치 확인 화면 (주소: /location) — 최초 시작 때 쓴다. 뒤로 버튼 없음.
// 설정(내 정보·날씨·홈 지역 안내)에서 여는 위치 화면은 /location_setting 이다.
import { LocationScreen } from '../components/location_screen';

export default function LocationFirstScreen() {
  return <LocationScreen mode="first" />;
}
