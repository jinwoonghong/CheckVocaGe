# Agent Guidelines for CheckVocaGe

## Build Commands

- Build: `pnpm build` (runs across all packages)
- Lint: `pnpm lint` (runs across all packages)
- Test all: `pnpm test` (runs across all packages)
- Test single: `pnpm test -- --testNamePattern="test name"` or `vitest --run -t "test name"`
- Typecheck: `pnpm typecheck` (runs across all packages)

## Code Style Guidelines

### Imports

- Use ES6 imports with path aliases (@core/_, @web/_, @extension/\*)
- Group imports: external libs, then internal modules
- No wildcard imports

### Formatting

- Use 2 spaces for indentation
- Max line length: 100 characters
- Semicolons required
- Single quotes for strings
- Trailing commas required

### Types

- TypeScript strict mode enabled
- Prefer interfaces over types for object shapes
- Avoid `any` type (warned by ESLint)
- Use proper typing for all functions and variables

### Naming Conventions

- Functions: camelCase
- Classes: PascalCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case.ts

### Error Handling

- Use try/catch for async operations
- Throw specific error types
- Log errors with context

### Testing

- Use Vitest with jsdom environment
- Test files: _.test.ts or _.test.tsx
- Place tests in **tests**/ directories or alongside source files
