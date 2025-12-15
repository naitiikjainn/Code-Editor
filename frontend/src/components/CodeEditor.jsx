import Editor, { useMonaco } from "@monaco-editor/react";
import { useEffect, useRef } from "react";

export default function CodeEditor({ value, onChange, language }) {
  const monaco = useMonaco();
  const editorRef = useRef(null);
  let debounceTimer = null;

  function handleMount(editor) {
    editorRef.current = editor;
  }

  useEffect(() => {
    if (!monaco) return;

    monaco.languages.registerInlineCompletionsProvider(language, {
      provideInlineCompletions: async (model, position) => {
        const textUntilCursor = model.getValueInRange({
          startLineNumber: Math.max(1, position.lineNumber - 20),
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const res = await fetch("http://localhost:5000/api/ai/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: textUntilCursor,
            language,
          }),
        });

        const data = await res.json();

        return {
          items: [
            {
              insertText: data.completion,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
            },
          ],
        };
      },
    });
  }, [monaco, language]);

  return (
  <Editor
    height="100%"
    width="100%" // Force width
    value={value}
    onChange={onChange}
    language={language}
    onMount={handleMount}
    theme="vs-dark"
    options={{
      inlineSuggest: true,
      quickSuggestions: false,
      minimap: { enabled: false }, // Disabling minimap saves space on small screens
      scrollBeyondLastLine: false,
      automaticLayout: true, // IMPORTANT: Tells Monaco to resize automatically
    }}
  />
);
}
