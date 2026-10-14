#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const COMMENT_HEADER = 'consolidated-ci-report'
const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 1000

const SECTION_DEFINITIONS = {
  lighthouse: { title: '🔦 Lighthouse', order: 1 },
  mutation: { title: '🧬 Mutation Testing', order: 2 },
  coverage: { title: '📊 Coverage', order: 3 },
}

function getSectionMarkers(section) {
  return {
    start: `<!-- SECTION:${section}:START -->`,
    end: `<!-- SECTION:${section}:END -->`,
    statusStart: `<!-- STATUS:${section}:`,
    statusEnd: '--!?>',
    summaryStart: `<!-- SUMMARY:${section}:`,
    summaryEnd: '--!?>',
  }
}

function parseExistingComment(body) {
  const sections = {}
  for (const section of Object.keys(SECTION_DEFINITIONS)) {
    const markers = getSectionMarkers(section)
    const startIdx = body.indexOf(markers.start)
    const endIdx = body.indexOf(markers.end)

    if (startIdx !== -1 && endIdx !== -1) {
      const content = body.substring(startIdx + markers.start.length, endIdx).trim()
      
      const statusMatch = body.match(new RegExp(`${markers.statusStart}([^>]+)${markers.statusEnd}`))
      const summaryMatch = body.match(new RegExp(`${markers.summaryStart}([^>]+)${markers.summaryEnd}`))
      
      sections[section] = {
        content,
        status: statusMatch ? statusMatch[1] : 'pending',
        summary: summaryMatch ? summaryMatch[1] : '',
      }
    }
  }
  return sections
}

function buildSummaryTable(sections) {
  const rows = Object.entries(SECTION_DEFINITIONS)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([section, def]) => {
      const data = sections[section] || { status: 'pending', summary: '' }
      const statusEmoji = {
        success: '✅',
        failure: '❌',
        pending: '⏳',
      }[data.status] || '⏳'
      
      const anchorLink = `[View](#${section})`
      const summaryText = data.summary || '—'
      
      return `| ${def.title} | ${statusEmoji} | ${summaryText} | ${anchorLink} |`
    })

  return [
    '| Check | Status | Summary | Details |',
    '|-------|--------|---------|---------|',
    ...rows,
  ].join('\n')
}

function buildConsolidatedComment(sections) {
  const header = '## 🔬 CI Report\n'
  const summaryTable = buildSummaryTable(sections)
  
  const sectionBlocks = Object.entries(SECTION_DEFINITIONS)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([section, def]) => {
      const data = sections[section] || { content: '⏳ Waiting for results...', status: 'pending', summary: '' }
      const markers = getSectionMarkers(section)
      
      return [
        `${markers.statusStart}${data.status}${markers.statusEnd}`,
        `${markers.summaryStart}${data.summary}${markers.summaryEnd}`,
        markers.start,
        `<details id="${section}">`,
        `<summary>${def.title}</summary>`,
        '',
        data.content,
        '',
        '</details>',
        markers.end,
      ].join('\n')
    })

  return [
    header,
    summaryTable,
    '',
    ...sectionBlocks,
  ].join('\n')
}

async function fetchCommentId(token, repo, prNumber) {
  const [owner, repoName] = repo.split('/')
  const url = `https://api.github.com/repos/${owner}/${repoName}/issues/${prNumber}/comments`
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText}`)
  }

  const comments = await response.json()
  const existing = comments.find((c) => 
    c.body?.includes(`<!-- header: ${COMMENT_HEADER} -->`)
  )
  
  return existing?.id || null
}

async function createOrUpdateComment(token, repo, prNumber, body, commentId, attempt = 1) {
  const [owner, repoName] = repo.split('/')
  const fullBody = `<!-- header: ${COMMENT_HEADER} -->\n${body}`
  
  const url = commentId
    ? `https://api.github.com/repos/${owner}/${repoName}/issues/comments/${commentId}`
    : `https://api.github.com/repos/${owner}/${repoName}/issues/${prNumber}/comments`

  const method = commentId ? 'PATCH' : 'POST'

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: fullBody }),
  })

  if (!response.ok) {
    if (response.status === 422 && attempt < RETRY_ATTEMPTS) {
      console.log(`Conflict detected, retrying (attempt ${attempt + 1}/${RETRY_ATTEMPTS})...`)
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt))
      const newCommentId = await fetchCommentId(token, repo, prNumber)
      return createOrUpdateComment(token, repo, prNumber, body, newCommentId, attempt + 1)
    }
    throw new Error(`Failed to ${method} comment: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  return result.id
}

async function main() {
  const section = process.argv[2]
  const status = process.argv[3] || 'pending'
  const contentPath = process.argv[4]
  const summary = process.argv[5] || ''

  if (!section || !SECTION_DEFINITIONS[section]) {
    console.error('Usage: update-consolidated-ci-comment.mjs <section> <status> <content-file> [summary]')
    console.error(`Valid sections: ${Object.keys(SECTION_DEFINITIONS).join(', ')}`)
    process.exit(1)
  }

  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPOSITORY
  const prNumber = process.env.PR_NUMBER

  if (!token || !repo || !prNumber) {
    console.error('Required env vars: GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER')
    process.exit(1)
  }

  let content = '⏳ Waiting for results...'
  if (contentPath && contentPath !== '-') {
    try {
      content = readFileSync(contentPath, 'utf8').trim()
    } catch (err) {
      console.warn(`Could not read content file ${contentPath}: ${err.message}`)
    }
  }

  const commentId = await fetchCommentId(token, repo, prNumber)
  
  let existingBody = ''
  if (commentId) {
    const [owner, repoName] = repo.split('/')
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/issues/comments/${commentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )
    if (response.ok) {
      const comment = await response.json()
      existingBody = comment.body || ''
    }
  }

  const sections = commentId ? parseExistingComment(existingBody) : {}
  
  sections[section] = {
    content,
    status,
    summary,
  }

  const newBody = buildConsolidatedComment(sections)
  await createOrUpdateComment(token, repo, prNumber, newBody, commentId)
  
  console.log(`✅ Updated ${section} section (status: ${status})`)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
