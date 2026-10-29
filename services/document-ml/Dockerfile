FROM cgr.dev/chainguard/wolfi-base:latest@sha256:0feab531471d2edfcca55f18883441cb7df598e724fa2dedf9985273f532eed7 AS runtime
USER root
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 DO_NOT_TRACK=1 MLFLOW_DISABLE_AGENT_HINT=1
ENV OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 HOME=/tmp
ENV PATH="/opt/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
WORKDIR /app
RUN apk add --no-cache python-3.12-base=3.12.16-r0 py3.12-pip=26.2.2-r0 libstdc++ \
    && python3.12 -m venv --without-pip /opt/venv
COPY services/document-ml/requirements.txt ./
RUN /usr/bin/python3.12 -m pip --python /opt/venv/bin/python install --disable-pip-version-check -r requirements.txt \
    && apk del py3.12-pip \
    && rm -rf /usr/share/python-wheels /usr/lib/python3.12/ensurepip
RUN addgroup -g 1000 lab && adduser -D -H -u 1000 -G lab lab
COPY services/document-ml/engine.py services/document-ml/snapshot.py services/document-ml/classification.py ./
ENV GIT_PYTHON_REFRESH=quiet
USER 1000:1000
CMD ["python", "engine.py", "worker"]

# Optional operator UI. The runtime worker does not install the full UI package.
FROM runtime AS tracking
USER root
RUN apk add --no-cache py3.12-pip=26.2.2-r0 \
    && /usr/bin/python3.12 -m pip --python /opt/venv/bin/python install --disable-pip-version-check mlflow==3.17.2 \
    && apk del py3.12-pip \
    && rm -rf /usr/share/python-wheels /usr/lib/python3.12/ensurepip
USER 1000:1000
