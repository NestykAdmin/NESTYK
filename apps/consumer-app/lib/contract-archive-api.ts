import type { ContractArchiveDetail, ContractArchiveKind, ContractArchivePage, ContractArchiveType } from '@nestyk/types';
import { apiGet } from './api';
import { ensureAgentSession } from './agent-session';
export const ARCHIVE_PAGE_SIZE = 20;
export async function listContractArchive(type: ContractArchiveType, query = '', page = 1): Promise<ContractArchivePage> {
  await ensureAgentSession();
  return apiGet(`/agent/contract-archive?type=${encodeURIComponent(type)}&q=${encodeURIComponent(query.trim())}&page=${page}&limit=${ARCHIVE_PAGE_SIZE}`);
}
export async function getContractArchiveDetail(kind: ContractArchiveKind, id: number): Promise<ContractArchiveDetail> {
  await ensureAgentSession();
  return apiGet(`/agent/contract-archive/${encodeURIComponent(kind)}/${id}`);
}
