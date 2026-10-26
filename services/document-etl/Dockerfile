FROM cgr.dev/chainguard/wolfi-base:latest@sha256:0feab531471d2edfcca55f18883441cb7df598e724fa2dedf9985273f532eed7
USER root
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
ENV PATH="/opt/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
WORKDIR /app
RUN apk add --no-cache python-3.12-base=3.12.16-r0 py3.12-pip=26.2.2-r0 tesseract=5.5.2-r8 tesseract-eng=5.5.2-r8 tesseract-deu=5.5.2-r8
RUN python3.12 -m venv --without-pip /opt/venv
COPY services/document-etl/requirements.txt .
COPY services/document-etl/inspection-requirements.txt .
RUN /usr/bin/python3.12 -m pip --python /opt/venv/bin/python install --disable-pip-version-check -r requirements.txt -r inspection-requirements.txt
COPY python /build/python
RUN /usr/bin/python3.12 -m pip --python /opt/venv/bin/python install --disable-pip-version-check --no-deps /build/python \
    && rm -rf /build \
    && apk del py3.12-pip
COPY services/document-etl/worker.py services/document-etl/evidence_worker.py ./
COPY services/document-etl/dbt dbt
# Runtime tasks never create environments or install packages.
RUN rm -rf /usr/share/python-wheels /usr/lib/python3.12/ensurepip
USER 1000:1000
ENTRYPOINT ["python", "worker.py"]
