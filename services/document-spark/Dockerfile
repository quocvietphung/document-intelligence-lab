FROM cgr.dev/chainguard/wolfi-base:latest@sha256:0feab531471d2edfcca55f18883441cb7df598e724fa2dedf9985273f532eed7
USER root
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 HOME=/tmp
ENV SPARK_LOCAL_IP=127.0.0.1 PYSPARK_PYTHON=python PYSPARK_SUBMIT_ARGS="--driver-memory 1g pyspark-shell"
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk
ENV PATH="/opt/venv/bin:/usr/lib/jvm/java-21-openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
RUN apk add --no-cache python-3.12-base=3.12.16-r0 py3.12-pip=26.2.2-r0 openjdk-21-jre=21.0.13.0.3-r0 libstdc++ bash \
    && python3.12 -m venv --without-pip /opt/venv
WORKDIR /app
COPY services/document-spark/requirements.txt ./
RUN /usr/bin/python3.12 -m pip --python /opt/venv/bin/python install --disable-pip-version-check -r requirements.txt \
    && apk del py3.12-pip \
    && rm -rf /usr/share/python-wheels /usr/lib/python3.12/ensurepip
COPY services/document-ml/snapshot.py services/document-spark/batch.py ./
RUN addgroup -g 1000 lab && adduser -D -H -u 1000 -G lab lab
USER 1000:1000
ENTRYPOINT ["python", "batch.py"]
CMD ["--help"]
