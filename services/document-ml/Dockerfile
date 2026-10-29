FROM python:3.12-slim@sha256:aa943ce411423c7582288f18707ff66eddcbaeb510502d747a72aeb34f30d159 AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 DO_NOT_TRACK=1 MLFLOW_DISABLE_AGENT_HINT=1
ENV OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 HOME=/tmp
WORKDIR /app
COPY services/document-ml/requirements.txt ./
RUN pip install --disable-pip-version-check -r requirements.txt
COPY services/document-ml/engine.py services/document-ml/snapshot.py ./
USER 1000:1000
CMD ["python", "engine.py", "worker"]

# Optional operator UI. The runtime worker does not install the full UI package.
FROM runtime AS tracking
USER root
RUN pip install --disable-pip-version-check mlflow==3.17.2
USER 1000:1000
