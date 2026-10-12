@echo off
setlocal

if not defined JAVA_HOME if exist "%ProgramFiles%\Java\jdk-17\bin\javac.exe" set "JAVA_HOME=%ProgramFiles%\Java\jdk-17"
if not defined JAVA_HOME (
    echo Java 17 JDK was not found. Set JAVA_HOME to your JDK folder.
    pause
    exit /b 1
)
if not exist "%JAVA_HOME%\bin\javac.exe" (
    echo JAVA_HOME must point to a JDK folder containing bin\javac.exe.
    pause
    exit /b 1
)

pushd "%~dp0backend" || exit /b 1
set "MAVEN_USER_HOME=%CD%\.maven-cache"
echo Loading Maven dependencies and importing medical facilities...
call "%~dp0backend\mvnw.cmd" "-Dmaven.repo.local=.maven-cache/repository" "-Dapp.main-class=tw.advanceddb.medical.scripts.ImportMedicalFacilities" "-DskipTests" spring-boot:run
set "IMPORT_EXIT_CODE=%ERRORLEVEL%"
popd
if not "%IMPORT_EXIT_CODE%"=="0" echo Import failed. See the message above.
pause
exit /b %IMPORT_EXIT_CODE%
