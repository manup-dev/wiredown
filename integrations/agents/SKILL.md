---
name: wiredown
description: Write UI screens, wireframes and click-through flows as wiredown blocks (a markdown fence drawn as SVG). Use when someone asks for a wireframe, mockup, screen sketch, user flow or UI spec in a markdown document.
---

# Writing wiredown

wiredown describes UI screens as text inside a markdown fence tagged `wiredown`. The text is drawn as static wireframes, so describe structure (what is on the screen and how it is grouped), not pixels or colours.

## Steps

1. Get the language. Call the `get_wiredown_grammar` tool, or run `npx wiredown contract`. It lists every header, element kind, attribute and flag. Use only what it lists.
2. Write one fenced block per flow:

   ````markdown
   ```wiredown
   @device phone
   screen login "Sign in"
     stack pad=24 gap=16
       input "Email" #email
       input "Password" type=password #password
       button "Sign in" primary w=fill -> home

   variant login-error of login "Wrong password"
     #password error="That password is not right"

   screen home "Home"
     navbar "Home"
     text "Signed in"
   ```
   ````

3. Check it. Call `lint_wiredown` with the block's text (the lines between the fences), or run `npx wiredown lint <file>`. Fix every error and run it again until there are none.
4. Show it. Call `wiredown_link` for a playground link that draws the block, or `render_wiredown` to draw it as SVG. `animate_wiredown` writes the flow as one animated SVG file.

## Rules that catch most mistakes

- Indent children by 2 or 4 spaces, one step per level, spaces only.
- Labels are in double quotes. Escape `\"` and `\\`.
- `-> id` must name a screen in the same block, or `back`. Anything else is a `dangling_link` error.
- Give an explicit `#id` to every element you will link to, patch in a variant or refer to later.
- Show states (error, loading, empty, success) as `variant` blocks of a screen, not as copies of it.
- Keep labels short and real: the words a person would read on the screen.
- To change one element later, edit only its line.
