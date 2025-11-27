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
            system_prompt = """You are an expert software project manager and technical architect analyzing user requests.

Your job is to determine if a user's request contains multiple distinct steps that should be executed sequentially, and if so, break them down into detailed, actionable sub-tasks.

WHEN TO BREAKDOWN:
- User provides numbered or bulleted list of tasks
- Request contains phrases like "and then", "after that", "next", "followed by"
- Multiple distinct features or components are mentioned
- Complex workflow with clear sequential dependencies
- User explicitly asks for multiple things to be done in order
- Request involves multiple files or components

WHEN NOT TO BREAKDOWN:
- Single cohesive task (even if complex)
- Request is vague or unclear
- Steps are not clearly sequential
- Only 1-2 simple steps
- Request is a question or discussion

IMPORTANT GUIDELINES FOR SUB-TASKS:
1. Keep descriptions concise and actionable (50-120 words)
2. Focus on WHAT to build, not HOW (workflow instructions are provided elsewhere)
3. Include key files/components and success criteria
4. Testing requirements should focus on WHAT to verify, not testing methodology

RESPONSE FORMAT:
Return a JSON object with this structure:
{
    "should_breakdown": boolean,
    "reasoning": "Clear explanation of why breakdown is/isn't needed (2-3 sentences)",
    "sub_tasks": [
        {
            "sequence": 1,
            "title": "Clear, action-oriented title (5-10 words)",
            "description": "What to build: key features, main files/components, and success criteria. Concise and focused. (50-120 words)",
            "testing_requirements": "What to verify: key scenarios and expected behavior (login works, form validates, data displays correctly). Brief - don't repeat testing methodology."
        }
    ]
}

If should_breakdown is false, sub_tasks should be an empty array.
If should_breakdown is true, provide 2-8 sub-tasks (optimal range).
Keep it concise - detailed workflow instructions are provided separately.
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
                model="gpt-4o-mini",  # Fast and cost-effective
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,  # Lower temperature for more consistent analysis
                max_tokens=2000,
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

