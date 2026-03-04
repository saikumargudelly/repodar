# Contributing to Repodar

Want to help make Repodar better? Great! We love contributions — whether it's bug reports, feature ideas, or full pull requests.

First, check out our [Code of Conduct](./CODE_OF_CONDUCT.md). TL;DR: be kind, be respectful, report problems.

## 🐛 Found a Bug?

Open an issue and tell us:
- What happened (clear title)
- How to recreate it
- What you expected vs what you got
- A screenshot or error log if possible
- Your setup (OS, Python version, etc.)

## 💡 Have an Idea?

Love it. Before you start:
1. Check [existing issues](../../issues) and [roadmap](./ROADMAP.md) — someone might already be working on it
2. Describe what problem it solves
3. Show how it helps developers
4. Include an example or two

## 🔧 Ready to Code?

Here's the flow:

1. **Fork the repo**
2. **Create a branch**: `git checkout -b feature/my-cool-feature`
3. **Make your changes** (follow our [code standards](#code-standards) below)
4. **Write tests** (new code = new tests)
5. **Update docs** if you changed user-facing stuff
6. **Commit with clear messages**: describe *what* and *why*
7. **Push to your fork**
8. **Open a PR** with a description of what you did and why

**PR Tips:**
- Title format: `[FEATURE/BUG/DOCS] What you did`
- Link related issues: `Fixes #123` or `Relates to #456`
- Include tests for new functionality
- Update README if needed
- No breaking changes without discussion

## 💻 Code Standards

### Python (Backend)

Keep it clean and typed:
- Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/)
- Add type hints: `def score(stars: int) -> float:`
- Write docstrings (explain the *why*, not just the *what*)
- Include tests for new functionality — good coverage keeps things stable
- Format with `black`, lint with `flake8`

```python
def calculate_trend_score(velocity: float, acceleration: float) -> float:
    """Calculate TrendScore from momentum signals."""
    return (velocity * 0.6) + (acceleration * 0.4)
```

### TypeScript/React (Frontend)

Type-first and accessible:
- Follow [Airbnb Style Guide](https://github.com/airbnb/javascript)
- Use TypeScript everywhere
- Component names: `PascalCase`, filenames: `kebab-case`
- Add JSDoc for complex components
- Use semantic HTML + ARIA labels
- Test components with React Testing Library

```typescript
/** Circular gauge showing TrendScore (0-100) */
function TrendGauge({ pct, label }: GaugeProps) {
  const color = LABEL_COLOR[label ?? "YELLOW"] ?? "#f59e0b";
  // render SVG arc based on pct
}
```

### Database Schema

Use Alembic:
- File naming: `[timestamp]_description.py`
- Always include upgrade AND downgrade
- Test on sample data before PR

## 🧪 Testing

Run tests before you commit:

```bash
# Backend
cd backend && python -m pytest tests/ -v --cov=app

# Frontend
cd frontend && npm test -- --coverage
```

Aim for great coverage — it catches bugs early.

## 📝 Documentation

Update docs when you change stuff:
- **User-facing changes?** Update [README.md](./README.md)
- **New features?** Add to [ROADMAP.md](./ROADMAP.md)
- **Code changes?** Write docstrings + comments
- **Complex components?** Add JSDoc or inline explanations

Keep it simple. You're writing for humans, not machines.

## 🚀 Local Development

Get up and running:

```bash
# Setup
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ../frontend && npm install

# Run (2 terminals)
# Terminal 1
cd backend && python -m uvicorn app.main:app --reload

# Terminal 2
cd frontend && npm run dev

# Setup database
cd backend && alembic upgrade head
```

Now you have a local environment. Change stuff. Test it. Done.

## 🤔 Looking for Ideas?

Check these areas — they need love:

- **Auto-Discovery**: Add new categories, improve signal detection
- **Scoring**: Refine TrendScore, validate SustainabilityScore with feedback
- **API**: New endpoints, webhooks, filtering options
- **Frontend**: Dark mode, mobile responsiveness, accessibility
- **Docs**: Architecture guides, deployment docs, tutorials

Or pick something from [ROADMAP.md](./ROADMAP.md)!

## 💬 Need Help?

- **Confused?** Open an issue and ask
- **Want to discuss?** Use [GitHub Discussions](../../discussions)
- **Direct help?** Contact maintainers on GitHub

## 📄 License & Thanks

By contributing, your code gets licensed under [AGPL-3.0](./LICENSE) — same as the project.

We'll credit you in release notes and monthly updates. And honestly? Your contribution makes Repodar better for everyone. That's the real thank you. 🚀
