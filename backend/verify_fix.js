// using native fetch

const test = async () => {
    try {
        const response = await fetch("http://localhost:5000/api/code/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                language: "cpp",
                code: "#include <iostream>\nint main() { std::cout << \"Hello World\"; return 0; }",
                stdin: ""
            })
        });
        const data = await response.json();
        console.log("RESPONSE:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("ERROR:", e);
    }
};

test();
