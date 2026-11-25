# wiremark for VS Code

Draw UI screens and flows written as markdown, right in your editor.

- Markdown preview: `wiremark` and `screens` fences are drawn as wireframes.
- Lint: problems in a fence show up as errors and warnings on the right line.
- Highlighting: fences in markdown and whole `.wiremark` files are colored.
- Preview command: "wiremark: Open preview" draws the open `.wiremark` file beside the editor.

````markdown
```wiremark
screen login "Sign in"
  input "Email"
  button "Sign in" primary -> home
```
````

See the wiremark language reference for every element and attribute.
