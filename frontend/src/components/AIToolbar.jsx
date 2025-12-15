export default function AIToolbar({ onAI }) {
  return (
    <div style={bar}>
      <button onClick={() => onAI("explain")}>Explain</button>
      <button onClick={() => onAI("fix")}>Fix</button>
      <button onClick={() => onAI("optimize")}>Optimize</button>
      <button onClick={() => onAI("generate")}>Generate</button>
    </div>
  );
}

const bar = {
  background: "#111827",
  padding: "8px",
  display: "flex",
  gap: "10px",
};
