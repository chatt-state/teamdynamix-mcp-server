/**
 * Handler implementations for custom attribute MCP tools.
 *
 * Contains the business logic that executes when attribute-related
 * MCP tools are invoked by the client.
 */

import { getTdxClient } from "../../tdx-client.js";
import type {
  AttributeDefinition,
  AttributeChoice,
  AttributeChoiceCreateParams,
  AttributeChoiceUpdateParams,
} from "@chatt-state/node-teamdynamix";

/** Lists custom attributes for a given component ID. */
export async function listAttributes(
  componentId: number,
): Promise<AttributeDefinition[]> {
  return getTdxClient().attributes.list(componentId);
}

/** Gets the choices for a custom attribute. */
export async function getChoices(
  attributeId: number,
): Promise<AttributeChoice[]> {
  return getTdxClient().attributes.getChoices(attributeId);
}

/** Creates a new choice for a custom attribute. */
export async function createChoice(
  attributeId: number,
  params: AttributeChoiceCreateParams,
): Promise<AttributeChoice> {
  return getTdxClient().attributes.createChoice(attributeId, params);
}

/** Updates an existing choice for a custom attribute. */
export async function updateChoice(
  attributeId: number,
  choiceId: number,
  params: AttributeChoiceUpdateParams,
): Promise<AttributeChoice> {
  return getTdxClient().attributes.updateChoice(attributeId, choiceId, params);
}

/** Deletes a choice from a custom attribute. */
export async function deleteChoice(
  attributeId: number,
  choiceId: number,
): Promise<void> {
  return getTdxClient().attributes.deleteChoice(attributeId, choiceId);
}
