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


@dataclass
class BreakdownAnalysis:
    """Result of analyzing a prompt for task breakdown"""
    should_breakdown: bool
    reasoning: str
    sub_tasks: List[SubTaskSpec]


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
            
            # Current sub-task instructions with enhanced formatting
            prompt_parts.append(f"""┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  CURRENT SUB-TASK {sub_task.sequence}: {sub_task.title}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

📋 DETAILED REQUIREMENTS:
{sub_task.description}

🎯 SUCCESS CRITERIA:
- All requirements from the description above are fully implemented
- Code is clean, well-documented, and follows best practices
- All edge cases are handled appropriately
- Implementation is complete and production-ready

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

