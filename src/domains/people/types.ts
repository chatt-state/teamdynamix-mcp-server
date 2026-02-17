/**
 * Type definitions for TeamDynamix people operations.
 *
 * These interfaces mirror the TDX Web API person data structures
 * used for search and retrieval operations.
 */

/** Represents a TeamDynamix person. */
export interface TdxPerson {
  UID: string;
  FirstName: string;
  LastName: string;
  FullName?: string;
  PrimaryEmail?: string;
  UserName?: string;
  IsActive?: boolean;
  IsEmployee?: boolean;
  Title?: string;
  Company?: string;
  Department?: string;
  Phone?: string;
  WorkAddress?: string;
  WorkCity?: string;
  WorkState?: string;
  WorkZip?: string;
  Attributes?: Array<{ ID: number; Name: string; Value: string }>;
  SecurityRoleID?: string;
  SecurityRoleName?: string;
  CreatedDate?: string;
  ModifiedDate?: string;
}

/** Parameters accepted by the TDX people search API endpoint. */
export interface PeopleSearchParams {
  SearchText?: string;
  IsActive?: boolean;
  IsEmployee?: boolean;
  MaxResults?: number;
}
