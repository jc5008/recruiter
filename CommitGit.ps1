# CommitGit.ps1 — Stage all changes and commit with the given message.
# Run from this folder (the git repo root). Usage:
#   .\CommitGit.ps1 "completed stage 4 implementation"
#   .\CommitGit.ps1 -"your message"

param(
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$MessageParts
)

$msg = ($MessageParts -join " ").TrimStart("-").Trim()
if (-not $msg) {
    Write-Error "Commit message is required. Example: .\CommitGit.ps1 `"completed stage 4 implementation`""
    exit 1
}

$gitDir = git rev-parse --git-dir 2>$null
if (-not $gitDir) {
    Write-Error "Not a git repository. Run 'git init' first."
    exit 1
}

git add -A
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

git commit -m $msg
exit $LASTEXITCODE
