const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// ScrollView inserts a native refresh wrapper when this prop exists. Removing it
// remounts its children, so selecting a contact must keep the refresh prop present.
const source = ts.createSourceFile('index.tsx', fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let expression, refreshHandler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handlePageRefresh') {
    refreshHandler = node.initializer.arguments[0].getText(source);
  }
  if (ts.isJsxOpeningElement(node) && node.tagName.getText(source) === 'MobileModePage') {
    const prop = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(source) === 'onRefresh');
    expression = prop.initializer.expression.getText(source);
  }
  ts.forEachChild(node, visit);
}
visit(source);
const callback = () => {};
const readRefresh = new Function('contactDetail', 'handlePageRefresh', 'contactKind', `
  const isTenantWorkspace = false, partyInbox = false, isWizardTab = false;
  const activeRole = 'agent', activeTab = 'contact';
  return (${expression});
`);

for (const kind of ['owner', 'landlord', 'lead', 'tenant', 'coAgent']) test(`${kind}: opening, loading, editing and saving preserve the native refresh wrapper`, () => {
  assert.equal(readRefresh(null, callback, kind), callback);
  for (const detail of [
    { canEdit: false, editing: false, saving: false },
    { canEdit: false, editing: false, saving: false, confirming: true },
    { canEdit: true, editing: false, saving: false },
    { canEdit: false, editing: true, saving: false },
    { canEdit: false, editing: true, saving: true },
  ]) assert.equal(readRefresh(detail, callback, kind), callback);
});

test('pull refresh during contact editing or saving leaves the form and refresh tokens untouched', () => {
  const createHandler = new Function('contactDetail', 'pendingRefresh', 'refreshSequence', 'setPageRefreshing', 'setContactsReloadToken', `
    const activeTab = 'contact', activeRole = 'agent', partyInbox = false, contactKind = 'owner';
    return (${refreshHandler});
  `);
  for (const detail of [{ editing: false, saving: false, confirming: true }, { editing: true, saving: false }, { editing: true, saving: true }]) {
    const pending = { current: null }, sequence = { current: 0 };
    createHandler(detail, pending, sequence, () => assert.fail('Must not start refreshing'), () => assert.fail('Must not reload'))();
    assert.equal(pending.current, null); assert.equal(sequence.current, 0);
  }
  const pending = { current: null }, sequence = { current: 0 }, calls = [];
  createHandler({ editing: false, saving: false }, pending, sequence, value => calls.push(value), token => calls.push(token))();
  assert.deepEqual(calls, [true, 1]); assert.equal(pending.current, 1);
});
