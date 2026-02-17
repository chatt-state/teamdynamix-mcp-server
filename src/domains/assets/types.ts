/**
 * Type definitions for TeamDynamix asset operations.
 *
 * These interfaces mirror the TDX Web API asset data structures
 * used for search and retrieval operations.
 */

/** Represents a custom attribute on an asset. */
export interface TdxAssetAttribute {
  ID: number;
  Name: string;
  Value: string;
}

/** Represents a file attachment on an asset. */
export interface TdxAssetAttachment {
  ID: string;
  Name: string;
}

/** Represents a TeamDynamix asset. */
export interface TdxAsset {
  ID: number;
  Name: string;
  SerialNumber?: string;
  Tag?: string;
  StatusID?: number;
  StatusName?: string;
  LocationID?: number;
  LocationName?: string;
  LocationRoomID?: number;
  LocationRoomName?: string;
  ProductModelID?: number;
  ProductModelName?: string;
  ProductTypeID?: number;
  ProductTypeName?: string;
  SupplierID?: number;
  SupplierName?: string;
  ManufacturerID?: number;
  ManufacturerName?: string;
  OwningDepartmentID?: number;
  OwningDepartmentName?: string;
  RequestingDepartmentID?: number;
  RequestingDepartmentName?: string;
  OwningCustomerID?: string;
  OwningCustomerName?: string;
  RequestingCustomerID?: string;
  RequestingCustomerName?: string;
  AcquisitionDate?: string;
  ExpectedReplacementDate?: string;
  PurchaseCost?: number;
  FormID?: number;
  FormName?: string;
  AppID?: number;
  Attributes?: TdxAssetAttribute[];
  Attachments?: TdxAssetAttachment[];
  CreatedDate?: string;
  ModifiedDate?: string;
}

/** Parameters accepted by the TDX asset search API endpoint. */
export interface AssetSearchParams {
  SearchText?: string;
  StatusIDs?: number[];
  CustomAttributes?: Array<{ ID: number; Value: string }>;
  MaxResults?: number;
}
