"""Add operations registers, preserving all existing records."""
from alembic import op
import sqlalchemy as sa
revision='0004'
down_revision='0003'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('ops_records',sa.Column('id',sa.String(80),primary_key=True),sa.Column('workspace',sa.String(80),nullable=False),sa.Column('station',sa.String(20),nullable=False),sa.Column('kind',sa.String(),nullable=False),sa.Column('label',sa.String(),nullable=False),sa.Column('data',sa.JSON(),nullable=False),sa.Column('origin',sa.String(),nullable=False),sa.Column('version',sa.Integer(),nullable=False),sa.Column('idempotency_key',sa.String(),nullable=False),sa.Column('created_at',sa.String(),nullable=False),sa.UniqueConstraint('workspace','station','idempotency_key'))
    op.create_index('ix_ops_records_workspace','ops_records',['workspace'])
    op.create_index('ix_ops_records_station','ops_records',['station'])
def downgrade():
    raise RuntimeError('Restore a reviewed backup for non-destructive rollback')
