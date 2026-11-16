# Imagem do backend (FastAPI + Alembic).
# A Fase 2 (YOLO) é opcional: INSTALL_ML=true no build.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# libgl/libglib são necessárias pelo ultralytics/opencv quando INSTALL_ML=true.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-ml.txt ./
ARG INSTALL_ML=false
RUN pip install --no-cache-dir -r requirements.txt \
    && if [ "$INSTALL_ML" = "true" ]; then pip install --no-cache-dir -r requirements-ml.txt; fi

COPY . .

EXPOSE 8000

# Migrações rodam no start para o compose subir com um comando só.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
