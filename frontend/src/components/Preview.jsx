import React from "react";

export default function Preview({ html, css, js }) {
  // We inject this script to capture console.log inside the iframe
  const consoleScript = `
    <script>
      (function() {
        const customConsole = {
          log: function(...args) {
            // Convert objects to strings so they show up nicely
            const msg = args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            
            // Send to parent window (React App)
            window.parent.postMessage({ type: 'CONSOLE_LOG', message: msg }, '*');
            
            // Also print to real browser console
            console.warn("[Internal]", ...args); 
          },
          error: function(...args) {
            const msg = args.map(arg => String(arg)).join(' ');
            window.parent.postMessage({ type: 'CONSOLE_ERROR', message: msg }, '*');
          }
        };
        
        // Override global console
        window.console.log = customConsole.log;
        window.console.error = customConsole.error;

        // Catch syntax errors
        window.onerror = function(msg, url, line) {
           window.parent.postMessage({ type: 'CONSOLE_ERROR', message: msg + " (Line " + line + ")" }, '*');
        };
      })();
    </script>
  `;

  const srcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>body { margin: 0; padding: 0; }</style>
        <style>${css}</style>
        ${consoleScript} 
      </head>
      <body>
        ${html}
        <script>
          try {
            ${js}
          } catch (err) {
            console.error(err);
          }
        </script>
      </body>
    </html>
  `;

return (
    // CHANGED: "flex: 1" -> "height: '100%'"
    // This guarantees the preview fills the area above the console.
    <div style={{ height: "100%", borderTop: "1px solid #333", background: "white" }}>
      <iframe
        title="preview"
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-modals"
        style={{ width: "100%", height: "100%", border: "none" }}
      />
    </div>
  );
}