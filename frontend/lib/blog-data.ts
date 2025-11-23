export interface BlogPost {
  slug: string
  title: string
  description: string
  content: string
  publishedAt: string
  modifiedAt?: string
  author: string
  authorImage?: string
  category: string
  tags: string[]
  image: string
  readTime: string
  featured?: boolean
}

export const blogCategories = [
  { name: 'AI Development', slug: 'ai-development' },
  { name: 'Machine Learning', slug: 'machine-learning' },
  { name: 'Developer Tools', slug: 'developer-tools' },
  { name: 'Best Practices', slug: 'best-practices' },
  { name: 'Tutorials', slug: 'tutorials' },
  { name: 'Industry News', slug: 'industry-news' },
]

export const blogPosts: BlogPost[] = [
  {
    slug: 'future-of-ai-powered-development',
    title: 'The Future of AI-Powered Software Development in 2025',
    description: 'Explore how AI is revolutionizing software development, from intelligent code generation to automated testing and deployment. Learn what developers need to know to stay ahead.',
    content: `
# The Future of AI-Powered Software Development in 2025

The software development landscape is undergoing a profound transformation. AI-powered tools are no longer just assistants—they're becoming integral partners in the development process. Here's what's shaping the future.

## The Rise of AI Coding Assistants

AI coding assistants have evolved from simple autocomplete tools to sophisticated partners that understand context, architecture, and best practices. Modern AI assistants can:

- **Generate entire functions** based on natural language descriptions
- **Refactor code** while maintaining functionality and improving readability
- **Identify bugs** before they reach production
- **Suggest optimizations** for performance and security

## Beyond Code Generation

While code generation grabs headlines, AI's impact extends much further:

### Intelligent Testing
AI can now generate comprehensive test suites, identify edge cases humans might miss, and even predict which code changes are most likely to introduce bugs.

### Automated Documentation
Gone are the days of outdated documentation. AI tools can generate and update documentation in real-time as code evolves.

### Smart Code Review
AI-powered code review catches not just syntax errors but architectural issues, security vulnerabilities, and performance bottlenecks.

## What This Means for Developers

Rather than replacing developers, AI amplifies their capabilities:

1. **Focus on creativity**: With AI handling routine tasks, developers can focus on solving complex problems
2. **Faster iteration**: Rapid prototyping and experimentation become the norm
3. **Higher quality**: Automated checks catch issues early, reducing technical debt
4. **Better collaboration**: AI helps bridge communication gaps between team members

## Getting Started with AI Development Tools

If you're looking to integrate AI into your development workflow:

1. Start with code completion and generation tools
2. Gradually adopt AI-powered testing solutions
3. Experiment with AI-assisted code review
4. Explore platforms like Tediux that combine multiple AI capabilities

## The Path Forward

The future belongs to developers who learn to work alongside AI effectively. The key is understanding what AI does well (pattern recognition, automation, consistency) and what humans do better (creativity, judgment, strategic thinking).

At Tediux, we're building tools that enhance developer capabilities rather than replace them. Our AI agents understand your codebase, learn from your patterns, and help you build better software faster. Use credits for AI queries, deployments, and hosting—all in one simple platform.

---

*Ready to experience AI-powered development? [Get started with Tediux credits](/pricing).*
    `,
    publishedAt: '2025-01-15',
    modifiedAt: '2025-01-20',
    author: 'Tediux Team',
    category: 'AI Development',
    tags: ['AI', 'software development', 'future of coding', 'developer tools', 'productivity'],
    image: '/blog/future-ai-development.png',
    readTime: '8 min read',
    featured: true,
  },
  {
    slug: 'ai-code-generation-best-practices',
    title: 'AI Code Generation: Best Practices for Maximum Productivity',
    description: 'Learn how to effectively use AI code generation tools to boost your productivity while maintaining code quality and security. Practical tips from real-world experience.',
    content: `
# AI Code Generation: Best Practices for Maximum Productivity

AI code generation has become a game-changer for developers. But like any powerful tool, getting the most out of it requires understanding how to use it effectively. Here are battle-tested best practices.

## Writing Effective Prompts

The quality of AI-generated code depends heavily on your prompts:

### Be Specific
❌ "Create a function to process data"
✅ "Create a TypeScript function that validates user email addresses using regex and returns true/false"

### Provide Context
Include relevant information about:
- The framework or language being used
- Existing code patterns in your project
- Performance requirements
- Edge cases to handle

### Use Examples
When possible, show the AI what you want:

\`\`\`typescript
// Example: I want functions similar to this pattern
function validateUsername(input: string): ValidationResult {
  if (!input) return { valid: false, error: 'Username is required' }
  if (input.length < 3) return { valid: false, error: 'Username too short' }
  return { valid: true }
}

// Now create: validatePassword function with similar pattern
\`\`\`

## Code Review Is Still Essential

AI-generated code should always be reviewed:

1. **Security**: Check for potential vulnerabilities
2. **Performance**: Verify efficient algorithms
3. **Maintainability**: Ensure code is readable
4. **Tests**: Validate edge cases are handled

## Iterative Refinement

Don't expect perfection on the first try:

1. Generate initial code
2. Test and identify issues
3. Provide feedback to refine
4. Repeat until satisfied

## When NOT to Use AI Code Generation

Some scenarios warrant caution:

- **Security-critical code**: Authentication, encryption
- **Novel algorithms**: Where understanding is crucial
- **Legacy system integration**: Requires deep domain knowledge
- **Regulatory compliance**: Where human accountability is required

## Integrating AI into Your Workflow

### Start Small
Begin with:
- Boilerplate generation
- Test case creation
- Documentation

### Scale Gradually
As you gain confidence:
- Feature implementation
- Refactoring assistance
- Architecture suggestions

## Tools and Platforms

Modern AI development platforms like Tediux combine multiple capabilities:

- **AI Queries**: Chat with agents to build and update your code (credits per query)
- **Automated Deployments**: One-click deploy to production (credits per deployment)
- **Cloud Hosting**: Keep your services running (credits for hosting time)
- **Integrated workflows**: From idea to deployment, all credit-based

## Measuring Success

Track these metrics:
- Time saved on routine tasks
- Code quality metrics (bugs, test coverage)
- Developer satisfaction
- Sprint velocity improvements

## Conclusion

AI code generation is a powerful ally when used correctly. The key is treating it as a collaborative tool that augments your skills rather than a replacement for understanding.

---

*Experience intelligent code generation with [Tediux](/pricing). Use credits for queries, deployments, and hosting.*
    `,
    publishedAt: '2025-01-10',
    author: 'Tediux Team',
    category: 'Best Practices',
    tags: ['AI', 'code generation', 'best practices', 'productivity', 'developer tips'],
    image: '/blog/ai-code-generation.png',
    readTime: '10 min read',
    featured: true,
  },
  {
    slug: 'introduction-to-ai-agents-development',
    title: 'Introduction to AI Agents in Software Development',
    description: 'Understand what AI agents are, how they work in development contexts, and how they\'re changing the way teams build software. A comprehensive guide for developers.',
    content: `
# Introduction to AI Agents in Software Development

AI agents represent the next evolution in development tools. Unlike simple chatbots or autocomplete, agents can understand context, plan actions, and execute complex multi-step tasks. Here's everything you need to know.

## What Are AI Agents?

AI agents are autonomous systems that can:

- **Perceive**: Understand your codebase, requirements, and context
- **Plan**: Break down complex tasks into manageable steps
- **Act**: Execute changes, run tests, and deploy code
- **Learn**: Improve from feedback and outcomes

## How AI Agents Differ from Traditional Tools

| Feature | Traditional Tools | AI Agents |
|---------|------------------|-----------|
| Context Understanding | Limited | Deep |
| Task Complexity | Single-step | Multi-step |
| Adaptability | Rigid | Flexible |
| Learning | None | Continuous |
| Autonomy | Manual | Semi-autonomous |

## Types of Development AI Agents

### Code Generation Agents
These agents write code based on specifications:
- Feature implementation
- Bug fixes
- Refactoring

### Testing Agents
Specialized in quality assurance:
- Test case generation
- Test execution
- Coverage analysis

### DevOps Agents
Handle deployment and operations:
- CI/CD pipeline management
- Infrastructure provisioning
- Monitoring and alerting

### Documentation Agents
Keep documentation current:
- API documentation
- Code comments
- README updates

## How AI Agents Work

### 1. Context Gathering
The agent analyzes:
- Your codebase structure
- Existing patterns and conventions
- Dependencies and integrations
- Recent changes

### 2. Task Planning
Given a goal, the agent:
- Breaks it into subtasks
- Identifies dependencies
- Determines execution order
- Estimates resources needed

### 3. Execution
The agent:
- Makes code changes
- Runs tests
- Validates results
- Handles errors

### 4. Feedback Loop
After execution:
- Results are analyzed
- Approaches are refined
- Knowledge is updated

## Real-World Applications

### Feature Development
\`\`\`
User: "Add user authentication with OAuth2"

Agent Actions:
1. Analyze existing auth patterns
2. Install necessary packages
3. Create auth service module
4. Implement OAuth2 flow
5. Add routes and middleware
6. Create tests
7. Update documentation
\`\`\`

### Bug Investigation
\`\`\`
User: "Users report slow dashboard loading"

Agent Actions:
1. Analyze performance metrics
2. Profile slow queries
3. Identify bottlenecks
4. Suggest optimizations
5. Implement fixes
6. Validate improvements
\`\`\`

## Getting Started with AI Agents

### Choose the Right Platform
Look for:
- Strong context understanding
- Transparent decision-making
- Human oversight capabilities
- Integration with existing tools

### Start with Supervision
Initially:
- Review all agent actions
- Provide feedback
- Set clear boundaries

### Expand Gradually
As trust builds:
- Increase autonomy
- Tackle larger tasks
- Reduce oversight

## Best Practices

1. **Clear Communication**: Give agents precise instructions
2. **Verify Outputs**: Always review generated code
3. **Maintain Oversight**: Keep humans in the loop
4. **Iterative Improvement**: Refine based on results

## The Future of AI Agents

We're moving toward:
- More autonomous agents
- Better collaboration between agents
- Deeper integration with development workflows
- Specialized agents for different domains

## Conclusion

AI agents are transforming software development from a purely manual process to a collaborative human-AI endeavor. Understanding how to work with them effectively is becoming an essential developer skill.

---

*Ready to work with AI agents? [Start with Tediux](/pricing)—credits for queries, deployments, and hosting.*
    `,
    publishedAt: '2025-01-05',
    author: 'Tediux Team',
    category: 'AI Development',
    tags: ['AI agents', 'automation', 'development workflow', 'future of development'],
    image: '/blog/ai-agents-intro.png',
    readTime: '12 min read',
  },
  {
    slug: 'automated-testing-with-ai',
    title: 'Automated Testing with AI: A Complete Guide',
    description: 'Discover how AI is transforming software testing. Learn about AI-powered test generation, intelligent test selection, and predictive quality assurance.',
    content: `
# Automated Testing with AI: A Complete Guide

Testing is one of the most time-consuming aspects of software development. AI is changing that by automating test creation, execution, and maintenance. Here's how to leverage AI for better testing.

## The Testing Challenge

Traditional testing faces several problems:
- **Time-consuming**: Writing comprehensive tests takes significant effort
- **Maintenance burden**: Tests break when code changes
- **Coverage gaps**: Hard to identify all edge cases
- **Flaky tests**: Inconsistent results waste developer time

## How AI Transforms Testing

### Intelligent Test Generation

AI can analyze your code and generate tests automatically:

\`\`\`typescript
// Your function
function calculateDiscount(price: number, userType: string): number {
  if (userType === 'premium') return price * 0.8
  if (userType === 'regular') return price * 0.95
  return price
}

// AI-generated tests
describe('calculateDiscount', () => {
  it('applies 20% discount for premium users', () => {
    expect(calculateDiscount(100, 'premium')).toBe(80)
  })

  it('applies 5% discount for regular users', () => {
    expect(calculateDiscount(100, 'regular')).toBe(95)
  })

  it('applies no discount for unknown user types', () => {
    expect(calculateDiscount(100, 'guest')).toBe(100)
  })

  it('handles edge cases', () => {
    expect(calculateDiscount(0, 'premium')).toBe(0)
    expect(calculateDiscount(-10, 'premium')).toBe(-8) // Potential bug!
  })
})
\`\`\`

### Predictive Test Selection

AI can predict which tests are most likely to catch bugs based on:
- Code changes made
- Historical test results
- Code complexity metrics

### Self-Healing Tests

When UI changes, AI can automatically update:
- Element selectors
- Expected values
- Test assertions

## Types of AI-Powered Testing

### Unit Test Generation
AI analyzes functions and creates comprehensive unit tests covering:
- Happy paths
- Edge cases
- Error conditions
- Boundary values

### Integration Test Automation
AI understands service interactions and generates tests for:
- API contracts
- Data flows
- Error handling
- Performance scenarios

### Visual Regression Testing
AI compares screenshots and identifies:
- Intentional changes
- Unintended regressions
- Cross-browser differences

### Performance Testing
AI can:
- Identify performance bottlenecks
- Generate load test scenarios
- Predict scaling issues

## Implementing AI Testing

### Step 1: Assess Current State
- Review existing test coverage
- Identify testing pain points
- Determine AI integration points

### Step 2: Choose Tools
Consider platforms that offer:
- Integration with your stack
- Customizable test generation
- CI/CD pipeline support

### Step 3: Start Small
Begin with:
- Unit test generation for new code
- Test maintenance automation
- Coverage gap analysis

### Step 4: Measure and Iterate
Track:
- Coverage improvements
- Time saved
- Bug detection rates
- Developer satisfaction

## Best Practices

### Review Generated Tests
Always verify:
- Test logic correctness
- Edge case coverage
- Assertion accuracy

### Combine AI and Human Testing
AI excels at:
- Repetitive testing
- Edge case discovery
- Regression testing

Humans excel at:
- Exploratory testing
- UX evaluation
- Business logic validation

### Maintain Test Quality
- Remove flaky tests
- Update obsolete tests
- Refactor test code

## Common Pitfalls to Avoid

1. **Over-reliance**: Don't assume AI catches everything
2. **Ignoring context**: AI may miss business-specific requirements
3. **Neglecting maintenance**: AI-generated tests still need updates
4. **Skipping review**: Always validate generated tests

## The ROI of AI Testing

Organizations report:
- 40-60% reduction in test creation time
- 30% improvement in bug detection
- 50% decrease in test maintenance effort
- Faster release cycles

## Conclusion

AI-powered testing is not about replacing human testers—it's about augmenting their capabilities. The best results come from combining AI's speed and consistency with human insight and creativity.

---

*Supercharge your testing with [Tediux](/pricing). AI queries, deployments, and hosting—all with simple credits.*
    `,
    publishedAt: '2024-12-28',
    author: 'Tediux Team',
    category: 'Tutorials',
    tags: ['testing', 'AI', 'automation', 'quality assurance', 'test generation'],
    image: '/blog/automated-testing-ai.png',
    readTime: '11 min read',
  },
  {
    slug: 'machine-learning-for-developers',
    title: 'Machine Learning Basics Every Developer Should Know',
    description: 'A practical introduction to machine learning concepts for software developers. Understand ML fundamentals without the complex math.',
    content: `
# Machine Learning Basics Every Developer Should Know

As AI becomes integral to software development, understanding machine learning fundamentals is increasingly valuable. Here's a practical guide for developers.

## What Is Machine Learning?

At its core, machine learning is about teaching computers to learn patterns from data rather than explicitly programming rules.

### Traditional Programming vs ML

**Traditional Programming:**
\`\`\`
Input + Rules → Output
\`\`\`

**Machine Learning:**
\`\`\`
Input + Output → Rules (Model)
\`\`\`

## Types of Machine Learning

### Supervised Learning
The model learns from labeled examples.

**Use cases:**
- Spam detection (email → spam/not spam)
- Price prediction (features → price)
- Image classification (image → category)

### Unsupervised Learning
The model finds patterns in unlabeled data.

**Use cases:**
- Customer segmentation
- Anomaly detection
- Topic discovery

### Reinforcement Learning
The model learns through trial and error.

**Use cases:**
- Game AI
- Robotics
- Resource optimization

## Key Concepts

### Features and Labels
- **Features**: Input variables (what you know)
- **Labels**: Output variables (what you predict)

### Training and Inference
- **Training**: Teaching the model with data
- **Inference**: Using the trained model to make predictions

### Overfitting and Underfitting
- **Overfitting**: Model memorizes training data, fails on new data
- **Underfitting**: Model is too simple, misses patterns

## Common ML Algorithms

### Linear Regression
Best for: Predicting continuous values

\`\`\`python
# Predicting house prices
from sklearn.linear_model import LinearRegression

model = LinearRegression()
model.fit(features, prices)
predicted_price = model.predict(new_house_features)
\`\`\`

### Decision Trees
Best for: Classification with interpretable results

### Neural Networks
Best for: Complex patterns, images, text

### Random Forests
Best for: General-purpose classification/regression

## ML in Development Tools

### Code Completion
Models trained on code predict the next token:
\`\`\`
def calculate_total( → price, quantity):
    return price * quantity
\`\`\`

### Bug Detection
ML identifies patterns associated with bugs:
- Unusual code patterns
- Known vulnerability signatures
- Performance anti-patterns

### Test Generation
Models learn from existing tests to generate new ones:
- Input/output patterns
- Edge case discovery
- Assertion prediction

## Practical ML for Developers

### Using Pre-trained Models
You don't need to train from scratch:
\`\`\`python
from transformers import pipeline

classifier = pipeline("sentiment-analysis")
result = classifier("This product is amazing!")
# Output: [{'label': 'POSITIVE', 'score': 0.99}]
\`\`\`

### Fine-tuning for Your Domain
Adapt general models to your specific needs:
- Use your codebase for training
- Add domain-specific terminology
- Customize for your patterns

### MLOps Basics
Deploying ML models requires:
- Model versioning
- Performance monitoring
- Regular retraining
- A/B testing

## Common Misconceptions

### "ML is Magic"
ML is pattern matching at scale—it needs quality data and proper problem framing.

### "More Data Always Helps"
Quality often matters more than quantity. Bad data leads to bad models.

### "ML Replaces Programming"
ML augments traditional programming. Most applications need both.

## Getting Started

### Learn the Fundamentals
1. Understand basic statistics
2. Learn Python basics
3. Explore scikit-learn tutorials
4. Build simple projects

### Experiment with APIs
Try:
- OpenAI API
- Hugging Face models
- Cloud ML services

### Apply to Real Problems
Start with:
- Simple classification tasks
- Data analysis
- Automation of repetitive tasks

## The Developer's Advantage

As a developer, you have:
- Strong problem-solving skills
- Understanding of data structures
- Experience with APIs and integration
- Practical deployment knowledge

These skills transfer well to ML work.

## Conclusion

You don't need a PhD to use machine learning effectively. Understanding the fundamentals enables you to leverage ML tools, make informed decisions, and build better software.

---

*Build with AI at [Tediux](/pricing)—use credits for AI queries, deployments, and hosting. No ML expertise required.*
    `,
    publishedAt: '2024-12-20',
    author: 'Tediux Team',
    category: 'Machine Learning',
    tags: ['machine learning', 'AI basics', 'developer education', 'ML fundamentals'],
    image: '/blog/ml-for-developers.png',
    readTime: '14 min read',
  },
  {
    slug: 'ai-pair-programming-guide',
    title: 'The Complete Guide to AI Pair Programming',
    description: 'Master the art of AI pair programming. Learn techniques to collaborate effectively with AI assistants and dramatically boost your productivity.',
    content: `
# The Complete Guide to AI Pair Programming

AI pair programming is revolutionizing how developers work. When done right, it combines human creativity with AI's speed and pattern recognition. Here's how to master it.

## What Is AI Pair Programming?

Traditional pair programming involves two developers working together. AI pair programming replaces one human with an AI assistant, creating a unique collaboration dynamic.

### The Human Role
- **Direction**: Set goals and priorities
- **Judgment**: Evaluate solutions and trade-offs
- **Creativity**: Solve novel problems
- **Context**: Provide business and domain knowledge

### The AI Role
- **Speed**: Generate code quickly
- **Memory**: Recall syntax and patterns
- **Consistency**: Apply best practices uniformly
- **Exploration**: Suggest alternatives

## Setting Up for Success

### Choose the Right Tools
Look for AI assistants that:
- Understand your programming language
- Integrate with your IDE
- Support your workflow
- Allow customization

### Configure Your Environment
\`\`\`json
{
  "ai_assistant": {
    "model": "latest",
    "context_window": "large",
    "code_style": "match_project",
    "safety_checks": true
  }
}
\`\`\`

### Prepare Your Codebase
AI works better with:
- Clear project structure
- Consistent naming conventions
- Good documentation
- Type annotations

## Effective Communication Techniques

### Be Explicit About Requirements
❌ "Make the login better"
✅ "Refactor the login function to use async/await, add input validation, and return appropriate error messages for each failure case"

### Provide Context
\`\`\`
Context: We're building a healthcare app with strict HIPAA compliance requirements.

Task: Create a patient data storage service that encrypts PII at rest and in transit.
\`\`\`

### Use Incremental Refinement
1. Start with a basic implementation
2. Review and identify improvements
3. Ask for specific enhancements
4. Repeat until satisfied

## Common Pairing Patterns

### The Driver-Navigator Pattern
**You (Navigator)**: Define what to build
**AI (Driver)**: Write the code

\`\`\`
You: "Create a REST API endpoint for user registration"
AI: [Generates endpoint code]
You: "Add email validation"
AI: [Updates with validation]
You: "Add rate limiting"
AI: [Adds rate limiting middleware]
\`\`\`

### The Explorer Pattern
Use AI to explore options:

\`\`\`
You: "Show me 3 different ways to implement caching here"
AI: [Presents options with trade-offs]
You: "Let's go with option 2, but modify it to..."
\`\`\`

### The Reviewer Pattern
\`\`\`
You: [Paste your code]
"Review this code for potential issues"
AI: [Identifies bugs, security issues, improvements]
You: "Fix issue #2"
AI: [Applies fix]
\`\`\`

## Maximizing Productivity

### Parallelize Work
While AI generates code:
- Review previous outputs
- Plan next steps
- Update documentation
- Write tests

### Use Templates and Patterns
Create reusable prompts:
\`\`\`
Template: "Create a {model_name} CRUD service with:
- Input validation using {validation_library}
- Error handling with custom exceptions
- Logging at INFO level
- Unit tests with >80% coverage"
\`\`\`

### Build on Generated Code
Don't regenerate—iterate:
\`\`\`
You: "Add pagination to the list endpoint above"
AI: [Modifies existing code]
\`\`\`

## Quality Control

### Always Review Generated Code
Check for:
- **Correctness**: Does it do what was asked?
- **Security**: Any vulnerabilities?
- **Performance**: Efficient algorithms?
- **Maintainability**: Readable and well-structured?

### Test Thoroughly
AI can help write tests, but verify:
- Edge cases are covered
- Tests are meaningful
- Mocks are appropriate

### Maintain Standards
Ensure generated code follows:
- Team coding standards
- Project conventions
- Security guidelines

## Common Challenges and Solutions

### Challenge: AI Hallucinates APIs
**Solution**: Always verify API calls against documentation

### Challenge: Context Gets Lost
**Solution**: Periodically summarize the current state

### Challenge: Over-engineered Solutions
**Solution**: Be explicit about simplicity requirements

### Challenge: Inconsistent Style
**Solution**: Provide style guides and examples

## Advanced Techniques

### Chain-of-Thought Prompting
Ask AI to explain its reasoning:
\`\`\`
"Before writing the code, explain your approach for implementing this caching layer"
\`\`\`

### Few-Shot Learning
Provide examples of what you want:
\`\`\`
"Here's how we handle errors in this project:
[example code]

Now implement error handling for the new service following this pattern"
\`\`\`

### Constraint-Based Prompting
Set clear boundaries:
\`\`\`
"Implement this feature using only standard library functions, no external dependencies"
\`\`\`

## Measuring Success

Track these metrics:
- Code quality scores
- Time to implementation
- Bug rates
- Developer satisfaction
- Review feedback

## The Future of AI Pair Programming

We're moving toward:
- More context-aware assistants
- Proactive suggestions
- Multi-file understanding
- Autonomous subtask completion

## Conclusion

AI pair programming is a skill that improves with practice. The key is finding the right balance between leveraging AI's capabilities and maintaining human oversight and creativity.

---

*Experience next-level AI pair programming with [Tediux](/pricing). Credits power your queries, deployments, and hosting.*
    `,
    publishedAt: '2024-12-15',
    author: 'Tediux Team',
    category: 'Developer Tools',
    tags: ['pair programming', 'AI collaboration', 'productivity', 'developer workflow'],
    image: '/blog/ai-pair-programming.png',
    readTime: '13 min read',
    featured: true,
  },
]

// Helper function to get blog post by slug
export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug)
}

// Helper function to get featured posts
export function getFeaturedPosts(): BlogPost[] {
  return blogPosts.filter((post) => post.featured)
}

// Helper function to get posts by category
export function getPostsByCategory(category: string): BlogPost[] {
  return blogPosts.filter((post) => post.category === category)
}

// Helper function to get posts by tag
export function getPostsByTag(tag: string): BlogPost[] {
  return blogPosts.filter((post) => post.tags.includes(tag))
}

// Helper function to get recent posts
export function getRecentPosts(count: number = 5): BlogPost[] {
  return [...blogPosts]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, count)
}
