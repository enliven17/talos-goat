import { NextRequest } from "next/server";
import { verifyAgentApiKey } from "@/lib/auth";

/**
 * Thrown by route handlers to return a structured error response.
 * `withRoute` turns it into `Response.json({ error }, { status })`.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Any Next.js route handler signature (variadic args: request, context, ...). */
type RouteHandler<A extends unknown[]> = (...args: A) => Promise<Response>;

/**
 * Wraps a route handler in the standard outer try/catch:
 *  - a thrown `ApiError` becomes `Response.json({ error }, { status })`
 *  - any other throw is logged and returns the generic 500 used across the API
 *  - otherwise the handler's own Response is returned untouched
 */
export function withRoute<A extends unknown[]>(
  handler: RouteHandler<A>,
): RouteHandler<A> {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      // A handler may throw a ready-made Response (e.g. from requireAgent).
      if (err instanceof Response) return err;
      console.error("Unhandled route error:", err);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

/**
 * Verifies the Bearer API key for `talosId`, throwing `ApiError` on failure
 * so it can be used inside a `withRoute` handler.
 */
export async function requireAgent(request: NextRequest, talosId: string) {
  const result = await verifyAgentApiKey(request, talosId);
  if (!result.ok) throw result.response;
  return result.talos;
}
