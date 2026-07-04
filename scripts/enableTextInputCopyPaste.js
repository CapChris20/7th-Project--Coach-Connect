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

// Add copy/paste props to TextInput components
function addCopyPasteToTextInput(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  const lines = content.split('\n');
  const newLines = lines.map((line, index) => {
    // Skip if already has these props
    if (line.includes('contextMenuHidden=') || line.includes('selectTextOnFocus=')) {
      return line;
    }
    
    // Match <TextInput with various attributes
    if (line.match(/<TextInput\s+[^>]*>/)) {
      // Check if it's a multiline TextInput (we want to enable copy/paste on all)
      // Add props before the closing >
      let newLine = line;
      
      // Add contextMenuHidden={false} if not present
      if (!line.includes('contextMenuHidden')) {
        newLine = newLine.replace(/(<TextInput\s+[^>]*)(>)/, '$1 contextMenuHidden={false}$2');
      }
      
      // Add selectTextOnFocus={false} if not present
      if (!newLine.includes('selectTextOnFocus')) {
        newLine = newLine.replace(/(<TextInput\s+[^>]*)(>)/, '$1 selectTextOnFocus={false}$2');
      }
      
      // Add textContentType="none" if not present (prevents iOS from interfering)
      if (!newLine.includes('textContentType')) {
        newLine = newLine.replace(/(<TextInput\s+[^>]*)(>)/, '$1 textContentType="none"$2');
      }
      
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
  if (addCopyPasteToTextInput(file)) {
    updatedCount++;
  }
});

console.log(`\n✓ Updated ${updatedCount} files with copy/paste props on TextInput components`);

