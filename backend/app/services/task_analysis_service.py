"""
Task Analysis Service

Analyzes user prompts to detect if they contain multiple distinct steps
that should be broken down into separate sub-tasks.
"""
import logging
import json
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
import openai
from openai import AsyncOpenAI

from app.core.settings import get_settings

logger = logging.getLogger(__name__)


@dataclass
class SubTaskSpec:
    """Specification for a single sub-task"""
    sequence: int
    title: str
    description: str
    testing_requirements: str
    parallel_group: Optional[int] = None  # Tasks in same group can run in parallel


@dataclass
class BreakdownAnalysis:
    """Result of analyzing a prompt for task breakdown"""
    should_breakdown: bool
    reasoning: str
    sub_tasks: List[SubTaskSpec]
    parallel_groups: Optional[List[List[int]]] = None  # Groups of task sequences that can run in parallel


@dataclass
class BreakdownDecision:
    """Simple result for quick breakdown check (no sub-task generation)"""
    should_breakdown: bool
    reasoning: str


class TaskAnalysisService:
    """Service for analyzing prompts and generating sub-task breakdowns"""
    
    def __init__(self):
        self.settings = get_settings()
        self.client = AsyncOpenAI(api_key=self.settings.openai_api_key)
        
    async def analyze_for_breakdown(self, prompt: str) -> BreakdownAnalysis:
        """
        Analyze if a prompt contains multiple distinct steps that should be broken down.
        
        Looks for:
        - Numbered/bulleted lists
        - Multiple "and then", "after that", "next" phrases
        - Multiple distinct feature requests
        - Complex multi-step workflows
        
        Args:
            prompt: The user's input message
            
        Returns:
            BreakdownAnalysis with breakdown recommendation
        """
        try:
            logger.info(f"🔍 Analyzing prompt for task breakdown (length: {len(prompt)} chars)")
            
            # System prompt for task analysis
            system_prompt = """You are a technical project manager analyzing user requests to determine if task breakdown is needed.

GOAL: Identify requests that contain multiple distinct deliverables requiring sequential execution.

BREAKDOWN CRITERIA (ALL must be true):
1. Request contains genuinely independent deliverables
2. Each deliverable requires different files/components
3. Clear sequential dependency exists (B needs A to work)
4. Tasks are distinct enough that combining them would create confusion

DO NOT BREAKDOWN:
- Single feature requests (even complex ones)
- Requests with only 1-2 steps
- Vague or exploratory requests
- Tasks where components are tightly coupled
- Bug fixes or refactoring tasks
- "Build X with Y and Z" (single deliverable with requirements)

EXAMPLES:
❌ "Create a login page with form validation and error handling" → Single feature
❌ "Add user authentication to the app" → Single cohesive task
❌ "Build a todo app with CRUD operations" → Single deliverable
✅ "1. Create user registration 2. Build dashboard 3. Add settings page 4. Implement notifications" → Independent pages/features
✅ "First implement the API endpoints, then create the frontend components, then add integration tests" → Clear phases

SUB-TASK GUIDELINES:
- Each sub-task should represent a meaningful, independent deliverable
- Combine tightly related work into single sub-tasks
- Order by dependency (what needs to exist first)
- Each sub-task should be completable and testable on its own

RESPONSE FORMAT:
{
    "should_breakdown": boolean,
    "reasoning": "One sentence explaining decision",
    "sub_tasks": [
        {
            "sequence": 1,
            "title": "Verb + Object (3-6 words)",
            "description": "Build [what] in [where]. Key requirements: [bullet points]. Output: [expected deliverable].",
            "testing_requirements": "Golden flow test cases to verify this sub-task works correctly"
        }
    ]
}

DESCRIPTION FORMAT:
- Start with "Build/Create/Implement [component] in [file/directory]"
- List key requirements as brief bullets
- Include relevant technical details (endpoints, components, data structures)
- End with expected output/deliverable
- Be specific enough that a developer knows exactly what to build

TESTING_REQUIREMENTS FORMAT:
Return golden flow test cases - the critical paths that MUST work for this feature to be considered complete.

Structure as numbered test cases:
1. [Test Name]: [Action] → [Expected Result]
2. [Test Name]: [Action] → [Expected Result]
...

Example for a Login feature:
1. Valid Login: Enter valid email/password, click submit → Redirects to /dashboard, shows welcome message
2. Invalid Password: Enter valid email with wrong password → Shows "Invalid credentials" error, stays on login page
3. Empty Form Submit: Click submit with empty fields → Shows validation errors for both fields
4. Session Persistence: Login successfully, refresh page → User remains logged in, dashboard still accessible

Example for an API endpoint:
1. Create Resource: POST /api/items with valid payload → Returns 201, response contains created item with ID
2. Get Resource: GET /api/items/{id} with valid ID → Returns 200, response matches created data
3. Invalid Payload: POST /api/items with missing required field → Returns 400 with descriptive error message
4. Not Found: GET /api/items/{invalid-id} → Returns 404 with appropriate error

For FRONTEND features, include snapshot verification:
- Use Playwright MCP to navigate to the page and take browser snapshots
- Verify UI elements are visible and interactive
- Example: "Navigate to /login, take snapshot, verify email input, password input, and submit button are visible"

Focus on:
- Happy path scenarios (the main use case working end-to-end)
- Critical validation cases (what errors should be caught)
- State verification (data persists, UI updates correctly)
- Frontend snapshot verification for UI components

IMPORTANT: When in doubt, DO NOT breakdown. A single well-defined task executed thoroughly is better than fragmented sub-tasks that lose context.
"""
            
            # User prompt with the actual request
            user_prompt = f"""Analyze this user request for task breakdown:

---
{prompt}
---

Should this be broken down into multiple sequential sub-tasks?
Return ONLY valid JSON, no other text."""
            
            # Call OpenAI
            response = await self.client.chat.completions.create(
                model="gpt-5-mini",  # Fast and cost-effective
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            # Parse response
            result_text = response.choices[0].message.content
            result = json.loads(result_text)
            
            logger.info(f"📊 Analysis result: should_breakdown={result['should_breakdown']}, "
                       f"sub_tasks={len(result.get('sub_tasks', []))}")
            
            # Convert to BreakdownAnalysis object
            sub_tasks = [
                SubTaskSpec(
                    sequence=task['sequence'],
                    title=task['title'],
                    description=task['description'],
                    testing_requirements=task.get('testing_requirements', 'Write and run appropriate tests')
                )
                for task in result.get('sub_tasks', [])
            ]
            
            return BreakdownAnalysis(
                should_breakdown=result['should_breakdown'],
                reasoning=result.get('reasoning', 'No reasoning provided'),
                sub_tasks=sub_tasks
            )
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse OpenAI response as JSON: {e}")
            # Fallback: don't breakdown on parse error
            return BreakdownAnalysis(
                should_breakdown=False,
                reasoning="Failed to parse analysis result",
                sub_tasks=[]
            )
        except Exception as e:
            logger.error(f"❌ Task analysis failed: {e}")
            # Fallback: don't breakdown on error
            return BreakdownAnalysis(
                should_breakdown=False,
                reasoning=f"Analysis error: {str(e)}",
                sub_tasks=[]
            )

    async def should_breakdown_task(self, prompt: str) -> BreakdownDecision:
        """
        Quick check to determine if a prompt needs breakdown into sub-tasks.

        This is a lightweight version of analyze_for_breakdown that only returns
        a boolean decision without generating sub-task specifications.

        Args:
            prompt: The user's input message

        Returns:
            BreakdownDecision with should_breakdown flag and reasoning
        """
        try:
            logger.info(f"🔍 Quick breakdown check (length: {len(prompt)} chars)")

            # Concise system prompt focused only on the decision
            system_prompt = """You are analyzing if a user request needs to be broken down into multiple sub-tasks.

RETURN TRUE (DO breakdown) when ANY of these are true:
1. Request describes a full application/system with 4+ distinct features or pages
2. Request has bullet points or sections listing multiple independent pages/features
3. Request mentions multiple user types/roles with different functionality (e.g., customer + admin)
4. Request explicitly lists 3+ distinct, independent deliverables
5. Request describes both frontend AND backend with multiple features each
6. Request is comprehensive enough that completing it requires building many separate components

RETURN FALSE (do NOT breakdown) for:
- Single feature requests (e.g., "build a login page with validation")
- Bug fixes or refactoring tasks
- Requests with only 1-2 features
- Vague or exploratory requests ("help me improve X")
- Simple CRUD for a single entity
- Code reviews or explanations
- Configuration changes
- Single file modifications

EXAMPLES:
❌ "Create a login page with form validation and error handling" → false (single feature)
❌ "Add user authentication to the app" → false (single cohesive task)
❌ "Build a simple todo app" → false (small single deliverable)
❌ "Fix the bug in the checkout flow" → false (bug fix)
✅ "Build an e-commerce site with product catalog, shopping cart, user accounts, checkout, and admin panel" → true (5+ major features)
✅ "Create a project management app with tasks, teams, notifications, and reporting" → true (multiple independent modules)
✅ "Build TechMart with home page, catalog, cart, auth, customer profiles, order tracking, admin area" → true (comprehensive app)
✅ "1. Create user registration 2. Build dashboard 3. Add settings page 4. Implement notifications" → true (4 independent pages)

IMPORTANT: For comprehensive application requests listing multiple features (especially with bullet points), RETURN TRUE.

Return JSON: {"should_breakdown": boolean, "reasoning": "one sentence"}"""

            user_prompt = f"""Should this request be broken into sub-tasks?

---
{prompt}
---

Return ONLY valid JSON."""

            response = await self.client.chat.completions.create(
                model="gpt-5-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"}
            )

            result_text = response.choices[0].message.content
            result = json.loads(result_text)

            should_breakdown = result.get('should_breakdown', False)
            reasoning = result.get('reasoning', 'No reasoning provided')

            logger.info(f"📊 Quick check result: should_breakdown={should_breakdown}")

            return BreakdownDecision(
                should_breakdown=should_breakdown,
                reasoning=reasoning
            )

        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse response as JSON: {e}")
            return BreakdownDecision(
                should_breakdown=False,
                reasoning="Failed to parse analysis result"
            )
        except Exception as e:
            logger.error(f"❌ Quick breakdown check failed: {e}")
            return BreakdownDecision(
                should_breakdown=False,
                reasoning=f"Analysis error: {str(e)}"
            )

    def generate_planning_prompt(self, original_prompt: str, context: Dict[str, Any]) -> str:
        """
        Generate a planning prompt for the external chat service.

        This prompt instructs Claude to analyze the codebase and create a
        granular, parallel-aware task breakdown.

        Args:
            original_prompt: The user's original request
            context: Project context (project_name, task_name, etc.)

        Returns:
            Planning prompt string for external chat service
        """
        project_name = context.get("project_name", "Unknown")
        task_name = context.get("task_name", "Unknown")

        planning_prompt = f"""You are in PLANNING MODE. Your job is to analyze the codebase and create a detailed task breakdown plan.

⚠️ CRITICAL INSTRUCTIONS - READ CAREFULLY:
1. You MUST stay in plan mode throughout - DO NOT implement anything
2. DO NOT exit plan mode - DO NOT use ExitPlanMode tool
3. DO NOT write the plan to any file - NO file creation or modification
4. Your FINAL RESPONSE must contain the complete plan as TEXT in your message
5. The plan must be returned in your response message, NOT saved to a file

PROJECT: {project_name}
TASK: {task_name}

USER REQUEST:
{original_prompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PLANNING WORKFLOW:

STEP 1: ANALYZE THE CODEBASE (use Read, Glob, Grep tools)
   - Explore directory structure and project layout
   - Read configuration files (package.json, requirements.txt, etc.)
   - Check existing code: models, APIs, components, utilities
   - Identify tech stack, frameworks, and patterns
   - Note naming conventions and code organization
   - Find existing tests and testing patterns

STEP 2: CREATE YOUR PLAN (output as text in your response)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REQUIRED PLAN FORMAT (include ALL sections in your final response):

## CODEBASE ANALYSIS
- **Project Structure**: Directory layout and organization
- **Tech Stack**: Frameworks, libraries, database, tools identified
- **Existing Patterns**: Coding conventions and patterns found
- **Reusable Components**: What already exists that we can build upon
- **Key Files**: Important files and their purposes

## API CONTRACTS (Define BEFORE task breakdown)

This section defines ALL API endpoints needed. By defining contracts upfront,
frontend and backend tasks can be built INDEPENDENTLY in parallel.

### [Feature Name] APIs

**Endpoint: [CREATE/MODIFY] METHOD /api/route**
- **Action**: CREATE new | MODIFY existing (specify file if modifying)
- **Purpose**: Brief description
- **Authentication**: Required/Optional/None
- **Request**:
```json
{{
  "field1": "string (required) - description",
  "field2": "number (optional) - description",
  "nested": {{
    "subfield": "boolean - description"
  }}
}}
```
- **Response (Success 200/201)**:
```json
{{
  "id": "uuid",
  "field1": "string",
  "created_at": "ISO datetime"
}}
```
- **Response (Error 400)**:
```json
{{
  "error": "string",
  "details": ["validation error messages"]
}}
```
- **Response (Error 401/403/404)**: Standard error format

[Repeat for ALL endpoints needed]

## DATA MODELS (Define schemas for database/state)

### [Model Name]
- **Action**: CREATE new | MODIFY existing
- **Location**: `path/to/model/file`
```
{{
  id: UUID (primary key)
  field1: String (required, max 255)
  field2: Integer (optional, default 0)
  field3: ForeignKey -> OtherModel
  created_at: DateTime (auto)
  updated_at: DateTime (auto)
}}
```
- **Indexes**: [field1], [field2, field3]
- **Relationships**: Has many X, Belongs to Y

[Repeat for ALL models needed]

## TASK BREAKDOWN

### Phase 1: [Phase Name] (parallel_group: 0 - Sequential)
Tasks that MUST run sequentially (database setup, core models, etc.)

**Task 1: [Clear Descriptive Title]**
- **parallel_group**: 0 (sequential)
- **Action**: CREATE new files | MODIFY existing files
- **Description**:
  Comprehensive explanation including:
  - Exact functionality to implement
  - Reference to API contracts defined above (e.g., "Implement POST /api/users endpoint as defined in API Contracts")
  - Reference to data models defined above
  - Validation rules and error handling
- **Files to Create/Modify**:
  - `path/to/file1.ts` - CREATE: Description
  - `path/to/file2.ts` - MODIFY: What changes to make
- **API Endpoints Implemented**: List endpoints from API Contracts section
- **Models Used**: List models from Data Models section
- **Dependencies**: What must exist before this task
- **Acceptance Criteria**:
  - [ ] Criterion 1
  - [ ] Criterion 2
- **Test Cases**:
  1. GIVEN [setup] WHEN [action] THEN [expected result]
  2. GIVEN [edge case] WHEN [action] THEN [expected result]
  3. GIVEN [error condition] WHEN [action] THEN [expected error handling]

### Phase 2: [Phase Name] (parallel_group: 1 - Parallel Batch 1)
Tasks that can run IN PARALLEL after Phase 1 completes.
Frontend and Backend can run in parallel because API contracts are defined above.

**Task 2: [Backend - Feature X API]**
- **parallel_group**: 1
- **Action**: CREATE/MODIFY
- **Description**: Implement backend endpoints as defined in API Contracts
- **API Endpoints Implemented**: POST /api/x, GET /api/x/:id, etc.
- [Same detailed format as above]

**Task 3: [Frontend - Feature X UI]**
- **parallel_group**: 1 (CAN run parallel with Task 2 because API contract is defined)
- **Action**: CREATE/MODIFY
- **Description**: Build UI that calls endpoints defined in API Contracts
- **API Endpoints Consumed**: POST /api/x, GET /api/x/:id, etc.
- **Mock Data**: Use API contract response format for development
- **UI/UX Requirements**: Follow minimal, aesthetic design principles (see Frontend UI Guidelines below)
- [Same detailed format as above]

### Phase 3: [Phase Name] (parallel_group: 2 - Parallel Batch 2)
Tasks that can run IN PARALLEL after Phase 2 completes.

**Task 5: [Title]**
- **parallel_group**: 2
- [Same detailed format as above]

## PARALLEL EXECUTION SUMMARY
```
Sequential (parallel_group: 0): Task 1 - Database/Model setup
Parallel Batch 1 (parallel_group: 1):
  - Task 2 (Backend API)
  - Task 3 (Frontend UI) <- Can run simultaneously because API contracts defined
Parallel Batch 2 (parallel_group: 2): Tasks 5, 6, 7 (run after Batch 1)
```

## IMPLEMENTATION NOTES
- Key patterns to follow from existing codebase
- Shared utilities or helpers to reuse
- Important considerations or potential issues

## FRONTEND UI GUIDELINES (CRITICAL FOR ALL FRONTEND TASKS)

All frontend tasks MUST follow these design principles:

**DESIGN PHILOSOPHY:**
- **Minimal & Clean**: Remove all unnecessary elements. Less is more.
- **Aesthetic & Modern**: Use subtle gradients, smooth transitions, proper spacing
- **Consistent**: Follow existing design patterns in the codebase
- **Accessible**: Proper contrast, focus states, semantic HTML

**VISUAL STANDARDS:**
- Use generous whitespace and padding (avoid cramped layouts)
- Subtle shadows and borders (avoid harsh lines)
- Smooth transitions/animations (150-300ms duration)
- Consistent border-radius (follow existing component patterns)
- Muted color palette with purposeful accent colors
- Typography hierarchy with proper font weights and sizes

**COMPONENT PATTERNS:**
- Cards with subtle borders and shadows, not flat boxes
- Buttons with hover/active states and proper feedback
- Form inputs with clear focus states and validation styling
- Loading states with skeleton loaders or subtle spinners
- Empty states with helpful messages and actions
- Error states that are informative but not alarming

**AVOID:**
- Cluttered interfaces with too many elements
- Harsh colors or high-contrast borders
- Abrupt transitions or jarring animations
- Inconsistent spacing or alignment
- Generic/boring default styling
- Over-engineering simple components

**REFERENCE**: Look at existing components in the codebase for styling patterns, especially:
- Color variables and theme tokens
- Existing card, button, and form components
- Animation/transition utilities
- Spacing and layout conventions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL REMINDERS:
1. DO NOT write plan to a file - output it directly in your response
2. DO NOT implement any code - only analyze and plan
3. DO NOT use ExitPlanMode
4. DEFINE API CONTRACTS FIRST - This enables frontend/backend parallel development
5. Specify CREATE or MODIFY for every file/endpoint/model
6. Each task description must be detailed enough for an AI to implement WITHOUT asking questions
7. Include parallel_group number for EVERY task
8. Tasks with same parallel_group run simultaneously
9. Your final message MUST contain the complete plan text

Begin by exploring the codebase, then output your complete plan in your response."""

        return planning_prompt

    async def parse_plan_response(self, plan_text: str, original_prompt: str) -> BreakdownAnalysis:
        """
        Parse a plan response from Claude into structured sub-tasks using OpenAI.

        This extracts:
        - Individual sub-tasks with descriptions
        - Parallel execution groups
        - Dependencies between tasks

        Args:
            plan_text: The plan response from Claude
            original_prompt: The original user request

        Returns:
            BreakdownAnalysis with structured sub-tasks
        """
        try:
            logger.info(f"📊 Parsing plan response (length: {len(plan_text)} chars)")

            system_prompt = """You are extracting structured task data from a development plan and creating comprehensive task specifications for an AI coding assistant.

Given a plan created by an AI assistant, extract the individual tasks into a structured format that another AI coding assistant can implement WITHOUT asking clarifying questions.

EXTRACTION RULES:
1. Each task should be atomic - one focused piece of work
2. Identify parallel groups (tasks that can run simultaneously)
3. Maintain the logical sequence based on dependencies
4. Create COMPREHENSIVE descriptions and test cases

DESCRIPTION REQUIREMENTS:
Each task description MUST be detailed enough for an AI coding assistant to implement independently. Include:
- Specific functionality to implement
- File paths to create or modify (based on project structure from the plan)
- Data models/schemas with field types if applicable
- API endpoints with HTTP methods, routes, request/response formats
- UI components with their props, state, and behavior
- Integration points with existing code
- Error handling requirements
- Any business logic or validation rules

FOR FRONTEND/UI TASKS, ALSO INCLUDE:
- UI/UX design requirements emphasizing minimal, aesthetic design
- Styling guidelines: subtle shadows, smooth transitions, proper spacing
- Component patterns to follow from existing codebase
- Loading states, empty states, error states to implement
- Responsive design considerations

TEST CASE REQUIREMENTS:
Each task MUST have concrete test cases that can be used to verify the implementation:
- Include happy path tests
- Include edge cases (empty input, maximum values, special characters)
- Include error scenarios (invalid input, unauthorized access, not found)
- Format: "Given [setup], when [action], then [expected result]"

PARALLEL GROUP RULES:
- Tasks in the same parallel group MUST NOT modify the same files
- Backend tasks for different features can often run in parallel
- Frontend tasks for different features can often run in parallel
- Database migrations should typically be sequential
- Tasks that depend on each other CANNOT be in the same parallel group

OUTPUT FORMAT (JSON):
{
    "should_breakdown": true,
    "reasoning": "Brief explanation of why breakdown is needed",
    "sub_tasks": [
        {
            "sequence": 1,
            "title": "Short task title (3-6 words)",
            "description": "COMPREHENSIVE description including:\\n- What to build (specific functionality)\\n- Files to create/modify with paths\\n- Data models with fields and types\\n- API endpoints (method, route, request/response)\\n- UI components (props, state, behavior)\\n- Integration with existing code\\n- Validation and error handling\\n- Business logic details",
            "testing_requirements": "TEST CASES:\\n1. Given [setup], when [action], then [expected]\\n2. Given [edge case], when [action], then [expected]\\n3. Given [error scenario], when [action], then [expected error]",
            "parallel_group": 0
        }
    ],
    "parallel_groups": [[1], [2, 3, 4], [5, 6, 7]]
}

PARALLEL GROUP FIELD:
- parallel_group: 0 means sequential (must run alone)
- parallel_group: 1 means first parallel batch
- parallel_group: 2 means second parallel batch (runs after group 1)
- etc.

Tasks with same parallel_group number run together.
Tasks with parallel_group 0 run sequentially in their sequence order.

Example:
- Task 1 (parallel_group: 0) - runs first, alone
- Task 2 (parallel_group: 1) - \\
- Task 3 (parallel_group: 1) - } run together after task 1
- Task 4 (parallel_group: 1) - /
- Task 5 (parallel_group: 0) - runs alone after tasks 2,3,4
- Task 6 (parallel_group: 2) - \\
- Task 7 (parallel_group: 2) - } run together after task 5

QUALITY CHECK - Before returning, verify:
1. Each description is detailed enough that a coding AI won't need to ask questions
2. Each task has at least 3 concrete test cases
3. File paths are specific (not generic placeholders)
4. API routes, methods, and payloads are specified
5. Data model fields include types

If the plan doesn't contain enough distinct tasks for breakdown, return:
{
    "should_breakdown": false,
    "reasoning": "Explanation of why single task is sufficient",
    "sub_tasks": [],
    "parallel_groups": []
}"""

            user_prompt = f"""Extract structured task data from this development plan and create comprehensive task specifications.

ORIGINAL USER REQUEST:
{original_prompt}

DEVELOPMENT PLAN:
{plan_text}

IMPORTANT:
1. Create descriptions detailed enough for an AI coding assistant to implement WITHOUT asking questions
2. Include specific file paths, API routes with methods, data models with field types
3. Generate at least 3 concrete test cases per task (happy path, edge case, error scenario)
4. Test cases should follow: "Given [setup], when [action], then [expected result]"

Extract the tasks and parallel groups. Return ONLY valid JSON."""

            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"}
            )

            result_text = response.choices[0].message.content
            result = json.loads(result_text)

            should_breakdown = result.get("should_breakdown", False)

            if not should_breakdown:
                logger.info(f"📝 Plan parsing: No breakdown needed - {result.get('reasoning', 'Unknown')}")
                return BreakdownAnalysis(
                    should_breakdown=False,
                    reasoning=result.get("reasoning", "Single task sufficient"),
                    sub_tasks=[],
                    parallel_groups=[]
                )

            # Convert to SubTaskSpec objects
            sub_tasks = [
                SubTaskSpec(
                    sequence=task["sequence"],
                    title=task["title"],
                    description=task["description"],
                    testing_requirements=task.get("testing_requirements", "Verify functionality works correctly"),
                    parallel_group=task.get("parallel_group", 0)
                )
                for task in result.get("sub_tasks", [])
            ]

            parallel_groups = result.get("parallel_groups", [])

            logger.info(
                f"✅ Plan parsed: {len(sub_tasks)} sub-tasks, "
                f"{len([g for g in parallel_groups if len(g) > 1])} parallel groups"
            )

            return BreakdownAnalysis(
                should_breakdown=True,
                reasoning=result.get("reasoning", "Complex task requiring breakdown"),
                sub_tasks=sub_tasks,
                parallel_groups=parallel_groups
            )

        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse plan response as JSON: {e}")
            return BreakdownAnalysis(
                should_breakdown=False,
                reasoning="Failed to parse plan structure",
                sub_tasks=[],
                parallel_groups=[]
            )
        except Exception as e:
            logger.error(f"❌ Plan parsing failed: {e}")
            return BreakdownAnalysis(
                should_breakdown=False,
                reasoning=f"Plan parsing error: {str(e)}",
                sub_tasks=[],
                parallel_groups=[]
            )

    async def generate_sub_task_prompts(
        self,
        original_prompt: str,
        analysis: BreakdownAnalysis,
        context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Generate detailed prompts for each sub-task.
        
        Each prompt includes:
        - Context from original request
        - Specific step instructions
        - Testing requirements
        - Reference to what previous steps accomplished
        
        Args:
            original_prompt: The original user message
            analysis: The breakdown analysis result
            context: Additional context (project info, etc.)
            
        Returns:
            List of prompt specifications for each sub-task
        """
        prompts = []
        total_tasks = len(analysis.sub_tasks)
        
        for i, sub_task in enumerate(analysis.sub_tasks):
            is_first = i == 0
            is_last = i == total_tasks - 1
            
            # Build the sub-task prompt
            prompt_parts = []
            
            # Overall context with more detail
            project_context = f"Project: {context.get('project_name', 'N/A')}, Task: {context.get('task_name', 'N/A')}"
            
            prompt_parts.append(f"""TASK BREAKDOWN EXECUTION - STEP {sub_task.sequence}/{total_tasks}

CONTEXT: {project_context}

ORIGINAL REQUEST (Full Context):
{original_prompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WORKFLOW BREAKDOWN:
This complex request has been intelligently broken down into {total_tasks} sequential sub-tasks.
You are currently executing: SUB-TASK {sub_task.sequence} of {total_tasks}

""")
            
            # Check if this is a frontend task
            is_frontend_task = any(keyword in sub_task.title.lower() or keyword in sub_task.description.lower()
                                   for keyword in ['frontend', 'ui', 'component', 'page', 'view', 'screen', 'form', 'modal', 'dashboard'])

            # Current sub-task instructions with enhanced formatting
            frontend_ui_guidance = """
🎨 UI/UX REQUIREMENTS (CRITICAL):
- **Minimal & Aesthetic**: Clean, uncluttered design with generous whitespace
- **Modern styling**: Subtle shadows, smooth transitions (150-300ms), proper border-radius
- **Consistent**: Match existing component patterns and color tokens in codebase
- **Polish**: Proper hover states, loading states, empty states, error states
- **AVOID**: Cramped layouts, harsh borders, generic/boring styling, over-engineering

""" if is_frontend_task else ""

            prompt_parts.append(f"""┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  CURRENT SUB-TASK {sub_task.sequence}: {sub_task.title}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

📋 DETAILED REQUIREMENTS:
{sub_task.description}
{frontend_ui_guidance}
🎯 SUCCESS CRITERIA:
- All requirements from the description above are fully implemented
- Code is clean, well-documented, and follows best practices
- All edge cases are handled appropriately
- Implementation is complete and production-ready{" with polished, aesthetic UI" if is_frontend_task else ""}

""")
            
            # Testing requirements - concise since deployment_prompt already has detailed instructions
            if sub_task.testing_requirements and sub_task.testing_requirements.strip():
                prompt_parts.append(f"""━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧪 TEST FOCUS:
{sub_task.testing_requirements}

""")
            
            # Context from previous steps (if not first)
            if not is_first:
                prompt_parts.append(f"""┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  PREVIOUS WORK COMPLETED
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

✅ COMPLETED SUB-TASKS: {i}

The previous {i} sub-task{"s have" if i > 1 else " has"} been completed and tested.
You should:
1. Review the codebase to understand what was implemented
2. Build upon the existing work (don't duplicate)
3. Ensure your implementation integrates seamlessly
4. Consider any files, functions, or components created in previous steps
5. Maintain consistency in coding style and architecture

⚠️ IMPORTANT: Check the existing code before creating new files or functions!

""")
            
            # Next steps hint (if not last)
            if not is_last:
                next_task = analysis.sub_tasks[i + 1]
                prompt_parts.append(f"""┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  UPCOMING NEXT STEP
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

🔮 NEXT SUB-TASK ({sub_task.sequence + 1}/{total_tasks}): {next_task.title}

Description: {next_task.description[:150]}{"..." if len(next_task.description) > 150 else ""}

Consider this upcoming step when making implementation decisions:
- Ensure your code is structured to support the next step
- Create necessary interfaces, exports, or data structures
- Document any important information for the next step
- Keep modularity and extensibility in mind

""")
            
            # Minimal execution reminder - deployment_prompt already has detailed workflow
            prompt_parts.append(f"""━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is step {sub_task.sequence} of {total_tasks} in an automated breakdown.
Implement completely and test the functionality.

""")
            
            full_prompt = "\n".join(prompt_parts)
            
            prompts.append({
                "sequence": sub_task.sequence,
                "title": sub_task.title,
                "description": sub_task.description,
                "prompt": full_prompt,
                "testing_requirements": sub_task.testing_requirements
            })
        
        logger.info(f"✅ Generated {len(prompts)} sub-task prompts")
        return prompts


# Global service instance
task_analysis_service = TaskAnalysisService()

