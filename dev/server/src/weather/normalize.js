// 한국 시간(UTC+9) 기준으로 날짜 'YYYYMMDD'와 시(hour)를 읽는다.
function kstParts(date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    ymd: `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}`,
    hour: kst.getUTCHours(),
  };
}

// 날씨를 못 얻었을 때의 결과. 추측하지 않고 이유 코드만 담는다.
export function unavailable(reason) {
  return { status: 'unavailable', reason };
}

// 기상청 items를 정리된 날씨 값 하나로 바꾼다.
// items: [{ category, fcstDate, fcstTime, fcstValue }, ...]
export function normalizeForecast(items, { now = new Date(), baseIso } = {}) {
  const { ymd, hour } = kstParts(now);
  // 지금 시(hour)가 시작하는 시각. 예: 2026-11-16 14:30 → '202611161400'
  const currentHourStart = `${ymd}${String(hour).padStart(2, '0')}00`;

  // 기온(TMP) 행만 골라서 시간순으로 정렬한다. (숫자 문자열은 글자순 = 시간순)
  const tmpRows = items
    .filter((row) => row?.category === 'TMP')
    .map((row) => ({ stamp: `${row.fcstDate}${row.fcstTime}`, row }))
    .sort((a, b) => a.stamp.localeCompare(b.stamp));

  // 지금 시각 이후(포함)의 첫 번째 행. 지난 시각의 값은 쓰지 않는다.
  const target = tmpRows.find((entry) => entry.stamp >= currentHourStart);
  if (!target) return unavailable('MISSING_VALUE');

  // 빈 문자열은 Number('')가 0이 되어 "0도"로 오해되니 먼저 걸러낸다.
  const raw = target.row.fcstValue;
  const temperatureC = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  // 숫자가 아니거나 말이 안 되는 값은 누락으로 본다. [확인 필요] 기상청 결측값 표기
  if (!Number.isFinite(temperatureC) || temperatureC < -60 || temperatureC > 60) {
    return unavailable('MISSING_VALUE');
  }

  const { fcstDate, fcstTime } = target.row;
  const y = Number(fcstDate.slice(0, 4));
  const m = Number(fcstDate.slice(4, 6));
  const d = Number(fcstDate.slice(6, 8));
  return {
    status: 'ok',
    temperatureC,
    apparentTemperatureC: null, // 체감온도 계산식이 정해지면 채운다
    hour: Number(fcstTime.slice(0, 2)),
    dayOfWeek: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), // 0=일 ... 6=토
    baseTime: baseIso,
    source: 'kma',
  };
}