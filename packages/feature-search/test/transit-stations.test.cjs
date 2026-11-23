// Transit picker data (Mos 20 Nov 2026): every station has a name in Thai and English and a position inside greater
// Bangkok; codes are unique on a line. Holds while the list is empty, and checks every row once it is filled.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { RAIL_LINES, railStationName } = require('../src/transit-stations.ts');

const BOX = { latMin: 13.45, latMax: 14.15, lngMin: 100.25, lngMax: 100.95 };
const LINE_CODES = ['bts_sukhumvit', 'bts_silom', 'bts_gold', 'mrt_blue', 'mrt_purple', 'mrt_yellow', 'mrt_pink', 'arl', 'srt_red_north', 'srt_red_west'];

test('every station has both names, a unique code on its line and a position in greater Bangkok', () => {
  for (const line of RAIL_LINES) {
    assert.ok(LINE_CODES.includes(line.code), line.code);
    assert.ok(['BTS', 'MRT', 'ARL', 'SRT'].includes(line.system), line.code);
    assert.ok(line.stations.length > 0, line.code);
    const codes = new Set();
    for (const station of line.stations) {
      assert.ok(station.th && station.en, `${line.code} ${station.code}`);
      assert.ok(!codes.has(station.code), `${line.code} ${station.code} twice`);
      codes.add(station.code);
      assert.ok(station.latitude >= BOX.latMin && station.latitude <= BOX.latMax, `${line.code} ${station.code} latitude`);
      assert.ok(station.longitude >= BOX.lngMin && station.longitude <= BOX.lngMax, `${line.code} ${station.code} longitude`);
    }
  }
  assert.equal(new Set(RAIL_LINES.map((line) => line.code)).size, RAIL_LINES.length, 'each line once');
});

test('a picked station is named with its system, in Thai on Thai pages and in English elsewhere', () => {
  const station = { th: 'อโศก', en: 'Asok' };
  assert.equal(railStationName({ system: 'BTS' }, station, 'th'), 'BTS อโศก');
  assert.equal(railStationName({ system: 'BTS' }, station, 'ja'), 'BTS Asok');
});

const rail = require('../src/transit-stations.ts');

// Location search (Mos 20 Nov 2026): typing finds stations from this list (free, no Google), at most 3.
test('typing finds stations by Thai or English name, with or without "BTS"/"สถานี", at most 3', () => {
  const asok = rail.matchRailStations('อโศก');
  assert.equal(asok[0].station.en, 'Asok');
  assert.equal(asok[0].line.code, 'bts_sukhumvit');
  assert.equal(rail.matchRailStations('BTS อโศก')[0].station.code, 'E4');
  assert.equal(rail.matchRailStations('สถานีอโศก')[0].station.code, 'E4');
  assert.equal(rail.matchRailStations('  thong lo ')[0].station.code, 'E6');
  assert.ok(rail.matchRailStations('ลาดพร้าว').length <= rail.RAIL_MATCH_LIMIT);
  assert.equal(rail.RAIL_MATCH_LIMIT, 3);
  assert.deepEqual(rail.matchRailStations(''), []);
  assert.deepEqual(rail.matchRailStations('ก'), [], 'one letter is too little');
});

test('a station shared by two lines shows once (Siam), name starts rank first', () => {
  const siam = rail.matchRailStations('สยาม');
  assert.equal(siam.length, 1);
  const lat = rail.matchRailStations('ลาดพร้าว');
  assert.equal(lat[0].station.th, 'ลาดพร้าว', 'exact name before ลาดพร้าว 71 / 83');
});

// "ต่อ …": stations of other lines within 350 m are interchanges (worked out from the positions, nothing typed in).
test('interchanges come from position: Asok ↔ MRT Sukhumvit, Phaya Thai ↔ ARL, not the next station', () => {
  const find = (line, code) => {
    const l = rail.RAIL_LINES.find((item) => item.code === line);
    return { line: l, station: l.stations.find((s) => s.code === code) };
  };
  const asok = find('bts_sukhumvit', 'E4');
  assert.ok(rail.railInterchanges(asok.line, asok.station).some((x) => x.line.code === 'mrt_blue' && x.station.code === 'BL22'));
  const phayaThai = find('bts_sukhumvit', 'N2');
  assert.ok(rail.railInterchanges(phayaThai.line, phayaThai.station).some((x) => x.line.code === 'arl'));
  const nana = find('bts_sukhumvit', 'E3');
  assert.deepEqual(rail.railInterchanges(nana.line, nana.station), []);
  assert.equal(rail.INTERCHANGE_METERS, 350);
});

// Badge and icon colours per line: the code text on the line colour, and the icon on its tint, must be readable.
test('each line has readable badge text (4.5:1) and icon on tint (3:1)', () => {
  for (const line of rail.RAIL_LINES) {
    const palette = rail.railLinePalette(line.code);
    assert.ok(rail.contrastRatio(palette.ink, palette.color) >= 4.5, `${line.code} badge ${palette.ink} on ${palette.color}`);
    assert.ok(rail.contrastRatio(palette.deep, palette.tint) >= 3, `${line.code} icon ${palette.deep} on ${palette.tint}`);
  }
  assert.ok(Math.abs(rail.contrastRatio('#000000', '#ffffff') - 21) < 0.01);
});
