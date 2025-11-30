import type { Id } from './Id.ts';

export type OrganizationId = Id<'OrganizationId'>;

export interface Organization {
  id: OrganizationId;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}
