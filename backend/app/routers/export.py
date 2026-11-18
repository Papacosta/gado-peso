"""Exportação do dataset: CSV com metadados/sensores + ZIP com imagens."""
from __future__ import annotations

import csv
import io
import json
import zipfile
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Animal, CapturePoint, Photo, Weighing
from ..services.storage import photo_abs_path

router = APIRouter(prefix="/api/export", tags=["exportação"])

CSV_COLUMNS = [
    "photo_id",
    "animal_id",
    "ear_tag",
    "breed",
    "sex",
    "category",
    "age_months",
    "bcs",
    "weighing_id",
    "weight_kg",
    "weighed_at",
    "light_condition",
    "time_of_day",
    "fasting",
    "capture_point_id",
    "capture_point_name",
    "distance_cm",
    "camera_height_cm",
    "photo_path",
    "captured_at",
    "width",
    "height",
    "tilt_deg",
    "sensor_score",
    "ambient_lux",
    "ambient_lux_source",
    "depth_distance_m",
    "geolocation_lat",
    "geolocation_lon",
    "camera_settings_json",
    "sensors_json",
    "quality_json",
]


def _dataset_rows(db: Session) -> List[Dict[str, Any]]:
    stmt = (
        select(Photo, Weighing, Animal, CapturePoint)
        .join(Weighing, Photo.weighing_id == Weighing.id)
        .join(Animal, Photo.animal_id == Animal.id)
        .outerjoin(CapturePoint, Photo.capture_point_id == CapturePoint.id)
        .order_by(Photo.captured_at.asc())
    )
    rows: List[Dict[str, Any]] = []
    for photo, weighing, animal, cp in db.execute(stmt).all():
        sensors = photo.sensors or {}
        quality = photo.quality or {}
        orientation = sensors.get("orientation") or {}
        ambient = sensors.get("ambient_light") or {}
        depth = sensors.get("depth") or {}
        geo = sensors.get("geolocation") or {}
        camera = sensors.get("camera") or {}
        rows.append(
            {
                "photo_id": photo.id,
                "animal_id": animal.id,
                "ear_tag": animal.ear_tag,
                "breed": animal.breed or "",
                "sex": animal.sex or "",
                "category": animal.category or "",
                "age_months": animal.age_months if animal.age_months is not None else "",
                "bcs": animal.bcs if animal.bcs is not None else "",
                "weighing_id": weighing.id,
                "weight_kg": weighing.weight_kg,
                "weighed_at": weighing.weighed_at.isoformat() if weighing.weighed_at else "",
                "light_condition": weighing.light_condition or "",
                "time_of_day": weighing.time_of_day or "",
                "fasting": "" if weighing.fasting is None else str(weighing.fasting).lower(),
                "capture_point_id": cp.id if cp else "",
                "capture_point_name": cp.name if cp else "",
                "distance_cm": cp.distance_cm if cp else "",
                "camera_height_cm": cp.camera_height_cm if cp else "",
                "photo_path": photo.file_path,
                "captured_at": photo.captured_at.isoformat() if photo.captured_at else "",
                "width": photo.width or "",
                "height": photo.height or "",
                "tilt_deg": orientation.get("tilt_deg", ""),
                "sensor_score": (sensors.get("quality") or {}).get("sensor_score", ""),
                "ambient_lux": ambient.get("lux", ""),
                "ambient_lux_source": ambient.get("source", ""),
                "depth_distance_m": depth.get("distance_m", ""),
                "geolocation_lat": geo.get("latitude", ""),
                "geolocation_lon": geo.get("longitude", ""),
                "camera_settings_json": json.dumps(camera.get("settings", {}), ensure_ascii=False),
                "sensors_json": json.dumps(sensors, ensure_ascii=False),
                "quality_json": json.dumps(quality, ensure_ascii=False),
            }
        )
    return rows


def _csv_bytes(rows: List[Dict[str, Any]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_COLUMNS, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    # BOM para o Excel abrir acentos corretamente no Windows.
    return ("\ufeff" + buffer.getvalue()).encode("utf-8")


@router.get("/csv")
def export_csv(db: Session = Depends(get_db)):
    rows = _dataset_rows(db)
    return Response(
        content=_csv_bytes(rows),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="pesovivo_dataset.csv"'},
    )


@router.get("/zip")
def export_zip(db: Session = Depends(get_db)):
    """ZIP com dataset.csv + pasta images/ (caminho relativo preservado)."""
    rows = _dataset_rows(db)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_STORED) as zf:
        zf.writestr("dataset.csv", _csv_bytes(rows))
        zf.writestr(
            "LEIA-ME.txt",
            (
                "Dataset de estimativa de peso de bovinos\n"
                "=======================================\n"
                "dataset.csv: uma linha por foto, com peso real, animal, ponto de\n"
                "captura, leituras de sensores (JSON) e qualidade da imagem.\n"
                "images/: fotos originais; o caminho em dataset.csv é relativo a esta pasta.\n\n"
                "Protocolo: câmera fixa (mesma distância/altura), foto lateral, animal\n"
                "inteiro, 3 a 5 fotos por sessão, sol difuso e terreno plano.\n"
            ),
        )
        for row in rows:
            path = photo_abs_path(row["photo_path"])
            if path.exists():
                zf.write(path, arcname=f"images/{row['photo_path']}")

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="pesovivo_dataset.zip"'},
    )
