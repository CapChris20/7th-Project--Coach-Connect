# Coach Connect design handoff

New UI for Coach Connect: neo-brutalist, black, white and gray, with small gradient accents. Everything here is design reference. Nothing in this package changes the app repo.

## What is in the folder

| Path | What it is |
|---|---|
| `DESIGN-SYSTEM.md` | Tokens, shapes, type, components, motion, native notes. Start here. |
| `MAPPING.md` | Each mockup screen matched to the repo files to change. |
| `CURSOR-HANDOFF.md` | What Cursor needs, what it does not, the order of work, a prompt template. |
| `cursor-rules/coach-connect-design.mdc` | Rule file. Copy to `.cursor/rules/` in the repo. |
| `mockups/*.html` | One page per flow, light and dark, interactive. Open in a browser (internet needed for GSAP and Lottie from cdnjs). |
| `mockups/legacy/` | The earlier mockups from the first handoff, kept for reference. |
| `assets/icons`, `assets/lottie` | The owner's icon art (96px PNG) and the recolored Lottie files. |
| `build-sources/` | The Python that generates the mockups (`kit.py` holds the shared CSS and JS). Edit a flow script, run it, get a new page. |

## Honest limits

- The mockups are web pages. None has been run on a phone.
- Sample data (names, numbers, prices) is invented. Some wording is mine, not from the app. Captions say which.
- Map view and Spreadsheet session mode have no matching screen in the app. They are concepts.
- The repo's `docs/design/DESIGN.md` describes a different look. The owner has to decide to replace it.
