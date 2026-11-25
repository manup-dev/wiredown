# Security

## Reporting a problem

Please report security problems privately through GitHub: open this repository's **Security** tab and choose **Report a vulnerability** (a private security advisory). Do not open a public issue for a security problem.

Say what you found, a wiredown block (or other input) that shows it, and what you expected. We will reply in the advisory.

## What counts

The threat model is the README's "Safety guarantees": wiredown takes text from anyone and its output is put into pages, email and books without a further sanitizer for the SVG. A report is in scope when some input makes wiredown:

- throw, or take more than linear time (for example a small input that takes seconds);
- produce output over the limits in `WM_LIMITS`;
- emit an SVG element, attribute or `href` outside the allowlist, or an `id` it did not make;
- turn author text into a URL, an image, a font, CSS or markup (anything not escaped);
- draw differently in Node and in a browser.

The integrations (rehype, VS Code, Obsidian, the browser script, the playground) are in scope too, for what they add around the core.

Supported version: the latest release.
