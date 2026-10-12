const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function("module", "exports", "require", source)(loaded, loaded.exports, require);
  return loaded.exports;
}

const { ownerContractRoomCard, ownerRoomMatches, ownedRoomsMissingFrom, ownerTenantStayDates } = load("owner-contract-rooms.ts");

const row = (over = {}) => ({
  formKind: "lease",
  status: "active",
  tenant: "คุณณัฐชา",
  contractNo: "L-1",
  agreementKind: "new",
  previousAgreementId: null,
  ownerSignedAt: "signed",
  agentSignedAt: null,
  myParties: ["owner"],
  room: "1208",
  ...over,
});

test("active lease with a renewal waiting on the owner", () => {
  const card = ownerContractRoomCard([
    row(),
    row({
      status: "awaiting_signatures",
      agreementKind: "renewal",
      ownerSignedAt: null,
      contractNo: "L-2",
    }),
    row({ status: "expired", contractNo: "L-0" }),
    row({ status: "terminated", contractNo: "L-00" }),
  ]);
  assert.equal(card.status, "active");
  assert.equal(card.tone, "green");
  assert.equal(card.action, "renewal");
  assert.equal(card.needsOwner, true);
  assert.equal(card.historyRounds, 2);
  assert.equal(card.pendingCount, 1);
});

test("reservation waiting on the owner, with no past lease", () => {
  const card = ownerContractRoomCard([
    row({
      formKind: "reservation",
      status: "awaiting_signatures",
      ownerSignedAt: null,
      tenant: "คุณพิมพ์",
    }),
  ]);
  assert.equal(card.status, "awaiting_owner");
  assert.equal(card.action, "reservation");
  assert.equal(card.historyRounds, 0);
});

test("past stay with nothing outstanding", () => {
  const card = ownerContractRoomCard([row({ status: "expired" })]);
  assert.equal(card.status, "idle");
  assert.equal(card.tone, "slate");
  assert.equal(card.action, null);
  assert.equal(card.pendingCount, 0);
  assert.equal(card.historyRounds, 1);
});

test("document waiting on the agent", () => {
  const card = ownerContractRoomCard([
    row({ status: "awaiting_agent_review", formKind: "reservation", ownerSignedAt: "signed" }),
  ]);
  assert.equal(card.status, "awaiting_agent");
  assert.equal(card.needsOwner, false);
  assert.equal(card.pendingCount, 1);
  assert.equal(card.historyRounds, 0);
});

test("a room with no contracts stays idle and is not waiting on the owner", () => {
  const card = ownerContractRoomCard([]);
  assert.equal(card.status, "idle");
  assert.equal(card.needsOwner, false);
  assert.equal(card.historyRounds, 0);
  assert.equal(card.pendingCount, 0);
  assert.equal(card.action, null);
});

test("owned rooms already shown through a contract are not added again", () => {
  const missing = ownedRoomsMissingFrom(
    [
      { property: "The Line", room: "1208" },
      { property: "Life", room: "504" },
    ],
    [
      { property: "The Line", room: "1208" },
      { property: "  Life  ", room: "504" },
      { property: "IDEO", room: "301" },
      { property: "IDEO", room: "301" },
    ],
  );
  assert.deepEqual(missing, [{ property: "IDEO", room: "301" }]);
});

test("stay dates span the first move-in through the current lease end", () => {
  const dates = ownerTenantStayDates([
    row({ startDate: "2024-01-01", endDate: "2024-12-31", moveInDate: "2024-01-05", status: "expired" }),
    row({ startDate: "2025-01-01", endDate: "2025-12-31", moveInDate: null, status: "active" }),
  ]);
  assert.equal(dates.moveIn, "2024-01-05");
  assert.equal(dates.moveOut, "2025-12-31");
});

test("an active renewal extends the move-out past the original lease", () => {
  const dates = ownerTenantStayDates([
    row({ startDate: "2026-12-25", endDate: "2027-12-24", moveInDate: "2026-12-25", status: "active" }),
    row({
      formKind: "renewal",
      startDate: "2027-12-25",
      endDate: "2028-12-24",
      moveInDate: null,
      status: "active",
    }),
  ]);
  assert.equal(dates.moveIn, "2026-12-25");
  assert.equal(dates.moveOut, "2028-12-24");
});

test("a past stay uses the lease start and end when there is no move-in date", () => {
  const dates = ownerTenantStayDates([
    row({ startDate: "2023-06-01", endDate: "2024-05-31", moveInDate: null, status: "terminated" }),
  ]);
  assert.equal(dates.moveIn, "2023-06-01");
  assert.equal(dates.moveOut, "2024-05-31");
});

test("search matches tenant, room, and contract number", () => {
  const contracts = [row({ tenant: "คุณพิมพ์", room: "805", contractNo: "R-9" })];
  assert.equal(ownerRoomMatches("IDEO", "805", contracts, "พิมพ์"), true);
  assert.equal(ownerRoomMatches("IDEO", "805", contracts, "r-9"), true);
  assert.equal(ownerRoomMatches("IDEO", "805", contracts, "ลาดพร้าว"), false);
});
