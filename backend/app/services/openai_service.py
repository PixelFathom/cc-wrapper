"""OpenAI service for GPT-4 mini integration"""
import logging
from typing import List, Dict, Optional
from openai import AsyncOpenAI
from pydantic import BaseModel
from app.core.settings import get_settings

settings = get_settings()

logger = logging.getLogger(__name__)


class ConversationMessage(BaseModel):
    role: str  # 'user', 'assistant', 'system'
    content: str


class ContinuationEvaluation(BaseModel):
    needs_continuation: bool
    continuation_prompt: Optional[str] = None
    confidence: float = 0.0
    reasoning: str = ""


class OpenAIService:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key
        )
        self.model = "gpt-4o-mini"  # Using GPT-4 mini as requested
        
    async def evaluate_conversation_completeness(
        self, 
        messages: List[ConversationMessage]
    ) -> ContinuationEvaluation:
        """
        Evaluate if a conversation needs continuation using GPT-4 mini
        """
        try:
            # Prepare the conversation history for evaluation
            conversation_history = "\n".join([
                f"{msg.role.upper()}: {msg.content}" 
                for msg in messages
            ])
            
            # Create the evaluation prompt
            system_prompt = """You are an AI assistant that evaluates conversations between users and another AI assistant.
Your task is to determine if the assistant's last response appears incomplete or if the user would benefit from additional information.

Analyze the conversation and return a JSON response with:
1. needs_continuation: boolean - true if the response seems incomplete or could benefit from more information
2. continuation_prompt: string - a follow-up question to ask the assistant (only if needs_continuation is true)
3. confidence: float - how confident you are in your assessment (0.0 to 1.0)
4. reasoning: string - brief explanation of your decision

Consider these factors:
- Does the response fully address the user's question?
- Are there obvious missing pieces of information?
- Does the response end abruptly or with phrases like "Would you like me to continue?"
- Is the task clearly incomplete (e.g., only partial code implementation)?
- Does the response indicate there's more to explain?

Be conservative - only suggest continuation if clearly needed."""

            evaluation_prompt = f"""Analyze this conversation and determine if it needs continuation:

{conversation_history}

Return your evaluation as a JSON object."""

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": evaluation_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,  # Lower temperature for more consistent evaluation
                max_tokens=500
            )
            
            result = response.choices[0].message.content
            if result:
                import json
                evaluation_data = json.loads(result)
                
                return ContinuationEvaluation(
                    needs_continuation=evaluation_data.get("needs_continuation", False),
                    continuation_prompt=evaluation_data.get("continuation_prompt"),
                    confidence=evaluation_data.get("confidence", 0.0),
                    reasoning=evaluation_data.get("reasoning", "")
                )
            
            return ContinuationEvaluation(needs_continuation=False, reasoning="No response from model")
            
        except Exception as e:
            logger.error(f"Error evaluating conversation completeness: {str(e)}")
            return ContinuationEvaluation(
                needs_continuation=False, 
                reasoning=f"Error during evaluation: {str(e)}"
            )
    
    async def generate_continuation_prompt(
        self, 
        messages: List[ConversationMessage],
        context: Optional[str] = None
    ) -> Optional[str]:
        """
        Generate a continuation prompt if the default one from evaluation isn't suitable
        """
        try:
            conversation_history = "\n".join([
                f"{msg.role.upper()}: {msg.content}" 
                for msg in messages[-5:]  # Last 5 messages for context
            ])
            
            system_prompt = """You are an AI assistant that helps generate follow-up questions to continue incomplete conversations.
Generate a natural, context-aware follow-up question that would help the assistant provide the missing information.
The question should be specific and directly address what seems to be missing from the response."""

            prompt = f"""Based on this conversation, generate a follow-up question to get the missing information:

{conversation_history}

{f"Additional context: {context}" if context else ""}

Generate a single, clear follow-up question:"""

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=150
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error generating continuation prompt: {str(e)}")
            return None


# Singleton instance
openai_service = OpenAIService()