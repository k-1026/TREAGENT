/*
 * [location.ts] 현재 위치 읽기 (공용 모듈)
 *
 * 역할
 *  - expo-location을 감싸서, 화면이 "결과 종류"만 보고 분기하게 한다.
 *
 * 동작
 *  1) 기기 위치 서비스가 꺼져 있으면 → 'unavailable'
 *  2) 앱 사용 중 위치 권한을 요청한다. 허용이 아니면 → 'denied'
 *     (canAskAgain이 false면 시스템 팝업이 다시 안 뜨므로, 화면에서 설정 앱으로 안내한다)
 *  3) 허용이면 현재 위치를 한 번 읽는다. 실패하면 → 'unavailable'
 *
 * 규칙 (plan/spec/treagent_tech_spec_v1.md F-23)
 *  - 좌표는 저장하지 않고 console.log 등 로그에도 남기지 않는다.
 *  - 앱 사용 중(foreground)에만 수집한다. 백그라운드 권한은 요청하지 않는다.
 *  - 호출할 때마다 다시 시도한다 (설정에서 허용하고 돌아온 뒤 재시도 가능).
 */
import * as Location from 'expo-location';

// 결과 타입: status 값으로 3가지 경우를 구분한다 (유니온 타입).
export type LocationResult =
  | { status: 'ok'; latitude: number; longitude: number; accuracy: number | null }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'unavailable' };

export async function getCurrentLocation(): Promise<LocationResult> {
  try {
    // 1) 기기 위치 서비스(GPS 스위치) 확인
    const servicesOn = await Location.hasServicesEnabledAsync();
    if (!servicesOn) {
      return { status: 'unavailable' };
    }

    // 2) 앱 사용 중 위치 권한 요청 (이미 정해졌으면 팝업 없이 현재 상태를 돌려줌)
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return { status: 'denied', canAskAgain: permission.canAskAgain };
    }

    // 3) 현재 위치 1회 읽기
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      status: 'ok',
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
  } catch {
    // 오류 내용(좌표가 섞일 수 있음)은 남기지 않고 '불가'로만 처리한다.
    return { status: 'unavailable' };
  }
}