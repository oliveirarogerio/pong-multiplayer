import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to recursively get all files in a directory
function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach((file) => {
    if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, file));
    }
  });

  return arrayOfFiles;
}

// Function to remove console.log statements
function removeConsoleLogs(filePath) {
  try {
    // Read the file
    let content = fs.readFileSync(filePath, "utf8");

    // Skip non-JS/TS files
    if (!filePath.match(/\.(js|ts|vue)$/)) {
      return;
    }

    // Skip node_modules and dist
    if (filePath.includes("node_modules") || filePath.includes("dist")) {
      return;
    }

    // Count original console.log statements
    const originalCount = (content.match(/console\.(log|debug|info)/g) || [])
      .length;

    if (originalCount === 0) {
      return;
    }

    // Replace console.log statements while preserving console.error and console.warn
    const newContent = content
      // Remove console.log statements
      .replace(/^\s*console\.log\([^)]*\);?\s*\n?/gm, "")
      // Remove console.debug statements
      .replace(/^\s*console\.debug\([^)]*\);?\s*\n?/gm, "")
      // Remove console.info statements
      .replace(/^\s*console\.info\([^)]*\);?\s*\n?/gm, "")
      // Handle multi-line console.log statements
      .replace(/^\s*console\.log\(\n[^)]*\n[^)]*\);?\s*\n?/gm, "")
      // Remove empty lines that might be left
      .replace(/\n\s*\n\s*\n/g, "\n\n");

    // Write the file back
    fs.writeFileSync(filePath, newContent);

    // Count remaining console.log statements
    const remainingCount = (
      newContent.match(/console\.(log|debug|info)/g) || []
    ).length;

    if (originalCount !== remainingCount) {
      console.log(
        `Removed ${
          originalCount - remainingCount
        } console statements from ${filePath}`
      );
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

// Get all files in the src directory
const srcPath = path.join(process.cwd(), "src");
const files = getAllFiles(srcPath);

// Process each file
files.forEach(removeConsoleLogs);

console.log("Finished removing console.log statements");
