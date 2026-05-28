/**
 * Cloudflare Workers transport bridge.
 *
 * Adapts the Workers Fetch API (Request/Response) to the Node.js
 * IncomingMessage/ServerResponse interface expected by
 * StreamableHTTPServerTransport. Supports both buffered JSON responses
 * and streaming SSE responses.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/**
 * Handles an incoming Workers Request by bridging it to the MCP SDK's
 * Node.js-style transport handler, then returning a Workers Response.
 */
export async function handleMcpRequest(
  request: Request,
  handleRequest: RequestHandler,
): Promise<Response> {
  // Pre-read body so we can hand it to the Node.js Readable synchronously.
  // MCP JSON-RPC payloads are small; buffering is acceptable.
  const bodyBuffer = request.body ? await request.arrayBuffer() : null;

  return new Promise<Response>((resolve, reject) => {
    const bodyBytes = bodyBuffer ? new Uint8Array(bodyBuffer) : new Uint8Array(0);
    const reqStream = Readable.from([bodyBytes]);

    const url = new URL(request.url);
    const req = Object.assign(reqStream, {
      method: request.method,
      url: url.pathname + url.search,
      headers: Object.fromEntries(request.headers.entries()),
    }) as unknown as IncomingMessage;

    const responseHeaders: Record<string, string> = {};
    let statusCode = 200;
    let isSSE = false;
    let resolved = false;

    // SSE streaming path: resolve with a ReadableStream body.
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Buffered (non-SSE) path: collect chunks, resolve on end().
    const chunks: Uint8Array[] = [];

    function toBytes(chunk: string | Buffer | Uint8Array): Uint8Array {
      if (typeof chunk === "string") return encoder.encode(chunk);
      return new Uint8Array(chunk.buffer as ArrayBuffer, chunk.byteOffset, chunk.byteLength);
    }

    function resolveBuffered() {
      if (resolved) return;
      resolved = true;
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const body = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        body.set(c, offset);
        offset += c.length;
      }
      resolve(new Response(body.length ? body : null, { status: statusCode, headers: responseHeaders }));
    }

    const res = {
      headersSent: false,
      statusCode: 200,

      setHeader(name: string, value: string | number | readonly string[]) {
        responseHeaders[name.toLowerCase()] = String(Array.isArray(value) ? value.join(", ") : value);
      },

      getHeader(name: string): string | undefined {
        return responseHeaders[name.toLowerCase()];
      },

      removeHeader(name: string) {
        delete responseHeaders[name.toLowerCase()];
      },

      writeHead(
        code: number,
        headersOrMsg?: string | Record<string, string | number | readonly string[]>,
        extraHeaders?: Record<string, string | number | readonly string[]>,
      ) {
        statusCode = code;
        res.statusCode = code;
        const h = (typeof headersOrMsg === "object" ? headersOrMsg : extraHeaders) ?? {};
        for (const [k, v] of Object.entries(h)) {
          responseHeaders[k.toLowerCase()] = String(Array.isArray(v) ? v.join(", ") : v);
        }
        (res as { headersSent: boolean }).headersSent = true;

        isSSE = (responseHeaders["content-type"] ?? "").includes("text/event-stream");
        if (isSSE && !resolved) {
          resolved = true;
          resolve(new Response(readable, { status: statusCode, headers: responseHeaders }));
        }
      },

      write(chunk: string | Buffer | Uint8Array): boolean {
        const bytes = toBytes(chunk);
        if (isSSE) {
          void writer.write(bytes);
        } else {
          chunks.push(bytes);
        }
        return true;
      },

      end(chunk?: string | Buffer | Uint8Array) {
        if (chunk) {
          const bytes = toBytes(chunk);
          if (isSSE) {
            void writer.write(bytes).then(() => writer.close());
          } else {
            chunks.push(bytes);
            void writer.close();
          }
        } else {
          void writer.close();
        }
        if (!isSSE) resolveBuffered();
      },

      // Satisfy Node.js EventEmitter duck-typing used internally by the SDK.
      on() { return res; },
      once() { return res; },
      off() { return res; },
      emit() { return false; },
      flushHeaders() {},
    } as unknown as ServerResponse;

    void handleRequest(req, res).catch((err: unknown) => {
      if (!resolved) reject(err as Error);
    });
  });
}
