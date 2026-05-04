# Homeio Promotion Plan

Updated: 2026-04-18

## 1. Product Analysis

### What Homeio already ships

Based on the current repository, README, routes, and modules, Homeio is not just a dashboard. It is a self-hosted home server control surface with:

- Desktop-style shell UI: dock, windows, widgets, lock screen, command palette
- Docker app management: install, update, uninstall, redeploy, logs, compose editing, custom app install
- App Store compatibility with CasaOS-style store archives and custom sources
- Real-time monitoring through SSE for system metrics, network events, Docker stats, and store operations
- File management: browse, upload, download, copy/move, trash, starred files, previews, ZIP, search
- Network storage: local folder sharing plus SMB share discovery, mount, and unmount
- Built-in terminal with an explicit command allowlist instead of a full shell
- System controls: updates, rollback, backups, shutdown, reboot, scheduled power actions
- Network management via NetworkManager / D-Bus
- Single-user authentication with registration bootstrap flow
- Docker image publishing and GitHub release automation in CI

### Core value proposition

Homeio’s value is not "yet another Docker UI".

It combines three things that are usually fragmented:

1. App deployment and lifecycle management
2. System visibility and server operations
3. A much more approachable desktop-like user experience for homelab users

### Strongest differentiators

- Better first impression than utilitarian dashboards
- Strong "no-SSH for daily tasks" story
- Real-time visibility built into the product, not bolted on
- Useful for Raspberry Pi / mini-PC / Debian home server setups
- Practical overlap between app management, files, terminal, backups, and networking

### Best-fit audience

- Self-hosters who find Portainer too infrastructure-heavy
- CasaOS or Umbrel users who want more control without dropping to raw Docker full-time
- Raspberry Pi and mini-PC homelab users
- Users setting up a family/home server and wanting a friendly UI
- Open-source contributors interested in self-hosted UX, not only backend infra

## 2. Message Positioning

### Recommended short positioning

Homeio is a self-hosted server manager with a desktop-style UI for running Docker apps, files, terminal, and system operations from one place.

### Recommended comparison framing

Use this framing consistently:

- Alternative to CasaOS, Umbrel, and Portainer
- More approachable than Portainer
- More operational than a homepage/dashboard
- More cohesive for daily homelab use than stitching multiple tools together

### Messaging pillars

- Control your homelab without living in SSH
- Manage apps, files, terminal, network, and system state from one interface
- Desktop-like UX for self-hosting, not another admin panel

## 3. Friction To Fix Before Promotion

These are worth tightening before broad outreach because self-hosted communities inspect repos closely.

- Keep `CONTRIBUTING.md` current
  - The file now exists; keep setup, branch, test, and PR expectations aligned with the codebase.
- Keep versioning consistent
  - `package.json` is in the `1.6.x` release line.
  - `ROADMAP.md` now documents v1.6.x as the current line.
  - Tags and GitHub releases should be checked before any broad launch push.
- Make contribution entry points obvious
  - add `good first issue`, `help wanted`, and module-scoped labels
- Publish one clear installation matrix
  - Docker
  - bare metal / Debian / Ubuntu / Raspberry Pi OS
  - what works only with NetworkManager / D-Bus
- Add a 60-90 second demo GIF/video
  - desktop shell
  - app install
  - file preview
  - terminal
  - metrics
- Prepare a "Why Homeio exists" launch post
  - communities respond better to narrative + tradeoffs than raw feature lists

## 4. Best Sites And Communities To Target

Priority order is based on relevance to self-hosted / homelab software and likelihood of reaching both users and contributors.

### Tier 1: Must target

#### 1. selfh.st/apps

Why it matters:

- Highly relevant self-hosted discovery surface
- Official directory for self-hosted software
- Maintainer explicitly invites developers to reach out to add projects
- The platform reported 900+ projects and nearly half a million monthly directory views in January 2025

How to use it:

- Submit Homeio for listing
- Pitch it for Self-Host Weekly coverage
- After listing, optionally evaluate paid partnership only if organic response is promising

Best angle:

- "Desktop-style self-hosted server manager for Docker apps, files, terminal, and system operations"

Links:

- https://selfh.st/apps-about/
- https://selfh.st/about/
- https://selfh.st/weekly/2025-01-03/

#### 2. Awesome-Selfhosted

Why it matters:

- Massive discovery surface inside the self-hosted ecosystem
- Strong contributor visibility because developers browse it directly
- The GitHub repo currently shows 287k stars and 1,200+ contributors

How to use it:

- Submit Homeio to the most appropriate category
- Treat this as a credibility move more than a traffic spike

Best angle:

- "Self-hosting solution" or adjacent category depending on maintainers' criteria

Links:

- https://github.com/awesome-selfhosted/awesome-selfhosted
- https://awesome-selfhosted.net/

#### 3. r/selfhosted

Why it matters:

- One of the main discussion hubs for this exact audience
- Strong feedback loop for bugs, missing docs, installation pain, and feature demand

How to use it:

- Post only when the launch post meets the subreddit self-promo requirements
- Lead with what problem Homeio solves and why it exists
- Include install docs, screenshots, a concise feature list, and explicit value to self-hosters

Important moderation constraints:

- The app must be self-hostable
- It must be released and available to try
- It must have documentation
- The post must explain what it does, key features, and why it helps users

Link:

- https://www.reddit.com/r/selfhosted/

### Tier 2: High-value supporting channels

#### 4. Noted.lol

Why it matters:

- Self-hosted publication with a directory and contributor model
- Explicitly invites developers to introduce their self-hosted projects

How to use it:

- Submit Homeio to the directory
- Pitch a guest article such as:
  - "Why I built a desktop-style UI for self-hosting"
  - "Managing a Raspberry Pi home server without SSH"
  - "What CasaOS and Portainer still leave open for homelab UX"

Links:

- https://noted.lol/directory/
- https://noted.lol/contribute/

#### 5. Mastodon hashtags: `#selfhosted` and `#homelab`

Why it matters:

- Relevant open-source audience
- Good channel for launches, release notes, and demo clips
- selfh.st explicitly cites those communities as part of the ecosystem it draws from

How to use it:

- Post short demo videos
- Post release threads with one concrete improvement per post
- Reply to related discussions instead of only broadcasting

Reference:

- https://selfh.st/about/

### Tier 3: Use carefully

#### 6. r/homelab

Why it matters:

- Big overlap with Homeio’s target user
- Good for tutorial or build-log style content

Why not primary:

- Direct product promotion is moderated aggressively
- Safer approach is educational content first, product second

Best use:

- "How I built a desktop-like control surface for my home server"
- "Managing Docker apps, files, and backups from one Raspberry Pi UI"

Reference:

- https://www.reddit.com/r/homelab/

## 5. Recommended Launch Sequence

### Phase 0: Pre-launch cleanup

Do this first:

1. Add `CONTRIBUTING.md`
2. Fix versioning inconsistencies across `package.json`, tags, releases, and roadmap
3. Produce a short demo video/GIF
4. Prepare three screenshots:
   - desktop shell
   - app store / compose management
   - file manager + terminal + metrics
5. Create 5-10 labeled starter issues
6. Add "Good first issue" and "Help wanted" labels

### Phase 1: Discovery surfaces

Do within the same week:

1. Submit to selfh.st/apps
2. Reach out to selfh.st for newsletter consideration
3. Submit to Awesome-Selfhosted
4. Submit or pitch to Noted.lol directory/editorial

Goal:

- make Homeio discoverable where self-hosters already search for new projects

### Phase 2: Community launch

Do after discovery listings are ready:

1. Publish a launch post on r/selfhosted
2. Publish a Mastodon launch thread with screenshots/video
3. Publish a GitHub release post with clear highlights

Goal:

- convert curiosity into GitHub stars, installs, and issue traffic

### Phase 3: Content-driven growth

Over the next 4-6 weeks:

1. Publish one technical article
2. Publish one comparison article
3. Publish one setup tutorial

Recommended topics:

- Homeio vs CasaOS vs Portainer for home servers
- Building a no-SSH homelab workflow
- Running Homeio on Raspberry Pi / Debian

Goal:

- bring in search traffic and higher-intent users

### Phase 4: Contributor acquisition

Once traffic starts:

1. Post "good first issues" visibly
2. Add architecture docs for modules
3. Publish a "where contributors can help" page
4. Thank external contributors publicly in releases

Goal:

- convert interest into sustained open-source participation

## 6. Suggested Content Assets

### Directory pitch

Homeio is a self-hosted server manager with a desktop-style UI for managing Docker apps, files, terminal access, backups, updates, and live system metrics from one place. It is aimed at homelab and home server users who want something more approachable than infrastructure-heavy admin panels without giving up operational control.

### r/selfhosted post skeleton

Title:

`Homeio: desktop-style self-hosted server manager for Docker apps, files, terminal, and live system metrics`

Body structure:

1. Problem:
   - most home server workflows still bounce between SSH, Docker tools, file browser, and system utilities
2. What Homeio is:
   - a self-hosted control surface for common homelab tasks
3. Key features:
   - desktop shell
   - Docker app store / compose management
   - file manager
   - terminal with allowlist
   - backups / updates / monitoring / networking
4. Who it is for:
   - Raspberry Pi, mini-PC, Debian/Ubuntu home servers
5. Links:
   - GitHub
   - install docs
   - screenshots / demo
6. Ask:
   - feedback on install flow, UX rough edges, and missing workflows

### Contributor CTA

If you want contributors, ask for narrow help:

- polish UX consistency
- improve install coverage
- add storage and backup workflows
- improve docs for networking and hardware-specific cases

Avoid generic asks like:

- "contributors welcome"

Use specific asks like:

- "Looking for help on Raspberry Pi testing, onboarding docs, and file-manager UX polish"

## 7. Success Metrics

Track weekly:

- GitHub stars
- GitHub issues opened by new users
- PRs from first-time contributors
- installs from release announcements
- referral traffic from selfh.st, Reddit, Noted, Mastodon
- docs visits for install pages

Best early signals:

- people successfully install it without hand-holding
- people compare it to CasaOS / Portainer unprompted
- contributors start picking up scoped issues

## 8. Practical Recommendation

If you only do three things in the next two weeks, do these:

1. Fix repo credibility gaps: `CONTRIBUTING.md`, version consistency, starter issues
2. Get listed on selfh.st/apps and submit to Awesome-Selfhosted
3. Launch on r/selfhosted with a strong demo and a narrative post, not just a link drop

## 9. Sources

- Repository analysis in this codebase:
  - `README.md`
  - `ROADMAP.md`
  - `.github/workflows/release.yml`
  - `package.json`
  - `modules/*`, `lib/server/modules/*`, `app/api/*`
- External references:
  - https://selfh.st/apps-about/
  - https://selfh.st/about/
  - https://selfh.st/weekly/2025-01-03/
  - https://github.com/awesome-selfhosted/awesome-selfhosted
  - https://noted.lol/directory/
  - https://noted.lol/contribute/
  - https://www.reddit.com/r/selfhosted/comments/1s1vqy0/removed/
  - https://www.reddit.com/r/homelab/comments/1seabls/removed_by_moderator/
