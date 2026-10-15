const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { createHash } = require('node:crypto');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const { PublicContractSignController } = require('../src/agent/contracts/public-contract-sign.controller.ts');
const { AgreementSignInviteEntity } = require('../src/entities/agreement-sign-invite.entity.ts');
const { LeaseContractEntity } = require('../src/entities/lease-contract.entity.ts');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWNgYGD4D8UQBgAd9AP9JAD7OgAAAABJRU5ErkJggg==', 'base64');
const signaturePng = `data:image/png;base64,${png.toString('base64')}`;

function contractRow(overrides = {}) {
  return {
    id: 11,
    tenant_id: 2,
    lead_id: 1,
    contract_no: 'RS20260001',
    rent_room: { property: { name: 'Aria' }, listing_title: null, room_id: '1201' },
    tenant: { name: 'สมชาย' },
    agreement_type_code: 'reservation',
    agreement_type: { name_th: 'หนังสือจองห้อง', form_kind: 'reservation' },
    reservation_fee: '5000.00',
    status: 'draft',
    start_date: '2026-10-01',
    end_date: null,
    move_in_date: '2026-10-15',
    monthly_rent: null,
    deposit: null,
    notes: null,
    owner_signed_at: null,
    tenant_signed_at: null,
    agent_signed_at: null,
    owner_signature_url: null,
    tenant_signature_url: null,
    agent_signature_url: null,
    document_url: null,
    invoice_url: null,
    receipt_url: null,
    created_by_user_id: 7,
    ...overrides,
  };
}

test('createSignInvite returns public url and publicSign records party', async () => {
  process.env.PUBLIC_WEB_URL = 'https://web.example';
  const current = contractRow();
  const invites = [];
  const qb = {};
  for (const key of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[key] = () => qb;
  qb.getOne = async () => current;
  const documents = {
    uploadSignature: async () => ({ path: '7/11/signatures/sig.png' }),
    remove: async () => undefined,
    signPaths: async () => new Map(),
  };
  const db = {
    getRepository: (entity) => {
      if (entity === LeaseContractEntity) {
        return {
          createQueryBuilder: () => qb,
          findOneBy: async () => current,
          update: async (_where, patch) => Object.assign(current, patch),
        };
      }
      if (entity === AgreementSignInviteEntity) {
        return {
          findOne: async ({ where }) =>
            invites.find((row) => row.token_hash === where.token_hash) || null,
          create: (row) => row,
          save: async (row) => {
            const saved = { id: invites.length + 1, ...row };
            invites.push(saved);
            return saved;
          },
        };
      }
      throw new Error(`unexpected entity ${entity?.name}`);
    },
    transaction: async (fn) =>
      fn({
        createQueryBuilder: () => ({
          update: () => ({
            set: () => ({
              where: () => ({
                andWhere: () => ({
                  andWhere: () => ({
                    andWhere: () => ({ execute: async () => undefined }),
                  }),
                }),
              }),
            }),
          }),
        }),
        getRepository: (entity) => db.getRepository(entity),
        findOne: async (entity, opts) => {
          if (entity === LeaseContractEntity) return current;
          if (entity === AgreementSignInviteEntity) {
            return invites.find((row) => row.id === opts.where.id) || null;
          }
          return null;
        },
        findOneBy: async (entity, where) => {
          if (entity === LeaseContractEntity) return current;
          return null;
        },
        update: async (entity, where, patch) => {
          if (entity === LeaseContractEntity) Object.assign(current, patch);
          if (entity === AgreementSignInviteEntity) {
            const row = invites.find((item) => item.id === where.id);
            if (row) Object.assign(row, patch);
          }
        },
      }),
  };
  const service = new AgentContractsService(db, documents);
  const createdBefore = Date.now();
  const invite = await service.createSignInvite(7, 11, { party: 'tenant' });
  const createdAfter = Date.now();
  const expiresAt = new Date(invite.expiresAt).getTime();
  assert.ok(expiresAt >= createdBefore + 15 * 60 * 1000);
  assert.ok(expiresAt <= createdAfter + 15 * 60 * 1000);
  assert.equal(invite.party, 'tenant');
  assert.match(invite.url, /^https:\/\/web\.example\/sign\/.+/);
  const token = invite.url.split('/sign/')[1];
  const preview = await service.publicSignPreview(token);
  assert.equal(preview.party, 'tenant');
  assert.equal(preview.alreadySigned, false);
  assert.match(preview.signingBlockedReason, /ต้องชำระค่าจอง/);
  const validExpiry = invites[0].expires_at;
  invites[0].expires_at = new Date(Date.now() - 1);
  await assert.rejects(() => service.publicSignPreview(token), /หมดอายุ/);
  await assert.rejects(() => service.publicSign(token, { signaturePng }), /หมดอายุ/);
  invites[0].expires_at = validExpiry;
  await assert.rejects(() => service.publicSign(token, { signaturePng }), /ต้องชำระค่าจอง/);
  current.data = { reservationPayment: { slipPath: 'slip.jpg' } };
  await assert.rejects(() => service.publicSign(token, { signaturePng }), /ต้องชำระค่าจอง/);
  assert.equal(current.tenant_signed_at, null);
  assert.equal(invites[0].used_at, null);
  current.receipt_url = '7/11/receipt/paid.pdf';
  const invalidPng = Buffer.concat([png.subarray(0, 8), Buffer.alloc(40, 1)]).toString('base64');
  await assert.rejects(() => service.publicSign(token, { signaturePng: invalidPng }), e => e.getStatus() === 400);
  assert.equal(current.tenant_signed_at, null);
  assert.equal(invites[0].used_at, null);

  assert.equal((await service.publicSignPreview(token)).signingBlockedReason, null);
  const result = await service.publicSign(token, { signaturePng });
  assert.deepEqual(result, { ok: true, party: 'tenant' });
  assert.ok(current.tenant_signed_at);
  assert.equal(current.tenant_signature_url, '7/11/signatures/sig.png');
  assert.equal(current.status, 'awaiting_signatures');
  assert.equal(invites[0].used_at != null, true);
});

test('public contract sign routes are unauthenticated', async () => {
  const calls = [];
  class TestModule {}
  Module({
    controllers: [PublicContractSignController],
    providers: [
      {
        provide: AgentContractsService,
        useValue: {
          publicSignPreview: async (token) => {
            calls.push(['preview', token]);
            return { party: 'owner' };
          },
          publicSign: async (token, body) => {
            calls.push(['sign', token, body]);
            return { ok: true, party: 'owner' };
          },
        },
      },
    ],
  })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  try {
    const preview = await fetch(`${base}/public/contract-sign/tok123`);
    assert.equal(preview.status, 200);
    const signed = await fetch(`${base}/public/contract-sign/tok123`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signaturePng }),
    });
    assert.equal(signed.status, 200);
    assert.deepEqual(calls[0], ['preview', 'tok123']);
    assert.deepEqual(calls[1], ['sign', 'tok123', { signaturePng }]);
  } finally {
    await app.close();
  }
});

test('invite token is stored hashed', () => {
  const token = 'abc';
  assert.equal(
    createHash('sha256').update(token).digest('hex').length,
    64,
  );
});
