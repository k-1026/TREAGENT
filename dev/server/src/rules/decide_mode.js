import { MODES, RULE_CONFIG } from './rule_config.js';

const RANK = { [MODES.EXPLORE]: 0, [MODES.SHADE]: 1, [MODES.INDOOR]: 2 };

function modeFromTemperature(temp, config) {
  if (temp >= config.indoorFromC) return MODES.INDOOR;
  if (temp >= config.shadeFromC) return MODES.SHADE;
  return MODES.EXPLORE;
}

function applyHysteresis(temp, previousMode, config) {
  const plain = modeFromTemperature(temp, config);
  const prevRank = RANK[previousMode];
  if (prevRank === undefined || RANK[plain] >= prevRank) return plain;
  const releaseC =
    (previousMode === MODES.INDOOR ? config.indoorFromC : config.shadeFromC) - config.hysteresisC;
  if (temp >= releaseC) return previousMode;
  if (previousMode === MODES.INDOOR && temp >= config.shadeFromC - config.hysteresisC) {
    return MODES.SHADE;
  }
  return plain;
}

export function decideMode(weather, context = {}, config = RULE_CONFIG) {
  const { hazard = false, heatAlert = false, previousMode } = context;

  if (hazard) return { mode: MODES.HOLD, reason: 'HAZARD' };
  if (heatAlert || config.demoAlert) {
    return { mode: MODES.SAFETY, reason: heatAlert ? 'HEAT_ALERT' : 'DEMO_ALERT' };
  }
  if (weather?.status !== 'ok') return { mode: MODES.UNKNOWN, reason: 'WEATHER_UNAVAILABLE' };

  const useApparent = Number.isFinite(weather.apparentTemperatureC);
  const temp = useApparent ? weather.apparentTemperatureC : weather.temperatureC;
  if (!Number.isFinite(temp)) return { mode: MODES.UNKNOWN, reason: 'WEATHER_UNAVAILABLE' };

  return {
    mode: applyHysteresis(temp, previousMode, config),
    reason: 'TEMPERATURE',
    basis: useApparent ? 'apparent' : 'air',
  };
}