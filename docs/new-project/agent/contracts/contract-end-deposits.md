# Contract endings, deposit settlements and renewals

Source of truth: [`20261009-contract-end-deposits.sql`](../../../../apps/api/migrations/20261009-contract-end-deposits.sql).
Prerequisite: the existing agreement templates/renewals migration. The legacy
`schema.sql` is a base blueprint; use the migrations to obtain the current schema.

## Tables and money

- `master_contract_end_reasons`: stable `code`, Thai/English labels, applicable
  terminal status, suggested deposit policy, note requirement and active flag.
  Default policies are `refund_full`, `refund_after_deductions`, `manual_review`.
  A policy is guidance, never an automatic forfeiture or refund instruction.
- `lease_contracts`: nullable `end_reason_id`, `end_reason_note`,
  `effective_end_date`, `end_recorded_at`, `end_recorded_by_user_id`.
  The scheduled `end_date` and existing `terminated_at` remain separate fields.
  System actions may leave the recording user null; manual actions supply an ID.
- `contract_deposit_settlements`: one settlement per contract. Store actual cash
  received and its evidence separately from `lease_contracts.deposit`, which is
  the amount required by the agreement. `available_deposit_amount` is actual
  cash plus completed incoming carry transfers, before allocating this settlement.
- `deposit_deduction_items`: each amount applied against the held deposit needs
  a type, explanation and evidence. Excess debt belongs in separate billing;
  deduction items here cannot allocate more money than the deposit holds.
- `contract_deposit_transfers`: a planned/actual carry from predecessor to its
  direct renewal, with approval and completion timestamps. At most one live
  outgoing transfer per predecessor. Cancelled transfers retain their history.

All amounts are `DECIMAL(12,2)` and mapped as strings in TypeORM, avoiding floating
point arithmetic. New tables have RLS enabled with no public write policies.
The backend database role performs writes; future API handlers must authenticate
the user and authorize access to all involved contracts before writing.

## Workflow and invariants

1. Existing closed contracts retain null reason fields. New transitions to
   `expired`, `terminated`, `cancelled` require a reason matching the status,
   effective date, recorded time and any required note. An inactive reason cannot
   be newly selected; used reasons retain their labels/meaning and may be disabled.
2. `expired` uses the scheduled end date. `terminated` uses an effective date
   within the term, before its scheduled end. `cancelled` may precede the start.
   Existing draft cancellation writes both the structured fields and the legacy
   `data.draftCancellation` for compatibility.
3. Start with a `draft` settlement. Record cash receipts/evidence, deductions and
   a `pending` carry transfer if renewing. A pending carry does not fund the renewal.
4. Approve only after the source contract has ended. Set the approving user/time
   and decision note. The database reconciles deduction items and transfer rows,
   and requires this exact allocation:

   `available_deposit_amount = deduction_total + carried_forward_total + refund_amount`

5. After approval, financial allocations and deduction items cannot be edited.
   Complete the carry only after the predecessor is `expired` and the renewal is
   `active`, for the same tenant and room. Its amount cannot exceed the deposit
   required by the renewal. Approval/transfer timestamps and user are required.
6. The renewal's cash received excludes carried money. For example, carry 17,000
   and receive an 8,000 top-up: its available deposit is 25,000. Completed transfer
   rows cannot be updated, deleted or counted again by another outgoing allocation.
7. Complete the settlement after all outgoing transfers finish. A positive refund
   requires a refund timestamp and evidence/reference. Completed records and
   recorded refund evidence are immutable. Zero deposit needs no fictitious refund.

For reporting, distinguish no deposit received, full refund, partial refund,
deposit consumed by deductions, and deposit carried to a renewal. A zero cash
refund with a positive carried amount is a carry, not forfeiture.

Existing renewal fields (`agreement_kind`, `previous_agreement_id`,
`root_agreement_id`) continue to record the contract chain. Continuous renewals
starting the next day reuse an existing active occupancy; gaps or moved-out
occupancies create a new tenancy. Draft renewal creation does not close the
predecessor or move money. No historical cash receipts are inferred or backfilled.

## Apply and verify

```sh
npm run db:contract-deposits -w @nestyk/api -- --check
RUN_CONTRACT_DEPOSIT_DB_TEST=1 npm run test:contract-deposits -w @nestyk/api
npm run db:contract-deposits -w @nestyk/api -- --apply
npm run db:check -w @nestyk/api -- --check
```

The apply runner uses a transaction, the configured `DB_SCHEMA`, an advisory lock
and bounded database timeouts. The integration test uses synthetic fixtures in a
temporary schema and rolls back the entire schema. Repeat application leaves
existing master configuration intact (`ON CONFLICT (code) DO NOTHING`).

This migration supplies the schema and guards. Dedicated settlement/transfer
API endpoints and user interfaces are not added by this schema change.
