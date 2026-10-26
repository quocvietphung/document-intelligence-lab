FROM python:3.12-slim@sha256:cb33f7f771ecec2ef1225cf39b159591a040391bd73e4c01f00fdfc4c47611d2
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-deu && rm -rf /var/lib/apt/lists/*
COPY services/document-etl/requirements.txt .
COPY services/document-etl/inspection-requirements.txt .
RUN pip install --disable-pip-version-check -r requirements.txt -r inspection-requirements.txt && useradd -u 1000 -m worker
COPY python /build/python
RUN pip install --disable-pip-version-check --no-deps /build/python && rm -rf /build
COPY services/document-etl/worker.py services/document-etl/evidence_worker.py ./
COPY services/document-etl/dbt dbt
USER worker
ENTRYPOINT ["python", "worker.py"]
