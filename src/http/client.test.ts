import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockInstance,
} from "vitest";
import { TdxClient, TdxApiError, extractEndpointKey } from "./client.js";

/** Valid GUID values for testing. */
const VALID_GUID_1 = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const VALID_GUID_2 = "12345678-abcd-ef01-2345-6789abcdef01";

function setRequiredEnv(): void {
  process.env.TDX_BASE_URL = "https://example.teamdynamix.com";
  process.env.TDX_BEID = VALID_GUID_1;
  process.env.TDX_WEB_SERVICES_KEY = VALID_GUID_2;
}

function clearTdxEnv(): void {
  delete process.env.TDX_BASE_URL;
  delete process.env.TDX_BEID;
  delete process.env.TDX_WEB_SERVICES_KEY;
}

/** Creates a minimal mock Response. */
function mockResponse(
  status: number,
  body: unknown = null,
  headers: Record<string, string> = {},
): Response {
  const statusText =
    status === 200
      ? "OK"
      : status === 201
        ? "Created"
        : status === 204
          ? "No Content"
          : status === 400
            ? "Bad Request"
            : status === 401
              ? "Unauthorized"
              : status === 404
                ? "Not Found"
                : status === 429
                  ? "Too Many Requests"
                  : status === 500
                    ? "Internal Server Error"
                    : "Unknown";

  const responseHeaders = new Headers(headers);
  const text = body === null ? "" : typeof body === "string" ? body : JSON.stringify(body);

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: responseHeaders,
    text: () => Promise.resolve(text),
  } as unknown as Response;
}

describe("TdxClient", () => {
  let client: TdxClient;
  let fetchMock: MockInstance;
  let envSnapshot: Record<string, string | undefined>;

  // Mock the tokenManager and rateLimiter modules
  vi.mock("../auth/token-manager.js", () => ({
    tokenManager: {
      getValidToken: vi.fn().mockResolvedValue("mock-token"),
      handleUnauthorized: vi.fn().mockResolvedValue("new-mock-token"),
    },
  }));

  vi.mock("../middleware/rate-limiter.js", () => ({
    rateLimiter: {
      checkLimit: vi.fn().mockResolvedValue(undefined),
      updateFromResponse: vi.fn(),
    },
  }));

  beforeEach(async () => {
    vi.useFakeTimers();

    envSnapshot = {
      TDX_BASE_URL: process.env.TDX_BASE_URL,
      TDX_BEID: process.env.TDX_BEID,
      TDX_WEB_SERVICES_KEY: process.env.TDX_WEB_SERVICES_KEY,
    };
    setRequiredEnv();

    const { resetConfig } = await import("../config.js");
    resetConfig();

    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    client = new TdxClient();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    for (const [k, v] of Object.entries(envSnapshot)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }

    const { resetConfig } = await import("../config.js");
    resetConfig();
  });

  describe("URL construction", () => {
    it("should construct the correct URL from baseUrl and path", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { id: 1 }));

      await client.get("/431/tickets/123");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.teamdynamix.com/TDWebApi/api/431/tickets/123",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  describe("HTTP methods", () => {
    it("should perform a GET request", async () => {
      const data = { id: 1, title: "Test Ticket" };
      fetchMock.mockResolvedValueOnce(mockResponse(200, data));

      const result = await client.get<typeof data>("/431/tickets/1");

      expect(result).toEqual(data);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should perform a POST request with body", async () => {
      const body = { title: "New Ticket" };
      const response = { id: 2, ...body };
      fetchMock.mockResolvedValueOnce(mockResponse(201, response));

      const result = await client.post<typeof response>("/431/tickets", body);

      expect(result).toEqual(response);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    });

    it("should perform a PUT request with body", async () => {
      const body = { id: 1, title: "Updated Ticket" };
      fetchMock.mockResolvedValueOnce(mockResponse(200, body));

      const result = await client.put<typeof body>("/431/tickets/1", body);

      expect(result).toEqual(body);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(body),
        }),
      );
    });

    it("should perform a PATCH request with JSON Patch array", async () => {
      const patches = [
        { op: "replace", path: "/title", value: "Patched" },
      ];
      const response = { id: 1, title: "Patched" };
      fetchMock.mockResolvedValueOnce(mockResponse(200, response));

      const result = await client.patch<typeof response>("/431/tickets/1", patches);

      expect(result).toEqual(response);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(patches),
        }),
      );
    });

    it("should perform a DELETE request", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(204));

      await client.delete("/431/tickets/1");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("401 retry logic", () => {
    it("should retry once with a new token on 401", async () => {
      const data = { id: 1 };
      fetchMock
        .mockResolvedValueOnce(mockResponse(401, "Unauthorized"))
        .mockResolvedValueOnce(mockResponse(200, data));

      const { tokenManager } = await import("../auth/token-manager.js");

      const result = await client.get<typeof data>("/431/tickets/1");

      expect(result).toEqual(data);
      expect(tokenManager.handleUnauthorized).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should throw TdxApiError if retry also returns an error", async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(401, "Unauthorized"))
        .mockResolvedValueOnce(mockResponse(403, "Forbidden"));

      await expect(client.get("/431/tickets/1")).rejects.toThrow(TdxApiError);
    });
  });

  describe("429 retry logic", () => {
    it("should wait and retry on 429", async () => {
      const resetDate = new Date(Date.now() + 10_000);
      const data = { id: 1 };
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(429, "Rate limited", {
            "X-RateLimit-Reset": resetDate.toUTCString(),
          }),
        )
        .mockResolvedValueOnce(mockResponse(200, data));

      const promise = client.get<typeof data>("/431/tickets/1");

      // Advance past the wait (reset + 5s floor = ~15s)
      await vi.advanceTimersByTimeAsync(20_000);

      const result = await promise;
      expect(result).toEqual(data);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should use 5s minimum wait when no reset header is present on 429", async () => {
      const data = { id: 1 };
      fetchMock
        .mockResolvedValueOnce(mockResponse(429, "Rate limited"))
        .mockResolvedValueOnce(mockResponse(200, data));

      const promise = client.get<typeof data>("/431/tickets/1");

      await vi.advanceTimersByTimeAsync(5_000);

      const result = await promise;
      expect(result).toEqual(data);
    });

    it("should throw TdxApiError if 429 retry also fails", async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse(429, "Rate limited"))
        .mockResolvedValueOnce(mockResponse(500, "Server Error"));

      // Attach the catch handler before advancing timers to avoid unhandled rejection
      const promise = client.get("/431/tickets/1").catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(10_000);

      const error = await promise;
      expect(error).toBeInstanceOf(TdxApiError);
    });
  });

  describe("error handling", () => {
    it("should throw TdxApiError on 400 Bad Request", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse(400, "Invalid request body"),
      );

      try {
        await client.get("/431/tickets/1");
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(TdxApiError);
        const err = e as TdxApiError;
        expect(err.status).toBe(400);
        expect(err.statusText).toBe("Bad Request");
        expect(err.endpoint).toBe("tickets");
        expect(err.message).toContain("Invalid request body");
      }
    });

    it("should throw TdxApiError on 404 Not Found", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(404, "Ticket not found"));

      try {
        await client.get("/431/tickets/999");
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(TdxApiError);
        const err = e as TdxApiError;
        expect(err.status).toBe(404);
      }
    });

    it("should throw TdxApiError on 500 Internal Server Error", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(500, "Internal error"));

      try {
        await client.get("/431/tickets/1");
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(TdxApiError);
        const err = e as TdxApiError;
        expect(err.status).toBe(500);
      }
    });

    it("should include response body in error message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse(400, "Field 'title' is required"),
      );

      try {
        await client.post("/431/tickets", {});
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(TdxApiError);
        expect((e as TdxApiError).message).toContain(
          "Field 'title' is required",
        );
      }
    });
  });

  describe("rate limiter integration", () => {
    it("should call rateLimiter.checkLimit before each request", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { id: 1 }));

      const { rateLimiter } = await import("../middleware/rate-limiter.js");

      await client.get("/431/tickets/1");

      expect(rateLimiter.checkLimit).toHaveBeenCalledWith("tickets");
    });

    it("should call rateLimiter.updateFromResponse after each request", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { id: 1 }));

      const { rateLimiter } = await import("../middleware/rate-limiter.js");

      await client.get("/431/tickets/1");

      expect(rateLimiter.updateFromResponse).toHaveBeenCalledWith(
        "tickets",
        expect.any(Headers),
      );
    });
  });
});

describe("extractEndpointKey", () => {
  it("should strip app ID prefix and resource ID", () => {
    expect(extractEndpointKey("/431/tickets/123")).toBe("tickets");
  });

  it("should preserve non-numeric trailing segments", () => {
    expect(extractEndpointKey("/431/tickets/search")).toBe("tickets/search");
  });

  it("should handle paths without app ID prefix", () => {
    expect(extractEndpointKey("/people/lookup")).toBe("people/lookup");
  });

  it("should handle auth paths", () => {
    expect(extractEndpointKey("/auth/loginadmin")).toBe("auth/loginadmin");
  });

  it("should handle deeply nested paths", () => {
    expect(extractEndpointKey("/431/tickets/123/comments/456")).toBe(
      "tickets/123/comments",
    );
  });

  it("should handle single segment paths", () => {
    expect(extractEndpointKey("/people")).toBe("people");
  });

  it("should handle paths without leading slash", () => {
    expect(extractEndpointKey("431/tickets/123")).toBe("tickets");
  });
});
