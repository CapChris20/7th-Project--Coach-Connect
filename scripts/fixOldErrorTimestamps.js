#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ERROR_LOG_FILE = path.join(__dirname, '..', 'ERRORS.md');

function formatTimestamp(date) {
  const now = date || new Date();
  const dateStr = now.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  return `${dateStr} at ${timeStr}`;
}

function parseISOTimestamp(isoString) {
  try {
    return new Date(isoString);
  } catch (e) {
    return null;
  }
}

if (!fs.existsSync(ERROR_LOG_FILE)) {
  console.log('❌ ERRORS.md not found');
  process.exit(1);
}

let content = fs.readFileSync(ERROR_LOG_FILE, 'utf8');

// Find all timestamp lines and add readable time if missing (plain text format)
const timestampRegex = /Timestamp: ([\dTZ.:-]+)/g;
let match;

while ((match = timestampRegex.exec(content)) !== null) {
  const isoString = match[1];
  const date = parseISOTimestamp(isoString);
  
  if (date) {
    const readableTime = formatTimestamp(date);
    
    // Check if this error already has a "Time:" line
    const errorStart = content.lastIndexOf('ERROR', match.index);
    const errorSection = content.substring(errorStart, match.index);
    
    if (!errorSection.includes('Time:')) {
      // Insert readable time line before timestamp
      const insertIndex = match.index;
      const before = content.substring(0, insertIndex);
      
      // Find the end of the previous line
      const lastNewline = before.lastIndexOf('\n');
      const insertPoint = lastNewline + 1;
      
      content = content.substring(0, insertPoint) + 
                `Time: ${readableTime}\n` + 
                content.substring(insertPoint);
      
      // Reset regex since we modified content
      timestampRegex.lastIndex = 0;
    }
  }
}

// Update the "Last updated" line if it exists (plain text format)
const lastUpdatedMatch = content.match(/Last updated: ([\dTZ.:-]+)/);
if (lastUpdatedMatch) {
  const isoString = lastUpdatedMatch[1];
  const date = parseISOTimestamp(isoString);
  if (date) {
    const readableTime = formatTimestamp(date);
    content = content.replace(
      /Last updated: [\dTZ.:-]+/,
      `Last updated: ${readableTime}`
    );
  }
}

fs.writeFileSync(ERROR_LOG_FILE, content, 'utf8');
console.log('✅ Updated all error timestamps to readable format');
console.log(`   Check ${ERROR_LOG_FILE}`);

