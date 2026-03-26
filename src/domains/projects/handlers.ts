/**
 * Handler implementations for project MCP tools.
 *
 * Contains the business logic that executes when project-related
 * MCP tools are invoked by the client.
 */

import { getTdxClient } from "../../tdx-client.js";
import type {
  Project,
  ProjectSearch,
  ProjectCreateParams,
  ProjectUpdateParams,
} from "@chatt-state/node-teamdynamix";

/** Searches for projects matching the given parameters. */
export async function searchProjects(
  params: ProjectSearch,
): Promise<Project[]> {
  return getTdxClient().projects.search(params);
}

/** Retrieves a single project by ID. */
export async function getProject(id: number): Promise<Project> {
  return getTdxClient().projects.get(id);
}

/** Creates a new project. */
export async function createProject(
  params: ProjectCreateParams,
): Promise<Project> {
  return getTdxClient().projects.create(params);
}

/** Updates an existing project. */
export async function updateProject(
  id: number,
  params: ProjectUpdateParams,
): Promise<Project> {
  return getTdxClient().projects.update(id, params);
}
