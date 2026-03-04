# Repodar Roadmap

This roadmap outlines the planned features and improvements for Repodar over the coming quarters. We're committed to building the most comprehensive AI/ML ecosystem radar for the developer community.

**Last Updated:** March 2026

---

## 🎯 Vision

Transform how developers discover, track, and understand emerging AI/ML projects through real-time signals, intelligent scoring, and actionable insights.

---

## 📅 Current Status (Q1 2026)

### ✅ Shipped
- Real-time GitHub trending leaderboard (multiple time windows)
- TrendScore + SustainabilityScore dual-signal system
- Auto-discovery engine (380+ tracked repos)
- Embeddable widget + SVG badges
- Signal explainer with 6+ metrics
- Comparison mode (2-5 repos side-by-side)
- Language & tech stack radar
- LLM-powered weekly reports
- Category-based organization (13+ categories)

---

## 🚀 Q2 2026: Enhanced Discovery & AI Features

### In Progress
- [ ] **Advanced Filtering API**
  - Filter by: language, category, star range, age, activity level
  - REST endpoint: `GET /api/repos?language=python&minStars=1000&maxVelocity=100`
  - GraphQL endpoint for complex queries
  - Save & share filter presets

- [ ] **AI-Powered Recommendations**
  - "Similar repos" suggestions based on signals
  - Personalized watchlist: repos trending in your interests
  - Trending before it trends: ML model predicts next hot repos
  - Email digests with curated recommendations

- [ ] **Webhook + Notifications**
  - Real-time alerts when repo crosses scoring thresholds
  - Custom triggers: "Notify me when TrendScore > 80 in LLM category"
  - Slack, Discord, email integrations
  - GitHub issue creation on major milestones

### Not Yet Started
- [ ] **Community Radar Collaboration**
  - User-curated collections: "Top 10 LLMs to watch"
  - Voting/reactions on trending repos
  - Shared lists with GitHub teams
  - Public vs private visibility controls

---

## 📊 Q3 2026: Enterprise & Analytics

### Roadmap Items
- [ ] **Time-Series Export**
  - CSV/JSON download: full 90-day history for any repo
  - Bulk export of category snapshots
  - API for programmatic data access

- [ ] **Enhanced Analytics Dashboard**
  - Cohort analysis: track groups of repos over time
  - Trend correlation: which signals predict sustainability?
  - Emerging trends report: weekly/monthly swings
  - Export as PDF reports for presentations

- [ ] **Dashboard Customization**
  - Custom widgets: pick metrics to display
  - Personalized landing page
  - Save query presets (compare these 5 repos daily)
  - Dark/light theme improvements

- [ ] **API Enhancements**
  - Rate limit increases for paid tiers
  - Batch endpoints: fetch 50+ repos in one call
  - Webhook delivery guarantees (retry logic)
  - API documentation portal

---

## 🔧 Q4 2026: Scaling & Performance

### Infrastructure
- [ ] **Database Optimization**
  - Index improvements for faster trending queries
  - Caching layer for frequently accessed repos
  - Time-series data compression
  - Query performance targets: p99 < 200ms

- [ ] **Frontend Performance**
  - Incremental static regeneration (ISR) for ranking pages
  - Virtual scrolling for large repo lists
  - Service worker for offline access
  - Image optimization & lazy loading

- [ ] **Auto-Discovery Expansion**
  - Support for alternative platforms: GitLab, Gitea
  - Monorepo tracking (e.g., meta-llama/llama has multiple projects)
  - GitHub enterprise integration
  - Custom repository sources

### Reliability
- [ ] **Alerting & Monitoring**
  - Uptime monitoring for APIs
  - Data freshness alerts
  - Ingestion pipeline health dashboard
  - Error tracking & debugging tools

---

## 🌟 Future Considerations (2027+)

### Long-Term Opportunities
- **Ecosystem Maturity Index**: Full community health scoring (not just trending)
- **Dependency Graph Analysis**: Track AI/ML project dependencies at scale
- **Developer Insights**: Identify key contributors, skill matching
- **Funding & Investment Tracking**: Link trending repos to funding rounds
- **Job Market Integration**: Demand signals for skills from trending tools
- **Research Paper Integration**: Link projects to ArXiv papers
- **Community Insights**: Track discussions, issues, pull requests at scale
- **Burnout Detection**: Identify project health risks before problems surface

---

## 🔄 Ongoing Initiatives

### Continuous Improvements
- **Category Refinement**: Add emerging AI/ML subdomains (AgentFrameworks, VectorDBs, etc.)
- **Scoring Algorithm Tuning**: Feedback loop to improve TrendScore accuracy
- **Performance**: Reduce TTFB, improve query speeds, optimize storage
- **Content**: Blog posts, tutorials, case studies on detected trends
- **Community**: Discord community, monthly virtual meetups

### Documentation & Content
- Architecture documentation (systems design)
- Deployment guides (self-hosting)
- API reference documentation
- Scoring methodology deep-dives
- Case studies: "Why did Ollama trend?"

---

## 💡 Under Consideration

These items require community feedback or further research:

- **GitHub Sponsorship Integration**: Track sponsors trend alongside code trends
- **Multi-Region Support**: Local mirrors in different regions
- **Price/Performance Analysis**: Track repo maintenance costs vs adoption
- **Security Scanning**: Automated vulnerability detection in trending repos
- **Code Quality Metrics**: GitHub CodeQL integration for quality trends

---

## 🤝 How to Contribute to Roadmap

1. **Vote on Features**: Open a discussion for features you'd like to see
2. **Implement Roadmap Items**: Check our [Contributing Guide](./CONTRIBUTING.md)
3. **Report Bugs**: File issues blocking roadmap items
4. **Community Input**: Suggest reordering priorities based on your needs

---

## 📞 Questions?

- **GitHub Issues**: Report bugs or limitations
- **Discussions**: Propose ideas and roadmap changes
- **Email**: Reach out to maintainers for strategic partnerships

---

**Made with ❤️ by the Repodar community**
