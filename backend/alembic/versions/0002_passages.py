"""Modo passagem: passagens (câmera fixa, gado passando) e seus quadros."""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_passages"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "passages",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("capture_point_id", sa.String(length=36), nullable=False),
        sa.Column("animal_id", sa.String(length=36), nullable=True),
        sa.Column("ear_tag", sa.String(length=60), nullable=True),
        sa.Column("lot", sa.String(length=60), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("weight_min_kg", sa.Float(), nullable=True),
        sa.Column("weight_max_kg", sa.Float(), nullable=True),
        sa.Column("interval_half_width_kg", sa.Float(), nullable=True),
        sa.Column("frame_spread_kg", sa.Float(), nullable=True),
        sa.Column("n_frames", sa.Integer(), nullable=False),
        sa.Column("n_frames_used", sa.Integer(), nullable=False),
        sa.Column("model_version", sa.String(length=60), nullable=True),
        sa.Column("estimated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["capture_point_id"], ["capture_points.id"]),
        sa.ForeignKeyConstraint(["animal_id"], ["animals.id"]),
    )
    op.create_index("ix_passages_capture_point_id", "passages", ["capture_point_id"])
    op.create_index("ix_passages_animal_id", "passages", ["animal_id"])
    op.create_index("ix_passages_ear_tag", "passages", ["ear_tag"])
    op.create_index("ix_passages_lot", "passages", ["lot"])
    op.create_index("ix_passages_started_at", "passages", ["started_at"])
    op.create_index("ix_passages_status", "passages", ["status"])

    op.create_table(
        "passage_frames",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("passage_id", sa.String(length=36), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("detection", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("quality", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("used", sa.Boolean(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["passage_id"], ["passages.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("file_path"),
    )
    op.create_index("ix_passage_frames_passage_id", "passage_frames", ["passage_id"])
    op.create_index("ix_passage_frames_sha256", "passage_frames", ["sha256"])


def downgrade() -> None:
    op.drop_table("passage_frames")
    op.drop_table("passages")
