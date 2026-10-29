FROM python:3.12-slim@sha256:aa943ce411423c7582288f18707ff66eddcbaeb510502d747a72aeb34f30d159
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 HOME=/tmp
ENV SPARK_LOCAL_IP=127.0.0.1 PYSPARK_PYTHON=python PYSPARK_SUBMIT_ARGS="--driver-memory 1g pyspark-shell"
RUN apt-get update && apt-get install -y --no-install-recommends default-jre-headless && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY services/document-spark/requirements.txt ./
RUN pip install --disable-pip-version-check -r requirements.txt
COPY services/document-ml/snapshot.py services/document-spark/batch.py ./
RUN groupadd --gid 1000 lab && useradd --uid 1000 --gid 1000 --no-create-home --shell /usr/sbin/nologin lab
USER 1000:1000
ENTRYPOINT ["python", "batch.py"]
CMD ["--help"]
