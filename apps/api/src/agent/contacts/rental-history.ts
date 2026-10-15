/** Internal SQL column references only; $1 is the current agent ID. */
export function rentalHistorySql(scope: { tenantId: string } | { roomId: string }) {
  const field = 'tenantId' in scope ? 'tenant_id' : 'rent_room_id';
  const id = 'tenantId' in scope ? scope.tenantId : scope.roomId;
  return `(
    EXISTS (SELECT 1 FROM room_tenancies stay WHERE stay.${field} = ${id}
      AND stay.created_by_user_id = $1
      AND (stay.status = 'active' OR stay.move_in_date IS NOT NULL))
    OR EXISTS (SELECT 1 FROM lease_contracts agreement
      INNER JOIN agreement_templates template ON template.id = agreement.template_id
      WHERE agreement.${field} = ${id} AND agreement.created_by_user_id = $1
        AND template.form_kind IN ('lease', 'renewal')
        AND (agreement.status IN ('active', 'expired', 'terminated')
          OR (agreement.status = 'cancelled' AND agreement.owner_signed_at IS NOT NULL
            AND agreement.tenant_signed_at IS NOT NULL AND agreement.agent_signed_at IS NOT NULL)))
  )`;
}
