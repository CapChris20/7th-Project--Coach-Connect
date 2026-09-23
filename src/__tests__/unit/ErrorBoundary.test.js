const { CrashCatcher } = require('../../crash-reports/CrashCatcher');

describe('CrashCatcher', () => {
  it('getDerivedStateFromError captures the error', () => {
    const err = new Error('boom');
    expect(CrashCatcher.getDerivedStateFromError(err)).toEqual({
      hasError: true,
      error: err,
    });
  });

  it('componentDidCatch logs without throwing', () => {
    const boundary = new CrashCatcher({ children: null });
    expect(() =>
      boundary.componentDidCatch(new Error('boom'), { componentStack: 'stack' }),
    ).not.toThrow();
  });
});
