/**
 * Type definitions for TeamDynamix knowledge base operations.
 *
 * These interfaces mirror the TDX Web API knowledge base data structures
 * used for search, retrieval, and management of KB articles.
 */

/** Represents a TeamDynamix knowledge base article. */
export interface TdxKbArticle {
  ID: number;
  Title: string;
  Body?: string;
  Summary?: string;
  Status: number;
  CategoryID?: number;
  CategoryName?: string;
  Order?: number;
  IsPublished?: boolean;
  IsPublic?: boolean;
  CreatedDate?: string;
  ModifiedDate?: string;
  ReviewDate?: string;
  Tags?: string[];
  Attributes?: Array<{ ID: number; Name: string; Value: string }>;
  Attachments?: Array<{
    ID: string;
    Name: string;
    ContentType?: string;
    Size?: number;
  }>;
  AppID?: number;
}

/** Parameters accepted by the TDX KB article search API endpoint. */
export interface KbSearchParams {
  SearchText?: string;
  CategoryID?: number;
  Status?: number;
  ReturnCount?: number;
}

/** Represents a knowledge base category. */
export interface TdxKbCategory {
  ID: number;
  Name: string;
  ParentID?: number;
  Order?: number;
  Description?: string;
}
