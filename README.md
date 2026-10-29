# Install dependencies

```
npm install
```

# Clean local

```
npm run clean
```

# Start in dev

```
npm run start
```

# Build for prod

```
npm run build
```

# Page components

Reusable pieces for the non-game pages live in `src/common/components/<name>/`:

- `*.pug`: a mixin for the markup; `layout.pug` includes them all, so every page can call it (`+iconButton(...)`, `+modal(...)`)
- `*.ts`: a custom element in light DOM, so global styles and Font Awesome still apply. A page imports it for its side effect, which registers the element
- `*.scss`: the component's styles. A page's own stylesheet pulls them in with `@use`, and the page links that stylesheet after the global one

Page intros go through `createIntro` (`src/common/scripts/intro.ts`), and page setup goes through `bootPage` (`src/common/scripts/page.ts`).
