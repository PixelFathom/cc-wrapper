"""
Prompt templates for the four-stage GitHub issue resolution workflow
"""

# Stage 2: Planning - Analysis and plan creation
PLANNING_PROMPT_TEMPLATE = """
You are tasked with analyzing and creating a detailed implementation plan for the following GitHub issue:

## Issue Details
**Title**: {issue_title}
**Issue Number**: #{issue_number}
**Labels**: {issue_labels}

**Description**:
{issue_body}

## Repository Context
{repo_context}

## Your Task
Please provide a comprehensive analysis and implementation plan that includes:

### 1. Issue Analysis
- **Root Cause**: Identify the underlying cause of the issue
- **Impact Assessment**: Who/what is affected and how severely
- **Related Components**: List all files, modules, and systems that may be impacted

### 2. Proposed Solution
- **Approach**: Describe your solution approach in detail
- **Implementation Steps**: Break down the solution into clear, actionable steps
- **Files to Modify**: List specific files that need to be changed with brief descriptions of changes

### 3. Risk Assessment
- **Potential Risks**: Identify any risks or complications
- **Mitigation Strategies**: How to handle identified risks
- **Rollback Plan**: How to revert changes if needed

### 4. Testing Strategy
- **Test Scenarios**: List specific test cases to validate the fix
- **Edge Cases**: Identify edge cases that need special attention
- **Regression Testing**: What existing functionality needs to be tested

### 5. Estimated Effort
- **Complexity**: Low/Medium/High
- **Estimated Time**: Rough estimate for implementation
- **Dependencies**: Any external dependencies or blockers

Please be thorough and specific in your analysis. This plan will be reviewed and must be approved before implementation begins.
"""

# Stage 3: Implementation - Execute the approved plan
IMPLEMENTATION_PROMPT_TEMPLATE = """
You are now implementing the approved plan to resolve GitHub issue #{issue_number}.

## Issue Details
**Title**: {issue_title}
**Description**:
{issue_body}

## Approved Plan
{plan}

## Implementation Instructions

### Branch Information
Please work on branch: `{resolution_branch}`

### Implementation Requirements
1. **Follow the approved plan exactly** - Make only the changes outlined in the plan
2. **Code Quality**:
   - Write clean, readable, and well-documented code
   - Follow the project's existing coding conventions and patterns
   - Add appropriate comments for complex logic
3. **Commit Practices**:
   - Make atomic commits with clear, descriptive messages
   - Format: `fix(#{{issue_number}}): <description>`
   - Group related changes logically
4. **Error Handling**:
   - Add proper error handling and validation
   - Ensure graceful degradation where applicable
5. **Performance**:
   - Consider performance implications of your changes
   - Avoid introducing performance regressions
6. **Security**:
   - Follow security best practices
   - Validate all inputs
   - Avoid introducing vulnerabilities

### Testing During Implementation
- Test your changes as you implement them
- Ensure each change works before moving to the next
- Run existing tests to ensure no regressions

### Important Notes
- If you encounter any blockers or need to deviate from the plan, document the reasons clearly
- Ensure backward compatibility unless breaking changes are explicitly approved
- Update any relevant documentation or README files

Please proceed with the implementation following these guidelines.
"""

# Testing summary prompt for final validation
TESTING_SUMMARY_PROMPT = """
Summarize the test execution results for GitHub issue #{issue_number}.

## Test Results
{test_results}

## Summary Required
Please provide:
1. Overall test success rate
2. Any failing test details and potential causes
3. Recommendations for next steps
4. Whether the issue can be considered resolved

Be concise but thorough in your assessment.
"""

# Coding standards to include in implementation (extracted from original prompt)
CODING_STANDARDS = """
## Coding Standards and Best Practices

### General Principles
1. **Readability First**: Code should be self-documenting with clear variable names and logical structure
2. **DRY (Don't Repeat Yourself)**: Extract common logic into reusable functions
3. **SOLID Principles**: Follow Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
4. **Error Handling**: Always handle errors gracefully with appropriate logging
5. **Testing**: Write testable code with clear interfaces

### Python/FastAPI Backend Standards
- Use type hints for all function parameters and return values
- Follow PEP 8 style guide
- Use async/await for I/O operations
- Implement proper dependency injection
- Use Pydantic models for request/response validation
- Structure: Router → Service → Repository/Model layers
- Always use SQLModel for database operations
- Handle database sessions properly with dependency injection

### TypeScript/Next.js Frontend Standards
- Use TypeScript strictly (no `any` types unless absolutely necessary)
- Implement proper error boundaries
- Use React hooks appropriately
- Follow component composition patterns
- Implement proper loading and error states
- Use TanStack Query for server state management
- Follow Tailwind CSS conventions for styling
- Ensure responsive design for all screen sizes

### Security Standards
- Never expose sensitive data in logs or responses
- Validate all inputs on both frontend and backend
- Use parameterized queries (SQLModel handles this)
- Implement proper authentication and authorization checks
- Follow OWASP guidelines
- Use environment variables for configuration

### Git Commit Standards
- Use conventional commits format
- Types: feat, fix, docs, style, refactor, test, chore
- Format: `type(scope): description`
- Keep commits atomic and focused
- Write clear commit messages

### Testing Standards
- Aim for high test coverage of critical paths
- Write unit tests for business logic
- Write integration tests for API endpoints
- Use meaningful test names that describe what is being tested
- Follow Arrange-Act-Assert pattern
- Mock external dependencies appropriately
"""