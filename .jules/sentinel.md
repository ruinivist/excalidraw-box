## 2024-06-04 - Defense in Depth: Shiki HTML Sanitization
**Vulnerability:** Potential XSS via `dangerouslySetInnerHTML` in CodeBlock components rendering Shiki highlighted code.
**Learning:** While Shiki is generally considered safe as it just wraps code in spans, passing user-controlled input (even if it's "code") through an external library and directly into `dangerouslySetInnerHTML` without explicit sanitization creates an unnecessary risk surface. A vulnerability or misconfiguration in the highlighter could lead to XSS.
**Prevention:** Always wrap the output of HTML generators (like Shiki) in a dedicated sanitizer (like DOMPurify) before using `dangerouslySetInnerHTML`, even if the generator is deemed "safe." This is a core tenet of defense in depth.
