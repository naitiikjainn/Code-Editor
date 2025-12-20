
/**
 * Generates a C++ main function and helper parsers to run LeetCode solutions locally.
 * @param {string} userCode - The user's current code (containing class Solution).
 * @param {object} problem - The problem object containing snippets/metadata.
 * @returns {string} - The full C++ code with injected runner.
 */
export function generateCppRunner(userCode, problem) {
    if (!problem || !problem.snippets) return userCode;

    const snippet = problem.snippets.find(s => s.langSlug === "cpp");
    if (!snippet) return userCode;

    // 1. Extract Function Signature
    // Heuristic: finding the function inside "class Solution"
    // We can also parse the snippet directly since it usually contains the method signature.
    const code = snippet.code;

    // Regex to find: returnType methodName(type1 arg1, type2 arg2, ...)
    // Standard LeetCode signature looks like: 
    // "    vector<int> twoSum(vector<int>& nums, int target) {"
    const signatureRegex = /([a-zA-Z0-9_<>:*\s]+)\s+([a-zA-Z0-9_]+)\((.*)\)/;
    const match = code.match(signatureRegex);

    if (!match) return userCode + "\n\n// Could not auto-generate runner: Signature not found.";

    const returnType = match[1].trim();
    const methodName = match[2].trim();
    const argsStr = match[3].trim();

    // Parse Args
    const args = [];
    if (argsStr) {
        let currentType = "";
        let depth = 0;
        let lastSplit = 0;

        for (let i = 0; i < argsStr.length; i++) {
            if (argsStr[i] === '<') depth++;
            if (argsStr[i] === '>') depth--;
            if (argsStr[i] === ',' && depth === 0) {
                const part = argsStr.substring(lastSplit, i).trim();
                const lastSpace = part.lastIndexOf(" ");
                args.push({
                    type: part.substring(0, lastSpace).trim().replace(/[&]/g, ""), // Remove reference &
                    name: part.substring(lastSpace + 1).trim()
                });
                lastSplit = i + 1;
            }
        }
        // Last arg
        const part = argsStr.substring(lastSplit).trim();
        const lastSpace = part.lastIndexOf(" ");
        args.push({
            type: part.substring(0, lastSpace).trim().replace(/[&]/g, ""),
            name: part.substring(lastSpace + 1).trim()
        });
    }

    // 2. Build Helper Functions (Parsers)
    // We need standard LeetCode helpers like stringToIntegerVector, etc.
    const helpers = `
    
    // --- LeetCode Helpers ---
    void trimLeftTrailingSpaces(string &input) {
        input.erase(input.begin(), find_if(input.begin(), input.end(), [](int ch) {
            return !isspace(ch);
        }));
    }

    void trimRightTrailingSpaces(string &input) {
        input.erase(find_if(input.rbegin(), input.rend(), [](int ch) {
            return !isspace(ch);
        }).base(), input.end());
    }

    vector<int> stringToIntegerVector(string input) {
        vector<int> output;
        trimLeftTrailingSpaces(input);
        trimRightTrailingSpaces(input);
        input = input.substr(1, input.length() - 2);
        stringstream ss;
        ss.str(input);
        string item;
        char delim = ',';
        while (getline(ss, item, delim)) {
            output.push_back(stoi(item));
        }
        return output;
    }

    int stringToInteger(string input) {
        return stoi(input);
    }
    
    string stringToString(string input) {
        // Remove quotes if present, handling "string"
        if (input.size() >= 2 && input.front() == '"' && input.back() == '"') {
             return input.substr(1, input.size() - 2);
        }
        return input;
    }
    
    // Fallback for types not strictly implemented yet (basic support)
    // You would expand this for vector<vector<int>>, ListNode*, TreeNode*, etc.
    `;

    // 3. Build Main Function
    let mainBody = `
    Solution sol;
    string line;
    `;

    // Read lines for arguments
    args.forEach((arg, i) => {
        // Map C++ type to Helper
        let parser = "";
        let varName = `arg${i}`;

        if (arg.type.includes("vector<int>")) {
            parser = `stringToIntegerVector(line)`;
        } else if (arg.type === "int") {
            parser = `stringToInteger(line)`;
        } else if (arg.type === "string") {
            parser = `stringToString(line)`;
        } else {
            // Fallback: try to just assume it's parseable or handle simple types
            if (arg.type === "double" || arg.type === "float") parser = "stod(line)";
            else if (arg.type === "long") parser = "stol(line)";
            else if (arg.type === "bool") parser = "(line == \"true\" || line == \"1\")";
            else parser = `/* Type ${arg.type} not fully supported in auto-runner yet */ line`;
            // This will likely fail compile if type mismatch, but better than nothing.
        }

        // Logic to read line and parse
        mainBody += `
    if (!getline(cin, line)) return 0;
    trimLeftTrailingSpaces(line);
    trimRightTrailingSpaces(line);
    ${arg.type} ${varName} = ${parser};
        `;
    });

    // Call Method
    const callArgs = args.map((_, i) => `arg${i}`).join(", ");
    mainBody += `
    auto result = sol.${methodName}(${callArgs});
    `;

    // Print Result (Generic Printer)
    // We need a helper to print various types.
    mainBody += `
    // Basic Print
    cout << result << endl;
    return 0;
    `;

    // 4. Combine
    // Need headers if not present? User snippet usually has headers or we add them.
    // We added generic headers in onCodeNow.

    return `${userCode}

#include <sstream>
#include <functional>

${helpers}

// Allow printing vectors
template<typename T>
ostream& operator<<(ostream& os, const vector<T>& v) {
    os << "[";
    for (int i = 0; i < v.size(); ++i) {
        os << v[i];
        if (i != v.size() - 1) os << ",";
    }
    os << "]";
    return os;
}

int main() {
${mainBody}
}
`;
}
