"""Fix issue resolution four-stage workflow fields

Revision ID: fix_issue_resolution_stages
Revises: 6893d9558350
Create Date: 2025-11-08 15:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'fix_issue_resolution_stages'
down_revision = '650245236082'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing columns only if they don't exist
    # Stage-specific session and chat tracking
    op.add_column('issue_resolutions', sa.Column('planning_session_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('issue_resolutions', sa.Column('planning_chat_id', sqlmodel.sql.sqltypes.GUID(), nullable=True))
    op.add_column('issue_resolutions', sa.Column('implementation_session_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('issue_resolutions', sa.Column('implementation_chat_id', sqlmodel.sql.sqltypes.GUID(), nullable=True))

    # Add planning_approval_by as UUID to replace the varchar version
    op.add_column('issue_resolutions', sa.Column('planning_approval_by', sqlmodel.sql.sqltypes.GUID(), nullable=True))

    # Stage completion flags
    op.add_column('issue_resolutions', sa.Column('deployment_complete', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('issue_resolutions', sa.Column('planning_complete', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('issue_resolutions', sa.Column('implementation_complete', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('issue_resolutions', sa.Column('testing_complete', sa.Boolean(), nullable=False, server_default='false'))

    # Add missing timestamps
    op.add_column('issue_resolutions', sa.Column('deployment_started_at', sa.DateTime(), nullable=True))
    op.add_column('issue_resolutions', sa.Column('deployment_completed_at', sa.DateTime(), nullable=True))
    op.add_column('issue_resolutions', sa.Column('implementation_started_at', sa.DateTime(), nullable=True))
    op.add_column('issue_resolutions', sa.Column('implementation_completed_at', sa.DateTime(), nullable=True))
    op.add_column('issue_resolutions', sa.Column('testing_completed_at', sa.DateTime(), nullable=True))

    # Create indexes
    op.create_index(op.f('ix_issue_resolutions_implementation_session_id'), 'issue_resolutions', ['implementation_session_id'], unique=False)
    op.create_index(op.f('ix_issue_resolutions_planning_session_id'), 'issue_resolutions', ['planning_session_id'], unique=False)

    # Create foreign keys
    op.create_foreign_key(None, 'issue_resolutions', 'users', ['planning_approval_by'], ['id'])
    op.create_foreign_key(None, 'issue_resolutions', 'chats', ['planning_chat_id'], ['id'])
    op.create_foreign_key(None, 'issue_resolutions', 'chats', ['implementation_chat_id'], ['id'])

    # Rename plan_approved_at to planning_approval_at if it exists
    op.alter_column('issue_resolutions', 'plan_approved_at', new_column_name='planning_approval_at')

    # Rename plan_approved to planning_approved if it exists
    op.alter_column('issue_resolutions', 'plan_approved', new_column_name='planning_approved')

    # Drop old varchar plan_approved_by column and unnecessary columns
    op.drop_column('issue_resolutions', 'plan_approved_by')
    op.drop_column('issue_resolutions', 'plan_auto_approved')
    op.drop_column('issue_resolutions', 'plan_rejection_reason')
    op.drop_column('issue_resolutions', 'resolution_plan')
    op.drop_column('issue_resolutions', 'stage_metadata')
    op.drop_column('issue_resolutions', 'best_practices_applied')

    # Drop unnecessary tables if they exist
    op.execute("DROP TABLE IF EXISTS resolution_stages CASCADE")
    op.execute("DROP TABLE IF EXISTS resolution_plans CASCADE")


def downgrade() -> None:
    # Revert the changes
    op.drop_constraint(None, 'issue_resolutions', type_='foreignkey')
    op.drop_constraint(None, 'issue_resolutions', type_='foreignkey')
    op.drop_constraint(None, 'issue_resolutions', type_='foreignkey')
    op.drop_index(op.f('ix_issue_resolutions_planning_session_id'), table_name='issue_resolutions')
    op.drop_index(op.f('ix_issue_resolutions_implementation_session_id'), table_name='issue_resolutions')

    # Rename columns back
    op.alter_column('issue_resolutions', 'planning_approval_at', new_column_name='plan_approved_at')
    op.alter_column('issue_resolutions', 'planning_approved', new_column_name='plan_approved')

    # Add back old columns
    op.add_column('issue_resolutions', sa.Column('plan_approved_by', sa.VARCHAR(), nullable=True))
    op.add_column('issue_resolutions', sa.Column('plan_auto_approved', sa.BOOLEAN(), server_default=sa.text('false'), nullable=False))
    op.add_column('issue_resolutions', sa.Column('plan_rejection_reason', sa.TEXT(), nullable=True))
    op.add_column('issue_resolutions', sa.Column('resolution_plan', sa.TEXT(), nullable=True))
    op.add_column('issue_resolutions', sa.Column('stage_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('issue_resolutions', sa.Column('best_practices_applied', postgresql.JSON(astext_type=sa.Text()), nullable=True))

    # Drop new columns
    op.drop_column('issue_resolutions', 'testing_completed_at')
    op.drop_column('issue_resolutions', 'implementation_completed_at')
    op.drop_column('issue_resolutions', 'implementation_started_at')
    op.drop_column('issue_resolutions', 'deployment_completed_at')
    op.drop_column('issue_resolutions', 'deployment_started_at')
    op.drop_column('issue_resolutions', 'testing_complete')
    op.drop_column('issue_resolutions', 'implementation_complete')
    op.drop_column('issue_resolutions', 'planning_complete')
    op.drop_column('issue_resolutions', 'deployment_complete')
    op.drop_column('issue_resolutions', 'planning_approval_by')
    op.drop_column('issue_resolutions', 'implementation_chat_id')
    op.drop_column('issue_resolutions', 'implementation_session_id')
    op.drop_column('issue_resolutions', 'planning_chat_id')
    op.drop_column('issue_resolutions', 'planning_session_id')