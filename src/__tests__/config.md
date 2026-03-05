# Test configuration for SonarLox project

## Test Structure

The project uses Vitest as the test runner with React Testing Library for DOM testing.

## Test Files

- `src/__tests__/` - Global test setup and configuration
- `src/renderer/__tests__/` - React component tests

## Available Test Commands

- `npm run test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Test Coverage

Tests are written to cover:
- Component rendering and behavior
- Store interactions
- Audio engine functionality
- User interactions
- Edge cases and error handling

## Mocking Strategy

- Web Audio API is mocked
- React Three Fiber hooks are mocked
- Zustand stores are mocked
- Browser APIs are mocked with jsdom
- External dependencies are mocked as needed