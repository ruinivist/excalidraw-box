import { HttpError } from "./scene";

const RESERVED_SLUGS = new Set(["api", "d", "p", "mcp"]);

export function normalizePublicationSlug(input: unknown): string {
  if (typeof input !== "string") {
    throw new HttpError(400, "slug must be a string");
  }

  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length === 0) {
    throw new HttpError(400, "slug is required");
  }

  if (RESERVED_SLUGS.has(normalized)) {
    throw new HttpError(400, "slug is reserved");
  }

  return normalized;
}
