"""Add spare allocation without modifying saved records."""
from alembic import op
import sqlalchemy as sa
revision='0002_reservations'
down_revision='0001'
branch_labels=None
depends_on=None
def upgrade():
    op.create_table('reservations',
        sa.Column('id',sa.String(80),primary_key=True),
        sa.Column('workspace',sa.String(80),nullable=False),
        sa.Column('station',sa.String(20),nullable=False),
        sa.Column('item_id',sa.String(),nullable=False),
        sa.Column('work_order_id',sa.String(),nullable=False),
        sa.Column('quantity',sa.Float(),nullable=False),
        sa.Column('remaining',sa.Float(),nullable=False),
        sa.Column('status',sa.String(),nullable=False),
        sa.Column('idempotency_key',sa.String(),nullable=False),
        sa.Column('actor',sa.String(),nullable=False),
        sa.Column('created_at',sa.String(),nullable=False),
        sa.UniqueConstraint('workspace','idempotency_key'),
        sa.CheckConstraint('remaining >= 0 AND remaining <= quantity'))
    op.create_index('ix_reservations_workspace','reservations',['workspace'])
    op.create_index('ix_reservations_station','reservations',['station'])
def downgrade():
    raise RuntimeError('Destructive downgrade disabled; restore a verified backup to a new database.')
