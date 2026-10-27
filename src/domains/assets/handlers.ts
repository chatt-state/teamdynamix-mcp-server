/**
 * Handler implementations for asset MCP tools.
 *
 * Contains the business logic that executes when asset-related
 * MCP tools are invoked by the client. Each handler calls the
 * TDX API via the shared TdxClient and returns typed results.
 */

import { getTdxClient } from "../../tdx-client.js";
import type {
  Asset,
  AssetSearch,
  AssetCreateParams,
  AssetUpdateParams,
  AssetStatus,
  AssetForm,
  Attachment,
  FeedEntry,
} from "@chatt-state/node-teamdynamix";

/**
 * Searches for assets matching the given parameters.
 */
export async function searchAssets(
  params: AssetSearch,
): Promise<Asset[]> {
  return getTdxClient().assets.search(params);
}

/** Retrieves a single asset by its ID. */
export async function getAsset(assetId: number): Promise<Asset> {
  return getTdxClient().assets.get(assetId);
}

/** Creates a new asset. */
export async function createAsset(
  asset: AssetCreateParams,
): Promise<Asset> {
  return getTdxClient().assets.create(asset);
}

/** Updates an existing asset. */
export async function updateAsset(
  assetId: number,
  asset: AssetUpdateParams,
): Promise<Asset> {
  return getTdxClient().assets.update(assetId, asset);
}

/** Deletes an asset by its ID. */
export async function deleteAsset(assetId: number): Promise<void> {
  return getTdxClient().assets.delete(assetId);
}

/** Retrieves the attachments for an asset. */
export async function getAssetAttachments(
  assetId: number,
): Promise<Attachment[]> {
  return getTdxClient().assets.getAttachments(assetId);
}

/** Retrieves the activity feed for an asset. */
export async function getAssetFeed(assetId: number): Promise<FeedEntry[]> {
  return getTdxClient().assets.getFeed(assetId);
}

/** Fetches all asset statuses for the configured application. */
export async function getAssetStatuses(): Promise<AssetStatus[]> {
  return getTdxClient().assets.getStatuses();
}

/** Fetches all asset forms for the configured application. */
export async function getAssetForms(): Promise<AssetForm[]> {
  return getTdxClient().assets.getForms();
}
