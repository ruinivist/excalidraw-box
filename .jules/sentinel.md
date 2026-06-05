## 2025-02-28 - Caddy HTTP Security Headers Configuration
**Vulnerability:** The application was missing basic security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy), increasing exposure to clickjacking and MIME-sniffing attacks.
**Learning:** Security posture isn't just about application-level code. The reverse proxy (Caddy) configuration serves as the first line of defense and is the correct layer to enforce global HTTP response headers.
**Prevention:** Always verify that the reverse proxy layer enforces foundational HTTP security headers instead of relying solely on the application code to handle response security.
