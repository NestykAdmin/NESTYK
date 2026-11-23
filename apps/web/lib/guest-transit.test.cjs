// Rail stations inside the location box (Mos 20 Nov 2026, canvas page "ช่องค้นหารวม"): typed text shows up to 3
// stations from our list with a line-coloured code badge and the interchange; "เลือกจากสายรถไฟฟ้า" opens line → station
// in the same box. A station searches 1.5 km around it with "BTS อโศก" as its name. No separate "รถไฟฟ้า" button.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const BOX = 'app/components/guest/LocationCombobox.tsx';

test('typed text lists our stations first, with the line colour and the interchange', () => {
  const box = read(BOX);
  assert.match(box, /matchRailStations\(value\)/);
  assert.match(box, /railLinePalette\(/);
  assert.match(box, /railInterchanges\(/);
  assert.match(box, /const sameName = /, 'Siam on both BTS lines names the other line, not "ต่อ BTS สยาม"');
  assert.match(box, /copy\.location\.stationsHeading/);
  assert.ok(box.indexOf('stationsHeading') < box.indexOf('areasHeading'), 'stations come before areas');
  assert.ok(box.indexOf('areasHeading') < box.indexOf('placesHeading'), 'areas come before Google places');
});

test('"choose from rail lines" opens lines then stations inside the same box', () => {
  const box = read(BOX);
  assert.match(box, /onClick=\{\(\) => setView\('lines'\)\}/);
  assert.match(box, /view === 'lines' \? linesView : listView/);
  assert.match(box, /RAIL_LINES\.map\(/);
  assert.match(box, /line\.stations\.map\(/);
});

test('a station becomes a place search marked as a station with "BTS อโศก" as its name', () => {
  const box = read(BOX);
  assert.match(box, /kind: 'place', name: railStationName\(/);
  assert.match(box, /station: true/);
});

test('the separate rail button is gone from the home and search pages', () => {
  assert.doesNotMatch(read('app/components/guest/SearchPanel.tsx'), /TransitPicker/);
  assert.doesNotMatch(read('app/components/guest/SearchKeywordBar.tsx'), /TransitPicker/);
});
