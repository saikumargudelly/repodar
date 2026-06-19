"""create_materialized_views

Revision ID: f6e8ab0e36a7
Revises: a6b1c6f58761
Create Date: 2026-06-19 18:10:30.783972

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6e8ab0e36a7'
down_revision: Union[str, Sequence[str], None] = 'a6b1c6f58761'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # 1. JSONB conversion (with explicit cast)
        op.execute("ALTER TABLE repositories ALTER COLUMN topics TYPE JSONB USING NULLIF(topics, '')::jsonb")
        op.execute("ALTER TABLE daily_metrics ALTER COLUMN language_breakdown TYPE JSONB USING NULLIF(language_breakdown, '')::jsonb")

        # 2. GIN Indexes
        op.execute("CREATE INDEX idx_repo_topics_gin ON repositories USING gin(topics)")
        op.execute("CREATE INDEX idx_dm_lang_breakdown_gin ON daily_metrics USING gin(language_breakdown)")

        # 3. Materialized Views
        # mv_language_radar
        op.execute("""
            CREATE MATERIALIZED VIEW mv_language_radar AS
            WITH latest_cm AS (
                SELECT cm.* FROM computed_metrics cm
                JOIN (SELECT repo_id, MAX(date) as max_date FROM computed_metrics GROUP BY repo_id) m
                  ON cm.repo_id = m.repo_id AND cm.date = m.max_date
            ),
            latest_dm AS (
                SELECT dm.* FROM daily_metrics dm
                JOIN (SELECT repo_id, MAX(captured_at) as max_cap FROM daily_metrics GROUP BY repo_id) m
                  ON dm.repo_id = m.repo_id AND dm.captured_at = m.max_cap
            ),
            repo_langs AS (
                SELECT DISTINCT r.id as repo_id, r.category, r.owner, r.name, r.stars_snapshot,
                       l.lang, latest_cm.trend_score, latest_cm.star_velocity_7d, latest_cm.sustainability_score
                FROM repositories r
                JOIN latest_cm ON r.id = latest_cm.repo_id
                LEFT JOIN latest_dm ON r.id = latest_dm.repo_id
                CROSS JOIN LATERAL (
                    SELECT r.primary_language AS lang WHERE r.primary_language IS NOT NULL AND r.primary_language != ''
                    UNION
                    SELECT jsonb_object_keys(latest_dm.language_breakdown) AS lang WHERE latest_dm.language_breakdown IS NOT NULL
                ) l
                WHERE r.is_active = true AND l.lang IS NOT NULL AND l.lang != ''
            )
            SELECT
                lang AS language,
                COUNT(*)::integer AS repo_count,
                SUM(stars_snapshot)::integer AS total_stars,
                AVG(trend_score)::double precision AS avg_trend_score,
                AVG(sustainability_score)::double precision AS avg_sustainability_score,
                SUM(star_velocity_7d)::double precision AS weekly_star_velocity,
                (array_agg(owner || '/' || name ORDER BY trend_score DESC))[1] AS top_repo,
                string_agg(DISTINCT category, ',') AS categories
            FROM repo_langs
            GROUP BY lang;
        """)
        op.execute("CREATE UNIQUE INDEX idx_mv_language_radar_lang ON mv_language_radar (language)")

        # mv_topic_momentum
        op.execute("""
            CREATE MATERIALIZED VIEW mv_topic_momentum AS
            WITH latest_cm AS (
                SELECT cm.* FROM computed_metrics cm
                JOIN (SELECT repo_id, MAX(date) as max_date FROM computed_metrics GROUP BY repo_id) m
                  ON cm.repo_id = m.repo_id AND cm.date = m.max_date
            ),
            repo_topics AS (
                SELECT r.id as repo_id, r.owner, r.name, r.stars_snapshot,
                       jsonb_array_elements_text(r.topics) AS topic,
                       latest_cm.trend_score, latest_cm.star_velocity_7d, latest_cm.acceleration
                FROM repositories r
                JOIN latest_cm ON r.id = latest_cm.repo_id
                WHERE r.is_active = true AND r.topics IS NOT NULL
            ),
            topic_stats AS (
                SELECT
                    topic,
                    COUNT(*)::integer AS repo_count,
                    AVG(trend_score)::double precision AS avg_trend_score,
                    SUM(star_velocity_7d)::double precision AS total_star_velocity,
                    AVG(acceleration)::double precision AS avg_acceleration,
                    jsonb_agg(
                        jsonb_build_object(
                            'owner', owner,
                            'name', name,
                            'trend_score', trend_score,
                            'stars', stars_snapshot
                        ) ORDER BY trend_score DESC
                    ) AS all_repos
                FROM repo_topics
                GROUP BY topic
            )
            SELECT
                topic,
                repo_count,
                avg_trend_score,
                total_star_velocity,
                avg_acceleration,
                (
                    SELECT jsonb_agg(elem)
                    FROM (
                        SELECT elem FROM jsonb_array_elements(all_repos) elem LIMIT 5
                    ) sub
                ) AS top_repos
            FROM topic_stats;
        """)
        op.execute("CREATE UNIQUE INDEX idx_mv_topic_momentum_topic ON mv_topic_momentum (topic)")

        # mv_leaderboard
        op.execute("""
            CREATE MATERIALIZED VIEW mv_leaderboard AS
            SELECT
                (row_number() OVER (ORDER BY cm.trend_score DESC))::integer as rank,
                r.id AS repo_id,
                r.owner,
                r.name,
                r.category,
                r.github_url,
                r.primary_language,
                r.age_days,
                r.stars_snapshot AS current_stars,
                cm.trend_score,
                cm.acceleration,
                cm.star_velocity_7d,
                cm.sustainability_score,
                cm.sustainability_label
            FROM repositories r
            JOIN computed_metrics cm ON r.id = cm.repo_id
            JOIN (
                SELECT repo_id, MAX(date) AS max_date
                FROM computed_metrics
                GROUP BY repo_id
            ) latest_cm ON cm.repo_id = latest_cm.repo_id AND cm.date = latest_cm.max_date
            WHERE r.is_active = true;
        """)
        op.execute("CREATE UNIQUE INDEX idx_mv_leaderboard_repo ON mv_leaderboard (repo_id)")

        # mv_org_health
        op.execute("""
            CREATE MATERIALIZED VIEW mv_org_health AS
            WITH org_repos AS (
                SELECT
                    r.owner,
                    COUNT(*)::integer AS repo_count,
                    SUM(r.stars_snapshot)::integer AS total_stars,
                    SUM(dm.forks)::integer AS total_forks,
                    SUM(dm.open_issues)::integer AS total_open_issues,
                    SUM(dm.contributors)::integer AS total_contributors,
                    AVG(cm.sustainability_score)::double precision AS avg_sustainability_score,
                    AVG(cm.trend_score)::double precision AS avg_trend_score,
                    COUNT(CASE WHEN cm.sustainability_label = 'GREEN' THEN 1 END)::integer AS green_repos,
                    COUNT(CASE WHEN cm.sustainability_label = 'YELLOW' THEN 1 END)::integer AS yellow_repos,
                    COUNT(CASE WHEN cm.sustainability_label = 'RED' THEN 1 END)::integer AS red_repos
                FROM repositories r
                JOIN (
                    SELECT repo_id, MAX(date) AS max_date
                    FROM computed_metrics
                    GROUP BY repo_id
                ) latest_cm ON r.id = latest_cm.repo_id
                JOIN computed_metrics cm ON cm.repo_id = latest_cm.repo_id AND cm.date = latest_cm.max_date
                LEFT JOIN (
                    SELECT dm_sub.repo_id, dm_sub.forks, dm_sub.open_issues, dm_sub.contributors
                    FROM daily_metrics dm_sub
                    JOIN (
                        SELECT repo_id, MAX(captured_at) AS max_captured
                        FROM daily_metrics
                        GROUP BY repo_id
                    ) latest_dm ON dm_sub.repo_id = latest_dm.repo_id AND dm_sub.captured_at = latest_dm.max_captured
                ) dm ON r.id = dm.repo_id
                WHERE r.is_active = true
                GROUP BY r.owner
            )
            SELECT
                owner AS org,
                repo_count,
                total_stars,
                total_forks,
                total_open_issues,
                total_contributors,
                avg_sustainability_score,
                avg_trend_score,
                green_repos,
                yellow_repos,
                red_repos
            FROM org_repos;
        """)
        op.execute("CREATE UNIQUE INDEX idx_mv_org_health_org ON mv_org_health (org)")

    else:
        # SQLite Views
        op.execute("""
            CREATE VIEW mv_language_radar AS
            SELECT
                primary_language AS language,
                COUNT(*) AS repo_count,
                SUM(stars_snapshot) AS total_stars,
                0.0 AS avg_trend_score,
                0.0 AS avg_sustainability_score,
                0.0 AS weekly_star_velocity,
                '' AS top_repo,
                '' AS categories
            FROM repositories
            WHERE is_active = 1 AND primary_language IS NOT NULL AND primary_language != ''
            GROUP BY primary_language;
        """)

        op.execute("""
            CREATE VIEW mv_topic_momentum AS
            SELECT
                'dummy' AS topic,
                0 AS repo_count,
                0.0 AS avg_trend_score,
                0.0 AS total_star_velocity,
                0.0 AS avg_acceleration,
                '[]' AS top_repos;
        """)

        op.execute("""
            CREATE VIEW mv_leaderboard AS
            SELECT
                1 as rank,
                id AS repo_id,
                owner,
                name,
                category,
                github_url,
                primary_language,
                age_days,
                stars_snapshot AS current_stars,
                0.0 AS trend_score,
                0.0 AS acceleration,
                0.0 AS star_velocity_7d,
                0.0 AS sustainability_score,
                'YELLOW' AS sustainability_label
            FROM repositories;
        """)

        op.execute("""
            CREATE VIEW mv_org_health AS
            SELECT
                owner AS org,
                COUNT(*) AS repo_count,
                SUM(stars_snapshot) AS total_stars,
                0 AS total_forks,
                0 AS total_open_issues,
                0 AS total_contributors,
                0.0 AS avg_sustainability_score,
                0.0 AS avg_trend_score,
                0 AS green_repos,
                0 AS yellow_repos,
                0 AS red_repos
            FROM repositories
            GROUP BY owner;
        """)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS idx_mv_org_health_org")
        op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_org_health")
        op.execute("DROP INDEX IF EXISTS idx_mv_leaderboard_repo")
        op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_leaderboard")
        op.execute("DROP INDEX IF EXISTS idx_mv_topic_momentum_topic")
        op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_topic_momentum")
        op.execute("DROP INDEX IF EXISTS idx_mv_language_radar_lang")
        op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_language_radar")
        op.execute("DROP INDEX IF EXISTS idx_dm_lang_breakdown_gin")
        op.execute("DROP INDEX IF EXISTS idx_repo_topics_gin")
        op.execute("ALTER TABLE daily_metrics ALTER COLUMN language_breakdown TYPE VARCHAR(1024)")
        op.execute("ALTER TABLE repositories ALTER COLUMN topics TYPE TEXT")
    else:
        op.execute("DROP VIEW IF EXISTS mv_org_health")
        op.execute("DROP VIEW IF EXISTS mv_leaderboard")
        op.execute("DROP VIEW IF EXISTS mv_topic_momentum")
        op.execute("DROP VIEW IF EXISTS mv_language_radar")
