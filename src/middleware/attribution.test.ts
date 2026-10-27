import { describe, it, expect } from "vitest";
import {
  actingUserSchema,
  resolveActor,
  missingAttributionResult,
  attributionNote,
} from "./attribution.js";
import type { PortalIdentity } from "./portal-identity.js";

const IDENTITY: PortalIdentity = {
  email: "brad.mccormick@example.edu",
  name: "Brad McCormick",
  oid: "00000000-0000-0000-0000-0000000000bb",
};

describe("attribution middleware", () => {
  describe("resolveActor", () => {
    it("uses the verified identity and marks it verified", () => {
      const actor = resolveActor(IDENTITY, undefined, undefined);
      expect(actor).not.toBeNull();
      expect(actor?.name).toBe("Brad McCormick");
      expect(actor?.email).toBe("brad.mccormick@example.edu");
      expect(actor?.verified).toBe(true);
    });

    it("verified identity overrides model-supplied actingUser* (spoof-proof)", () => {
      const actor = resolveActor(IDENTITY, "Someone Else", "attacker@example.edu");
      expect(actor?.name).toBe("Brad McCormick");
      expect(actor?.email).toBe("brad.mccormick@example.edu");
      expect(actor?.verified).toBe(true);
    });

    it("falls back to model-supplied fields when no identity, marked unverified", () => {
      const actor = resolveActor(null, "Aaron Sachs", "aaron.sachs@example.edu");
      expect(actor?.name).toBe("Aaron Sachs");
      expect(actor?.email).toBe("aaron.sachs@example.edu");
      expect(actor?.verified).toBe(false);
    });

    it("returns null when no identity and a field is missing", () => {
      expect(resolveActor(null, "Aaron Sachs", undefined)).toBeNull();
      expect(resolveActor(null, undefined, "aaron.sachs@example.edu")).toBeNull();
      expect(resolveActor(null, undefined, undefined)).toBeNull();
    });
  });

  describe("actingUserSchema", () => {
    it("marks the fields REQUIRED in their description when no identity", () => {
      const shape = actingUserSchema(null);
      expect(shape.actingUserFullName.description).toContain("REQUIRED");
      expect(shape.actingUserEmail.description).toContain("REQUIRED");
    });

    it("marks the fields IGNORED when a verified identity is present", () => {
      const shape = actingUserSchema(IDENTITY);
      expect(shape.actingUserFullName.description).toContain("IGNORED");
      expect(shape.actingUserEmail.description).toContain("IGNORED");
    });

    it("produces optional string fields that parse a provided value", () => {
      const shape = actingUserSchema(null);
      expect(shape.actingUserFullName.parse("Aaron Sachs")).toBe("Aaron Sachs");
      expect(shape.actingUserFullName.parse(undefined)).toBeUndefined();
    });
  });

  describe("missingAttributionResult", () => {
    it("is an isError result naming the required fields", () => {
      const result = missingAttributionResult();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("actingUserFullName");
      expect(result.content[0].text).toContain("actingUserEmail");
    });
  });

  describe("attributionNote", () => {
    it("records the verified actor and notes AI Portal verification", () => {
      const note = attributionNote({
        name: "Brad McCormick",
        email: "brad.mccormick@example.edu",
        verified: true,
      });
      expect(note).toContain("Brad McCormick");
      expect(note).toContain("brad.mccormick@example.edu");
      expect(note).toContain("identity verified by AI Portal");
    });

    it("omits the verified clause for an unverified (model-supplied) actor", () => {
      const note = attributionNote({
        name: "Aaron Sachs",
        email: "aaron.sachs@example.edu",
        verified: false,
      });
      expect(note).toContain("Aaron Sachs");
      expect(note).not.toContain("verified");
    });
  });
});
