const fs = require('fs');
const path = require('path');

// Find all JS files in src directory
function findJSFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !filePath.includes('node_modules')) {
      findJSFiles(filePath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Add selectable={true} to Text components
function addSelectableToText(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Pattern to match <Text ...> but not already having selectable
  // Match <Text with various attributes but not selectable
  const textPattern = /<Text\s+([^>]*?)(?<!selectable)([^>]*?)>/g;
  
  // More specific: find Text components that don't have selectable prop
  const lines = content.split('\n');
  const newLines = lines.map((line, index) => {
    // Skip if already has selectable
    if (line.includes('selectable=')) {
      return line;
    }
    
    // Match <Text with style or other props
    if (line.match(/<Text\s+[^>]*style[^>]*>/)) {
      // Add selectable={true} before the closing >
      const newLine = line.replace(/(<Text\s+[^>]*)(>)/, '$1 selectable={true}$2');
      if (newLine !== line) {
        modified = true;
        return newLine;
      }
    }
    
    // Match simple <Text> or <Text with just className
    if (line.match(/<Text\s*>/)) {
      const newLine = line.replace(/<Text\s*>/, '<Text selectable={true}>');
      if (newLine !== line) {
        modified = true;
        return newLine;
      }
    }
    
    return line;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
    console.log(`✓ Updated: ${filePath}`);
    return true;
  }
  
  return false;
}

// Main execution
const srcDir = path.join(__dirname, '..', 'src');
const files = findJSFiles(srcDir);

console.log(`Found ${files.length} JS files to process...\n`);

let updatedCount = 0;
files.forEach(file => {
  if (addSelectableToText(file)) {
    updatedCount++;
  }
});

console.log(`\n✓ Updated ${updatedCount} files with selectable={true} on Text components`);

