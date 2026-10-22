// D1 test helper: stands in for the query in AgentContractsService.activeBrokerAppointments. The harnesses hand it
// every contract query that starts with leftJoin; the other leftJoin queries in the service are not reached by
// these tests (if one is, it fails loudly with a missing method). Like the real query, it only returns appointments of the agent
// it is asked about, filtered by the room and tenant ids it is given. `pairs()` lists [roomId, tenantId]
// with a valid appointment; `log` collects every call so a test can check what was asked.
function brokerAppointmentLookup(pairs, agentId, log = []) {
  const seen = {};
  const q = {};
  for (const key of ['leftJoin', 'select', 'addSelect', 'distinct', 'where', 'andWhere'])
    q[key] = (...args) => {
      log.push([key, ...args]);
      if (args[1] && typeof args[1] === 'object') Object.assign(seen, args[1]);
      return q;
    };
  q.getRawMany = async () =>
    (seen.agentId === agentId ? pairs() : [])
      .filter(([room, tenant]) => (!seen.roomIds || seen.roomIds.includes(room)) && (!seen.tenantIds || seen.tenantIds.includes(tenant)))
      .map(([roomId, tenantId]) => ({ roomId: String(roomId), tenantId: String(tenantId) }));
  return q;
}
module.exports = { brokerAppointmentLookup };
