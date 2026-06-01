## 2024-06-01 - [Missing Security Headers]
**Vulnerability:** The web application served by Caddy was missing essential security headers, making it more vulnerable to Clickjacking and MIME-sniffing attacks.
**Learning:** Security headers should be explicitly configured in the reverse proxy/web server (Caddy in this case) since they are not typically added by default application servers or front-end frameworks.
**Prevention:** Always ensure standard security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, etc.) are configured globally in the Caddyfile or equivalent web server configuration for all incoming requests.
