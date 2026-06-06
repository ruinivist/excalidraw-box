## 2024-06-06 - Missing HTTP Security Headers
**Vulnerability:** The Caddyfile configuration was missing standard HTTP security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy), leaving the application susceptible to clickjacking, MIME-type sniffing, and sensitive data leakage via referrers.
**Learning:** The application relies on Caddy as a reverse proxy, and by default, Caddy doesn't automatically add these specific security headers unless explicitly configured.
**Prevention:** Ensure that reverse proxy configurations in new projects or updates to existing ones explicitly include essential HTTP security headers in a global scope to protect all served content.
