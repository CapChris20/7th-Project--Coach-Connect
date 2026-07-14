const { ErrorBoundary } = require('../../components/ErrorBoundary');

describe('ErrorBoundary', () => {
  it('getDerivedStateFromError captures the error', () => {
    const err = new Error('boom');
    expect(ErrorBoundary.getDerivedStateFromError(err)).toEqual({
      hasError: true,
      error: err,
    });
  });

  it('componentDidCatch logs without throwing', () => {
    const boundary = new ErrorBoundary({ children: null });
    expect(() =>
      boundary.componentDidCatch(new Error('boom'), { componentStack: 'stack' }),
    ).not.toThrow();
  });
});
