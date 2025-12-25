# Extract Claude Commit Message Action

A reusable composite action for extracting commit messages from Claude's PR comments.

## Overview

This action searches through Claude bot's PR comments for hidden HTML markers (`<!-- COMMIT_MESSAGE_START ... END -->`), extracts the commit message, and outputs it in a format suitable for GitHub's squash merge.

## Features

- ✅ **Latest message preference**: Uses the most recent comment with a commit message
- 📝 **Subject/body split**: Automatically separates first line (subject) from body
- 🔄 **Fallback support**: Optional fallback values if no message found
- 🔍 **Found indicator**: Outputs whether message was found or fallback used

## Usage

### Basic Example

```yaml
- name: Extract commit message
  id: extract-msg
  uses: ./.github/actions/extract-claude-commit-message
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Use commit message
  run: |
    echo "Subject: ${{ steps.extract-msg.outputs.commit-subject }}"
    echo "Body: ${{ steps.extract-msg.outputs.commit-body }}"
```

### With Fallback

```yaml
- name: Extract commit message
  id: extract-msg
  uses: ./.github/actions/extract-claude-commit-message
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    fallback-subject: 'chore(deps): bump dependencies'
    fallback-body: 'Automated dependency update'

- name: Enable auto-merge with message
  run: |
    if [ "${{ steps.extract-msg.outputs.found }}" = "true" ]; then
      echo "Using Claude's commit message"
    else
      echo "Using fallback message"
    fi

    gh pr merge --squash --subject "${{ steps.extract-msg.outputs.commit-subject }}" \
                --body "${{ steps.extract-msg.outputs.commit-body }}"
```

## Inputs

| Input              | Description                                 | Required | Default |
| ------------------ | ------------------------------------------- | -------- | ------- |
| `pr-url`           | Pull request URL                            | Yes      | -       |
| `github-token`     | GitHub token for API access                 | Yes      | -       |
| `fallback-subject` | Fallback commit subject if no message found | No       | `''`    |
| `fallback-body`    | Fallback commit body if no message found    | No       | `''`    |

## Outputs

| Output           | Description                                                 |
| ---------------- | ----------------------------------------------------------- |
| `commit-subject` | Extracted commit subject (first line) or fallback           |
| `commit-body`    | Extracted commit body (remaining lines) or fallback         |
| `found`          | `'true'` if commit message was found, `'false'` if fallback |

## How It Works

1. **Fetch comments**: Gets all comments from `claude[bot]` on the PR, newest first
2. **Search for markers**: Looks for HTML comments containing:

   ```
   <!-- COMMIT_MESSAGE_START
   commit subject here

   commit body here
   COMMIT_MESSAGE_END -->
   ```

3. **Extract latest**: Uses the first (newest) comment that contains markers
4. **Parse message**: Splits into subject (line 1) and body (remaining lines)
5. **Output**: Sets GitHub Actions outputs for downstream steps

## Why Latest Comment?

Claude may post multiple comments during a PR's lifecycle:

1. **Initial review**: First analysis with commit message
2. **Final verification**: Updated message including applied fixes

The action prefers the latest message to ensure fix summaries are included.

## Expected Markers

Claude's comments should include:

```markdown
## 📝 Commit Message

**Subject:**
chore(deps)(npm): bump package from 1.0.0 to 2.0.0

**Body:**

- Updated feature X
- Fixed bug Y

Applied fixes:

- Addressed breaking change in API

<!-- COMMIT_MESSAGE_START
chore(deps)(npm): bump package from 1.0.0 to 2.0.0

- Updated feature X
- Fixed bug Y

Applied fixes:
- Addressed breaking change in API
COMMIT_MESSAGE_END -->
```

The hidden markers allow extraction without parsing markdown structure.

## Error Handling

- **No comments found**: Uses fallback if provided, otherwise empty outputs
- **Malformed markers**: Skips comment and continues searching
- **API errors**: Fails workflow (requires valid token and PR URL)

## Use Cases

### Dependabot Auto-merge

Extract commit message crafted by Claude during Dependabot PR review:

```yaml
- name: Get commit message
  id: commit-msg
  uses: ./.github/actions/extract-claude-commit-message
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    fallback-subject: 'chore(deps): bump ${{ steps.metadata.outputs.dependency-names }}'

- name: Enable auto-merge
  run: |
    gh pr merge --auto --squash \
      --subject "${{ steps.commit-msg.outputs.commit-subject }}" \
      --body "${{ steps.commit-msg.outputs.commit-body }}"
```

### Manual Merge with Custom Message

Let Claude craft the message, but merge manually:

```yaml
- name: Extract commit message
  id: msg
  uses: ./.github/actions/extract-claude-commit-message
  with:
    pr-url: ${{ github.event.pull_request.html_url }}
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Post message for review
  if: steps.msg.outputs.found == 'true'
  run: |
    gh pr comment "${{ github.event.pull_request.html_url }}" \
      --body "**Suggested commit message:**

    Subject: ${{ steps.msg.outputs.commit-subject }}

    Body:
    ${{ steps.msg.outputs.commit-body }}"
```

## Troubleshooting

### "No commit message found"

Possible causes:

- Claude hasn't posted a comment yet
- Claude's comment doesn't include the HTML markers
- Workflow is looking at wrong PR

**Solution**: Check Claude's comments manually, verify PR URL is correct

### Empty subject/body

If `found=true` but outputs are empty, the markers exist but content is missing.

**Solution**: Check Claude's prompt includes instructions to populate commit message markers

## Best Practices

1. **Always provide fallback**: Ensures workflow doesn't fail if message missing
2. **Check `found` output**: Log whether Claude's message was used
3. **Validate before merge**: Ensure subject is non-empty before enabling auto-merge
4. **Use latest comment**: Don't cache - always fetch fresh to get updated messages
