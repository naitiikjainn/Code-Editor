import Editor, { useMonaco } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import { API_URL } from "../config";

export default function CodeEditor({ value, onChange, language }) {
  const monaco = useMonaco();
  const editorRef = useRef(null);
  const providerRef = useRef(null);

  function handleMount(editor) {
    editorRef.current = editor;
  }

  useEffect(() => {
    if (!monaco) return;

    // Dispose previous provider to prevent stacking
    if (providerRef.current) {
      providerRef.current.dispose();
      providerRef.current = null;
    }

    const disposable = monaco.languages.registerInlineCompletionsProvider(language, {
      provideInlineCompletions: async (model, position, _ctx, token) => {
        try {
          const textUntilCursor = model.getValueInRange({
            startLineNumber: Math.max(1, position.lineNumber - 20),
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

          const controller = new AbortController();
          // Cancel fetch if Monaco cancels the request
          token.onCancellationRequested(() => controller.abort());

          const authToken = localStorage.getItem("codeplay_token");
          const res = await fetch(`${API_URL}/api/ai/complete`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
            body: JSON.stringify({ code: textUntilCursor, language }),
            signal: controller.signal,
          });

          if (!res.ok) return { items: [] };
          const data = await res.json();
          if (!data.completion) return { items: [] };

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
        } catch {
          // Network errors, aborts — return empty completions
          return { items: [] };
        }
      },
      freeInlineCompletions() {},
    });

    providerRef.current = disposable;

    return () => {
      disposable.dispose();
      providerRef.current = null;
    };
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
