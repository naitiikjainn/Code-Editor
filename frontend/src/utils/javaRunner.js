/**
 * Generates a Java main method and helper parsers to run LeetCode solutions locally.
 * Similar to cppRunner.js but for Java.
 * @param {string} userCode - The user's current code (containing class Solution).
 * @param {object} problem - The problem object containing snippets/metadata.
 * @returns {string} - The full Java code with injected runner.
 */
export function generateJavaRunner(userCode, problem) {
    if (!problem || !problem.snippets) {
        console.warn("[JavaRunner] No snippets available, cannot generate runner");
        return userCode;
    }

    const snippet = problem.snippets.find(s => s.langSlug === "java");
    if (!snippet) {
        console.warn("[JavaRunner] No Java snippet found");
        return userCode;
    }

    // 1. Extract Function Signature from snippet
    const code = snippet.code;

    // Regex to find: public returnType methodName(type1 arg1, type2 arg2, ...)
    const signatureRegex = /public\s+([a-zA-Z0-9_<>,\[\]\s]+)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/m;
    const match = code.match(signatureRegex);

    if (!match) {
        console.warn("[JavaRunner] Could not parse function signature from:", code);
        return userCode + "\n\n// Could not auto-generate runner: Signature not found.";
    }

    const returnType = match[1].trim();
    const methodName = match[2].trim();
    const argsStr = match[3].trim();

    console.log(`[JavaRunner] Detected: ${returnType} ${methodName}(${argsStr})`);

    // Parse Args
    const args = [];
    if (argsStr) {
        let depth = 0;
        let lastSplit = 0;

        for (let i = 0; i < argsStr.length; i++) {
            if (argsStr[i] === '<' || argsStr[i] === '[') depth++;
            if (argsStr[i] === '>' || argsStr[i] === ']') depth--;
            if (argsStr[i] === ',' && depth === 0) {
                const part = argsStr.substring(lastSplit, i).trim();
                const parsed = parseJavaArgument(part);
                if (parsed) args.push(parsed);
                lastSplit = i + 1;
            }
        }
        // Last arg
        const part = argsStr.substring(lastSplit).trim();
        const parsed = parseJavaArgument(part);
        if (parsed) args.push(parsed);
    }

    // 2. Build the complete runner code - wrap Solution class
    const imports = generateJavaImports();
    const helpers = generateJavaHelpers();
    const mainMethod = generateJavaMain(args, methodName, returnType);

    // 3. Inject main method into Solution class
    // Find where Solution class ends (last closing brace)
    let modifiedCode = userCode;

    // Find the last } of the Solution class
    const lastBrace = modifiedCode.lastIndexOf('}');
    if (lastBrace !== -1) {
        // Insert main method before the last closing brace
        modifiedCode = modifiedCode.slice(0, lastBrace) + '\n' + mainMethod + '\n' + modifiedCode.slice(lastBrace);
    }

    // Always add imports at the very top, before everything else
    // First, strip any existing imports to avoid duplicates
    let finalCode = modifiedCode;

    // Build final code with imports at top
    return `${imports}

${finalCode}

// ============ AUTO-GENERATED LEETCODE RUNNER HELPERS ============
${helpers}
// ============ END AUTO-GENERATED RUNNER ============
`;
}

/**
 * Parse a single Java argument like "int[] nums" into { type, name }
 */
function parseJavaArgument(part) {
    const trimmed = part.trim();

    // Find the last space that's not inside <> or []
    let depth = 0;
    let lastValidSpace = -1;
    for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '<' || trimmed[i] === '[') depth++;
        if (trimmed[i] === '>' || trimmed[i] === ']') depth--;
        if (trimmed[i] === ' ' && depth === 0) {
            lastValidSpace = i;
        }
    }

    if (lastValidSpace === -1) return null;

    return {
        type: trimmed.substring(0, lastValidSpace).trim(),
        name: trimmed.substring(lastValidSpace + 1).trim()
    };
}

/**
 * Generate Java imports
 */
function generateJavaImports() {
    return `import java.util.*;`;
}

/**
 * Generate Java helper class for parsing
 */
function generateJavaHelpers() {
    return `
class LeetCodeParser {
    public static int[] parseIntArray(String input) {
        input = input.trim();
        if (input.equals("[]") || input.isEmpty()) return new int[0];
        if (input.startsWith("[")) input = input.substring(1);
        if (input.endsWith("]")) input = input.substring(0, input.length() - 1);
        if (input.isEmpty()) return new int[0];
        String[] parts = input.split(",");
        int[] result = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            result[i] = Integer.parseInt(parts[i].trim());
        }
        return result;
    }
    
    public static long[] parseLongArray(String input) {
        input = input.trim();
        if (input.equals("[]") || input.isEmpty()) return new long[0];
        if (input.startsWith("[")) input = input.substring(1);
        if (input.endsWith("]")) input = input.substring(0, input.length() - 1);
        if (input.isEmpty()) return new long[0];
        String[] parts = input.split(",");
        long[] result = new long[parts.length];
        for (int i = 0; i < parts.length; i++) {
            result[i] = Long.parseLong(parts[i].trim());
        }
        return result;
    }
    
    public static double[] parseDoubleArray(String input) {
        input = input.trim();
        if (input.equals("[]") || input.isEmpty()) return new double[0];
        if (input.startsWith("[")) input = input.substring(1);
        if (input.endsWith("]")) input = input.substring(0, input.length() - 1);
        if (input.isEmpty()) return new double[0];
        String[] parts = input.split(",");
        double[] result = new double[parts.length];
        for (int i = 0; i < parts.length; i++) {
            result[i] = Double.parseDouble(parts[i].trim());
        }
        return result;
    }
    
    public static int[][] parse2DIntArray(String input) {
        input = input.trim();
        if (input.equals("[]") || input.equals("[[]]") || input.isEmpty()) return new int[0][0];
        // Remove outer brackets
        if (input.startsWith("[")) input = input.substring(1);
        if (input.endsWith("]")) input = input.substring(0, input.length() - 1);
        
        List<int[]> rows = new ArrayList<>();
        int depth = 0;
        int start = 0;
        for (int i = 0; i < input.length(); i++) {
            if (input.charAt(i) == '[') {
                if (depth == 0) start = i;
                depth++;
            } else if (input.charAt(i) == ']') {
                depth--;
                if (depth == 0) {
                    rows.add(parseIntArray(input.substring(start, i + 1)));
                }
            }
        }
        return rows.toArray(new int[0][]);
    }
    
    public static List<Integer> parseIntegerList(String input) {
        int[] arr = parseIntArray(input);
        List<Integer> list = new ArrayList<>();
        for (int x : arr) list.add(x);
        return list;
    }
    
    public static List<List<Integer>> parse2DIntegerList(String input) {
        int[][] arr = parse2DIntArray(input);
        List<List<Integer>> result = new ArrayList<>();
        for (int[] row : arr) {
            List<Integer> list = new ArrayList<>();
            for (int x : row) list.add(x);
            result.add(list);
        }
        return result;
    }
    
    public static String parseString(String input) {
        input = input.trim();
        if (input.startsWith("\\"")) input = input.substring(1);
        if (input.endsWith("\\"")) input = input.substring(0, input.length() - 1);
        return input;
    }
    
    public static String[] parseStringArray(String input) {
        input = input.trim();
        if (input.equals("[]") || input.isEmpty()) return new String[0];
        if (input.startsWith("[")) input = input.substring(1);
        if (input.endsWith("]")) input = input.substring(0, input.length() - 1);
        
        List<String> result = new ArrayList<>();
        boolean inString = false;
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);
            if (c == '"' && (i == 0 || input.charAt(i-1) != '\\\\')) {
                if (inString) {
                    result.add(current.toString());
                    current = new StringBuilder();
                }
                inString = !inString;
            } else if (inString) {
                current.append(c);
            }
        }
        return result.toArray(new String[0]);
    }
    
    public static List<String> parseStringList(String input) {
        return Arrays.asList(parseStringArray(input));
    }
    
    public static char parseChar(String input) {
        input = input.trim();
        if (input.startsWith("\\"") || input.startsWith("'")) input = input.substring(1);
        if (input.endsWith("\\"") || input.endsWith("'")) input = input.substring(0, input.length() - 1);
        return input.isEmpty() ? ' ' : input.charAt(0);
    }
    
    public static char[][] parse2DCharArray(String input) {
        input = input.trim();
        if (input.equals("[]") || input.isEmpty()) return new char[0][0];
        if (input.startsWith("[")) input = input.substring(1);
        if (input.endsWith("]")) input = input.substring(0, input.length() - 1);
        
        List<char[]> rows = new ArrayList<>();
        int depth = 0;
        int start = 0;
        for (int i = 0; i < input.length(); i++) {
            if (input.charAt(i) == '[') {
                if (depth == 0) start = i;
                depth++;
            } else if (input.charAt(i) == ']') {
                depth--;
                if (depth == 0) {
                    String inner = input.substring(start + 1, i);
                    List<Character> chars = new ArrayList<>();
                    for (int j = 0; j < inner.length(); j++) {
                        char c = inner.charAt(j);
                        if (c == '"' || c == '\\'') {
                            if (j + 1 < inner.length()) {
                                chars.add(inner.charAt(j + 1));
                                j += 2;
                            }
                        }
                    }
                    char[] row = new char[chars.size()];
                    for (int k = 0; k < chars.size(); k++) row[k] = chars.get(k);
                    rows.add(row);
                }
            }
        }
        return rows.toArray(new char[0][]);
    }
    
    // Output helpers
    public static String formatIntArray(int[] arr) {
        if (arr == null || arr.length == 0) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            sb.append(arr[i]);
            if (i < arr.length - 1) sb.append(",");
        }
        sb.append("]");
        return sb.toString();
    }
    
    public static String formatList(List<?> list) {
        if (list == null || list.isEmpty()) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            Object obj = list.get(i);
            if (obj instanceof List) {
                sb.append(formatList((List<?>)obj));
            } else if (obj instanceof int[]) {
                sb.append(formatIntArray((int[])obj));
            } else if (obj instanceof String) {
                sb.append("\\"").append(obj).append("\\"");
            } else {
                sb.append(obj);
            }
            if (i < list.size() - 1) sb.append(",");
        }
        sb.append("]");
        return sb.toString();
    }
    
    public static String format2DIntArray(int[][] arr) {
        if (arr == null || arr.length == 0) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            sb.append(formatIntArray(arr[i]));
            if (i < arr.length - 1) sb.append(",");
        }
        sb.append("]");
        return sb.toString();
    }
}
`;
}

/**
 * Generate the main method that reads input and calls Solution
 */
function generateJavaMain(args, methodName, returnType) {
    let mainBody = `
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        Solution sol = new Solution();
`;

    // Read and parse each argument
    args.forEach((arg, i) => {
        const varName = `arg${i}`;
        const parser = getJavaParser(arg.type);

        mainBody += `
        // Read ${arg.name} (${arg.type})
        String line${i} = sc.nextLine();
        ${arg.type} ${varName} = ${parser.replace('INPUT', `line${i}`)};
`;
    });

    // Call the method
    const callArgs = args.map((_, i) => `arg${i}`).join(", ");

    // Handle return type for output
    const cleanReturnType = returnType.replace(/\s+/g, '');

    if (cleanReturnType === "void") {
        mainBody += `
        sol.${methodName}(${callArgs});
        System.out.println("done");
`;
    } else if (cleanReturnType === "boolean") {
        mainBody += `
        boolean result = sol.${methodName}(${callArgs});
        System.out.println(result);
`;
    } else if (cleanReturnType === "int" || cleanReturnType === "long" || cleanReturnType === "double" || cleanReturnType === "float") {
        mainBody += `
        ${cleanReturnType} result = sol.${methodName}(${callArgs});
        System.out.println(result);
`;
    } else if (cleanReturnType === "String") {
        mainBody += `
        String result = sol.${methodName}(${callArgs});
        System.out.println("\\"" + result + "\\"");
`;
    } else if (cleanReturnType === "int[]") {
        mainBody += `
        int[] result = sol.${methodName}(${callArgs});
        System.out.println(LeetCodeParser.formatIntArray(result));
`;
    } else if (cleanReturnType === "int[][]") {
        mainBody += `
        int[][] result = sol.${methodName}(${callArgs});
        System.out.println(LeetCodeParser.format2DIntArray(result));
`;
    } else if (cleanReturnType.startsWith("List")) {
        mainBody += `
        ${cleanReturnType} result = sol.${methodName}(${callArgs});
        System.out.println(LeetCodeParser.formatList(result));
`;
    } else {
        mainBody += `
        ${cleanReturnType} result = sol.${methodName}(${callArgs});
        System.out.println(result);
`;
    }

    mainBody += `
        sc.close();
    }`;

    return mainBody;
}

/**
 * Get the parser function call for a given Java type
 */
function getJavaParser(type) {
    // Clean up the type
    const cleanType = type.replace(/\s+/g, ' ').trim();

    if (cleanType === "int[]") return "LeetCodeParser.parseIntArray(INPUT)";
    if (cleanType === "long[]") return "LeetCodeParser.parseLongArray(INPUT)";
    if (cleanType === "double[]") return "LeetCodeParser.parseDoubleArray(INPUT)";
    if (cleanType === "int[][]") return "LeetCodeParser.parse2DIntArray(INPUT)";
    if (cleanType === "char[][]") return "LeetCodeParser.parse2DCharArray(INPUT)";
    if (cleanType === "String[]") return "LeetCodeParser.parseStringArray(INPUT)";
    if (cleanType === "String") return "LeetCodeParser.parseString(INPUT)";
    if (cleanType === "int") return "Integer.parseInt(INPUT.trim())";
    if (cleanType === "long") return "Long.parseLong(INPUT.trim())";
    if (cleanType === "double") return "Double.parseDouble(INPUT.trim())";
    if (cleanType === "boolean") return "Boolean.parseBoolean(INPUT.trim())";
    if (cleanType === "char") return "LeetCodeParser.parseChar(INPUT)";
    if (cleanType === "List<Integer>") return "LeetCodeParser.parseIntegerList(INPUT)";
    if (cleanType === "List<List<Integer>>") return "LeetCodeParser.parse2DIntegerList(INPUT)";
    if (cleanType === "List<String>") return "LeetCodeParser.parseStringList(INPUT)";

    // Fallback
    console.warn(`[JavaRunner] Unknown type: ${type}, using raw line`);
    return `/* TODO: Parse ${type} */ INPUT`;
}
