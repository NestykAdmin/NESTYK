const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const loaded = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, '../src/public-room-share.ts'), 'utf8');
new Function('exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(loaded.exports);
const { toPublicRoomDetail } = loaded.exports;

const fixture = {
  id: 1, promoTitle: 'Public title', description: 'Description',
  roomStatusCode: 'available', roomTypeCode: 'studio', availableFromDate: null,
  layout: [], medias: [{ id: 1, mediaUrl: '/photo.jpg', mediaType: 'image', isCover: true }],
  prices: [{ contractTypeCode: 'year', termMonths: 12, price: 17000, advanceRentMonths: 1, depositMonths: 2 }],
  advanceRentMonths: 1, depositMonths: 2,
  facilities: ['bed', 'Custom item'], facilityItems: [{ code: 'bed', groupCode: 'furniture' }], customFacilities: ['Custom item'],
  latitude: '13', longitude: '100', property: { id: 1, name: 'Project', address: 'Address', district: 'District', latitude: '13', longitude: '100' },
  nearbyPlaces: [{ placeId: 'park', name: 'Park', type: 'park', latitude: 13, longitude: 100, distanceMeters: 50 }],
  contacts: [{ id: 2, name: 'Chosen contact', phone: '123', email: null, note: 'PRIVATE NOTE', isPrimary: true }],
  listingTitle: 'PRIVATE TITLE', roomId: 'PRIVATE ROOM', documents: [{ mediaUrl: 'PRIVATE DOCUMENT' }], nearbyOther: 'PRIVATE NEARBY',
};

test('all 32 share-section combinations retain only enabled public sections', () => {
  const keys = ['photos', 'price', 'facilities', 'location', 'contact'];
  for (let mask = 0; mask < 32; mask++) {
    const shareSections = Object.fromEntries(keys.map((key, i) => [key, !!(mask & (1 << i))]));
    const detail = toPublicRoomDetail({ ...fixture, shareSections });
    assert.equal(detail.medias.length, shareSections.photos ? 1 : 0);
    assert.equal(detail.prices.length, shareSections.price ? 1 : 0);
    assert.equal(detail.advanceRentMonths, shareSections.price ? 1 : 0);
    assert.equal(detail.facilityItems.length, shareSections.facilities ? 1 : 0);
    assert.equal(detail.customFacilities.length, shareSections.facilities ? 1 : 0);
    assert.equal(detail.latitude, shareSections.location ? '13' : null);
    assert.equal(detail.property.address, shareSections.location ? 'Address' : '');
    assert.equal(detail.nearbyPlaces.length, shareSections.location ? 1 : 0);
    assert.equal(detail.contacts.length, shareSections.contact ? 1 : 0);
    assert.equal(detail.property.name, 'Project');
    assert.doesNotMatch(JSON.stringify(detail), /PRIVATE/);
  }
});

test('omitted optional fields are safe and contract-specific costs remain intact', () => {
  const shareSections = { photos: true, price: true, facilities: true, location: true, contact: true };
  const detail = toPublicRoomDetail({ ...fixture, shareSections, property: null, contacts: undefined, facilityItems: undefined, facilities: undefined, customFacilities: undefined, nearbyPlaces: undefined });
  assert.deepEqual(detail.contacts, []);
  assert.deepEqual(detail.facilities, []);
  assert.equal(detail.property, null);
  assert.equal(detail.availableFromDate, '');
  assert.deepEqual(detail.prices, fixture.prices);
});

// Render the real browser presentation, with no native modules or network calls.
const moduleCache = new Map();
function browserModule(filename) {
  filename = path.resolve(filename);
  if (moduleCache.has(filename)) return moduleCache.get(filename).exports;
  const module = { exports: {} };
  moduleCache.set(filename, module);
  const browserRequire = name => {
    if (name.endsWith('.css')) return {};
    if (name === 'react-native' || name === '@nestyk/ui/native') throw new Error(`Native dependency in public website: ${name}`);
    if (name === '@nestyk/i18n') return browserModule(path.join(__dirname, '../../i18n/src/index.ts'));
    if (name === '@nestyk/ui/web-content') return browserModule(path.join(__dirname, '../../ui/src/shells/WebContentContainer.tsx'));
    if (name === '@nestyk/ui') return {
      ...browserModule(path.join(__dirname, '../../ui/src/icons/AppIcon.tsx')),
    };
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    const target = [base, `${base}.ts`, `${base}.tsx`].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    if (!target) throw new Error(`Missing browser dependency: ${base}`);
    return browserModule(target);
  };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText)(browserRequire, module, module.exports);
  return module.exports;
}

function renderPublic(shareSections) {
  moduleCache.clear();
  const { LocaleProvider } = browserModule(path.join(__dirname, '../../i18n/src/index.ts'));
  const { PublicRoomDesktopBody } = browserModule(path.join(__dirname, '../src/components/PublicRoomDesktopBody.tsx'));
  return renderToStaticMarkup(React.createElement(LocaleProvider, { defaultLocale: 'th' },
    React.createElement(PublicRoomDesktopBody, { room: { ...fixture, shareSections } })));
}

test('app share payload renders desktop gallery and prices without Agent-only information', () => {
  const markup = renderPublic({ photos: true, price: true, facilities: true, location: true, contact: true });
  assert.match(markup, /class="ard-gallery/);
  assert.match(markup, /class="ard-price-card|class="ard-card ard-price-card/);
  assert.match(markup, /17,000/);
  assert.match(markup, /51,000/);
  assert.match(markup, /Chosen contact/);
  assert.doesNotMatch(markup, /PRIVATE|ard-internal/);
});

test('hidden app share sections never render photos, prices, location or contacts', () => {
  const markup = renderPublic({ photos: false, price: false, facilities: false, location: false, contact: false });
  assert.match(markup, /ard-no-sidebar/);
  assert.doesNotMatch(markup, /<img|ard-price-card|17,000|Address|District|Chosen contact|Custom item|PRIVATE/);
});
