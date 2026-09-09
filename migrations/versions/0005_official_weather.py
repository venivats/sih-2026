"""Preserve official weather intake reports separately from operational telemetry."""
from alembic import op
import sqlalchemy as sa
revision='0005'
down_revision='0004'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('official_weather_reports',sa.Column('id',sa.String(80),primary_key=True),sa.Column('workspace',sa.String(80),nullable=False),sa.Column('station',sa.String(20),nullable=False),sa.Column('status',sa.String(),nullable=False),sa.Column('reference',sa.String(),nullable=False),sa.Column('acquired_at',sa.String(),nullable=False),sa.Column('parser_version',sa.String(),nullable=False),sa.Column('checksum',sa.String(),nullable=True),sa.Column('storage_key',sa.String(),nullable=True),sa.Column('payload',sa.JSON(),nullable=False),sa.Column('detail',sa.String(),nullable=False))
    op.create_index('ix_official_weather_reports_workspace','official_weather_reports',['workspace'])
    op.create_index('ix_official_weather_reports_station','official_weather_reports',['station'])

def downgrade():
    raise RuntimeError('Restore a reviewed backup for non-destructive rollback')
