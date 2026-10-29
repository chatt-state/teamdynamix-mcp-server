/**
 * Shared attribution helpers for destructive, non-ticket writes.
 *
 * Every MCP call runs through a single TDX service account (TDX has no
 * per-user API impersonation), so a mutation's TDX record shows only that
 * account — not the human who requested it. The tickets domain already
 * enforces a human-attributable audit trail for state changes; these helpers
 * apply the same convention to the destructive people / CMDB / asset /
 * location / group writes added by the full-coverage expansion, which is a
 * FERPA accountability requirement for person/student records.
 *
 * Resolution rules (identical to the tickets domain):
 *  - A verified portal identity (X-Portal-User) is authoritative and overrides
 *    any model-supplied actingUser* arguments (spoof-proof).
 *  - Without a verified identity, the model MUST supply both actingUser fields
 *    or the tool refuses — it never invents an actor.
 */

import { z } from "zod";
import type { PortalIdentity } from "./portal-identity.js";
import type { McpErrorResponse } from "./error-handler.js";

/** The human an action is attributed to, plus whether it was cryptographically verified. */
export interface ResolvedActor {
  name: string;
  email: string;
  verified: boolean;
}

/**
 * The actingUser* input fields to spread into a destructive tool's raw zod
 * inputSchema. Descriptions adapt to whether a verified identity is present.
 */
export function actingUserSchema(
  identity: PortalIdentity | null,
): {
  actingUserFullName: z.ZodOptional<z.ZodString>;
  actingUserEmail: z.ZodOptional<z.ZodString>;
} {
  return {
    actingUserFullName: z
      .string()
      .optional()
      .describe(
        identity
          ? "IGNORED — attribution comes from the verified portal identity."
          : "REQUIRED. Full name of the real user making this change " +
              "(e.g., 'Aaron Sachs'). Never fabricate or guess.",
      ),
    actingUserEmail: z
      .string()
      .optional()
      .describe(
        identity
          ? "IGNORED — attribution comes from the verified portal identity."
          : "REQUIRED. Email address of the real user making this change. " +
              "Never fabricate or guess.",
      ),
  };
}

/**
 * Resolve the acting user from the verified identity (authoritative) or the
 * model-supplied fields. Returns null when neither yields a full name + email.
 */
export function resolveActor(
  identity: PortalIdentity | null,
  actingUserFullName: string | undefined,
  actingUserEmail: string | undefined,
): ResolvedActor | null {
  const name = identity?.name ?? actingUserFullName;
  const email = identity?.email ?? actingUserEmail;
  if (!name || !email) return null;
  return { name, email, verified: identity !== null };
}

/** The standard isError result returned when attribution cannot be resolved. */
export function missingAttributionResult(): McpErrorResponse {
  return {
    content: [
      {
        type: "text",
        text:
          "actingUserFullName and actingUserEmail are required: provide the " +
          "real name and email of the user making this change (never guess).",
      },
    ],
    isError: true,
  };
}

/**
 * A short, human-readable attribution suffix for confirmation messages, e.g.
 * " (requested by Aaron Sachs <aaron@example.edu> — identity verified by AI Portal)".
 * Because these TDX resources expose no feed to write an audit note to, the
 * actor is recorded in the tool's confirmation output.
 */
export function attributionNote(actor: ResolvedActor): string {
  const verified = actor.verified ? " — identity verified by AI Portal" : "";
  return ` (requested by ${actor.name} <${actor.email}>${verified})`;
}
