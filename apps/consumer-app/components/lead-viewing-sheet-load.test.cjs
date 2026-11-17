// F2 (QA 9 Nov 2026, ClickUp z8rcteuz20): while "viewings on this day" loaded, the sheet had no row there, so the
// save button moved down when the list arrived and could be tapped by mistake. Saving also skipped the
// "near another viewing" warning, which needs that list. Now a loading row holds the space and save waits for the list.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const code = fs.readFileSync(path.join(__dirname, 'LeadViewingSheet.tsx'), 'utf8');

test('the day list shows a loading row instead of nothing while it loads', () => {
  assert.doesNotMatch(code, /\{dayViewings === null \? null :/);
  assert.match(code, /\{dayViewings === null \? \(\s*<Text style=\{\[styles\.muted, \{ color: theme\.textSecondary \}\]\}>\{t\.common\.loading\}<\/Text>\s*\) :/);
});

test('save waits for the day list (the near-viewing warning needs it); a failed load still lets the agent save', () => {
  assert.match(code, /<MobileButton onPress=\{\(\) => void save\(\)\} isLoading=\{busy\} disabled=\{past \|\| dayViewings === null\}>/);
  // a load error ends the wait with an empty list
  assert.match(code, /\.catch\(\(\) => \{\s*if \(active\) setDayViewings\(\[\]\);/);
});
