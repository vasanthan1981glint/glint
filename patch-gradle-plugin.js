// save this as patch-gradle-plugin.js in your project root

const fs = require('fs');
const path = require('path');

const pluginDir = path.join(__dirname, 'node_modules', '@react-native', 'gradle-plugin');

function patchFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  const fixedContent = content.replace(
    /allWarningsAsErrors\s*=\s*project\.properties\["enableWarningsAsErrors"\]\?\s*\.toString\(\)\?\.\s*toBoolean\(\)\s*\?\:\s*false/,
    `allWarningsAsErrors.set(
        project.properties["enableWarningsAsErrors"]?.toString()?.toBoolean() ?: false
    )`
  );

  if (content !== fixedContent) {
    fs.writeFileSync(filePath, fixedContent, 'utf8');
    console.log(`Patched: ${filePath}`);
  } else {
    console.log(`No changes needed: ${filePath}`);
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile() && entry.name === 'build.gradle.kts') {
      patchFile(fullPath);
    }
  }
}

walkDir(pluginDir);
console.log('Patch completed!');
