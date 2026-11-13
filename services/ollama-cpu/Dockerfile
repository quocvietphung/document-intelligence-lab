# Repackage the official, multi-architecture release; do not compile or replace the engine.
# The upstream image includes CUDA/JetPack backends that CPU-only Docker does not need.
FROM ollama/ollama:0.40.6@sha256:265409e1d931028a8f7d5a32bcbafddd7bffbc6cc629d77efe9560adf692a5e7 AS upstream
RUN mkdir /cpu \
    && find /usr/lib/ollama -mindepth 1 -maxdepth 1 \( -type f -o -type l -o -name 'cpu*' \) -exec cp -a '{}' /cpu/ \;

FROM ubuntu:24.04
# Fixed non-root identity: UID and GID 10010. The model store is /models; scratch space is /tmp (a tmpfs in Compose).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libgomp1 libopenblas0 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10010 ollama \
    && useradd --system --uid 10010 --gid 10010 --home-dir /tmp --no-create-home --shell /usr/sbin/nologin ollama \
    && install -d -o 10010 -g 10010 -m 0755 /models
COPY --from=upstream /usr/bin/ollama /usr/bin/ollama
COPY --from=upstream /cpu/ /usr/lib/ollama/
ENV OLLAMA_HOST=0.0.0.0:11434 OLLAMA_NO_CLOUD=1 OLLAMA_MODELS=/models HOME=/tmp
EXPOSE 11434
USER 10010:10010
ENTRYPOINT ["/usr/bin/ollama"]
CMD ["serve"]
