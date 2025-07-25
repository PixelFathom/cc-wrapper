"""Convert continuation_status from enum to string

Revision ID: convert_continuation_status_to_string
Revises: fix_continuation_status_enum
Create Date: 2025-01-25 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'convert_continuation_status_to_string'
down_revision = 'fix_continuation_status_enum'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    
    # Check if the column exists
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('chats')]
    if 'continuation_status' not in columns:
        # Column doesn't exist, nothing to do
        return
    
    # Create a temporary column
    op.add_column('chats', sa.Column('continuation_status_temp', sa.String(), nullable=True))
    
    # Copy the data from enum to string
    op.execute("UPDATE chats SET continuation_status_temp = continuation_status::text")
    
    # Drop the old enum column
    op.drop_column('chats', 'continuation_status')
    
    # Rename the temporary column
    op.alter_column('chats', 'continuation_status_temp', new_column_name='continuation_status')
    
    # Make it non-nullable with default
    op.alter_column('chats', 'continuation_status', nullable=False, server_default='NONE')
    
    # Drop the enum types if they exist and are not used
    result = conn.execute(sa.text("""
        SELECT COUNT(*) FROM pg_attribute a
        JOIN pg_class c ON a.attrelid = c.oid
        JOIN pg_type t ON a.atttypid = t.oid
        WHERE t.typname IN ('continuationstatus', 'continuationstatus_v2')
        AND c.relkind = 'r'
    """))
    if result.scalar() == 0:
        op.execute('DROP TYPE IF EXISTS continuationstatus CASCADE')
        op.execute('DROP TYPE IF EXISTS continuationstatus_v2 CASCADE')


def downgrade() -> None:
    conn = op.get_bind()
    
    # Check if the column exists
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('chats')]
    if 'continuation_status' not in columns:
        return
    
    # Create enum type
    continuationstatus_enum = postgresql.ENUM('NONE', 'NEEDED', 'IN_PROGRESS', 'COMPLETED', name='continuationstatus')
    continuationstatus_enum.create(conn, checkfirst=True)
    
    # Add temporary enum column
    op.add_column('chats', sa.Column('continuation_status_temp', sa.Enum('NONE', 'NEEDED', 'IN_PROGRESS', 'COMPLETED', name='continuationstatus'), nullable=True))
    
    # Copy data
    op.execute("UPDATE chats SET continuation_status_temp = continuation_status::continuationstatus")
    
    # Drop the string column
    op.drop_column('chats', 'continuation_status')
    
    # Rename the temporary column
    op.alter_column('chats', 'continuation_status_temp', new_column_name='continuation_status')
    
    # Make it non-nullable with default
    op.alter_column('chats', 'continuation_status', nullable=False, server_default='NONE')