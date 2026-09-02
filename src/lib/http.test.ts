import { describe, expect, it } from "vitest";
import { errorMessage, HttpError, readJson } from "@/lib/http";

/** Asserts readJson rejected, and hands back the typed failure. */
async function failureOf(response: Response): Promise<HttpError> {
  try {
    await readJson(response);
  } catch (error) {
    if (error instanceof HttpError) return error;
    throw error;
  }
  throw new Error("expected readJson to reject, but it resolved");
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("readJson", () => {
  it("returns the parsed body on success", async () => {
    await expect(
      readJson<{ url: string }>(json({ url: "/api/photos/x" })),
    ).resolves.toEqual({ url: "/api/photos/x" });
  });

  it("surfaces the server's own message on failure", async () => {
    await expect(
      readJson(json({ error: "Photos must be JPEG." }, 400)),
    ).rejects.toThrow("Photos must be JPEG.");
  });

  /**
   * The actual bug: an EMPTY body made `response.json()` throw
   * "JSON.parse: unexpected end of data at line 1 column 1", which told the
   * user nothing and hid the status entirely.
   */
  it("explains an empty body instead of throwing a parse error", async () => {
    const error = await failureOf(new Response("", { status: 500 }));
    expect(error).toBeInstanceOf(HttpError);
    expect(error.message).not.toMatch(/JSON|parse|unexpected end/i);
    expect(error.message).toMatch(/server had a problem/i);
  });

  it("explains a 413 as an oversized upload — the platform rejects before our handler runs", async () => {
    const error = await failureOf(
      new Response("Request Entity Too Large", { status: 413 }),
    );
    expect(error.status).toBe(413);
    expect(error.message).toMatch(/too large/i);
  });

  it("handles an HTML error page without a parse error", async () => {
    const error = await failureOf(
      new Response("<!doctype html><title>502</title>", { status: 502 }),
    );
    expect(error).toBeInstanceOf(HttpError);
    expect(error.message).not.toMatch(/JSON|parse/i);
  });

  it("maps auth failures to something actionable", async () => {
    await expect(readJson(new Response("", { status: 401 }))).rejects.toThrow(
      /sign in/i,
    );
    await expect(readJson(new Response("", { status: 403 }))).rejects.toThrow(
      /permission/i,
    );
  });

  it("rejects a 200 with an unparseable body rather than returning junk", async () => {
    await expect(
      readJson(new Response("not json", { status: 200 })),
    ).rejects.toThrow(/unexpected response/i);
  });
});

describe("errorMessage", () => {
  it("prefers an HttpError's message", () => {
    expect(errorMessage(new HttpError("Too large", 413), "fallback")).toBe(
      "Too large",
    );
  });

  it("falls back for a non-Error throw", () => {
    expect(errorMessage("boom", "fallback")).toBe("fallback");
    expect(errorMessage(null, "fallback")).toBe("fallback");
  });
});
