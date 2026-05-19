"""Add document_id to conversations table.

Revision ID: 002
Revises: 001
Create Date: 2025-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_conversations_document_id",
        "conversations",
        ["document_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_conversations_document_id", table_name="conversations")
    op.drop_column("conversations", "document_id")
