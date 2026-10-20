FROM python:3.12-slim
ARG INSTALL_PADDLE=false
RUN pip install --no-cache-dir FlagEmbedding==1.4.2 \
    && if [ "$INSTALL_PADDLE" = "true" ]; then pip install --no-cache-dir 'paddleocr==3.7.0' 'paddlepaddle>=3.0,<4' pypdfium2 Pillow; fi
RUN useradd --uid 1000 --create-home model
WORKDIR /app
COPY server.py /app/server.py
ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 OMP_NUM_THREADS=2
USER 1000
EXPOSE 8090
CMD ["python", "server.py"]
