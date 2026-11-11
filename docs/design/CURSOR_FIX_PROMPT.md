# Cursor prompt: set up the design skills, then remove the hardcoded old design

Paste the block below into a NEW Cursor Agent chat (strong model, Agent mode). Do not paste it into a chat that already has the earlier attempt in it.

```
The first redesign pass left the old design hardcoded all over the app. Fix it properly. Work in two parts. Do Part 1 fully, then Part 2. Do not stop to ask unless something is blocked.

READ FIRST: docs/design/DESIGN.md and .cursor/rules/redesign.mdc. The mockup in docs/design/mockups is a STYLE reference only. Keep each screen's existing structure, content, data and navigation.

=== PART 1: install the design tooling ===
Clone these into a scratch folder OUTSIDE the repo (for example ~/design-refs), shallow (--depth 1). If one fails (private or renamed), say so, skip it and carry on:
  https://github.com/emilkowalski/skills
  https://github.com/pbakaus/impeccable
  https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
  https://github.com/wshobson/agents
  https://github.com/software-mansion-labs/skills
  https://github.com/wondelai/ios-hig-design
  https://github.com/allen-hsu/react-native-mobile-design

Install these skills into .cursor/skills/<name>/ (copy the whole skill folder, SKILL.md plus its references and scripts). Cursor also reads .claude/skills, so use that folder if your version does not load .cursor/skills:
  apple-design          from emilkowalski/skills        skills/apple-design
  impeccable            from pbakaus/impeccable         .claude/skills/impeccable
  ui-ux-pro-max         from nextlevelbuilder/ui-ux-pro-max-skill   .claude/skills/ui-ux-pro-max
  react-native-design   from wshobson/agents            plugins/ui-design/skills/react-native-design
  mobile-ios-design     from wshobson/agents            plugins/ui-design/skills/mobile-ios-design
  ios-hig-design        from wondelai/ios-hig-design    (find the SKILL.md in the repo)
  react-native-best-practices (and any animation or haptics skills useful for Reanimated) from software-mansion-labs/skills/skills

Plugins and tools: install the Expo skills/plugin (https://docs.expo.dev) if Cursor supports it, and add the iOS simulator MCP (https://github.com/conorluddy/ios-simulator-mcp) to .cursor/mcp.json only if this machine is a Mac with Xcode. If a step is not possible here, list it as skipped with the reason.

Then confirm by listing the installed skill folders. Do not commit the cloned repos. Commit only .cursor/skills.

=== PART 2: remove hardcoded design ===
Goal: the whole app reads color, gradient, radius, border, shadow, spacing and type ONLY from tokens in src/look-and-feel. Zero raw design values in screens.

Step A. Measure. Run and save the output to docs/design/hardcode-audit-before.txt:
  - raw hex colors by file and count:  grep -rnoE "#[0-9A-Fa-f]{3,8}\b" src --include=*.js --include=*.jsx | grep -v "src/look-and-feel"
  - rgb/rgba literals
  - inline LinearGradient colors arrays
  - numeric borderRadius, borderWidth, shadow*, elevation, fontSize, lineHeight, padding, margin, gap literals in StyleSheet.create
  - imports of the old Glass* components (GlassCard, GlassPanel, GlassButton, GlassBackgroundDark/Light, BlurredBackground)
  - the per-feature color files that fork the palette: homeStatColors.js, coachColors.js, schedulingColors.js, setupColors.js, reportColors.js, foodCardColors.js, nutritionColors.js, editorColors.js, brandColors.js, pageStylePresets.js

Step B. Consolidate. Make src/look-and-feel the single source: colors (light and dark), gradients (brand, ink, title, water, sleep, energy, soft), border width, hard-shadow style, radii, spacing scale (4/8), type scale. Keep existing export names so nothing else breaks; add new ones. Turn each per-feature color file into a thin re-export of the shared tokens (no hex literals left inside), then remove those files once nothing imports them.

Step C. Replace, directory by directory, in this order: trainer-app/scheduling, client-app/home, for-both/setup-steps and login-and-signup, client-app/find-a-trainer and for-both/trainer-listing, nutrition and client-app/meals, ai-coach, workouts and client-app/workout-plans, trainer-app (everything else), then the rest of src. In each directory:
  - replace raw colors with tokens via the theme hook, replace gradient arrays with the named gradients, replace radii, borders and shadows with the Nb* components or tokens, replace spacing and font sizes with the scales
  - replace hand-rolled cards, buttons, chips, segmented controls and option rows with the shared Nb* components
  - delete every use of the old Glass* components and any translucent/blur "glass" styling, then delete the unused components
  - keep structure, content, data, navigation and behavior exactly as they were
  - run the app's existing tests and lint for that directory, fix what you broke, and commit with a message naming the directory

Step D. Lock it in. Add an ESLint rule (no-restricted-syntax or a small custom rule) that fails on hex and rgb literals, and on raw numeric borderRadius, fontSize and shadow values, in any file outside src/look-and-feel. Add a script npm run audit:design that prints the remaining counts. Run it and save docs/design/hardcode-audit-after.txt. Target is zero outside src/look-and-feel. If anything must stay (for example a third-party brand color such as the Apple or Google logo), list it in the file with the reason.

Step E. Verify. Check light and dark on iPhone SE width (320) and a large phone for every directory you touched: no clipped text, 44pt touch targets, no card inside a card, one gradient moment per screen, no solid accent fills. Fix what you find.

Report at the end: skills installed or skipped, counts before and after, files deleted, anything you could not convert and why.
```

## Notes for you
- Cursor needs shell access to clone from GitHub. If it can't reach a repo, run the `git clone` lines yourself in a terminal and tell it where they are.
- Two repos (`wondelai/ios-hig-design`, `allen-hsu/react-native-mobile-design`) could not be cloned in my session (blocked), so they may be private or renamed. The prompt tells Cursor to skip any that fail.
- The audit step matters most. It gives you a number you can check, so you are not relying on Cursor saying it is done.
