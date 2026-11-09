# Multi-stage image for the M365 document evidence PoC.
# Base image and Python line follow services/document-ml/Dockerfile (Chainguard wolfi, digest-pinned).
FROM cgr.dev/chainguard/wolfi-base@sha256:0feab531471d2edfcca55f18883441cb7df598e724fa2dedf9985273f532eed7 AS build
USER root
RUN apk add --no-cache python-3.12-base=3.12.16-r0 py3.12-pip=26.2.2-r0 \
    && python3.12 -m venv /opt/venv
WORKDIR /build
COPY services/m365-mcp-poc/requirements.txt ./
# Build/install tooling is unnecessary at runtime. Remove it after resolving
# the locked application dependencies so vendored setuptools/wheel helpers do
# not expand the shipped attack surface or SBOM.
RUN /opt/venv/bin/python -m pip install --disable-pip-version-check --no-cache-dir -r requirements.txt \
    && /opt/venv/bin/python -m pip uninstall --yes setuptools \
    && /opt/venv/bin/python -m pip uninstall --yes pip

FROM cgr.dev/chainguard/wolfi-base@sha256:0feab531471d2edfcca55f18883441cb7df598e724fa2dedf9985273f532eed7 AS runtime
LABEL org.opencontainers.image.title="m365-document-evidence-poc" \
      org.opencontainers.image.description="Local-first grounded document evidence PoC (fictional data by default)" \
      org.opencontainers.image.source="services/m365-mcp-poc" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="local-lab"
USER root
RUN apk add --no-cache python-3.12-base=3.12.16-r0 \
    && addgroup -g 10001 poc && adduser -D -H -u 10001 -G poc poc
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/src \
    M365_POC_HOST=0.0.0.0 M365_POC_PORT=8765 M365_POC_PROVIDER=mock M365_POC_EXTRACTOR=local \
    M365_POC_ANSWER_PROVIDER=deterministic \
    M365_POC_FIXTURES_DIR=/app/fixtures/pdfs M365_POC_MANIFEST=/app/fixtures/manifest.json
WORKDIR /app
COPY --from=build /opt/venv /opt/venv
# Application code and the fictional fixtures only. No tests, caches, .env files or secrets.
COPY services/m365-mcp-poc/src/m365_poc /app/src/m365_poc
COPY services/m365-mcp-poc/fixtures/pdfs /app/fixtures/pdfs
COPY services/m365-mcp-poc/fixtures/manifest.json /app/fixtures/manifest.json
COPY services/m365-mcp-poc/eval /app/eval
RUN chown -R root:root /app && chmod -R a-w /app
ENV PATH="/opt/venv/bin:$PATH"
USER 10001:10001
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8765/health', timeout=4).status == 200 else 1)"]
STOPSIGNAL SIGTERM
CMD ["uvicorn", "m365_poc.api:create_app", "--factory", "--host", "0.0.0.0", "--port", "8765", \
     "--limit-concurrency", "50", "--timeout-keep-alive", "5", "--no-server-header", "--no-access-log", \
     "--timeout-graceful-shutdown", "20"]
