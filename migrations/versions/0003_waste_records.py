"""Add waste custody register without changing existing station records."""
from alembic import op
import sqlalchemy as sa
revision='0003'
down_revision='0002_reservations'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('waste_records',
        sa.Column('id',sa.String(80),primary_key=True),
        sa.Column('workspace',sa.String(80),nullable=False),
        sa.Column('station',sa.String(20),nullable=False),
        sa.Column('category',sa.String(),nullable=False),
        sa.Column('quantity',sa.Float(),nullable=False),
        sa.Column('unit',sa.String(),nullable=False),
        sa.Column('location',sa.String(),nullable=False),
        sa.Column('destination',sa.String(),nullable=False),
        sa.Column('shipment_id',sa.String(),nullable=True),
        sa.Column('evidence',sa.String(),nullable=False),
        sa.Column('origin',sa.String(),nullable=False),
        sa.Column('status',sa.String(),nullable=False),
        sa.Column('history',sa.JSON(),nullable=False),
        sa.Column('idempotency_key',sa.String(),nullable=False),
        sa.Column('created_at',sa.String(),nullable=False),
        sa.CheckConstraint('quantity > 0'),
        sa.UniqueConstraint('workspace','station','idempotency_key'))
    op.create_index('ix_waste_records_workspace','waste_records',['workspace'])
    op.create_index('ix_waste_records_station','waste_records',['station'])

def downgrade():
    raise RuntimeError('Non-destructive migration: restore a reviewed backup to roll back waste records.')
