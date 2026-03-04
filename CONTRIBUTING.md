# Contributing to Repodar

Thank you for your interest in contributing to Repodar! We welcome contributions from the community to help improve our AI/ML ecosystem radar. This document outlines how you can get involved.

## 🤝 Code of Conduct

This project adheres to a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## 🚀 How to Contribute

### 1. **Report Bugs**

If you find a bug, please open an issue with:
- A clear, descriptive title
- A detailed description of the issue
- Steps to reproduce the behavior
- Expected vs. actual behavior
- Screenshots or error logs (if applicable)
- Your environment details (OS, Python/Node version, etc.)

### 2. **Suggest Enhancements**

We love feature ideas! Before submitting, check existing [issues](../../issues) and [roadmap](./ROADMAP.md) to avoid duplicates.

When proposing a feature:
- Describe the problem it solves
- Explain how it benefits the AI/ML community
- Include use cases and examples
- Consider performance and scalability implications

### 3. **Submit Pull Requests**

#### Pre-submission checklist:
- [ ] Fork the repository
- [ ] Create a feature branch: `git checkout -b feature/your-feature-name`
- [ ] Make your changes following our [code standards](#code-standards)
- [ ] Write or update tests (if applicable)
- [ ] Update documentation
- [ ] Commit with clear, descriptive messages
- [ ] Push to your fork
- [ ] Open a PR with a clear description

#### Pull Request Guidelines:
- **Title**: Use format `[FEATURE/BUG/DOCS] Brief description`
- **Description**: Clearly explain what changes were made and why
- **Link issues**: Reference related issues using `Fixes #123` or `Relates to #456`
- **Tests**: Include tests for new functionality
- **Documentation**: Update README, API docs, or inline comments as needed
- **No breaking changes** without discussion

## 📋 Code Standards

### Backend (Python/FastAPI)
- Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/) style guidelines
- Use type hints for function arguments and returns
- Write docstrings for classes and public methods
- Maintain > 70% test coverage for new code
- Use `pytest` for testing
- Format with `black` and lint with `flake8`

**Example:**
```python
def calculate_trend_score(
    velocity: float,
    acceleration: float,
    fork_ratio: float
) -> float:
    """
    Calculate composite TrendScore based on multiple signals.
    
    Args:
        velocity: 7-day star velocity per day
        acceleration: Momentum change vs prior week
        fork_ratio: Fork-to-star ratio
        
    Returns:
        Normalized score (0-100)
    """
    # Implementation here
    pass
```

### Frontend (Next.js/React/TypeScript)
- Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- Use TypeScript for type safety
- Component names: PascalCase
- File names: kebab-case (e.g., `trend-gauge.tsx`)
- Write JSDoc comments for complex components
- Use semantic HTML and ARIA labels for accessibility
- Test with React Testing Library

**Example:**
```typescript
/**
 * Renders a circular gauge showing TrendScore (0-100)
 * @param pct - Percentage value (0-100)
 * @param label - Sustainability label (GREEN, YELLOW, RED)
 */
function TrendGauge({ pct, label }: { pct: number; label: string | null }) {
  // Implementation here
}
```

### Database Migrations
- Use Alembic for schema changes
- Naming: `[timestamp]_[description].py`
- Include both upgrade and downgrade paths
- Test migrations on dev data before PR

## 🧪 Testing

### Backend Tests
```bash
cd backend
.venv/bin/python -m pytest tests/ -v --cov=app --cov-report=html
```

### Frontend Tests
```bash
cd frontend
npm test -- --coverage
```

## 📚 Documentation

- Update [README.md](./README.md) for user-facing changes
- Add docstrings to Python functions
- Include JSDoc comments in TypeScript/React
- Update [ROADMAP.md](./ROADMAP.md) for planned features
- Use clear, concise language
- Include examples where helpful

## 🔄 Development Workflow

1. **Setup Development Environment**
   ```bash
   # Backend
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   
   # Frontend
   cd ../frontend
   npm install
   ```

2. **Run Local Services**
   ```bash
   # Terminal 1: Backend
   cd backend && .venv/bin/python -m uvicorn app.main:app --reload --port 8000
   
   # Terminal 2: Frontend
   cd frontend && npm run dev
   ```

3. **Database Migrations**
   ```bash
   cd backend
   alembic upgrade head
   ```

## 🎯 Priority Areas

Looking for where to contribute? These areas need help:

1. **Auto-Discovery Engine Improvements**
   - Expand category coverage
   - Improve trending signal detection
   - Add new search domains

2. **Scoring Algorithm Refinements**
   - Enhance TrendScore calculations
   - Better sustainability metrics
   - Community feedback integration

3. **API Enhancements**
   - New endpoints for advanced filtering
   - Webhook support for notifications
   - GraphQL integration

4. **Frontend/UX**
   - Dark/light theme improvements
   - Mobile responsive design
   - Accessibility enhancements

5. **Documentation**
   - Architecture diagrams
   - Deployment guides
   - API reference improvements

## 📞 Questions or Need Help?

- **Issues**: Open a discussion issue for questions
- **Community**: [GitHub Discussions](../../discussions)
- **Email**: Contact maintainers via GitHub

## 📄 License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0 License](./LICENSE).

## ✨ Recognition

We recognize and appreciate all contributors! Contributors will be:
- Added to the project contributors list
- Credited in release notes
- Featured in monthly community updates

---

**Thank you for making Repodar better!** 🚀
