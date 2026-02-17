/**
 * Handler implementations for asset MCP tools.
 *
 * Contains the business logic that executes when asset-related
 * MCP tools are invoked by the client. Each handler calls the
 * TDX API via tdxClient and returns typed results.
 */

import { tdxClient } from "../../http/client.js";
import { getConfig } from "../../config.js";
import type { TdxAsset, AssetSearchParams } from "./types.js";

/**
 * Resolves the assets app ID from an explicit value or the global config.
 * Throws if neither is available.
 */
function getAppId(providedAppId?: number): number {
  const appId = providedAppId ?? getConfig().assetsAppId;
  if (appId === undefined) {
    throw new Error(
      "No assets app ID provided and TDX_ASSETS_APP_ID is not configured",
    );
  }
  return appId;
}

/**
 * Searches for assets matching the given parameters.
 * The `appId` field on params is used for routing; the rest
 * is forwarded to the TDX search endpoint as the POST body.
 */
export async function searchAssets(
  params: AssetSearchParams & { appId?: number },
): Promise<TdxAsset[]> {
  const appId = getAppId(params.appId);
  const { appId: _, ...searchParams } = params;
  return tdxClient.post<TdxAsset[]>(`/${appId}/assets/search`, searchParams);
}

/** Retrieves a single asset by its ID. */
export async function getAsset(
  assetId: number,
  appId?: number,
): Promise<TdxAsset> {
  return tdxClient.get<TdxAsset>(`/${getAppId(appId)}/assets/${assetId}`);
}
