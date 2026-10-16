#!/usr/bin/env node
// Fails when code uses the retired role code 'owner' as an ACCOUNT ROLE (docs/ROLE-CHANGE-PLAN.md, guard 5).
// 'owner' as a CONTRACT PARTY (agreement_sign_invites.party, agreement_documents.subject, owner_* columns,
// ContractParty, partyRole, mode="owner") is fine and is not matched. tsc already rejects typed uses
// (UserRole, MasterRoleName, @Roles); this catches untyped ones: SQL strings, string[] role lists, seeds.
// Usage (repo root): npm run check:roles      Exit 1 when something is found.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const DIRS = ['apps', 'packages', 'supabase', 'docs/new-project'];
const EXT = /\.(ts|tsx|js|cjs|mjs|sql)$/;
const SKIP_DIR = new Set(['node_modules', 'dist', '.next', '.expo', '.turbo', 'build', 'android', 'ios']);
// Files that must name the retired code on purpose.
const ALLOW = new Set([
  'apps/api/scripts/check-roles.cjs',
  'apps/api/scripts/db-test-users.cjs', // maps the legacy 'owner' row while a database is not migrated yet
  'apps/api/src/entities/master-role.entity.ts', // RETIRED_ROLE_NAMES
  'apps/api/test/role-catalog.test.cjs',
  'apps/consumer-app/app/index.tsx', // old deep links containing "owner" open landlord mode
  'apps/consumer-app/lib/config.ts', // EXPO_PUBLIC_DEFAULT_ROLE=owner is mapped to landlord with a warning
  'supabase/migrations/20261014100838_baseline.sql', // history: dumped before the rename
  'supabase/migrations/20261016100000_rename_owner_role_to_landlord.sql',
]);

const RULES = [
  [/@Roles\([^)]*['"]owner['"]/, '@Roles(...) with owner'],
  [/\b(?:roleNames|roles|allowedRoles)\s*\.\s*includes\(\s*['"]owner['"]/, 'role list .includes("owner")'],
  [/\b(?:activeRole|role|userRole|pendingRole)\s*===?\s*['"]owner['"]/, 'role compared with "owner"'],
  [/\br\.name\s*=\s*'owner'/, "SQL r.name = 'owner'"],
  [/\bname\s*:\s*['"]owner['"]/, "role lookup { name: 'owner' }"],
  [/\brole\s*:\s*['"]owner['"]/, "role: 'owner'"],
  [/(?:UserRole|MasterRoleName)[^;\n]*['"]owner['"]/, "role type containing 'owner'"],
  [/colors\.roles\.owner\b|\.roles\[['"]owner['"]\]|\bt\.roles\.owner\b/, 'role-keyed colour/label .owner'],
  [/\(\s*(?:\d+\s*,\s*)?'owner'\s*,\s*'[^']*(?:mode|Owner|owner)[^']*'\s*\)/, "master_roles row ('owner', ...)"],
];

const hits = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (EXT.test(entry.name)) {
      const rel = path.relative(ROOT, full).split(path.sep).join('/');
      if (ALLOW.has(rel)) continue;
      fs.readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
        for (const [re, why] of RULES) if (re.test(line)) hits.push(`${rel}:${i + 1}  ${why}\n    ${line.trim().slice(0, 160)}`);
      });
    }
  }
}
for (const dir of DIRS) if (fs.existsSync(path.join(ROOT, dir))) walk(path.join(ROOT, dir));

if (hits.length) {
  console.error(`check:roles — the retired role code 'owner' is used as an account role (${hits.length}):\n`);
  console.error(hits.join('\n'));
  console.error("\nUse 'landlord' for the account role. 'owner' is only valid as a contract party (ContractParty).");
  process.exit(1);
}
console.log("check:roles — no account-role use of 'owner' found.");
