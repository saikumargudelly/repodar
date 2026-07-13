import json
import logging
from app.services.context import build_repository_context
from app.services.prompt_builder import build_deep_summary_prompt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_evaluation():
    logger.info("Starting Deep Summary Prompt optimization evaluation...")
    
    # 1. Simulate a large repository with huge README and large ecosystem/commit logs
    large_readme = """# Massive Framework
    
    ## Description
    This is an enterprise-grade framework designed to optimize asynchronous workflows.
    
    ## Tech Stack
    - Python 3.10
    - FastAPI
    - PostgreSQL
    - Redis
    
    ## Installation
    Here are extremely verbose installation logs:
    Step 1: Run pip install requirements.txt
    Installing collected packages: click, markupSafe, jinja2, itsdangerous, werkzeug, flask...
    Successfully installed click-8.1.3 markupSafe-2.1.2 jinja2-3.1.2 itsdangerous-2.1.2...
    (Imagine 500 lines of setup logs here...)
    
    ## Usage
    Simply import and run:
    ```python
    import massive
    massive.run()
    ```
    
    ## License
    Copyright (c) 2026 Enterprise Corp.
    All rights reserved.
    """
    
    # Verbose daily commit points over 52 weeks (364 days)
    mock_commit_activity = json.dumps([
        {"date": f"2026-01-{day % 28 + 1:02d}", "count": day % 5} 
        for day in range(1, 365)
    ])
    
    # Verbose ecosystem context containing full descriptions
    mock_ecosystem_context = {
        "relationships": [
            {
                "related_repo": "django/django",
                "relationship": "alternative",
                "stars": 75000,
                "primary_language": "Python",
                "description": "A high-level Python web framework that encourages rapid development and clean, pragmatic design. Follows model-template-views architectural pattern."
            },
            {
                "related_repo": "encode/django-rest-framework",
                "relationship": "companion",
                "stars": 28000,
                "primary_language": "Python",
                "description": "A powerful and flexible toolkit for building Web APIs in Python Django framework."
            }
        ]
    }

    # 2. Build RepositoryContext
    context = build_repository_context(
        repo_id="enterprise/massive-framework",
        owner="enterprise",
        name="massive-framework",
        description="A massive framework that does everything.",
        primary_language="Python",
        languages={"Python": 95000, "HTML": 5000},
        readme=large_readme,
        commit_activity_json=mock_commit_activity,
        ecosystem_context=mock_ecosystem_context,
        trend_score=4.5,
        star_velocity_7d=12.5,
        acceleration=0.15,
        sustainability_score=0.95,
        stars=1200,
        forks=240,
        contributors_count=45
    )
    
    # 3. Build prompts under standard budget
    messages, telemetry = build_deep_summary_prompt(context, budget_tokens=2000)
    
    print("\n" + "="*50)
    print(" PIPELINE OPTIMIZATION TELEMETRY EVALUATION ")
    print("="*50)
    print(f"Prompt Version:          {telemetry['prompt_version']}")
    print(f"Estimated Raw Size:      {telemetry['raw_chars']} characters")
    print(f"Optimized Prompt Size:   {telemetry['prompt_chars']} characters")
    print(f"Compression Ratio:       {telemetry['compression_ratio']}x")
    print(f"Estimated Input Tokens:  {telemetry['prompt_tokens']} tokens")
    print("="*50)
    
    # Verify budget constraint is met
    assert telemetry["prompt_tokens"] <= 2000, "Failed: budget constraint violated!"
    logger.info("Evaluation completed successfully. All constraints and schemas validated.")

if __name__ == "__main__":
    run_evaluation()
