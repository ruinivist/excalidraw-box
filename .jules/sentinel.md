## 2025-06-07 - [Added Security Headers via Caddy]

**Vulnerability:** Missing HTTP security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
**Learning:** The application does not apply security headers in the Bun application server but instead relies on the Caddy reverse proxy to inject them in the `Caddyfile`.
**Prevention:** Always configure security headers at the reverse proxy level (`Caddyfile`) instead of within the backend API routing code to ensure all routes, including static files, are properly protected.
