# wiredown for VS Code

Draw UI screens and flows written as markdown, right in your editor.

- Markdown preview: `wiredown` and `screens` fences are drawn as wireframes.
- Lint: problems in a fence show up as errors and warnings on the right line.
- Highlighting: fences in markdown and whole `.wiredown` files are colored.
- Preview command: "wiredown: Open preview" draws the open `.wiredown` file beside the editor.

````markdown
```wiredown
screen login "Sign in"
  input "Email"
  button "Sign in" primary -> home
```
````

See the wiredown language reference for every element and attribute.
