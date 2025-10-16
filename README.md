# link-shortening-service-frontend

Frontend for **Short.ly** — vanilla HTML/CSS/JS single-page UI. Talks to the Spring Boot backend, handles JWT auth (auto refresh), and surfaces shorten + statistics flows.

---

## Status

This **main** branch intentionally stays lightweight during active development.
All source code and the comprehensive documentation live in the **development** branch.

### Quick Links

* **Development branch:**
  [`development`](https://github.com/ahmadyardimli/link-shortening-service-frontend/tree/development)

* **Full README (setup, API wiring, token flow, screenshots):**
  [`README.md` on development](https://github.com/ahmadyardimli/link-shortening-service-frontend/blob/development/README.md)

---

## How to use this repo

1. Switch to the `development` branch to view and run the code.
2. Follow the full README there for:

   * local setup and static hosting tips,
   * backend base URL configuration,
   * JWT/refresh handling in the client,
   * feature walkthrough with screenshots.

> PRs should target `development`. Periodically, stable milestones will be merged into `main`.

---

## License

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
This project is licensed under the **Apache License 2.0** — see the [LICENSE](LICENSE) file for details.
