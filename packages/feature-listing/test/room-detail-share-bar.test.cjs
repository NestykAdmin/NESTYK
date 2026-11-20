// Self owner room detail (Jom 20 Nov 2026): the agent detail page without the share bar when no onShare is given.
// The agent always passes onShare, so its bar stays.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const code = fs.readFileSync(path.resolve(__dirname, '../src/components/MobileRoomDetailBody.tsx'), 'utf8');
const agentBody = fs.readFileSync(path.resolve(__dirname, '../src/components/MobileAgentRoomBody.tsx'), 'utf8');

test('the sticky share bar shows only with onShare', () => {
  assert.match(code, /\{isAgent && onShare \? \(\s*<View style=\{\[styles\.sticky/);
  assert.match(code, /<View style=\{\{ height: isAgent && onShare \? 100 : 24 \}\} \/>/);
});

test('the agent room body still passes onShare', () => {
  assert.match(agentBody, /onShare=\{\(\) => setShareOpen\(true\)\}/);
});

// Review fix (20 Nov 2026): the self owner web modal uses the agent desktop body, also without sharing.
const desktop = fs.readFileSync(path.resolve(__dirname, '../src/components/RoomDesktopBody.tsx'), 'utf8');
const index = fs.readFileSync(path.resolve(__dirname, '../src/index.ts'), 'utf8');
test('desktop body: the share button shows only with onShare; the adapter is exported', () => {
  assert.match(desktop, /\{agent && onShare && \(\s*<button\s*className="aw-button aw-button-primary ard-share"/);
  assert.match(index, /export \{ AgentRoomDesktopBody \} from ['"]\.\/components\/AgentRoomDesktopBody['"];/);
});
