import assert from 'node:assert/strict';
import { MARS_RADIUS, retrogradeState } from '../../standalone/_retrograde';

// The defining astronomical behavior, not just a rendered animation snapshot.
for (const tilt of [0, 1.85, 5]) {
  assert.ok(retrogradeState(-130, tilt).longitudeRate > 0, 'prograde before encounter');
  assert.ok(retrogradeState(0, tilt).longitudeRate < 0, 'retrograde near opposition');
  assert.ok(retrogradeState(130, tilt).longitudeRate > 0, 'prograde after encounter');
  let signChanges = 0;
  let previous = retrogradeState(-130, tilt);
  for (let day = -129; day <= 130; day++) {
    const s = retrogradeState(day, tilt);
    assert.ok(s.earthAngle > previous.earthAngle && s.marsAngle > previous.marsAngle, 'neither orbit reverses');
    assert.ok(Math.abs(Math.hypot(s.mars.x, s.mars.y, s.mars.z) - MARS_RADIUS) < 1e-12);
    const epsilon = 0.001;
    const rate = (retrogradeState(day + epsilon, tilt).longitude - retrogradeState(day - epsilon, tilt).longitude) / (2 * epsilon);
    assert.ok(Math.abs(rate - s.longitudeRate) < 1e-9, 'analytic rate agrees with actual sky displacement');
    assert.ok(Math.abs(s.longitude - previous.longitude) < 0.02, 'no angular wrap in observation window');
    if (s.retrograde !== previous.retrograde) signChanges++;
    if (tilt === 0) assert.equal(s.latitude, 0, 'coplanar model has no latitude loop');
    previous = s;
  }
  assert.equal(signChanges, 2, 'exactly two stationary transitions');
}
const center = retrogradeState(0);
assert.ok(center.mars.y > center.earth.y && center.earth.y > 0, 'Earth lies inside Mars at opposition');
assert.ok(Math.abs(center.longitude) < 1e-12);
console.log('PASS retrograde geometry: direction, stationary points, continuous projection, inclination');
