/** Circular-orbit teaching model for the standalone HTML; days relative to opposition, distances in AU.
 * This is not an ephemeris. The sky coordinates are derived from the SAME
 * heliocentric positions used by the orbit diagram (no hand-drawn loop).
 */
const TAU = 2 * Math.PI;
export const EARTH_PERIOD = 365.25;
export const MARS_PERIOD = 686.98;
export const MARS_RADIUS = 1.524;
export const OBSERVATION_DAYS = 260;

export function retrogradeState(day: number, inclinationDeg = 1.85) {
  const inclination = inclinationDeg * Math.PI / 180;
  const ne = TAU / EARTH_PERIOD;
  const nm = TAU / MARS_PERIOD;
  const earthAngle = Math.PI / 2 + ne * day;
  const marsAngle = Math.PI / 2 + nm * day;
  const earth = { x: Math.cos(earthAngle), y: Math.sin(earthAngle), z: 0 };
  const mars = {
    x: MARS_RADIUS * Math.cos(marsAngle),
    y: MARS_RADIUS * Math.sin(marsAngle) * Math.cos(inclination),
    z: MARS_RADIUS * Math.sin(marsAngle) * Math.sin(inclination),
  };
  const dx = mars.x - earth.x;
  const dy = mars.y - earth.y;
  const vx = -MARS_RADIUS * nm * Math.sin(marsAngle) + ne * Math.sin(earthAngle);
  const vy = MARS_RADIUS * nm * Math.cos(marsAngle) * Math.cos(inclination) - ne * Math.cos(earthAngle);
  const longitudeRate = (dx * vy - dy * vx) / (dx * dx + dy * dy);
  // Relative to the fixed longitude of opposition, continuous in this window.
  const longitude = Math.atan2(-dx, dy);
  const latitude = Math.atan2(mars.z, Math.hypot(dx, dy));
  return { earth, mars, earthAngle, marsAngle, longitude, latitude, longitudeRate, retrograde: longitudeRate < 0 };
}
