# DevPost Pro — Complete Build Guide
### AI-Powered LinkedIn Content Engine for IT Professionals
**Course: AI Product Development — Phase 3 MVP**
**Team: 2 Members | Stack: n8n + React + LinkedIn API + GitHub API + Claude API**

---

## Product Summary

DevPost Pro takes a public GitHub repository URL and a LinkedIn profile URL from an IT professional, validates that the work is authentic (solo-built, not forked, real profile), and generates three ready-to-post LinkedIn posts with an image card — then posts directly to LinkedIn with one click.

**The core value:** Converts code into professional storytelling. Validates authenticity before generating. Posts directly. Zero manual writing.

---

## Architecture Overview

```
User Input (GitHub URL + LinkedIn URL)
        ↓
[Trust Validation Engine]
  - GitHub: fork check, solo authorship, commit match, README quality
  - LinkedIn: profile exists, has content, not empty
        ↓
[Trust Score 0-100]
  - < 60 → Reject with specific reason shown to user
  - 60-79 → Generate with disclaimer banner
  - 80+ → Full generation, show "Verified Authentic Work" badge
        ↓
[AI Generation Engine — Claude API via n8n]
  - Scrape README, extract tech stack, analyze project impact
  - Generate 3 LinkedIn post variants
  - Build image card (tech stack visual)
        ↓
[User Approval Screen]
  - Preview all 3 posts
  - Edit inline
  - Select one to post
        ↓
[LinkedIn Direct Post — UGC Posts API]
  - Upload image to LinkedIn CDN
  - Register asset, get URN
  - POST to /ugcPosts with text + image
        ↓
Post live on user's LinkedIn ✓
```

---

# PART 1: n8n WORKFLOW
### (Backend Developer — You)

---

## Setup Prerequisites

### What You Need Installed / Accounts Created

1. **n8n** — self-hosted locally via Docker OR use n8n.cloud (free trial)
   - Local: `docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n`
   - Access at: `http://localhost:5678`

2. **GitHub Personal Access Token (PAT)**
   - Go to: github.com → Settings → Developer Settings → Personal Access Tokens → Fine-grained
   - Permissions needed: `repo:read` (public repos only is fine)
   - This is YOUR backend token — users never see it
   - Store in n8n as a credential: `Header Auth` → Name: `Authorization` → Value: `token YOUR_PAT_HERE`

3. **Anthropic API Key**
   - Get from: console.anthropic.com
   - Store in n8n as: `Header Auth` → Name: `x-api-key` → Value: `YOUR_KEY`
   - Model to use: `claude-opus-4-5` (best quality) or `claude-sonnet-4-5` (faster/cheaper)

4. **LinkedIn Developer App**
   - Go to: linkedin.com/developers → Create App
   - App name: DevPost Pro
   - Request these OAuth scopes: `r_liteprofile`, `r_emailaddress`, `w_member_social`
   - Add redirect URI: `http://localhost:3000/auth/linkedin/callback` (for dev) + your Vercel URL (for demo)
   - You get: `Client ID` and `Client Secret` — store both safely

5. **RapidAPI Account** (for LinkedIn scraping)
   - Search "LinkedIn Profile Scraper" on rapidapi.com
   - Free tier is enough for MVP (100 requests/month)
   - Get your RapidAPI key

---

## n8n Workflow Structure

You will build **ONE main workflow** with these logical sections:

```
Webhook Trigger
      ↓
Section 1: Input Parser
      ↓
Section 2: GitHub Validation (4 parallel API calls)
      ↓
Section 3: LinkedIn Profile Scrape
      ↓
Section 4: Trust Score Calculator
      ↓
Section 5: Gate Check (score threshold)
      ↓
Section 6: README Processor + Tech Stack Extractor
      ↓
Section 7: Claude AI — Post Generator
      ↓
Section 8: Image Card Generator
      ↓
Section 9: Response Builder
      ↓
Webhook Response → sends JSON back to UI
```

---

## SECTION 1: Webhook Trigger + Input Parser

### Node 1: Webhook Trigger
- Node type: `Webhook`
- Method: `POST`
- Path: `/analyze` (full URL will be: `http://localhost:5678/webhook/analyze`)
- Authentication: None (for MVP)
- Response mode: `Last Node` (so the final node's output is returned)

**Expected incoming JSON from UI:**
```json
{
  "github_url": "https://github.com/username/repo-name",
  "linkedin_url": "https://www.linkedin.com/in/username/",
  "tone": "professional",
  "linkedin_access_token": "AQX...",
  "linkedin_user_id": "urn:li:person:abc123"
}
```

### Node 2: Input Parser (Code Node)
- Node type: `Code`
- Language: JavaScript

```javascript
// Parse and clean inputs from the webhook
const body = $input.first().json.body;

// Extract GitHub owner and repo from URL
const githubUrl = body.github_url.trim().replace(/\/$/, '');
const githubParts = githubUrl.replace('https://github.com/', '').split('/');
const githubOwner = githubParts[0];
const githubRepo = githubParts[1];

// Extract LinkedIn username from URL
const linkedinUrl = body.linkedin_url.trim().replace(/\/$/, '');
const linkedinUsername = linkedinUrl.split('/in/')[1]?.replace('/', '') || '';

// Validate basic format
if (!githubOwner || !githubRepo) {
  throw new Error('Invalid GitHub URL format. Expected: https://github.com/username/repo');
}
if (!linkedinUsername) {
  throw new Error('Invalid LinkedIn URL format. Expected: https://linkedin.com/in/username');
}

return [{
  json: {
    github_owner: githubOwner,
    github_repo: githubRepo,
    github_url: githubUrl,
    linkedin_url: linkedinUrl,
    linkedin_username: linkedinUsername,
    tone: body.tone || 'professional',
    linkedin_access_token: body.linkedin_access_token || '',
    linkedin_user_id: body.linkedin_user_id || ''
  }
}];
```

---

## SECTION 2: GitHub Validation (4 API Calls)

Run these four HTTP requests. They can be sequential (simpler) or parallel (faster — use n8n's split-in-batches or just chain them). For MVP, do them sequentially.

### Node 3: GitHub — Get Repo Metadata
- Node type: `HTTP Request`
- Method: `GET`
- URL: `https://api.github.com/repos/{{$json.github_owner}}/{{$json.github_repo}}`
- Headers:
  - `Authorization`: `token YOUR_PAT_HERE` (use your stored credential)
  - `Accept`: `application/vnd.github.v3+json`
  - `User-Agent`: `DevPostPro/1.0`

**What we extract from response:**
- `fork` (boolean) → if true, flag it
- `description` → project description
- `stargazers_count` → credibility signal
- `language` → primary language
- `created_at` → when repo was created
- `size` → repo size (too small = suspicious)
- `default_branch` → for commit calls later

### Node 4: GitHub — Get Contributors
- Node type: `HTTP Request`
- Method: `GET`
- URL: `https://api.github.com/repos/{{$json.github_owner}}/{{$json.github_repo}}/contributors`
- Same headers as above

**What we look for:**
- Count of unique contributors
- If > 1, it's collaborative work (not necessarily bad — show warning, not block)
- If the repo owner is NOT in the contributor list = red flag

### Node 5: GitHub — Get Commits
- Node type: `HTTP Request`
- Method: `GET`
- URL: `https://api.github.com/repos/{{$json.github_owner}}/{{$json.github_repo}}/commits?per_page=30`
- Same headers

**What we look for:**
- Total commit count (very low = < 3 commits is suspicious)
- Commit author emails — do they match one person?
- Date range of commits (one-day dump = lower score)

### Node 6: GitHub — Get README
- Node type: `HTTP Request`
- Method: `GET`
- URL: `https://api.github.com/repos/{{$json.github_owner}}/{{$json.github_repo}}/readme`
- Headers: same + add `Accept: application/vnd.github.v3.raw` to get raw text

**What we extract:**
- Full README text (this is what Claude will use to generate posts)
- README length (too short = lower score)
- Presence of tech stack keywords
- Presence of demo link or screenshots

### Node 7: GitHub Validation Scorer (Code Node)
This is where you calculate the GitHub portion of the Trust Score.

```javascript
const repoData = $('GitHub — Get Repo Metadata').first().json;
const contributorsData = $('GitHub — Get Contributors').all();
const commitsData = $('GitHub — Get Commits').all();
const readmeData = $('GitHub — Get README').first().json;

const inputData = $('Input Parser').first().json;

let githubScore = 0;
let flags = [];
let warnings = [];

// Check 1: Fork detection (critical — 0 points if forked)
if (repoData.fork === true) {
  flags.push('FORKED_REPO');
  // Score stays 0 for this check
} else {
  githubScore += 25;
}

// Check 2: Solo authorship
const contributors = contributorsData.map(c => c.json);
const ownerContributions = contributors.find(c => 
  c.login?.toLowerCase() === inputData.github_owner.toLowerCase()
);
if (contributors.length === 1) {
  githubScore += 20; // Purely solo
} else if (contributors.length <= 3 && ownerContributions) {
  githubScore += 12; // Mostly solo
  warnings.push('MULTI_CONTRIBUTOR');
} else if (contributors.length > 3) {
  warnings.push('TEAM_PROJECT');
  githubScore += 5;
}

// Check 3: Commit history quality
const commits = commitsData.map(c => c.json);
const commitCount = commits.length;
if (commitCount >= 10) {
  githubScore += 20;
} else if (commitCount >= 5) {
  githubScore += 12;
} else if (commitCount >= 2) {
  githubScore += 6;
  warnings.push('LOW_COMMIT_COUNT');
} else {
  flags.push('INSUFFICIENT_COMMITS');
}

// Check 4: README quality
const readme = readmeData || '';
const readmeLength = readme.length;
const hasTechStack = /tech|stack|built with|technologies|framework|library/i.test(readme);
const hasDemo = /demo|screenshot|live|preview|video/i.test(readme);
const hasDescription = readmeLength > 200;

if (readmeLength > 500 && hasTechStack) {
  githubScore += 20;
} else if (readmeLength > 200) {
  githubScore += 10;
  warnings.push('README_COULD_BE_BETTER');
} else {
  githubScore += 0;
  flags.push('WEAK_README');
}

// Check 5: Repo substance (not empty)
if (repoData.size > 10) {
  githubScore += 15;
} else {
  flags.push('EMPTY_REPO');
}

return [{
  json: {
    ...inputData,
    github_score: githubScore,
    github_flags: flags,
    github_warnings: warnings,
    repo_meta: {
      name: repoData.name,
      description: repoData.description || '',
      language: repoData.language || 'Not specified',
      stars: repoData.stargazers_count || 0,
      created_at: repoData.created_at,
      is_fork: repoData.fork,
      contributor_count: contributors.length,
      commit_count: commitCount
    },
    readme_content: readme,
    has_demo_link: hasDemo
  }
}];
```

---

## SECTION 3: LinkedIn Profile Scrape

### Node 8: LinkedIn Scraper (HTTP Request)
- Node type: `HTTP Request`
- Method: `GET`
- URL: `https://linkedin-profile-data.p.rapidapi.com/person`
- Query params: `url` = `{{$json.linkedin_url}}`
- Headers:
  - `X-RapidAPI-Key`: `YOUR_RAPIDAPI_KEY`
  - `X-RapidAPI-Host`: `linkedin-profile-data.p.rapidapi.com`

**Fallback:** If RapidAPI scrape fails (profile private, rate limit), catch the error and use default values:
```javascript
// In error handling branch:
return [{
  json: {
    linkedin_name: 'Professional',
    linkedin_headline: 'IT Professional',
    linkedin_location: '',
    linkedin_scrape_success: false
  }
}];
```

### Node 9: LinkedIn Profile Parser (Code Node)
```javascript
const scrapeResult = $input.first().json;
const prevData = $('GitHub Validation Scorer').first().json;

// Extract what we need — different scraper APIs return different shapes
// Adjust field names based on which RapidAPI scraper you use
const name = scrapeResult.firstName 
  ? `${scrapeResult.firstName} ${scrapeResult.lastName}` 
  : scrapeResult.full_name || scrapeResult.name || 'Professional';

const headline = scrapeResult.headline 
  || scrapeResult.title 
  || 'IT Professional';

const location = scrapeResult.geoLocationName 
  || scrapeResult.location 
  || '';

const connectionCount = scrapeResult.connections 
  || scrapeResult.connectionsCount 
  || 0;

const profileExists = !!(name && headline);

// LinkedIn score component
let linkedinScore = 0;
let linkedinFlags = [];

if (!profileExists) {
  linkedinFlags.push('PROFILE_NOT_FOUND');
} else {
  linkedinScore += 40; // Profile exists
  if (connectionCount > 50) linkedinScore += 30;
  else if (connectionCount > 10) linkedinScore += 20;
  else if (connectionCount > 0) linkedinScore += 10;
  else linkedinFlags.push('LOW_CONNECTIONS');
  
  if (headline && headline.length > 10) linkedinScore += 30;
}

return [{
  json: {
    ...prevData,
    linkedin_score: linkedinScore,
    linkedin_flags: linkedinFlags,
    linkedin_profile: {
      name,
      headline,
      location,
      connection_count: connectionCount,
      profile_exists: profileExists
    }
  }
}];
```

---

## SECTION 4: Trust Score Calculator

### Node 10: Trust Score Engine (Code Node)
```javascript
const data = $input.first().json;

// Combine scores — GitHub is 60% weight, LinkedIn is 40%
const githubWeighted = (data.github_score / 100) * 60;
const linkedinWeighted = (data.linkedin_score / 100) * 40;
const totalScore = Math.round(githubWeighted + linkedinWeighted);

// Determine trust level
let trustLevel = '';
let trustBadge = '';
let proceedToGeneration = false;
let rejectionReason = '';

// Hard blocks — these kill the request regardless of score
const allFlags = [...(data.github_flags || []), ...(data.linkedin_flags || [])];

if (allFlags.includes('FORKED_REPO')) {
  trustLevel = 'REJECTED';
  rejectionReason = 'This repository appears to be a fork of another project. DevPost Pro only generates content for original work. If this is your fork with significant original contributions, please contact us.';
} else if (allFlags.includes('PROFILE_NOT_FOUND')) {
  trustLevel = 'REJECTED';
  rejectionReason = 'Your LinkedIn profile could not be found or appears to be private. Please ensure your profile URL is correct and your profile is public.';
} else if (allFlags.includes('EMPTY_REPO')) {
  trustLevel = 'REJECTED';
  rejectionReason = 'This repository appears to be empty or has very little content. DevPost Pro needs a repository with actual code to generate meaningful posts.';
} else if (allFlags.includes('INSUFFICIENT_COMMITS')) {
  trustLevel = 'REJECTED';
  rejectionReason = 'This repository has fewer than 2 commits. DevPost Pro requires a repository with meaningful commit history.';
} else if (totalScore >= 80) {
  trustLevel = 'HIGH';
  trustBadge = 'VERIFIED';
  proceedToGeneration = true;
} else if (totalScore >= 60) {
  trustLevel = 'MEDIUM';
  trustBadge = 'STANDARD';
  proceedToGeneration = true;
} else {
  trustLevel = 'LOW';
  rejectionReason = `Your profile scored ${totalScore}/100 on our authenticity check. Common reasons: new GitHub account, low commit count, or incomplete LinkedIn profile.`;
}

// Build score breakdown for UI display
const scoreBreakdown = {
  total: totalScore,
  github_component: Math.round(githubWeighted),
  linkedin_component: Math.round(linkedinWeighted),
  checks: {
    is_original_work: !allFlags.includes('FORKED_REPO'),
    solo_or_lead_author: !data.github_warnings?.includes('TEAM_PROJECT'),
    has_commit_history: !allFlags.includes('INSUFFICIENT_COMMITS'),
    readme_quality: !allFlags.includes('WEAK_README'),
    linkedin_profile_real: !allFlags.includes('PROFILE_NOT_FOUND')
  },
  warnings: data.github_warnings || []
};

return [{
  json: {
    ...data,
    trust_score: totalScore,
    trust_level: trustLevel,
    trust_badge: trustBadge,
    proceed_to_generation: proceedToGeneration,
    rejection_reason: rejectionReason,
    score_breakdown: scoreBreakdown
  }
}];
```

---

## SECTION 5: Gate Check

### Node 11: IF Node — Should We Proceed?
- Node type: `IF`
- Condition: `{{$json.proceed_to_generation}}` equals `true`

**True branch** → Continue to generation
**False branch** → Go to Node 12 (Rejection Response)

### Node 12: Rejection Response Builder (Code Node — False branch)
```javascript
const data = $input.first().json;

return [{
  json: {
    status: 'rejected',
    trust_score: data.trust_score,
    score_breakdown: data.score_breakdown,
    rejection_reason: data.rejection_reason,
    repo_meta: data.repo_meta,
    linkedin_profile: data.linkedin_profile
  }
}];
```
Connect this to the Webhook Response node.

---

## SECTION 6: README Processor + Tech Stack Extractor

### Node 13: Tech Stack Extractor (Code Node)
```javascript
const data = $input.first().json;
const readme = data.readme_content || '';
const repoMeta = data.repo_meta;

// Common tech stack keywords to detect
const techPatterns = {
  languages: ['Python', 'JavaScript', 'TypeScript', 'Java', 'Go', 'Rust', 'C++', 'C#', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'R', 'Scala'],
  frontend: ['React', 'Vue', 'Angular', 'Next.js', 'Nuxt', 'Svelte', 'HTML', 'CSS', 'Tailwind', 'Bootstrap', 'SASS'],
  backend: ['Node.js', 'Express', 'FastAPI', 'Django', 'Flask', 'Spring', 'Laravel', 'Rails', 'NestJS', 'Gin', 'Fiber'],
  databases: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Supabase', 'Firebase', 'DynamoDB', 'Cassandra'],
  cloud: ['AWS', 'Azure', 'GCP', 'Vercel', 'Netlify', 'Heroku', 'Railway', 'DigitalOcean', 'Docker', 'Kubernetes'],
  ai_ml: ['TensorFlow', 'PyTorch', 'scikit-learn', 'OpenAI', 'LangChain', 'Hugging Face', 'pandas', 'numpy'],
  tools: ['Git', 'GitHub Actions', 'CI/CD', 'REST API', 'GraphQL', 'WebSocket', 'OAuth', 'JWT', 'n8n']
};

const detectedTech = {};
const fullText = (readme + ' ' + repoMeta.description + ' ' + repoMeta.language).toLowerCase();

for (const [category, techs] of Object.entries(techPatterns)) {
  const found = techs.filter(tech => 
    fullText.includes(tech.toLowerCase())
  );
  if (found.length > 0) {
    detectedTech[category] = found;
  }
}

// Always include primary language from GitHub metadata
if (repoMeta.language && !Object.values(detectedTech).flat().includes(repoMeta.language)) {
  detectedTech.languages = [...(detectedTech.languages || []), repoMeta.language];
}

// Flatten for display
const allTech = Object.values(detectedTech).flat();

// Extract a project summary from README (first meaningful paragraph)
const lines = readme.split('\n').filter(l => l.trim() && !l.startsWith('#'));
const projectSummary = lines.slice(0, 3).join(' ').substring(0, 500);

return [{
  json: {
    ...data,
    tech_stack: detectedTech,
    tech_stack_flat: allTech,
    project_summary: projectSummary,
    readme_cleaned: readme.substring(0, 3000) // Limit for Claude context
  }
}];
```

---

## SECTION 7: Claude AI — Post Generator

### Node 14: Claude API Call (HTTP Request)
- Node type: `HTTP Request`
- Method: `POST`
- URL: `https://api.anthropic.com/v1/messages`
- Headers:
  - `x-api-key`: `YOUR_ANTHROPIC_API_KEY`
  - `anthropic-version`: `2023-06-01`
  - `content-type`: `application/json`
- Body (JSON):

```json
{
  "model": "claude-opus-4-5",
  "max_tokens": 2000,
  "system": "You are an expert LinkedIn content strategist for IT professionals. You write authentic, engaging LinkedIn posts that convert technical work into compelling professional stories. You never use generic filler phrases. Every post must feel personal, specific, and real. Always return valid JSON only.",
  "messages": [
    {
      "role": "user",
      "content": "Generate 3 LinkedIn posts for this IT professional's GitHub project. Return ONLY a JSON object with no markdown, no backticks, just raw JSON.\n\nPROFESSIONAL CONTEXT:\n- Name: {{$json.linkedin_profile.name}}\n- Role: {{$json.linkedin_profile.headline}}\n- Location: {{$json.linkedin_profile.location}}\n- Tone preference: {{$json.tone}}\n\nPROJECT DATA:\n- Repo name: {{$json.repo_meta.name}}\n- Description: {{$json.repo_meta.description}}\n- Primary language: {{$json.repo_meta.language}}\n- Stars: {{$json.repo_meta.stars}}\n- Contributors: {{$json.repo_meta.contributor_count}}\n- Tech stack: {{$json.tech_stack_flat}}\n- Project summary from README: {{$json.project_summary}}\n- README excerpt: {{$json.readme_cleaned}}\n\nGenerate exactly this JSON structure:\n{\n  \"post_technical\": {\n    \"content\": \"[A 150-200 word technical deep-dive post. Start with a bold hook. Explain what problem you solved, the interesting technical decisions made, and what you learned. Include specific tech names. End with a question to drive comments.]\",\n    \"hashtags\": [\"#tag1\", \"#tag2\", \"#tag3\", \"#tag4\", \"#tag5\"],\n    \"post_type\": \"Technical Deep-Dive\",\n    \"best_time_to_post\": \"Tuesday-Thursday 8-10am\",\n    \"expected_reach\": \"High engagement from developers\"\n  },\n  \"post_story\": {\n    \"content\": \"[A 150-200 word lessons-learned narrative post. Start with a personal challenge or struggle. Tell the journey, not just the result. Be vulnerable about what was hard. End with the key takeaway for other developers.]\",\n    \"hashtags\": [\"#tag1\", \"#tag2\", \"#tag3\", \"#tag4\", \"#tag5\"],\n    \"post_type\": \"Lessons Learned\",\n    \"best_time_to_post\": \"Monday 9am or Friday 12pm\",\n    \"expected_reach\": \"High engagement from career-focused audience\"\n  },\n  \"post_announcement\": {\n    \"content\": \"[A 100-150 word project announcement post. Lead with impact and results. What can people DO with this project? Make it accessible to non-technical readers too. Include a call-to-action to check out the repo.]\",\n    \"hashtags\": [\"#tag1\", \"#tag2\", \"#tag3\", \"#tag4\", \"#tag5\"],\n    \"post_type\": \"Project Announcement\",\n    \"best_time_to_post\": \"Wednesday 10am-12pm\",\n    \"expected_reach\": \"Broadest reach, good for visibility\"\n  },\n  \"recruiter_score\": {\n    \"technical_post\": 8,\n    \"story_post\": 7,\n    \"announcement_post\": 9,\n    \"reasoning\": \"Brief explanation of scores\"\n  }\n}"
    }
  ]
}
```

### Node 15: Claude Response Parser (Code Node)
```javascript
const claudeResponse = $input.first().json;
const prevData = $('Tech Stack Extractor').first().json;

// Extract text from Claude's response
const responseText = claudeResponse.content[0].text;

// Parse the JSON (Claude should return pure JSON per our prompt)
let posts;
try {
  posts = JSON.parse(responseText);
} catch(e) {
  // Fallback: try to extract JSON from response if there's any wrapper text
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    posts = JSON.parse(jsonMatch[0]);
  } else {
    throw new Error('Claude did not return valid JSON: ' + responseText.substring(0, 200));
  }
}

return [{
  json: {
    ...prevData,
    generated_posts: posts,
    generation_timestamp: new Date().toISOString()
  }
}];
```

---

## SECTION 8: Image Card Generator

For the MVP, generate a structured text-based image card using HTML-to-image conversion. The simplest approach for n8n is to generate the HTML and have the frontend render it, OR use a service like `htmlcsstoimage.com` API.

### Option A (Recommended for MVP): Return HTML Template
Just return the image data as an HTML string — the frontend renders and screenshots it.

### Option B: htmlcsstoimage.com API
- Sign up at htmlcsstoimage.com (free tier: 50 images/month)
- Use HTTP Request node to call their API

### Node 16: Image Card Data Builder (Code Node)
```javascript
const data = $input.first().json;

// Build the image card data — frontend will render this
const imageCardData = {
  title: data.repo_meta.name,
  description: data.repo_meta.description || data.project_summary.substring(0, 100),
  tech_stack: data.tech_stack_flat.slice(0, 8), // Max 8 tech items
  author_name: data.linkedin_profile.name,
  author_role: data.linkedin_profile.headline,
  language: data.repo_meta.language,
  stars: data.repo_meta.stars,
  trust_badge: data.trust_badge,
  trust_score: data.trust_score,
  github_url: data.github_url
};

// HTML template for the image card (1200x630 — LinkedIn OG size)
const imageHtml = `
<div style="width:1200px;height:630px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:60px;display:flex;flex-direction:column;justify-content:space-between;font-family:system-ui">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div style="color:#64748b;font-size:18px;font-weight:500">DevPost Pro</div>
    <div style="background:${data.trust_badge === 'VERIFIED' ? '#059669' : '#d97706'};color:white;padding:8px 20px;border-radius:100px;font-size:16px;font-weight:600">
      ${data.trust_badge === 'VERIFIED' ? '✓ Verified Work' : 'Authenticated'}
    </div>
  </div>
  <div>
    <div style="color:#94a3b8;font-size:20px;margin-bottom:12px">New Project</div>
    <h1 style="color:white;font-size:64px;font-weight:700;margin:0 0 20px">${data.repo_meta.name}</h1>
    <p style="color:#cbd5e1;font-size:24px;max-width:800px;line-height:1.4">${imageCardData.description}</p>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:flex-end">
    <div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">
        ${imageCardData.tech_stack.map(t => `<span style="background:#1e40af;color:#93c5fd;padding:6px 16px;border-radius:100px;font-size:16px">${t}</span>`).join('')}
      </div>
      <div style="color:#94a3b8;font-size:18px">${imageCardData.author_name} · ${imageCardData.author_role}</div>
    </div>
    <div style="text-align:right;color:#64748b;font-size:16px">
      ${data.repo_meta.stars > 0 ? `⭐ ${data.repo_meta.stars} stars` : ''}
    </div>
  </div>
</div>
`;

return [{
  json: {
    ...data,
    image_card: {
      html: imageHtml,
      data: imageCardData
    }
  }
}];
```

---

## SECTION 9: Final Response Builder

### Node 17: Response Builder (Code Node)
```javascript
const data = $input.first().json;

// Build clean response for the frontend
const response = {
  status: 'success',
  trust: {
    score: data.trust_score,
    level: data.trust_level,
    badge: data.trust_badge,
    breakdown: data.score_breakdown
  },
  profile: {
    github: {
      repo_name: data.repo_meta.name,
      description: data.repo_meta.description,
      language: data.repo_meta.language,
      stars: data.repo_meta.stars,
      contributors: data.repo_meta.contributor_count,
      commits: data.repo_meta.commit_count,
      is_fork: data.repo_meta.is_fork,
      url: data.github_url
    },
    linkedin: data.linkedin_profile
  },
  tech_stack: data.tech_stack,
  posts: {
    technical: {
      ...data.generated_posts.post_technical,
      id: 'technical'
    },
    story: {
      ...data.generated_posts.post_story,
      id: 'story'
    },
    announcement: {
      ...data.generated_posts.post_announcement,
      id: 'announcement'
    }
  },
  recruiter_scores: data.generated_posts.recruiter_score,
  image_card: data.image_card,
  generated_at: data.generation_timestamp
};

return [{ json: response }];
```

---

## SECTION 10: LinkedIn Direct Posting Workflow

This is a **SEPARATE workflow** in n8n triggered when the user clicks "Post to LinkedIn" in the UI.

### Workflow: `POST /webhook/post-to-linkedin`

**Expected input from UI:**
```json
{
  "post_content": "The selected post text...",
  "hashtags": ["#tag1", "#tag2"],
  "image_html": "<div>...</div>",
  "access_token": "AQX...",
  "linkedin_user_id": "urn:li:person:abc123"
}
```

### Node A: Register Image Upload with LinkedIn
- Method: `POST`
- URL: `https://api.linkedin.com/v2/assets?action=registerUpload`
- Headers: `Authorization: Bearer {{$json.access_token}}`
- Body:
```json
{
  "registerUploadRequest": {
    "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
    "owner": "{{$json.linkedin_user_id}}",
    "serviceRelationships": [{
      "relationshipType": "OWNER",
      "identifier": "urn:li:userGeneratedContent"
    }]
  }
}
```
→ Returns `uploadMechanism.com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest.uploadUrl` and `asset`

### Node B: Upload Image Binary to LinkedIn CDN
- Method: `PUT`
- URL: `{{upload_url from Node A}}`
- Headers:
  - `Authorization: Bearer {{$json.access_token}}`
  - `Content-Type: image/png`
- Body: Binary image data

**Note for MVP:** For simplicity, instead of server-side screenshot, have the frontend take a screenshot of the rendered HTML card using `html2canvas` library and send it as base64. n8n receives the base64, converts to binary, uploads.

### Node C: Combine Post Text + Hashtags
```javascript
const data = $input.first().json;
const hashtags = data.hashtags.join(' ');
const fullContent = data.post_content + '\n\n' + hashtags;
return [{ json: { ...data, full_post_content: fullContent } }];
```

### Node D: POST to LinkedIn UGC Posts API
- Method: `POST`
- URL: `https://api.linkedin.com/v2/ugcPosts`
- Headers:
  - `Authorization: Bearer {{$json.access_token}}`
  - `Content-Type: application/json`
  - `X-Restli-Protocol-Version: 2.0.0`
- Body:
```json
{
  "author": "{{$json.linkedin_user_id}}",
  "lifecycleState": "PUBLISHED",
  "specificContent": {
    "com.linkedin.ugc.ShareContent": {
      "shareCommentary": {
        "text": "{{$json.full_post_content}}"
      },
      "shareMediaCategory": "IMAGE",
      "media": [{
        "status": "READY",
        "description": { "text": "Project showcase by DevPost Pro" },
        "media": "{{asset_urn_from_Node_A}}",
        "title": { "text": "{{$json.repo_name}}" }
      }]
    }
  },
  "visibility": {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
  }
}
```

### Node E: Post Success Response
```javascript
const postResult = $input.first().json;
return [{
  json: {
    status: 'posted',
    post_id: postResult.id,
    post_url: `https://www.linkedin.com/feed/update/${postResult.id}`,
    message: 'Your post is now live on LinkedIn!'
  }
}];
```

---

## n8n Environment Variables (Store in n8n Settings → Credentials)

```
GITHUB_PAT=your_github_personal_access_token
ANTHROPIC_API_KEY=your_anthropic_api_key
RAPIDAPI_KEY=your_rapidapi_key
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
HTMLCSSTOIMAGE_USER_ID=your_id (optional)
HTMLCSSTOIMAGE_API_KEY=your_key (optional)
```

---

## n8n Workflow Testing Checklist

Before connecting to UI, test each section with these sample inputs:

1. **Test GitHub validation:** Use `https://github.com/torvalds/linux` → should flag as multi-contributor
2. **Test fork detection:** Fork any repo, use the forked URL → should reject
3. **Test good repo:** Use a clean solo public repo → should get score 80+
4. **Test Claude generation:** Manually trigger with good repo data → check JSON output shape
5. **Test rejection response:** Use a private repo URL → should return rejection message
6. **Test LinkedIn posting:** Use a test LinkedIn account → verify post appears

---

# PART 2: FRONTEND UI
### (Partner — React/Next.js)

---

## Tech Stack for UI

- **Framework:** Next.js 14 (App Router) — simplest full-stack setup
- **Styling:** Tailwind CSS
- **HTTP calls:** Axios or native fetch
- **LinkedIn OAuth:** NextAuth.js with LinkedIn provider
- **Image screenshot:** html2canvas (for capturing the image card)
- **Icons:** Lucide React
- **Deployment:** Vercel (free, needed for LinkedIn OAuth redirect URI)

```bash
npx create-next-app@latest devpost-pro --typescript --tailwind --app
cd devpost-pro
npm install axios html2canvas lucide-react next-auth
```

---

## File Structure

```
devpost-pro/
├── app/
│   ├── page.tsx                    # Landing + Input form
│   ├── results/page.tsx            # Trust score + Post previews
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # LinkedIn OAuth
│   │   ├── analyze/route.ts              # Calls n8n analyze webhook
│   │   └── post/route.ts                 # Calls n8n post webhook
├── components/
│   ├── InputForm.tsx               # GitHub + LinkedIn URL inputs
│   ├── TrustScoreCard.tsx          # Animated trust score display
│   ├── PostPreviewCard.tsx         # Individual post card with edit
│   ├── ImageCard.tsx               # The visual project card
│   ├── PostSelector.tsx            # Select which post to publish
│   ├── LoadingScreen.tsx           # Processing animation
│   └── RejectionScreen.tsx         # Shows rejection reason
├── lib/
│   ├── n8n.ts                      # n8n API calls
│   └── types.ts                    # TypeScript types
└── .env.local
```

---

## Environment Variables (.env.local)

```
NEXT_PUBLIC_N8N_ANALYZE_URL=http://localhost:5678/webhook/analyze
NEXT_PUBLIC_N8N_POST_URL=http://localhost:5678/webhook/post-to-linkedin
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
```

---

## Page 1: Landing + Input Form (app/page.tsx)

### What this page contains:
- DevPost Pro logo + tagline: "Turn your GitHub into your greatest recruiter"
- Two input fields:
  1. GitHub Repository URL (text input with GitHub icon)
  2. LinkedIn Profile URL (text input with LinkedIn icon)
- Tone selector: Radio buttons — "Professional" / "Casual" / "Bold"
- "Connect LinkedIn" button (triggers OAuth — required for posting later)
- LinkedIn connection status indicator (shows green checkmark when connected)
- "Analyze & Generate" primary CTA button
- A small info box: "We only process public GitHub repositories"
- Trust score explanation section (what the score means)

### Validation (client-side before sending):
```typescript
// lib/validation.ts
export function validateGithubUrl(url: string): string | null {
  const pattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+\/?$/;
  if (!url) return 'GitHub URL is required';
  if (!pattern.test(url)) return 'Please enter a valid GitHub repository URL (e.g. https://github.com/username/repo)';
  return null;
}

export function validateLinkedinUrl(url: string): string | null {
  const pattern = /^https:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/;
  if (!url) return 'LinkedIn URL is required';
  if (!pattern.test(url)) return 'Please enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/username)';
  return null;
}
```

### Form submission flow:
1. Validate both URLs client-side
2. If LinkedIn not connected → show modal: "Connect LinkedIn to enable direct posting. You can still generate posts and copy them manually."
3. Show LoadingScreen component
4. Call `/api/analyze` with the form data
5. If response.status === 'rejected' → redirect to rejection screen with reason
6. If response.status === 'success' → redirect to `/results` with data in sessionStorage

---

## Page 2: Results Page (app/results/page.tsx)

### What this page contains (top to bottom):

**Section A: Trust Score Display**
- Animated circular progress bar showing score (0-100)
- Color: Red < 60, Amber 60-79, Green 80+
- Badge: "Verified Authentic Work" (green) or "Standard" (amber)
- Expandable score breakdown showing 5 individual checks with pass/fail icons

**Section B: Project Summary Card**
- Repo name + description
- Detected tech stack badges (colored pills)
- GitHub stats: stars, commits, contributors
- LinkedIn profile: name + headline

**Section C: Three Post Preview Cards**
Side-by-side (desktop) / stacked (mobile). Each card shows:
- Post type label (Technical Deep-Dive / Lessons Learned / Project Announcement)
- Recruiter score badge (e.g. "9/10 recruiter appeal")
- Best time to post
- Full post text (editable inline — use a textarea that looks like text)
- Hashtags (editable chips)
- "Select this post" button
- Character counter (LinkedIn max: 3000 characters)

**Section D: Image Card Preview**
- Renders the ImageCard component using the HTML template from n8n
- "Regenerate image" button
- Download image button (uses html2canvas)

**Section E: Post Action Panel** (appears after user selects a post)
- Shows selected post summary
- If LinkedIn connected: "Post to LinkedIn Now" primary button
- If LinkedIn not connected: "Copy Post Text" button + "Connect LinkedIn to post directly" link
- Confirmation modal before posting: "You're about to post as [Name]. Confirm?"
- Success state: animated checkmark + link to view the live post

---

## Component Specifications

### TrustScoreCard.tsx
```typescript
interface TrustScoreCardProps {
  score: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  badge: 'VERIFIED' | 'STANDARD';
  breakdown: {
    total: number;
    checks: {
      is_original_work: boolean;
      solo_or_lead_author: boolean;
      has_commit_history: boolean;
      readme_quality: boolean;
      linkedin_profile_real: boolean;
    };
    warnings: string[];
  };
}
// Visual: Animated SVG circle chart + 5 check rows with green tick / red cross
// Animation: Count up from 0 to actual score on page load
```

### PostPreviewCard.tsx
```typescript
interface PostPreviewCardProps {
  post: {
    id: string;
    content: string;
    hashtags: string[];
    post_type: string;
    best_time_to_post: string;
    expected_reach: string;
  };
  recruiterScore: number;
  isSelected: boolean;
  onSelect: () => void;
  onContentChange: (content: string) => void;
}
// Key feature: inline editing — clicking the post text turns it into a textarea
// Character count with LinkedIn's 3000 char limit shown as colored bar
```

### ImageCard.tsx
```typescript
interface ImageCardProps {
  html: string; // HTML template from n8n
  onCapture: (imageBlob: Blob) => void; // For html2canvas screenshot
}
// Renders the HTML in a hidden div, uses html2canvas to capture as PNG
// Shows preview to user, passes blob to parent for LinkedIn upload
```

### LoadingScreen.tsx
Show this while n8n is processing (can take 10-20 seconds):
- Animated steps indicator showing current stage:
  1. "Checking GitHub repository..." ✓
  2. "Scanning LinkedIn profile..." ✓
  3. "Calculating trust score..." ✓
  4. "Generating your posts..." (spinning)
  5. "Building image card..."
- Fake progress (use setTimeout to advance steps every 3 seconds)
- Tip shown underneath: "Did you know? Posts with project images get 3x more impressions"

### RejectionScreen.tsx
```typescript
interface RejectionScreenProps {
  reason: string;
  score: number;
  breakdown: object;
}
// Shows: large warning icon, score, specific rejection reason
// Actionable tips: "Here's how to improve your score:"
// Back button to try a different repo
```

---

## API Routes

### app/api/auth/[...nextauth]/route.ts
```typescript
import NextAuth from 'next-auth';
import LinkedInProvider from 'next-auth/providers/linkedin';

export const authOptions = {
  providers: [
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'r_liteprofile r_emailaddress w_member_social'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Store LinkedIn access token in JWT
      if (account?.provider === 'linkedin') {
        token.linkedinAccessToken = account.access_token;
        token.linkedinId = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      // Make access token available in session
      session.linkedinAccessToken = token.linkedinAccessToken;
      session.linkedinId = `urn:li:person:${token.linkedinId}`;
      return session;
    }
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### app/api/analyze/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const body = await req.json();
  
  const n8nPayload = {
    github_url: body.github_url,
    linkedin_url: body.linkedin_url,
    tone: body.tone,
    linkedin_access_token: session?.linkedinAccessToken || '',
    linkedin_user_id: session?.linkedinId || ''
  };
  
  const response = await fetch(process.env.NEXT_PUBLIC_N8N_ANALYZE_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(n8nPayload),
    signal: AbortSignal.timeout(60000) // 60 second timeout
  });
  
  const data = await response.json();
  return NextResponse.json(data);
}
```

### app/api/post/route.ts
```typescript
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.linkedinAccessToken) {
    return NextResponse.json({ error: 'LinkedIn not connected' }, { status: 401 });
  }
  
  const body = await req.json();
  // body contains: post_content, hashtags, image_base64, repo_name
  
  const response = await fetch(process.env.NEXT_PUBLIC_N8N_POST_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      access_token: session.linkedinAccessToken,
      linkedin_user_id: session.linkedinId
    })
  });
  
  const data = await response.json();
  return NextResponse.json(data);
}
```

---

## TypeScript Types (lib/types.ts)

```typescript
export interface AnalyzeResponse {
  status: 'success' | 'rejected';
  trust: {
    score: number;
    level: 'HIGH' | 'MEDIUM' | 'LOW';
    badge: 'VERIFIED' | 'STANDARD';
    breakdown: TrustBreakdown;
  };
  profile: {
    github: GithubProfile;
    linkedin: LinkedinProfile;
  };
  tech_stack: Record<string, string[]>;
  posts: {
    technical: Post;
    story: Post;
    announcement: Post;
  };
  recruiter_scores: RecruiterScores;
  image_card: ImageCardData;
  rejection_reason?: string;
  generated_at: string;
}

export interface Post {
  id: string;
  content: string;
  hashtags: string[];
  post_type: string;
  best_time_to_post: string;
  expected_reach: string;
}

export interface TrustBreakdown {
  total: number;
  github_component: number;
  linkedin_component: number;
  checks: {
    is_original_work: boolean;
    solo_or_lead_author: boolean;
    has_commit_history: boolean;
    readme_quality: boolean;
    linkedin_profile_real: boolean;
  };
  warnings: string[];
}

export interface GithubProfile {
  repo_name: string;
  description: string;
  language: string;
  stars: number;
  contributors: number;
  commits: number;
  is_fork: boolean;
  url: string;
}

export interface LinkedinProfile {
  name: string;
  headline: string;
  location: string;
  connection_count: number;
  profile_exists: boolean;
}

export interface RecruiterScores {
  technical_post: number;
  story_post: number;
  announcement_post: number;
  reasoning: string;
}

export interface ImageCardData {
  html: string;
  data: {
    title: string;
    description: string;
    tech_stack: string[];
    author_name: string;
    author_role: string;
    language: string;
    stars: number;
    trust_badge: string;
    trust_score: number;
    github_url: string;
  };
}
```

---

## UI Design Specifications

### Color Palette
```css
/* Primary colors */
--primary: #2563eb;        /* Blue — main CTAs */
--primary-hover: #1d4ed8;
--success: #059669;        /* Green — verified, success states */
--warning: #d97706;        /* Amber — medium trust, warnings */
--danger: #dc2626;         /* Red — rejection, errors */

/* Backgrounds */
--bg-primary: #ffffff;
--bg-secondary: #f8fafc;
--bg-dark: #0f172a;        /* Used in image card */

/* Text */
--text-primary: #0f172a;
--text-secondary: #64748b;
--text-muted: #94a3b8;

/* Trust score colors */
--trust-high: #059669;     /* 80+ */
--trust-medium: #d97706;   /* 60-79 */
--trust-low: #dc2626;      /* <60 */
```

### Typography
- Font: Inter (Google Fonts)
- Headings: font-weight 700
- Body: font-weight 400
- Labels/badges: font-weight 600

### Layout
- Max width: 1200px, centered
- Mobile-first responsive
- Page padding: 24px mobile, 48px desktop

---

## User Flow — Complete End-to-End

```
1. User lands on homepage
2. Enters GitHub repo URL + LinkedIn profile URL
3. Selects tone (Professional / Casual / Bold)
4. Clicks "Connect LinkedIn" → OAuth popup → returns to app
5. Session now has LinkedIn access token
6. Clicks "Analyze & Generate"
7. Loading screen shows (10-20 seconds)
   - n8n: validates GitHub (4 API calls)
   - n8n: scrapes LinkedIn profile
   - n8n: calculates trust score
   - n8n: calls Claude API
   - n8n: builds image card HTML
8a. IF rejected → Rejection screen with specific reason + how to fix
8b. IF success → Results page loads with:
    - Trust score card (animated)
    - Project summary card
    - 3 post preview cards (editable)
    - Image card preview
9. User reads/edits posts
10. User selects preferred post
11. User clicks "Post to LinkedIn Now"
12. Confirmation modal appears
13. User confirms → app captures image card (html2canvas)
14. App calls /api/post → n8n posts to LinkedIn
15. Success screen: "Your post is live!" + link to view it
```

---

## Error Handling — Required for Phase 3

### Every error state must show a user-friendly message:

| Error | User-facing message |
|-------|-------------------|
| GitHub repo not found | "This GitHub repository doesn't exist or is private. DevPost Pro only works with public repositories." |
| GitHub API rate limit | "We're experiencing high demand. Please try again in a few minutes." |
| LinkedIn scrape failed | "We couldn't load your LinkedIn profile details, but we can still generate posts. Some personalization may be reduced." |
| Claude API timeout | "AI generation is taking longer than expected. Please try again." |
| LinkedIn post failed | "Your post couldn't be published. Please check your LinkedIn connection and try again, or copy the post text manually." |
| Invalid GitHub URL | "Please enter a valid GitHub repository URL (e.g. https://github.com/username/repo-name)" |
| Invalid LinkedIn URL | "Please enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/your-username)" |

---

## Private Repo Handling

When a GitHub URL returns a 404 (private repo or doesn't exist), show this in the UI:

```
⚠️ Private or Non-Existent Repository
DevPost Pro only processes public GitHub repositories.

If this is your repository:
→ Go to GitHub → Repository Settings → Change visibility to Public
→ Then come back and try again

If you want to showcase private work, consider:
→ Creating a public portfolio repo with project descriptions
→ Using a README-only public repo as a showcase
```

---

## Demo Day Checklist

Before presenting to your professor:

### n8n
- [ ] All 17 nodes connected and tested
- [ ] Webhook URL is accessible (use ngrok if local: `ngrok http 5678`)
- [ ] Test with a good repo → generates 3 posts ✓
- [ ] Test with a forked repo → rejection screen ✓
- [ ] Test with private repo → private repo message ✓
- [ ] LinkedIn posting tested with test account ✓
- [ ] Error handling tested (bad URLs etc.) ✓

### UI
- [ ] Deployed to Vercel (required for LinkedIn OAuth)
- [ ] LinkedIn OAuth working with production redirect URI
- [ ] Mobile responsive ✓
- [ ] All 3 post cards editable ✓
- [ ] Image card rendering ✓
- [ ] Loading states on all buttons ✓
- [ ] All error messages showing correctly ✓
- [ ] End-to-end flow working live ✓

### Demo Script (for live presentation)
1. Open the app — show the clean landing page
2. Paste a pre-tested GitHub URL (use your own real repo)
3. Paste your LinkedIn URL
4. Select "Professional" tone
5. Show LinkedIn is already connected (do this before demo)
6. Click Generate — narrate what's happening during the 15-second wait
7. Show the Trust Score — explain what each check means
8. Show all 3 post variants — click into one to show editing
9. Show the image card
10. Select the announcement post, click "Post to LinkedIn"
11. Show the success screen
12. Pull up LinkedIn on your phone to show the live post

---

## Known Limitations (Document These in Phase 3 Slides)

1. **Public repos only** — private repo support requires OAuth which adds complexity
2. **LinkedIn scraping** — relies on third-party RapidAPI; if scraper fails, personalization is reduced
3. **Single repo per session** — no history or saved posts in MVP
4. **Image card** — HTML-based, not a fully designed graphic
5. **LinkedIn posting rate limits** — LinkedIn limits API calls; heavy usage would require approval
6. **No post scheduling** — posts immediately; scheduling is a post-MVP feature
7. **English only** — Claude prompts optimized for English posts only
8. **No A/B analytics** — no tracking of which post type performs better

---

## What You Are Testing With This MVP

Frame this clearly in your Phase 3 technical summary:

> "This MVP tests three core assumptions:
> 1. IT professionals are willing to share a GitHub URL + LinkedIn URL in exchange for AI-generated content
> 2. The Trust Validation Matrix successfully filters fake/forked profiles without creating too many false rejections
> 3. AI-generated LinkedIn posts are good enough quality that users will post them with minimal editing"

---

*Build sequence: n8n Sections 1-5 first → test rejection flow → Sections 6-9 → test generation → UI Input Form → UI Results Page → integration test → LinkedIn posting → full demo rehearsal*
