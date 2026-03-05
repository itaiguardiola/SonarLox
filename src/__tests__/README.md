# Testing in SonarLox

This directory contains all the test files for the SonarLox project.

## Test Structure

- `src/__tests__/` - Root test directory with global setup files
- `src/renderer/__tests__/` - React component tests

## Testing Framework

- **Vitest** - Test runner
- **React Testing Library** - DOM testing utilities
- **jsdom** - DOM environment for tests

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Guidelines

1. **Component Tests** - Test React components in isolation
2. **Integration Tests** - Test how components work together
3. **Unit Tests** - Test individual functions and classes
4. **Mocking** - Mock external dependencies and browser APIs

## Mocked Dependencies

- `useAppStore` - Zustand store mocks
- `useTransportStore` - Zustand store mocks
- `audioEngine` - Web Audio API mocks
- Browser APIs - jsdom environment mocks