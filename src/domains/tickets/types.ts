/**
 * Type definitions for TeamDynamix ticket operations.
 *
 * These interfaces mirror the TDX Web API ticket data structures
 * used for search, retrieval, creation, and update operations.
 */

/** Represents a TeamDynamix ticket. */
export interface TdxTicket {
  ID: number;
  Title: string;
  Description?: string;
  StatusID: number;
  StatusName?: string;
  PriorityID: number;
  PriorityName?: string;
  TypeID: number;
  TypeName?: string;
  AccountID?: number;
  AccountName?: string;
  RequestorName?: string;
  RequestorEmail?: string;
  RequestorUid?: string;
  ResponsibleFullName?: string;
  ResponsibleUid?: string;
  ResponsibleGroupID?: number;
  ResponsibleGroupName?: string;
  SourceID?: number;
  SourceName?: string;
  ImpactID?: number;
  UrgencyID?: number;
  CreatedDate?: string;
  ModifiedDate?: string;
  CompletedDate?: string;
  GoesOffHoldDate?: string;
  SlaID?: number;
  SlaName?: string;
  AppID?: number;
  FormID?: number;
  FormName?: string;
  Attributes?: TdxAttribute[];
  Attachments?: TdxAttachment[];
  Tags?: string[];
}

/** Represents a custom attribute on a ticket. */
export interface TdxAttribute {
  ID: number;
  Name: string;
  Value: string;
  ValueText?: string;
  ChoiceId?: number;
}

/** Represents a file attachment on a ticket. */
export interface TdxAttachment {
  ID: string;
  Name: string;
  ContentType?: string;
  Size?: number;
  CreatedDate?: string;
  CreatedUid?: string;
}

/** Represents a feed entry (comment/activity) on a ticket. */
export interface TdxFeedEntry {
  ID: number;
  Body: string;
  CreatedDate: string;
  CreatedFullName: string;
  CreatedUid: string;
  IsPrivate: boolean;
}

/** Parameters accepted by the TDX ticket search API endpoint. */
export interface TicketSearchParams {
  SearchText?: string;
  StatusIDs?: number[];
  PriorityIDs?: number[];
  TypeIDs?: number[];
  ResponsibilityUids?: string[];
  ResponsibilityGroupIDs?: number[];
  RequestorUids?: string[];
  CreatedDateFrom?: string;
  CreatedDateTo?: string;
  MaxResults?: number;
}
