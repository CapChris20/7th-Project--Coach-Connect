#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const errors = [];
const warnings = [];

console.log('🔍 Scanning for ALL errors...\n');

// 1. Check for imports without relative paths (missing ./ or ../)
function checkImports(filePath, content) {
  const lines = content.split('\n');
  const relativeImports = [];
  
  lines.forEach((line, index) => {
    // Match imports that look like local files but don't have ./ or ../ or @/
    const importMatch = line.match(/import\s+.*\s+from\s+['"]([^./@][^'"]+)['"]/);
    if (importMatch) {
      const importPath = importMatch[1];
      // Skip node_modules imports
      if (!importPath.startsWith('react') && 
          !importPath.startsWith('expo') &&
          !importPath.startsWith('firebase') &&
          !importPath.startsWith('@react') &&
          !importPath.startsWith('axios') &&
          !importPath.startsWith('three') &&
          !importPath.includes('/') && // Single word imports are usually packages
          importPath !== 'crypto' &&
          importPath !== 'stream' &&
          importPath !== 'buffer') {
        relativeImports.push({
          line: index + 1,
          import: importPath,
          fullLine: line.trim()
        });
      }
    }
  });
  
  return relativeImports;
}

// 2. Check for broken relative paths
function checkBrokenPaths(filePath, content) {
  const broken = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Check for imports with ../../../src/ pattern (should use @/)
    if (line.includes("'../../../src/") || line.includes('"../../../src/')) {
      broken.push({
        line: index + 1,
        fullLine: line.trim(),
        issue: 'Using ../../../src/ instead of @/ alias'
      });
    }
    // Check for imports with ui/ThemeContext (should be @/shared/ui/ThemeContext)
    if (line.match(/from\s+['"]ui\/ThemeContext['"]/)) {
      broken.push({
        line: index + 1,
        fullLine: line.trim(),
        issue: 'Using ui/ThemeContext instead of @/shared/ui/ThemeContext'
      });
    }
  });
  
  return broken;
}

// 3. Check for syntax errors using TypeScript compiler
function checkSyntaxErrors() {
  try {
    execSync('npx tsc --noEmit --skipLibCheck 2>&1', { 
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: __dirname
    });
    return [];
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const tsErrors = output.split('\n')
      .filter(line => line.includes('error TS'))
      .map(line => line.trim())
      .filter(line => line.length > 0);
    return tsErrors;
  }
}

// 4. Scan all JS/JSX/TS/TSX files
function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules, .expo, build, etc.
      if (!file.startsWith('.') && 
          file !== 'node_modules' && 
          file !== 'build' && 
          file !== 'dist' &&
          file !== 'ios' &&
          file !== 'android' &&
          file !== '.expo') {
        scanDirectory(filePath, fileList);
      }
    } else if (/\.(js|jsx|ts|tsx)$/.test(file)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Main scanning
console.log('📁 Scanning source files...');
const srcDir = path.join(__dirname, 'src');
const allFiles = scanDirectory(srcDir);

console.log(`Found ${allFiles.length} files to check\n`);

allFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(__dirname, file);
    
    // Check imports
    const importErrors = checkImports(file, content);
    if (importErrors.length > 0) {
      errors.push({
        file: relativePath,
        type: 'Missing relative path',
        issues: importErrors
      });
    }
    
    // Check broken paths
    const brokenPaths = checkBrokenPaths(file, content);
    if (brokenPaths.length > 0) {
      errors.push({
        file: relativePath,
        type: 'Broken import path',
        issues: brokenPaths
      });
    }
  } catch (e) {
    warnings.push(`Could not read ${file}: ${e.message}`);
  }
});

// Check syntax errors
console.log('🔎 Checking TypeScript syntax errors...');
const syntaxErrors = checkSyntaxErrors();

// Print results
console.log('\n' + '='.repeat(80));
console.log('📊 COMPLETE ERROR REPORT');
console.log('='.repeat(80) + '\n');

if (errors.length === 0 && syntaxErrors.length === 0) {
  console.log('✅ No errors found!');
} else {
  console.log(`❌ Found ${errors.length} file(s) with import errors`);
  console.log(`❌ Found ${syntaxErrors.length} TypeScript syntax error(s)\n`);
  
  // Print import errors
  errors.forEach((error, idx) => {
    console.log(`\n${idx + 1}. ${error.file}`);
    console.log(`   Type: ${error.type}`);
    error.issues.forEach(issue => {
      if (issue.line) {
        console.log(`   Line ${issue.line}: ${issue.fullLine || issue.import}`);
        if (issue.issue) {
          console.log(`   ⚠️  ${issue.issue}`);
        }
      }
    });
  });
  
  // Print syntax errors
  if (syntaxErrors.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('🔴 TYPESCRIPT SYNTAX ERRORS:');
    console.log('='.repeat(80));
    syntaxErrors.forEach((error, idx) => {
      console.log(`${idx + 1}. ${error}`);
    });
  }
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:');
  warnings.forEach(w => console.log(`   ${w}`));
}

console.log('\n' + '='.repeat(80));
console.log(`Total: ${errors.length} file(s) with errors, ${syntaxErrors.length} syntax error(s)`);
console.log('='.repeat(80) + '\n');




