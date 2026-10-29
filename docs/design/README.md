# Design

Status: approved (home page mockup)

The canvas is the source of truth: https://claude.ai/artifact/42B72JjiCxFrtWvUZuHKFX

It is private to the owner; outsiders cannot open it. No exported snapshot exists yet.

| Page | Covers |
|---|---|
| Storyboard | Home page: desktop, mobile light, mobile dark |
| Design tokens | Style palette, type, shape, states, and the product-card layers |
| Notes | Decisions and open questions |

Theme code lives in `src/style.css`. Layer-system mapping for the product card: blurred decoy (-1), name plate (origin), "Under construction" chip (attachment), caution tape (+1).
