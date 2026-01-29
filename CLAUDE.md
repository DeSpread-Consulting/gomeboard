# AI Agent Operational Guidelines

## 1. Decision Protocol (Token Economy)

Before executing any task, evaluate the complexity and context to minimize token usage.

- **Use Internal Knowledge (Direct Action)** when:
  - The task is a simple bug fix, single-file refactor, or syntax correction.
  - The context is local and small (under 5 files).
  - DO NOT query external tools (Gemini/Stitch) for trivial tasks.

- **Use Gemini CLI** when:
  - Analyzing huge codebases (> 10 files or > 100KB).
  - Understanding project-wide architecture or dependencies.
  - Checking for global implementation patterns (e.g., "Is auth implemented everywhere?").
  - _Instruction:_ Run the `gemini` command in the terminal and use its output as your context.

- **Use Stitch (MCP)** when:
  - Creating new UI components from scratch.
  - Modifying visual design, CSS, colors, or layout structure.
  - _Instruction:_ Query Stitch first to get the design data/specs, then implement.

---

## 2. Gemini CLI Workflow (Large Context Analysis)

You have access to a local CLI tool named `gemini`. Do NOT try to read 50+ files yourself. Instead, use `gemini -p` to get a summary or analysis.

### Command Syntax

Run this in the terminal:
`gemini -p "@path/to/files prompt..."`

### Syntax Rules

- Use `@` to include files/directories relative to the current directory.
- **Single file:** `@app/page.tsx`
- **Multiple files:** `@package.json @app/layout.tsx`
- **Directory:** `@app/components/` (Summarizes the folder)
- **Warning:** Avoid including `node_modules` or `.env` files.

### Standard Usage Examples

- **Architecture Check:** `gemini -p "@app/ Summarize the project structure"`
- **Implementation Check:** `gemini -p "@app/api/ Is error handling implemented in all endpoints?"`
- **Feature Verification:** `gemini -p "@app/hooks/ List all custom hooks and their purpose"`

---

## 3. Stitch Workflow (Design & UI)

You have `stitch` connected via MCP.

- **New UI:** "Ask Stitch for the design specs of [Component Name], then generate the React/Tailwind code."
- **Design Update:** "Check Stitch for the latest updates on [Page Name] and apply changes to the code."

---

## 4. Execution Flow Summary

1.  **Analyze Request:** Is it Design? Large Scale? or Small Fix?
2.  **Tool Selection:**
    - If Design -> Query Stitch.
    - If Large Scale -> Run `gemini -p "..."`.
    - If Small -> Proceed directly.
3.  **Implementation:** Write/Edit code based on the tool's output.
4.  **Verification:** Run tests or check builds.
