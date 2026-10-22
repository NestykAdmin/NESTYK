// Signing by link without logging in was removed on 21 Oct 2026 (Aof's decision). Parties sign in the app only.
// The agreement_sign_invites table stays: old signatures logged with the `link` channel still point to it, and
// leftover unused invites are still revoked when a draft changes or a contract closes (agent-contracts.test.cjs,
// contract-closure.test.cjs). Signing in the app (payment rule, PNG check, races, the `app` log) is in contract-delivery.test.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const { AgentContractsController } = require('../src/agent/contracts/agent-contracts.controller.ts');
const { attachmentChecklist } = require('../src/agent/contracts/agreement-attachments.service.ts');

const src = (file) => path.join(__dirname, '../src', file);

test('there is no sign link: no public sign routes, no route to create a link, nothing in the service', () => {
  assert.equal(fs.existsSync(src('agent/contracts/public-contract-sign.controller.ts')), false);
  assert.doesNotMatch(fs.readFileSync(src('agent/agent.module.ts'), 'utf8'), /PublicContractSign/);
  const routes = Object.getOwnPropertyNames(AgentContractsController.prototype)
    .map((name) => Reflect.getMetadata('path', AgentContractsController.prototype[name]))
    .filter(Boolean);
  assert.ok(routes.includes(':id/deliveries'), 'sending to the app is still there');
  assert.equal(routes.some((route) => /sign-invites/.test(route)), false);
  for (const name of ['createSignInvite', 'publicSignPreview', 'publicSign', 'loadInvite'])
    assert.equal(typeof AgentContractsService.prototype[name], 'undefined', name);
  // No other API source serves a sign token page.
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  for (const file of walk(src('')).filter((f) => f.endsWith('.ts')))
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /public\/contract-sign|sign-invites/, file);
});

test('B3: a rejected file still counts as attached, so signing is not blocked (the app tells the signer: party-payment-signing and contracts-renewal-flow tests)', () => {
  const groups = attachmentChecklist(
    [{ group_key: 'tenant_id', label: 'บัตรผู้เช่า', subject: 'tenant', document_type_code: 'national_id' }],
    [{ id: 1, subject: 'tenant', document_type_code: 'national_id', review_status: 'rejected', removed_at: null, supersedes_document_id: null }],
  );
  assert.equal(groups[0].complete, true);
});
