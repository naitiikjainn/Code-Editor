/**
 * Generates a C++ main function and helper parsers to run LeetCode solutions locally.
 * @param {string} userCode - The user's current code (containing class Solution).
 * @param {object} problem - The problem object containing snippets/metadata.
 * @returns {string} - The full C++ code with injected runner.
 */
export function generateCppRunner(userCode, problem) {
    if (!problem || !problem.snippets) {
        console.warn("[CppRunner] No snippets available, cannot generate runner");
        return userCode;
    }

    const snippet = problem.snippets.find(s => s.langSlug === "cpp");
    if (!snippet) {
        console.warn("[CppRunner] No C++ snippet found");
        return userCode;
    }

    // 1. Extract Function Signature from snippet
    const code = snippet.code;

    // Regex to find: returnType methodName(type1 arg1, type2 arg2, ...)
    // Standard LeetCode signature looks like: 
    // "    vector<int> twoSum(vector<int>& nums, int target) {"
    const signatureRegex = /^\s*([a-zA-Z0-9_<>,:\s*]+)\s+([a-zA-Z0-9_]+)\s*\((.*)\)\s*\{/m;
    const match = code.match(signatureRegex);

    if (!match) {
        console.warn("[CppRunner] Could not parse function signature from:", code);
        return userCode + "\n\n// Could not auto-generate runner: Signature not found.";
    }

    const returnType = match[1].trim();
    const methodName = match[2].trim();
    const argsStr = match[3].trim();

    console.log(`[CppRunner] Detected: ${returnType} ${methodName}(${argsStr})`);

    // Parse Args - handle nested templates like vector<vector<int>>
    const args = [];
    if (argsStr) {
        let depth = 0;
        let lastSplit = 0;

        for (let i = 0; i < argsStr.length; i++) {
            if (argsStr[i] === '<') depth++;
            if (argsStr[i] === '>') depth--;
            if (argsStr[i] === ',' && depth === 0) {
                const part = argsStr.substring(lastSplit, i).trim();
                const parsed = parseArgument(part);
                if (parsed) args.push(parsed);
                lastSplit = i + 1;
            }
        }
        // Last arg
        const part = argsStr.substring(lastSplit).trim();
        const parsed = parseArgument(part);
        if (parsed) args.push(parsed);
    }

    // 2. Build the complete runner code
    const helpers = generateHelpers();
    const mainBody = generateMain(args, methodName, returnType);

    // 3. Combine - ensure we have necessary headers
    let finalCode = userCode;
    
    // Add headers if not present
    if (!finalCode.includes("<sstream>")) {
        finalCode = "#include <sstream>\n" + finalCode;
    }
    if (!finalCode.includes("<algorithm>")) {
        finalCode = "#include <algorithm>\n" + finalCode;
    }
    // Ensure using namespace std is present
    if (!finalCode.includes("using namespace std")) {
        // Add after the last #include
        const lastInclude = finalCode.lastIndexOf("#include");
        const endOfLine = finalCode.indexOf("\n", lastInclude);
        if (endOfLine !== -1) {
            finalCode = finalCode.slice(0, endOfLine + 1) + "using namespace std;\n" + finalCode.slice(endOfLine + 1);
        } else {
            finalCode = finalCode + "\nusing namespace std;\n";
        }
    }

    return `${finalCode}

// ============ AUTO-GENERATED LEETCODE RUNNER ============
${helpers}

${mainBody}
// ============ END AUTO-GENERATED RUNNER ============
`;
}

/**
 * Parse a single argument like "vector<int>& nums" into { type, name }
 */
function parseArgument(part) {
    // Remove reference & and const
    let cleanPart = part.replace(/\s*&\s*/g, ' ').replace(/const\s+/g, '').trim();
    
    // Find the last space that's not inside <>
    let depth = 0;
    let lastValidSpace = -1;
    for (let i = 0; i < cleanPart.length; i++) {
        if (cleanPart[i] === '<') depth++;
        if (cleanPart[i] === '>') depth--;
        if (cleanPart[i] === ' ' && depth === 0) {
            lastValidSpace = i;
        }
    }
    
    if (lastValidSpace === -1) return null;
    
    return {
        type: cleanPart.substring(0, lastValidSpace).trim(),
        name: cleanPart.substring(lastValidSpace + 1).trim()
    };
}

/**
 * Generate all helper functions for parsing LeetCode input formats
 */
function generateHelpers() {
    return `
// --- LeetCode Input Parsers ---
void ltrim(string &s) {
    s.erase(s.begin(), find_if(s.begin(), s.end(), [](unsigned char ch) { return !isspace(ch); }));
}
void rtrim(string &s) {
    s.erase(find_if(s.rbegin(), s.rend(), [](unsigned char ch) { return !isspace(ch); }).base(), s.end());
}
void trim(string &s) { ltrim(s); rtrim(s); }

vector<int> parseVectorInt(string input) {
    vector<int> result;
    trim(input);
    if (input.empty() || input == "[]") return result;
    if (input.front() == '[') input = input.substr(1);
    if (input.back() == ']') input.pop_back();
    stringstream ss(input);
    string item;
    while (getline(ss, item, ',')) {
        trim(item);
        if (!item.empty()) result.push_back(stoi(item));
    }
    return result;
}

vector<long long> parseVectorLong(string input) {
    vector<long long> result;
    trim(input);
    if (input.empty() || input == "[]") return result;
    if (input.front() == '[') input = input.substr(1);
    if (input.back() == ']') input.pop_back();
    stringstream ss(input);
    string item;
    while (getline(ss, item, ',')) {
        trim(item);
        if (!item.empty()) result.push_back(stoll(item));
    }
    return result;
}

vector<double> parseVectorDouble(string input) {
    vector<double> result;
    trim(input);
    if (input.empty() || input == "[]") return result;
    if (input.front() == '[') input = input.substr(1);
    if (input.back() == ']') input.pop_back();
    stringstream ss(input);
    string item;
    while (getline(ss, item, ',')) {
        trim(item);
        if (!item.empty()) result.push_back(stod(item));
    }
    return result;
}

vector<vector<int>> parseVectorVectorInt(string input) {
    vector<vector<int>> result;
    trim(input);
    if (input.empty() || input == "[]" || input == "[[]]") return result;
    // Remove outer brackets
    if (input.front() == '[') input = input.substr(1);
    if (input.back() == ']') input.pop_back();
    
    int depth = 0;
    int start = 0;
    for (size_t i = 0; i < input.size(); i++) {
        if (input[i] == '[') {
            if (depth == 0) start = i;
            depth++;
        } else if (input[i] == ']') {
            depth--;
            if (depth == 0) {
                string inner = input.substr(start, i - start + 1);
                result.push_back(parseVectorInt(inner));
            }
        }
    }
    return result;
}

vector<vector<char>> parseVectorVectorChar(string input) {
    vector<vector<char>> result;
    trim(input);
    if (input.empty() || input == "[]") return result;
    if (input.front() == '[') input = input.substr(1);
    if (input.back() == ']') input.pop_back();
    
    int depth = 0;
    int start = 0;
    for (size_t i = 0; i < input.size(); i++) {
        if (input[i] == '[') {
            if (depth == 0) start = i;
            depth++;
        } else if (input[i] == ']') {
            depth--;
            if (depth == 0) {
                string inner = input.substr(start + 1, i - start - 1);
                vector<char> row;
                for (size_t j = 0; j < inner.size(); j++) {
                    if (inner[j] == '"' || inner[j] == '\\'') {
                        if (j + 1 < inner.size()) {
                            row.push_back(inner[j + 1]);
                            j += 2;
                        }
                    }
                }
                result.push_back(row);
            }
        }
    }
    return result;
}

vector<string> parseVectorString(string input) {
    vector<string> result;
    trim(input);
    if (input.empty() || input == "[]") return result;
    if (input.front() == '[') input = input.substr(1);
    if (input.back() == ']') input.pop_back();
    
    bool inString = false;
    string current = "";
    for (size_t i = 0; i < input.size(); i++) {
        if (input[i] == '"' && (i == 0 || input[i-1] != '\\\\')) {
            if (inString) {
                result.push_back(current);
                current = "";
            }
            inString = !inString;
        } else if (inString) {
            current += input[i];
        }
    }
    return result;
}

string parseString(string input) {
    trim(input);
    if (input.size() >= 2 && input.front() == '"' && input.back() == '"') {
        return input.substr(1, input.size() - 2);
    }
    return input;
}

int parseInt(string input) {
    trim(input);
    return stoi(input);
}

long long parseLong(string input) {
    trim(input);
    return stoll(input);
}

double parseDouble(string input) {
    trim(input);
    return stod(input);
}

bool parseBool(string input) {
    trim(input);
    return input == "true" || input == "1";
}

char parseChar(string input) {
    trim(input);
    if (input.size() >= 3 && (input.front() == '"' || input.front() == '\\'')) {
        return input[1];
    }
    return input.empty() ? ' ' : input[0];
}

// --- Output Printers ---
template<typename T>
ostream& operator<<(ostream& os, const vector<T>& v) {
    os << "[";
    for (size_t i = 0; i < v.size(); ++i) {
        os << v[i];
        if (i != v.size() - 1) os << ",";
    }
    os << "]";
    return os;
}

// Special printer for vector<string>
void printVectorString(const vector<string>& v) {
    cout << "[";
    for (size_t i = 0; i < v.size(); ++i) {
        cout << "\\"" << v[i] << "\\"";
        if (i != v.size() - 1) cout << ",";
    }
    cout << "]" << endl;
}

void printBool(bool b) {
    cout << (b ? "true" : "false") << endl;
}

void printString(const string& s) {
    cout << "\\"" << s << "\\"" << endl;
}
`;
}

/**
 * Generate the main function that reads input and calls Solution
 */
function generateMain(args, methodName, returnType) {
    let mainBody = `
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    Solution sol;
    string line;
`;

    // Read and parse each argument
    args.forEach((arg, i) => {
        const varName = `arg${i}`;
        const parser = getParser(arg.type);
        
        mainBody += `
    // Read ${arg.name} (${arg.type})
    if (!getline(cin, line)) { cerr << "Missing input for ${arg.name}" << endl; return 1; }
    ${arg.type} ${varName} = ${parser};
`;
    });

    // Call the method
    const callArgs = args.map((_, i) => `arg${i}`).join(", ");
    
    // Handle return type for output
    const cleanReturnType = returnType.replace(/\s+/g, '');
    
    if (cleanReturnType === "void") {
        mainBody += `
    sol.${methodName}(${callArgs});
    // Void return - print modified input if applicable
    cout << "done" << endl;
`;
    } else if (cleanReturnType === "bool") {
        mainBody += `
    bool result = sol.${methodName}(${callArgs});
    printBool(result);
`;
    } else if (cleanReturnType === "string") {
        mainBody += `
    string result = sol.${methodName}(${callArgs});
    printString(result);
`;
    } else if (cleanReturnType === "vector<string>") {
        mainBody += `
    vector<string> result = sol.${methodName}(${callArgs});
    printVectorString(result);
`;
    } else {
        mainBody += `
    auto result = sol.${methodName}(${callArgs});
    cout << result << endl;
`;
    }

    mainBody += `
    return 0;
}`;

    return mainBody;
}

/**
 * Get the parser function call for a given C++ type
 */
function getParser(type) {
    // Clean up the type - remove spaces around < >
    const cleanType = type.replace(/\s*<\s*/g, '<').replace(/\s*>\s*/g, '>').replace(/\s+/g, ' ').trim();
    
    if (cleanType === "vector<int>") return "parseVectorInt(line)";
    if (cleanType === "vector<long>" || cleanType === "vector<long long>") return "parseVectorLong(line)";
    if (cleanType === "vector<double>" || cleanType === "vector<float>") return "parseVectorDouble(line)";
    if (cleanType === "vector<vector<int>>") return "parseVectorVectorInt(line)";
    if (cleanType === "vector<vector<char>>") return "parseVectorVectorChar(line)";
    if (cleanType === "vector<string>") return "parseVectorString(line)";
    if (cleanType === "string") return "parseString(line)";
    if (cleanType === "int") return "parseInt(line)";
    if (cleanType === "long" || cleanType === "long long") return "parseLong(line)";
    if (cleanType === "double" || cleanType === "float") return "parseDouble(line)";
    if (cleanType === "bool") return "parseBool(line)";
    if (cleanType === "char") return "parseChar(line)";
    
    // Fallback - try to parse as the raw line
    console.warn(`[CppRunner] Unknown type: ${type}, using raw line`);
    return `/* TODO: Parse ${type} */ line`;
}

/**
 * Convert LeetCode example test cases to runnable input format
 * LeetCode format: "[2,7,11,15]\n9" (one value per line)
 * Our format: same, but we need to handle it in the runner
 */
export function formatLeetCodeTestCase(exampleBlock) {
    // LeetCode examples are already line-separated
    // Just clean up and return
    return exampleBlock.trim();
}
