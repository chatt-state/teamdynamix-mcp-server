import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, getConfig, resetConfig } from "./config.js";

/** Valid GUID values for testing (not real credentials). */
const VALID_GUID_1 = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const VALID_GUID_2 = "12345678-abcd-ef01-2345-6789abcdef01";

/** Minimal valid environment for loadConfig to succeed. */
const REQUIRED_ENV = {
  TDX_BASE_URL: "https://example.teamdynamix.com",
  TDX_BEID: VALID_GUID_1,
  TDX_WEB_SERVICES_KEY: VALID_GUID_2,
};

/**
 * Saves a snapshot of the current env vars we care about, so we can
 * restore them after each test.
 */
function snapshotEnv(): Record<string, string | undefined> {
  const keys = [
    "TDX_BASE_URL",
    "TDX_BEID",
    "TDX_WEB_SERVICES_KEY",
    "TDX_TICKETING_APP_ID",
    "TDX_ASSETS_APP_ID",
    "TDX_KB_APP_ID",
    "TDX_MCP_TRANSPORT",
    "TDX_MCP_HTTP_PORT",
    "TDX_MCP_HTTP_HOST",
    "TDX_LOG_LEVEL",
    "TDX_PRELOAD_DOMAINS",
    "TDX_RATE_LIMIT_BUFFER",
  ];
  const snap: Record<string, string | undefined> = {};
  for (const k of keys) {
    snap[k] = process.env[k];
  }
  return snap;
}

function restoreEnv(snap: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(snap)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

function setEnv(vars: Record<string, string>): void {
  for (const [k, v] of Object.entries(vars)) {
    process.env[k] = v;
  }
}

function clearTdxEnv(): void {
  const keys = [
    "TDX_BASE_URL",
    "TDX_BEID",
    "TDX_WEB_SERVICES_KEY",
    "TDX_TICKETING_APP_ID",
    "TDX_ASSETS_APP_ID",
    "TDX_KB_APP_ID",
    "TDX_MCP_TRANSPORT",
    "TDX_MCP_HTTP_PORT",
    "TDX_MCP_HTTP_HOST",
    "TDX_LOG_LEVEL",
    "TDX_PRELOAD_DOMAINS",
    "TDX_RATE_LIMIT_BUFFER",
  ];
  for (const k of keys) {
    delete process.env[k];
  }
}

describe("config", () => {
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    envSnapshot = snapshotEnv();
    clearTdxEnv();
    resetConfig();
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
    resetConfig();
  });

  describe("loadConfig", () => {
    it("should load config with all required vars", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();

      expect(config.baseUrl).toBe("https://example.teamdynamix.com");
      expect(config.beid).toBe(VALID_GUID_1);
      expect(config.webServicesKey).toBe(VALID_GUID_2);
    });

    it("should apply defaults for optional vars", () => {
      setEnv(REQUIRED_ENV);
      const config = loadConfig();

      expect(config.ticketingAppId).toBeUndefined();
      expect(config.assetsAppId).toBeUndefined();
      expect(config.kbAppId).toBeUndefined();
      expect(config.transport).toBe("stdio");
      expect(config.httpPort).toBe(3000);
      expect(config.httpHost).toBe("0.0.0.0");
      expect(config.logLevel).toBe("info");
      expect(config.preloadDomains).toEqual(["tickets"]);
      expect(config.rateLimitBuffer).toBe(5);
    });

    it("should accept all optional vars when provided", () => {
      setEnv({
        ...REQUIRED_ENV,
        TDX_TICKETING_APP_ID: "123",
        TDX_ASSETS_APP_ID: "456",
        TDX_KB_APP_ID: "789",
        TDX_MCP_TRANSPORT: "http",
        TDX_MCP_HTTP_PORT: "8080",
        TDX_MCP_HTTP_HOST: "127.0.0.1",
        TDX_LOG_LEVEL: "debug",
        TDX_PRELOAD_DOMAINS: "tickets,assets,kb",
        TDX_RATE_LIMIT_BUFFER: "10",
      });
      const config = loadConfig();

      expect(config.ticketingAppId).toBe(123);
      expect(config.assetsAppId).toBe(456);
      expect(config.kbAppId).toBe(789);
      expect(config.transport).toBe("http");
      expect(config.httpPort).toBe(8080);
      expect(config.httpHost).toBe("127.0.0.1");
      expect(config.logLevel).toBe("debug");
      expect(config.preloadDomains).toEqual(["tickets", "assets", "kb"]);
      expect(config.rateLimitBuffer).toBe(10);
    });

    describe("required var validation", () => {
      it("should throw when all required vars are missing", () => {
        expect(() => loadConfig()).toThrow(
          /TDX_BASE_URL is required/,
        );
        expect(() => loadConfig()).toThrow(
          /TDX_BEID is required/,
        );
        expect(() => loadConfig()).toThrow(
          /TDX_WEB_SERVICES_KEY is required/,
        );
      });

      it("should list ALL missing vars in one error", () => {
        try {
          loadConfig();
          expect.fail("should have thrown");
        } catch (e) {
          const msg = (e as Error).message;
          expect(msg).toContain("TDX_BASE_URL");
          expect(msg).toContain("TDX_BEID");
          expect(msg).toContain("TDX_WEB_SERVICES_KEY");
        }
      });

      it("should throw when TDX_BASE_URL is missing", () => {
        setEnv({
          TDX_BEID: VALID_GUID_1,
          TDX_WEB_SERVICES_KEY: VALID_GUID_2,
        });
        expect(() => loadConfig()).toThrow(/TDX_BASE_URL/);
      });

      it("should throw when TDX_BEID is missing", () => {
        setEnv({
          TDX_BASE_URL: "https://example.teamdynamix.com",
          TDX_WEB_SERVICES_KEY: VALID_GUID_2,
        });
        expect(() => loadConfig()).toThrow(/TDX_BEID/);
      });

      it("should throw when TDX_WEB_SERVICES_KEY is missing", () => {
        setEnv({
          TDX_BASE_URL: "https://example.teamdynamix.com",
          TDX_BEID: VALID_GUID_1,
        });
        expect(() => loadConfig()).toThrow(/TDX_WEB_SERVICES_KEY/);
      });
    });

    describe("GUID format validation", () => {
      it("should reject invalid BEID format", () => {
        setEnv({
          ...REQUIRED_ENV,
          TDX_BEID: "not-a-guid",
        });
        expect(() => loadConfig()).toThrow(/TDX_BEID must be a valid GUID/);
      });

      it("should reject invalid WebServicesKey format", () => {
        setEnv({
          ...REQUIRED_ENV,
          TDX_WEB_SERVICES_KEY: "invalid",
        });
        expect(() => loadConfig()).toThrow(
          /TDX_WEB_SERVICES_KEY must be a valid GUID/,
        );
      });

      it("should accept uppercase GUIDs", () => {
        setEnv({
          ...REQUIRED_ENV,
          TDX_BEID: "A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
        });
        const config = loadConfig();
        expect(config.beid).toBe("A1B2C3D4-E5F6-7890-ABCD-EF1234567890");
      });
    });

    describe("URL format validation", () => {
      it("should reject non-URL strings", () => {
        setEnv({
          ...REQUIRED_ENV,
          TDX_BASE_URL: "not-a-url",
        });
        expect(() => loadConfig()).toThrow(/TDX_BASE_URL/);
      });

      it("should reject HTTP URLs (must be HTTPS)", () => {
        setEnv({
          ...REQUIRED_ENV,
          TDX_BASE_URL: "http://example.teamdynamix.com",
        });
        expect(() => loadConfig()).toThrow(/https:\/\//);
      });
    });

    describe("preloadDomains parsing", () => {
      it("should parse comma-separated domains", () => {
        setEnv({
          ...REQUIRED_ENV,
          TDX_PRELOAD_DOMAINS: "tickets,assets,kb",
        });
        const config = loadConfig();
        expect(config.preloadDomains).toEqual(["tickets", "assets", "kb"]);
      });

      it("should trim whitespace around domains", () => {
        setEnv({
          ...REQUIRED_ENV,
          TDX_PRELOAD_DOMAINS: " tickets , assets , kb ",
        });
        const config = loadConfig();
        expect(config.preloadDomains).toEqual(["tickets", "assets", "kb"]);
      });

      it("should filter empty strings from domains", () => {
        setEnv({
          ...REQUIRED_ENV,
          TDX_PRELOAD_DOMAINS: "tickets,,assets",
        });
        const config = loadConfig();
        expect(config.preloadDomains).toEqual(["tickets", "assets"]);
      });
    });

    describe("enum validation", () => {
      it("should reject invalid transport value", () => {
        setEnv({
          ...REQUIRED_ENV,
          TDX_MCP_TRANSPORT: "websocket",
        });
        expect(() => loadConfig()).toThrow(/transport/);
      });

      it("should reject invalid log level", () => {
        setEnv({
          ...REQUIRED_ENV,
          TDX_LOG_LEVEL: "verbose",
        });
        expect(() => loadConfig()).toThrow(/logLevel/);
      });

      it("should accept all valid transport values", () => {
        for (const transport of ["stdio", "http"]) {
          clearTdxEnv();
          setEnv({ ...REQUIRED_ENV, TDX_MCP_TRANSPORT: transport });
          const config = loadConfig();
          expect(config.transport).toBe(transport);
        }
      });

      it("should accept all valid log levels", () => {
        for (const level of ["debug", "info", "warn", "error"]) {
          clearTdxEnv();
          setEnv({ ...REQUIRED_ENV, TDX_LOG_LEVEL: level });
          const config = loadConfig();
          expect(config.logLevel).toBe(level);
        }
      });
    });

    describe("port validation", () => {
      it("should reject port 0", () => {
        setEnv({ ...REQUIRED_ENV, TDX_MCP_HTTP_PORT: "0" });
        expect(() => loadConfig()).toThrow(/httpPort/);
      });

      it("should reject port above 65535", () => {
        setEnv({ ...REQUIRED_ENV, TDX_MCP_HTTP_PORT: "70000" });
        expect(() => loadConfig()).toThrow(/httpPort/);
      });
    });

    describe("security", () => {
      it("should not include BEID value in error messages", () => {
        const badBeid = "not-a-guid-but-secret";
        setEnv({
          ...REQUIRED_ENV,
          TDX_BEID: badBeid,
        });
        try {
          loadConfig();
          expect.fail("should have thrown");
        } catch (e) {
          const msg = (e as Error).message;
          expect(msg).not.toContain(badBeid);
        }
      });

      it("should not include WebServicesKey value in error messages", () => {
        const badKey = "super-secret-key-value";
        setEnv({
          ...REQUIRED_ENV,
          TDX_WEB_SERVICES_KEY: badKey,
        });
        try {
          loadConfig();
          expect.fail("should have thrown");
        } catch (e) {
          const msg = (e as Error).message;
          expect(msg).not.toContain(badKey);
        }
      });
    });
  });

  describe("getConfig", () => {
    it("should return the same instance on subsequent calls", () => {
      setEnv(REQUIRED_ENV);
      const config1 = getConfig();
      const config2 = getConfig();
      expect(config1).toBe(config2);
    });

    it("should return fresh config after resetConfig", () => {
      setEnv(REQUIRED_ENV);
      const config1 = getConfig();
      resetConfig();
      const config2 = getConfig();
      // Same values but different object references
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});
