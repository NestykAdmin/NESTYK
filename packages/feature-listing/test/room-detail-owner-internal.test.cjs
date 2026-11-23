// Self owner room detail (Jom 23 Nov 2026): the "internal info" card speaks to the owner (no team, no share page):
// the owner's words for the hint, the room name and the listing state, and no source / provider / team-notes rows.
// Optional prop `ownerInternalCopy`; without it the agent card is exactly as before.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.resolve(__dirname, '../src/components', f), 'utf8');
const desktop = read('RoomDesktopBody.tsx');
const mobile = read('MobileRoomDetailBody.tsx');

test('both bodies take an optional ownerInternalCopy', () => {
  assert.match(mobile, /ownerInternalCopy\?: RoomOwnerInternalCopy;/);
  assert.match(mobile, /export type RoomOwnerInternalCopy = \{\s*hint: string;\s*titleLabel: string;\s*visibilityLabel: string;\s*publishedLabel: string;\s*privateLabel: string;?\s*\};/);
  assert.match(desktop, /ownerInternalCopy\?: RoomOwnerInternalCopy;/);
});

for (const [name, code] of [['desktop', desktop], ['mobile', mobile]]) {
  test(`${name}: owner words replace the agent words, agent words stay the default`, () => {
    assert.match(code, /ownerInternalCopy\?\.hint \?\? rd\.internalOnlyHint/);
    assert.match(code, /ownerInternalCopy\?\.titleLabel \?\? cr\.listingTitle/);
    assert.match(code, /ownerInternalCopy\?\.visibilityLabel \?\? rd\.internalVisibility/);
  });
  test(`${name}: the source, provider and team-notes rows are left out for the owner`, () => {
    for (const label of ['cr\\.sourceSection', 'rd\\.internalProvider', 'rd\\.internalNotes']) {
      assert.match(code, new RegExp(`ownerInternalCopy \\? null : [\\[{][\\s\\S]{0,40}${label}`), label);
    }
  });
}

// Jom 23 Nov 2026: the owner's listing words ("ประกาศอยู่ / ยังไม่ประกาศ") replace the agent's
// ("เผยแพร่ / ส่วนตัว") in the internal card and, on desktop, the header badge.
for (const [name, code, count] of [['desktop', desktop, 2], ['mobile', mobile, 1]]) {
  test(`${name}: published / private words come from ownerInternalCopy, agent words stay the default`, () => {
    assert.equal((code.match(/ownerInternalCopy\?\.publishedLabel \?\? cr\.visibilityPublished/g) ?? []).length, count);
    assert.equal((code.match(/ownerInternalCopy\?\.privateLabel \?\? cr\.visibilityPrivate/g) ?? []).length, count);
    assert.doesNotMatch(code, /(?<!\?)[?:] cr\.visibilityP/, 'no bare agent word left');
  });
}
