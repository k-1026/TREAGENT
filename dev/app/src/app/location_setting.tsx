// 위치 설정 화면 (주소: /location_setting) — 내 정보·날씨·홈 지역 안내에서 연다. 뒤로 버튼이 항상 있다.
import { LocationScreen } from '../components/location_screen';

export default function LocationSettingScreen() {
  return <LocationScreen mode="setting" />;
}
