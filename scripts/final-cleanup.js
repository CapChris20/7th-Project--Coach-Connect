#!/usr/bin/env node

/**
 * final-cleanup.js
 * Moves ALL remaining files from old structure to new structure and deletes old folders
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_ROOT = path.join(process.cwd(), 'src');

// File movement mappings
const moveRules = [
  // Auth/Login
  { from: 'screens/auth', to: 'login/screens' },
  { from: 'screens/onboarding', to: 'login/screens' },
  
  // Nutrition
  { from: 'screens/nutrition', to: 'nutrition/screens' },
  { from: 'screens/supplements', to: 'nutrition/screens' },
  { from: 'components/nutrition', to: 'nutrition/components' },
  
  // Voice AI
  { from: 'screens/voice', to: 'voice-ai/screens' },
  { from: 'services/voice', to: 'voice-ai/components' },
  
  // AI/Chat
  { from: 'screens/chat', to: 'ai/screens' },
  { from: 'screens/messages', to: 'ai/screens' },
  { from: 'components/chat', to: 'ai/components' },
  { from: 'components/ai', to: 'ai/components' },
  { from: 'services/ai', to: 'ai/components' },
  { from: 'services/chat', to: 'ai/components' },
  
  // Client Page
  { from: 'screens/dashboard', to: 'client-page/screens' },
  { from: 'screens/profile', to: 'client-page/screens' },
  { from: 'screens/client', to: 'client-page/screens' },
  
  // Trainer Page
  { from: 'screens/trainer', to: 'trainer-page/screens' },
  
  // Workout
  { from: 'screens/workout', to: 'workout/screens' },
  { from: 'screens/body', to: 'workout/screens' },
  { from: 'components/workout', to: 'workout/components' },
  { from: 'components/body', to: 'workout/components' },
  
  // Bottom Navbar
  { from: 'components/navigation', to: 'bottom-navbar/components' },
  
  // Extra (shared)
  { from: 'components/common', to: 'extra/components' },
  { from: 'components/charts', to: 'extra/components' },
  { from: 'screens/admin', to: 'extra/app' },
  
  // Services -> extra/api
  { from: 'services/firebase', to: 'extra/api' },
  { from: 'services/supabase', to: 'extra/api' },
  { from: 'services/openaiClient.js', to: 'extra/api/openaiClient.js' },
  { from: 'services/askServer.js', to: 'extra/api/askServer.js' },
];

function moveFiles() {
  let moved = 0;
  let errors = 0;
  
  for (const rule of moveRules) {
    const fromPath = path.join(SRC_ROOT, rule.from);
    const toPath = path.join(SRC_ROOT, rule.to);
    
    if (!fs.existsSync(fromPath)) continue;
    
    const stats = fs.statSync(fromPath);
    
    if (stats.isFile()) {
      // Single file
      try {
        if (!fs.existsSync(path.dirname(toPath))) {
          fs.mkdirSync(path.dirname(toPath), { recursive: true });
        }
        const shouldMove = !fs.existsSync(toPath) || 
                          fs.statSync(toPath).size === 0 || 
                          fs.statSync(fromPath).size > fs.statSync(toPath).size;
        
        if (shouldMove) {
          if (fs.existsSync(toPath)) {
            fs.unlinkSync(toPath);
          }
          fs.renameSync(fromPath, toPath);
          console.log(`✅ Moved: ${rule.from} -> ${rule.to}`);
          moved++;
        } else {
          fs.unlinkSync(fromPath);
          console.log(`🗑️  Deleted empty: ${rule.from}`);
        }
      } catch (error) {
        console.error(`❌ Error moving ${rule.from}:`, error.message);
        errors++;
      }
    } else if (stats.isDirectory()) {
      // Directory - move all files
      try {
        if (!fs.existsSync(toPath)) {
          fs.mkdirSync(toPath, { recursive: true });
        }
        
        const files = fs.readdirSync(fromPath, { withFileTypes: true });
        
        for (const file of files) {
          if (file.isFile() && file.name.endsWith('.js')) {
            const fromFile = path.join(fromPath, file.name);
            const toFile = path.join(toPath, file.name);
            
            // Move if destination doesn't exist, is empty, or source has more content
            const shouldMove = !fs.existsSync(toFile) || 
                              fs.statSync(toFile).size === 0 || 
                              fs.statSync(fromFile).size > fs.statSync(toFile).size;
            
            if (shouldMove) {
              if (fs.existsSync(toFile)) {
                fs.unlinkSync(toFile); // Remove empty/smaller file
              }
              fs.renameSync(fromFile, toFile);
              console.log(`✅ Moved: ${rule.from}/${file.name} -> ${rule.to}/${file.name}`);
              moved++;
            } else {
              // Source is smaller/empty, just delete it
              fs.unlinkSync(fromFile);
              console.log(`🗑️  Deleted empty: ${rule.from}/${file.name}`);
            }
          } else if (file.isDirectory()) {
            // Recursively move subdirectories
            const subFrom = path.join(rule.from, file.name);
            const subTo = path.join(rule.to, file.name);
            const subRule = { from: subFrom, to: subTo };
            moveRules.push(subRule);
          }
        }
      } catch (error) {
        console.error(`❌ Error moving directory ${rule.from}:`, error.message);
        errors++;
      }
    }
  }
  
  return { moved, errors };
}

function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  // Recursively remove subdirectories first
  for (const entry of entries) {
    if (entry.isDirectory()) {
      removeEmptyDirs(path.join(dir, entry.name));
    }
  }
  
  // Check if directory is now empty
  const remaining = fs.readdirSync(dir);
  if (remaining.length === 0 || (remaining.length === 1 && remaining[0] === '.DS_Store')) {
    try {
      fs.rmdirSync(dir);
      console.log(`🗑️  Removed empty: ${path.relative(SRC_ROOT, dir)}`);
    } catch (error) {
      // Ignore errors
    }
  }
}

function main() {
  console.log('🔄 Moving files to new structure...\n');
  
  const { moved, errors } = moveFiles();
  
  console.log(`\n✅ Moved ${moved} files`);
  if (errors > 0) {
    console.log(`❌ ${errors} errors`);
  }
  
  console.log('\n🗑️  Removing empty old directories...\n');
  
  // Remove old structure directories
  const oldDirs = [
    'screens',
    'services',
    'components',
  ];
  
  for (const dir of oldDirs) {
    const dirPath = path.join(SRC_ROOT, dir);
    if (fs.existsSync(dirPath)) {
      removeEmptyDirs(dirPath);
    }
  }
  
  console.log('\n✅ Cleanup complete!');
}

main();

