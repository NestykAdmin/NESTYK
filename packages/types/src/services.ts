export type ServiceCategory = 'viewing' | 'cleaning' | 'maintenance' | 'inspection' | 'support';
export type ServiceStatus = 'requested' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

export interface ServiceTicket {
  id: string;
  category: ServiceCategory;
  listingId?: string;
  requesterId: string;
  requesterRole: 'tenant' | 'landlord' | 'agent' | 'guest';
  assigneeId?: string; // Assistant or Agent or Technician
  scheduledAt: string;
  status: ServiceStatus;
  notes?: string;
  attachments?: string[];
  estimatedCost?: number;
  finalCost?: number;
  createdAt: string;
  updatedAt: string;
}
