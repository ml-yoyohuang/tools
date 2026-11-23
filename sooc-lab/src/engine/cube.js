// .cube (Adobe/Resolve 3D LUT) parser → { size, data: Float32Array RGBA, title }

export function parseCube(text) {
  let size = 0, title = '';
  let dmin = [0, 0, 0], dmax = [1, 1, 1];
  const vals = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const parts = line.split(/\s+/);
    const key = parts[0].toUpperCase();
    if (key === 'TITLE') { title = line.slice(5).trim().replace(/^"|"$/g, ''); continue; }
    if (key === 'LUT_3D_SIZE') { size = parseInt(parts[1], 10); continue; }
    if (key === 'LUT_1D_SIZE') throw new Error('CUBE_1D_UNSUPPORTED');
    if (key === 'DOMAIN_MIN') { dmin = parts.slice(1, 4).map(Number); continue; }
    if (key === 'DOMAIN_MAX') { dmax = parts.slice(1, 4).map(Number); continue; }
    if (/^[A-Z_]/.test(key)) continue;
    if (parts.length >= 3) vals.push(+parts[0], +parts[1], +parts[2]);
  }
  if (!size || vals.length < size * size * size * 3) throw new Error('CUBE_INVALID');
  const n = size * size * size;
  const data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) data[i * 4 + c] = (vals[i * 3 + c] - dmin[c]) / ((dmax[c] - dmin[c]) || 1);
    data[i * 4 + 3] = 1;
  }
  return { size, data, title };
}

// Red varies fastest in .cube, which matches GL's x-fastest 3D texture layout.
export function createLutTexture(gl, lut) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, lut.size, lut.size, lut.size, 0, gl.RGBA, gl.FLOAT, lut.data);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, p, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}
