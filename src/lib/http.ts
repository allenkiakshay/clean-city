/**
 * Safe response reading for every client fetch.
 *
 * `await response.json()` on a non-JSON body throws
 * "JSON.parse: unexpected end of data at line 1 column 1" — which tells the
 * user nothing and hides the real status. That happens more often than it
 * looks: a platform-level rejection (Vercel returns 413 for a request body
 * over 4.5 MB, before any handler runs), a proxy error page, or an unhandled
 * 500 all produce a body that is not JSON.
 *
 * Everything here turns those into a message a person can act on.
 */

export class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function fallbackMessage(status: number): string {
  if (status === 413) {
    return "That photo is too large to upload. Try taking it again at a lower resolution.";
  }
  if (status === 401) return "Please sign in and try again.";
  if (status === 403) return "You do not have permission to do that.";
  if (status === 404) return "That is no longer there.";
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  if (status >= 500) return "The server had a problem. Please try again.";
  return "That did not go through. Please try again.";
}

/**
 * Returns the parsed body, or throws an HttpError carrying the clearest
 * message available — the server's own `error` field when there is one.
 */
export async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  let parsed: unknown = null;
  if (text.trim() !== "") {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  const serverMessage =
    parsed &&
    typeof parsed === "object" &&
    typeof (parsed as { error?: unknown }).error === "string"
      ? (parsed as { error: string }).error
      : null;

  if (!response.ok) {
    throw new HttpError(
      serverMessage ?? fallbackMessage(response.status),
      response.status,
    );
  }

  if (parsed === null) {
    throw new HttpError(
      "The server sent an unexpected response. Please try again.",
      response.status,
    );
  }

  return parsed as T;
}

/** The message to show a user for any thrown value. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
