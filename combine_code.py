import os

# --- CONFIGURATION ---
# The name of the output file
OUTPUT_FILE = "full_project_code.txt"

# Folders to completely ignore
IGNORE_DIRS = {
    'node_modules', '.git', '.idea', '.vscode', 'target', 'build', 
    'dist', 'bin', 'obj', '__pycache__', '.mvn', 'gradle'
}

# Files to ignore
IGNORE_FILES = {
    'package-lock.json', 'yarn.lock', 'mvnw', 'mvnw.cmd', 'gradlew', 
    'gradlew.bat', '.gitignore', '.DS_Store', 'combine_code.py', OUTPUT_FILE
}

# Only include files with these extensions (add more if needed)
# Added .cpp and .h since you do competitive programming/C++ logic
VALID_EXTENSIONS = {
    '.java', '.xml', '.properties',       # Spring Boot / Backend
    '.js', '.jsx', '.ts', '.tsx', '.css', # React / Frontend
    '.html', '.json',                     # Config / Web
    '.cpp', '.c', '.h', '.hpp'            # C++ Native stuff
}

def is_text_file(filename):
    return any(filename.endswith(ext) for ext in VALID_EXTENSIONS)

def main():
    root_dir = os.getcwd() # Get current folder
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as outfile:
        print(f"Scanning directory: {root_dir}")
        print("--------------------------------------------------")
        
        for dirpath, dirnames, filenames in os.walk(root_dir):
            # Modify dirnames in-place to skip ignored directories
            dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
            
            for filename in filenames:
                if filename in IGNORE_FILES:
                    continue
                
                if not is_text_file(filename):
                    continue
                
                filepath = os.path.join(dirpath, filename)
                # Create a relative path for cleaner reading
                relative_path = os.path.relpath(filepath, root_dir)
                
                try:
                    with open(filepath, "r", encoding="utf-8") as infile:
                        content = infile.read()
                        
                        # Write the file header and content
                        outfile.write(f"\n{'='*50}\n")
                        outfile.write(f"FILE: {relative_path}\n")
                        outfile.write(f"{'='*50}\n")
                        outfile.write(content + "\n")
                        
                        print(f"Added: {relative_path}")
                except Exception as e:
                    print(f"Skipping file due to error: {relative_path} ({e})")

    print("--------------------------------------------------")
    print(f"Done! All code saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()