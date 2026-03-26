/**
 * Handler implementations for report MCP tools.
 *
 * Contains the business logic that executes when report-related
 * MCP tools are invoked by the client.
 */

import { getTdxClient } from "../../tdx-client.js";
import type {
  Report,
  ReportSearch,
  ReportData,
} from "@chatt-state/node-teamdynamix";

/** Searches for reports matching the given parameters. */
export async function searchReports(
  params: ReportSearch,
): Promise<Report[]> {
  return getTdxClient().reports.search(params);
}

/** Retrieves a single report by ID. */
export async function getReport(id: number): Promise<Report> {
  return getTdxClient().reports.get(id);
}

/** Executes a report and returns the resulting data. */
export async function executeReport(
  id: number,
  params?: Record<string, unknown>,
): Promise<ReportData> {
  return getTdxClient().reports.execute(id, params);
}
