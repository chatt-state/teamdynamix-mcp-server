/**
 * Handler implementations for CMDB configuration item MCP tools.
 *
 * Contains the business logic that executes when CMDB-related MCP tools are
 * invoked by the client. Each handler is a thin wrapper around a single
 * TdxClient `cmdb` resource call and returns typed results. Configuration
 * items are the CMDB side of asset management and share the assets app id.
 */

import { getTdxClient } from "../../tdx-client.js";
import type {
  ConfigurationItem,
  CISearch,
  CICreateParams,
  CIUpdateParams,
  CIRelationship,
  Attachment,
  FeedEntry,
} from "@chatt-state/node-teamdynamix";

/** Searches for configuration items matching the given parameters. */
export async function searchConfigurationItems(
  params: CISearch,
): Promise<ConfigurationItem[]> {
  return getTdxClient().cmdb.search(params);
}

/** Retrieves a single configuration item by its ID. */
export async function getConfigurationItem(
  id: number,
): Promise<ConfigurationItem> {
  return getTdxClient().cmdb.get(id);
}

/** Creates a new configuration item. */
export async function createConfigurationItem(
  ci: CICreateParams,
): Promise<ConfigurationItem> {
  return getTdxClient().cmdb.create(ci);
}

/** Updates an existing configuration item. */
export async function updateConfigurationItem(
  id: number,
  ci: CIUpdateParams,
): Promise<ConfigurationItem> {
  return getTdxClient().cmdb.update(id, ci);
}

/** Deletes a configuration item by ID. */
export async function deleteConfigurationItem(id: number): Promise<void> {
  return getTdxClient().cmdb.delete(id);
}

/** Retrieves the activity feed for a configuration item. */
export async function getCIFeed(id: number): Promise<FeedEntry[]> {
  return getTdxClient().cmdb.getFeed(id);
}

/** Retrieves the relationships for a configuration item. */
export async function getCIRelationships(
  id: number,
): Promise<CIRelationship[]> {
  return getTdxClient().cmdb.getRelationships(id);
}

/** Adds a relationship between two configuration items. */
export async function addCIRelationship(
  id: number,
  relatedId: number,
  typeId: number,
): Promise<void> {
  return getTdxClient().cmdb.addRelationship(id, relatedId, typeId);
}

/** Removes a relationship from a configuration item. */
export async function removeCIRelationship(
  id: number,
  relationshipId: number,
): Promise<void> {
  return getTdxClient().cmdb.removeRelationship(id, relationshipId);
}

/** Uploads a file attachment to a configuration item. */
export async function addCIAttachment(
  id: number,
  file: Buffer | Uint8Array,
  fileName: string,
): Promise<Attachment> {
  return getTdxClient().cmdb.addAttachment(id, file, fileName);
}
