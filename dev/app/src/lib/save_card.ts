/*
 * [save_card.ts] 여행 카드 한 장을 이미지로 저장·공유한다 (trip_card.tsx의 [저장]과 공유 칩)
 *  - 저장, 휴대폰: 카드 칸을 PNG로 찍어(react-native-view-shot) 사진첩에 넣는다(expo-media-library). 사진 추가 권한만 묻는다.
 *  - 저장, 웹: 카드 칸을 PNG로 찍어 파일로 내려받는다 (html2canvas-pro가 있어야 찍힌다).
 *  - 공유, 휴대폰: 카드 PNG를 붙여 휴대폰 기본 공유창을 연다(expo-sharing). 어느 앱으로 보낼지는 공유창에서 고른다.
 *  - 공유, 웹: 브라우저가 파일 공유를 지원하면(navigator.share) 공유창을 연다. 지원하지 않으면 'unsupported'.
 *  - 앨범 폴더(예: daeprica)는 만들지 않는다. 폴더 이름은 정해지지 않았다 [확인 필요].
 *  - 사진에는 위치 정보(EXIF)를 넣지 않는다. 화면을 찍은 PNG라 위치가 없다.
 */
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import type { ComponentRef, RefObject } from 'react';
import { Platform, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

type CardRef = RefObject<ComponentRef<typeof View> | null>;
export type SaveResult = 'saved' | 'downloaded' | 'denied' | 'failed';
export type ShareResult = 'shared' | 'cancelled' | 'unsupported' | 'failed';

/** 파일 이름: trip_card_20261127.png (오늘 날짜) */
function fileName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `trip_card_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.png`;
}

export async function saveCardImage(target: CardRef): Promise<SaveResult> {
  try {
    if (Platform.OS === 'web') {
      const uri = await captureRef(target, { format: 'png', result: 'data-uri' });
      const a = document.createElement('a');
      a.href = uri;
      a.download = fileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      return 'downloaded';
    }
    const perm = await MediaLibrary.requestPermissionsAsync(true); // 사진 추가만 (읽기 권한은 묻지 않음)
    if (!perm.granted) return 'denied';
    const uri = await captureRef(target, { format: 'png', result: 'tmpfile', fileName: fileName().replace('.png', '') });
    await MediaLibrary.saveToLibraryAsync(uri);
    return 'saved';
  } catch (e) {
    if (__DEV__) console.warn('[save_card] 저장 실패', e);
    return 'failed';
  }
}

export async function shareCardImage(target: CardRef): Promise<ShareResult> {
  try {
    if (Platform.OS === 'web') {
      const nav = typeof navigator !== 'undefined' ? navigator : undefined;
      if (!nav?.share || !nav.canShare) return 'unsupported';
      const uri = await captureRef(target, { format: 'png', result: 'data-uri' });
      const blob = await (await fetch(uri)).blob();
      const file = new File([blob], fileName(), { type: 'image/png' });
      if (!nav.canShare({ files: [file] })) return 'unsupported';
      await nav.share({ files: [file] });
      return 'shared';
    }
    if (!(await Sharing.isAvailableAsync())) return 'unsupported';
    const uri = await captureRef(target, { format: 'png', result: 'tmpfile', fileName: fileName().replace('.png', '') });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: '여행 카드 공유' });
    return 'shared';
  } catch (e) {
    // 웹에서 사용자가 공유창을 닫으면 AbortError가 난다
    if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
    if (__DEV__) console.warn('[save_card] 공유 실패', e);
    return 'failed';
  }
}
