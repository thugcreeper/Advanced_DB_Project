# Build context: repository root.
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

# Cache dependency resolution separately from application source changes.
COPY backend/pom.xml backend/pom.xml
RUN mvn -B -ntp -f backend/pom.xml dependency:go-offline

COPY backend/src/main backend/src/main
COPY pages pages
COPY shared shared
# Unit/integration tests run outside image construction; no Aura credentials at build time.
RUN mvn -B -ntp -f backend/pom.xml -Dmaven.test.skip=true package

FROM eclipse-temurin:17-jre-jammy AS runtime
WORKDIR /app
RUN groupadd --system app && useradd --system --gid app --home-dir /app app
COPY --from=build --chown=app:app /build/backend/target/medical-resource-backend-0.0.1-SNAPSHOT.jar /app/app.jar
USER app
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65.0 -XX:+ExitOnOutOfMemoryError"
# Local default only. Spring Boot reads Render's runtime PORT environment variable.
EXPOSE 18080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
