const fs = require('fs');
const path = require('path');

describe('ScheduleSessionScreen listener sharing', () => {
  it('wraps TrainerAppStart in SessionsProvider', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../app-start/TrainerAppStart.js'),
      'utf8',
    );
    expect(source).toContain('SessionsProvider');
  });

  it('thin session hooks require SharedSessionList', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../trainer-app/scheduling/mySessions.js'),
      'utf8',
    );
    expect(source).toContain('useSharedSessionList');
    expect(source).not.toMatch(/useCreateTrainingSession[\s\S]*useSessions\(\)/);
  });
});
