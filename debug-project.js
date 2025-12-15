import fs from 'fs';
import path from 'path';

// IGNORE these folders/files so the output isn't too huge
const IGNORE = ['.git', 'node_modules', 'dist', 'build', 'package-lock.json', '.env', 'assets'];
const EXTENSIONS = ['.js', '.jsx', '.css', '.json', '.html'];

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (IGNORE.includes(file)) return;
    
    const fullPath = path.join(dirPath, file);
    
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      // Only include specific code extensions
      if (EXTENSIONS.includes(path.extname(file))) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

// Run the dumper
console.log("--- START OF PROJECT DUMP ---");

['frontend', 'backend'].forEach(folder => {
    try {
        const folderPath = path.join(process.cwd(), folder);
        if (fs.existsSync(folderPath)) {
            const files = getAllFiles(folderPath);
            files.forEach(filePath => {
                const relativePath = path.relative(process.cwd(), filePath);
                const content = fs.readFileSync(filePath, 'utf8');
                console.log(`\n\n================================================================`);
                console.log(`FILE: ${relativePath}`);
                console.log(`================================================================`);
                console.log(content);
            });
        }
    } catch (e) {
        console.error(`Could not read ${folder}:`, e.message);
    }
});

console.log("\n--- END OF PROJECT DUMP ---");