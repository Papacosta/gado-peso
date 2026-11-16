"""Migração inicial: pontos de captura, animais, pesagens, fotos e modelos."""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "capture_points",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("device_model", sa.String(length=120), nullable=True),
        sa.Column("distance_cm", sa.Float(), nullable=False),
        sa.Column("camera_height_cm", sa.Float(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_capture_points_name", "capture_points", ["name"])

    op.create_table(
        "animals",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("ear_tag", sa.String(length=60), nullable=False),
        sa.Column("breed", sa.String(length=60), nullable=True),
        sa.Column("sex", sa.String(length=20), nullable=True),
        sa.Column("category", sa.String(length=30), nullable=True),
        sa.Column("age_months", sa.Integer(), nullable=True),
        sa.Column("bcs", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("ear_tag", name="uq_animal_ear_tag"),
    )
    op.create_index("ix_animals_ear_tag", "animals", ["ear_tag"])

    op.create_table(
        "weighings",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("animal_id", sa.String(length=36), nullable=False),
        sa.Column("capture_point_id", sa.String(length=36), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=False),
        sa.Column("weighed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("light_condition", sa.String(length=40), nullable=True),
        sa.Column("time_of_day", sa.String(length=20), nullable=True),
        sa.Column("fasting", sa.Boolean(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["animal_id"], ["animals.id"]),
        sa.ForeignKeyConstraint(["capture_point_id"], ["capture_points.id"]),
    )
    op.create_index("ix_weighings_animal_id", "weighings", ["animal_id"])
    op.create_index("ix_weighings_weighed_at", "weighings", ["weighed_at"])

    op.create_table(
        "photos",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("weighing_id", sa.String(length=36), nullable=False),
        sa.Column("animal_id", sa.String(length=36), nullable=False),
        sa.Column("capture_point_id", sa.String(length=36), nullable=True),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("sensors", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("quality", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["weighing_id"], ["weighings.id"]),
        sa.ForeignKeyConstraint(["animal_id"], ["animals.id"]),
        sa.ForeignKeyConstraint(["capture_point_id"], ["capture_points.id"]),
        sa.UniqueConstraint("file_path"),
    )
    op.create_index("ix_photos_weighing_id", "photos", ["weighing_id"])
    op.create_index("ix_photos_animal_id", "photos", ["animal_id"])
    op.create_index("ix_photos_sha256", "photos", ["sha256"])
    op.create_index("ix_photos_captured_at", "photos", ["captured_at"])

    op.create_table(
        "model_versions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("version", sa.String(length=60), nullable=False),
        sa.Column("algorithm", sa.String(length=60), nullable=False),
        sa.Column("artifact_path", sa.String(length=500), nullable=False),
        sa.Column("metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("feature_names", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("n_animals", sa.Integer(), nullable=False),
        sa.Column("n_photos", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("trained_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_model_versions_version", "model_versions", ["version"])
    op.create_index("ix_model_versions_active", "model_versions", ["active"])


def downgrade() -> None:
    op.drop_table("model_versions")
    op.drop_table("photos")
    op.drop_table("weighings")
    op.drop_table("animals")
    op.drop_table("capture_points")