# Repackage the official, multi-architecture release; do not compile or replace the engine.
# The upstream image includes CUDA/JetPack backends that CPU-only Docker does not need.
FROM ollama/ollama:0.40.6@sha256:265409e1d931028a8f7d5a32bcbafddd7bffbc6cc629d77efe9560adf692a5e7 AS upstream
RUN mkdir /cpu \
    && find /usr/lib/ollama -mindepth 1 -maxdepth 1 \( -type f -o -type l -o -name 'cpu*' \) -exec cp -a '{}' /cpu/ \;

FROM ubuntu:24.04
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libgomp1 libopenblas0 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=upstream /usr/bin/ollama /usr/bin/ollama
COPY --from=upstream /cpu/ /usr/lib/ollama/
ENV OLLAMA_HOST=0.0.0.0:11434 OLLAMA_NO_CLOUD=1
EXPOSE 11434
ENTRYPOINT ["/usr/bin/ollama"]
CMD ["serve"]
