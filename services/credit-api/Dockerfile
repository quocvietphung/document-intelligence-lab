FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src src
RUN mvn -q package -DskipTests

# Cache the test runner as well, so the explicit local model test needs no egress.
FROM build AS docling-check
RUN mvn -q -Dtest=DoclingDocumentAnalysisProviderTest test

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends libssl3 tesseract-ocr tesseract-ocr-deu tesseract-ocr-eng wget && rm -rf /var/lib/apt/lists/* && useradd -m app
USER app
WORKDIR /app
COPY --from=build /workspace/target/credit-api-0.1.0.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
