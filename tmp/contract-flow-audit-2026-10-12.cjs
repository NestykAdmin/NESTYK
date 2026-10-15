// Regression runner for the contract audit fixes. Does not connect to a database.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = [
  'apps/api/test/lease-term.test.cjs',
  'apps/api/test/lease-renewal.test.cjs',
  'apps/consumer-app/lib/contract-renewal.test.cjs',
  'apps/consumer-app/lib/tenant-work.test.cjs',
  'apps/consumer-app/lib/tenant-bill-upcoming.test.cjs',
  'apps/consumer-app/components/lease-agreement-fields.test.cjs',
  'apps/consumer-app/components/lease-renewal-fields.test.cjs',
  'apps/consumer-app/components/contracts-renewal-flow.test.cjs',
];
const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
