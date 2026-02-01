/**
 * Generates a Python main function and helper parsers to run LeetCode solutions locally.
 * Similar to cppRunner.js and javaRunner.js but for Python.
 * @param {string} userCode - The user's current code (containing class Solution).
 * @param {object} problem - The problem object containing snippets/metadata.
 * @returns {string} - The full Python code with injected runner.
 */
export function generatePythonRunner(userCode, problem) {
    if (!problem || !problem.snippets) {
        console.warn("[PythonRunner] No snippets available, cannot generate runner");
        return userCode;
    }

    const snippet = problem.snippets.find(s => s.langSlug === "python3" || s.langSlug === "python");
    if (!snippet) {
        console.warn("[PythonRunner] No Python snippet found");
        return userCode;
    }

    // 1. Extract Function Signature from snippet
    const code = snippet.code;

    // Regex to find: def methodName(self, arg1: Type1, arg2: Type2, ...) -> ReturnType:
    const signatureRegex = /def\s+(\w+)\s*\(\s*self\s*(?:,\s*(.+?))?\s*\)\s*(?:->\s*(.+?)\s*)?:/m;
    const match = code.match(signatureRegex);

    if (!match) {
        console.warn("[PythonRunner] Could not parse function signature from:", code);
        return userCode + "\n\n# Could not auto-generate runner: Signature not found.";
    }

    const methodName = match[1].trim();
    const argsStr = match[2] ? match[2].trim() : "";
    const returnType = match[3] ? match[3].trim() : "Any";

    console.log(`[PythonRunner] Detected: def ${methodName}(self, ${argsStr}) -> ${returnType}`);

    // Parse Args
    const args = [];
    if (argsStr) {
        // Split by comma, but handle nested types like List[List[int]]
        let depth = 0;
        let lastSplit = 0;

        for (let i = 0; i < argsStr.length; i++) {
            if (argsStr[i] === '[' || argsStr[i] === '(') depth++;
            if (argsStr[i] === ']' || argsStr[i] === ')') depth--;
            if (argsStr[i] === ',' && depth === 0) {
                const part = argsStr.substring(lastSplit, i).trim();
                const parsed = parsePythonArgument(part);
                if (parsed) args.push(parsed);
                lastSplit = i + 1;
            }
        }
        // Last arg
        const part = argsStr.substring(lastSplit).trim();
        const parsed = parsePythonArgument(part);
        if (parsed) args.push(parsed);
    }

    // 2. Generate the runner code
    const runner = generatePythonMain(args, methodName, returnType);

    // 3. Combine - add imports at top if needed
    let finalCode = userCode;

    // Ensure required imports
    if (!finalCode.includes("import sys")) {
        finalCode = "import sys\n" + finalCode;
    }
    if (!finalCode.includes("import json") && !finalCode.includes("from json")) {
        finalCode = "import json\n" + finalCode;
    }
    if (!finalCode.includes("from typing import")) {
        finalCode = "from typing import List, Optional, Tuple, Dict, Set\n" + finalCode;
    }

    return `${finalCode}

# ============ AUTO-GENERATED LEETCODE RUNNER ============
${runner}
# ============ END AUTO-GENERATED RUNNER ============
`;
}

/**
 * Parse a single Python argument like "nums: List[int]" into { name, type }
 */
function parsePythonArgument(part) {
    const trimmed = part.trim();

    // Check if it has type annotation
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
        // No type annotation, just name
        return { name: trimmed, type: "Any" };
    }

    return {
        name: trimmed.substring(0, colonIndex).trim(),
        type: trimmed.substring(colonIndex + 1).trim()
    };
}

/**
 * Generate the main block that reads input and calls Solution
 */
function generatePythonMain(args, methodName, returnType) {
    let mainBody = `
def parse_input(line, type_hint):
    """Parse a single line of input based on type hint."""
    line = line.strip()
    if not line:
        return None
    
    # Handle common LeetCode types
    if type_hint in ['int', 'Int']:
        return int(line)
    elif type_hint in ['float', 'Float']:
        return float(line)
    elif type_hint in ['str', 'String']:
        # Remove quotes if present
        if line.startswith('"') and line.endswith('"'):
            return line[1:-1]
        return line
    elif type_hint in ['bool', 'Bool']:
        return line.lower() == 'true'
    elif 'List[List[' in type_hint or 'list[list[' in type_hint.lower():
        # 2D list - parse as JSON
        return json.loads(line)
    elif 'List[' in type_hint or 'list[' in type_hint.lower():
        # 1D list - parse as JSON
        return json.loads(line)
    elif type_hint.startswith('Optional['):
        inner_type = type_hint[9:-1]  # Extract inner type
        if line.lower() == 'null' or line.lower() == 'none':
            return None
        return parse_input(line, inner_type)
    else:
        # Try JSON parsing for complex types
        try:
            return json.loads(line)
        except:
            return line

def format_output(result, type_hint):
    """Format output to match LeetCode expected format."""
    if result is None:
        return "null"
    elif isinstance(result, bool):
        return "true" if result else "false"
    elif isinstance(result, str):
        return f'"{result}"'
    elif isinstance(result, (list, tuple)):
        return json.dumps(result, separators=(',', ':'))
    else:
        return str(result)

if __name__ == "__main__":
    sol = Solution()
    
    # Read inputs
    inputs = []
    try:
`;

    // Read each argument
    args.forEach((arg, i) => {
        mainBody += `        line${i} = input()
        arg${i} = parse_input(line${i}, "${arg.type}")
        inputs.append(arg${i})
`;
    });

    // Call the method
    const callArgs = args.map((_, i) => `arg${i}`).join(", ");

    // Handle return type for output
    const cleanReturnType = returnType.replace(/\s+/g, '');

    if (cleanReturnType === "None" || cleanReturnType === "void") {
        mainBody += `
        sol.${methodName}(${callArgs})
        print("done")
`;
    } else {
        mainBody += `
        result = sol.${methodName}(${callArgs})
        print(format_output(result, "${returnType}"))
`;
    }

    mainBody += `    except EOFError:
        pass
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
`;

    return mainBody;
}
