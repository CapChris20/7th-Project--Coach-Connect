const fs = require('fs');
const path = require('path');

describe('ScheduleTrainingSessionScreen listener sharing', () => {
  it('wraps TrainerApp in SessionsProvider', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../app-start/TrainerApp.js'),
      'utf8',
    );
    expect(source).toContain('SessionsProvider');
  });

  it('thin session hooks require SessionsContext', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../trainer-app/hooks/useMyTrainingSessions.js'),
      'utf8',
    );
    expect(source).toContain('useSessionsContext');
    expect(source).not.toMatch(/useCreateTrainingSession[\s\S]*useSessions\(\)/);
  });
});
