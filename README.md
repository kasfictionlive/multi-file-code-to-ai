# multi-file-code-to-ai README

Select multiple files and convert them to a prompt for chatGPT, claude, or deepseek.

## Features

- Manage multiple file lists.
- Swap between different file lists.
- Automatically update prompt with selected files.
- Save the prompts with the workspace in version control.

## How to use

1. Open the prompt explorer.
2. Click on the `+` button to create a new prompt, type a name and instructions.
3. Use the file explorer to copy the relative paths of the files you want to include in the prompt.
4. Paste the paths into the prompt under the `Files` section.
5. Click on the generate button on the prompt in the prompt explorer to generate the prompt.


## Example prompt

```yaml
  name: New prompt
  instruction: Example instructions
  files:
    - src/app.ts
    - src/server.ts
    - src/views/index.ts
```


## Versions

### 1.0.2

Updated the README with instructions on how to use the extension.

### 1.0.0

Initial release