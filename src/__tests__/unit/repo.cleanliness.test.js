import fs from 'fs';
import path from 'path';

describe('repo cleanliness', () => {
  it('has no .tmp files in server/lib', () => {
    const dir = path.join(__dirname, '../../../server/lib');
    const tmpFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'));
    expect(tmpFiles).toEqual([]);
  });

  it('gitignore includes firestore-debug.log', () => {
    const gitignore = fs.readFileSync(path.join(__dirname, '../../../.gitignore'), 'utf8');
    expect(gitignore).toContain('firestore-debug.log');
  });
});
