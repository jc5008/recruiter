@echo off
REM CommitGit.cmd — Stage all and commit. Run from this folder. Usage: .\CommitGit.cmd "your message"
if "%~1"=="" (
    echo Commit message is required. Example: .\CommitGit.cmd "completed stage 4 implementation"
    exit /b 1
)
set "MSG=%~1"
if "%MSG:~0,1%"=="-" set "MSG=%MSG:~1%"
:shift
shift
if not "%~1"=="" set "MSG=%MSG% %~1" & goto shift
git add -A
if errorlevel 1 exit /b 1
git commit -m "%MSG%"
exit /b %errorlevel%
