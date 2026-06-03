## 2025-06-03 - Avoid TextEncoder for string byte length

**Learning:** `new TextEncoder().encode(text).byteLength` allocates a `Uint8Array` for the entire string, which causes significant memory allocations and is ~100x slower for large JSON payloads in Bun/Node.
**Action:** Use `Buffer.byteLength(text)` when available (with a fallback to `TextEncoder` for browser compatibility) to compute string byte lengths without memory allocation overhead.
