---
title: 'Building a Light Novel Review Site in 5 Hours'
description: 'How I built a Japanese light novel review site in 5 hours with Astro, Svelte, and AI tooling-focusing on honest opinions over SEO, static generation over complexity, and CC0 licensing over gatekeeping.'
pubDate: 'Oct 22 2025'
heroImageId: '32004755-5e5d-4d6c-8e45-2d440f809e00'
heroImageSource: 'Pixiv'
heroImageSourceUrl: 'https://www.pixiv.net/artworks/125004074'
heroImageAuthor: '코쿠큐커'
heroImageAuthorUrl: 'https://www.pixiv.net/users/6763792'
pinned: true
tags:
  - Coding
  - Frontend
  - ACGN
---

I just wrapped up a new side project, a light novel review site for Japanese readers and serious enthusiasts. The entire thing, from initialization to deployment, took about 5 hours. Here's how modern tooling and smart architecture decisions made this possible.

[Link to the project](https://ln.plr.moe)

## Why This Site Exists

My friends constantly ask me for anime and light novel recommendations. Without idea of becoming an influencer or chasing SEO rankings, I built a personal reference site. It's written in Japanese for native speakers and foreigners at B2+ level who can handle untranslated works.

> There are quite amount of novels which don't have translated version.
>
> ~If you don't understand Japanese, shame on you.~

The philosophy is simple: honest opinions over popular consensus. I gave [時々ボソッとロシア語でデレる隣のアーリャさん](https://ln.plr.moe/novel/russia-slop) an E+ rating despite its popularity. This isn't about building an audience. It's about expressing my own considering while also having a place to point friends when they ask me for recommendation.

## Tech Stack: Astro + Svelte

**Why Astro?** It's the best SSG framework available. Pure static generation, excellent performance, and the freedom to bring your own UI framework.

**Why Svelte?** I needed state management for the search functionality. Having worked on commercial SvelteKit projects, Svelte was the natural choice. It's also the smallest framework option in Astro's ecosystem.

The entire site is statically generated and hosted on Vercel. No server, no database queries, no runtime costs.

### JSON as Database

All metadata lives in a single JSON file structured like a relational database:

- Novels have `id` as primary key
- Articles have `id` as primary key  
- Tags have `id` as primary key
- Relationships are validated at build time

Content itself is in Markdown for reviews and articles. This separation keeps metadata queryable while keeping writing in a comfortable format.

The build process validates all relationships. If I reference a non-existent novel or tag, the build fails. It's like foreign key constraints, but enforced by TypeScript and the Astro build pipeline.

### Search Without an API

The search feature uses fuse.js for client-side fuzzy search. According to benchmarks, it handles up to 4,000 books smoothly, more than enough for my collection.

The entire search index ships with the static bundle. No API calls, no loading states, instant results.

For sorting Japanese titles, I use `localCompare` with Japanese collation to achieve proper あいうえお順 (aiueo order). It's one of those JavaScript APIs that just works:

```typescript
titles.sort((a, b) => a.localCompare(b, 'ja'))
```

## Design: Literary, Not Technical

My main blog focuses on software development and math. It doesn't even have dark mode. Light novel reviews didn't belong there.

For this site, I wanted a "literary" aesthetic:

- **Typography**: Noto Serif throughout (fallback to system serif)
- **Colors**: Light green theme for light mode, brown for dark mode. This is inspired by forest.
- **Feel**: Lively and vivid, not corporate or minimalist

The design language deliberately contrasts with typical tech blogs. Light novels deserve something warmer.

## The Cursor Experience

I used Cursor's latest "plan mode" to bootstrap the project. It generated an almost-working version in minutes: routing, components, basic styling all functional.

The catch? The colors were absolutely diabolical, unusable. I ended up rewriting all the color systems and doing extensive refactoring for component reuse.

![AI generated code's color](https://imagedelivery.net/6gszw1iux5BH0bnwjXECTQ/a1dbed3f-2253-48ee-dd72-79c3d2c99800/public)

> The articles are also AI generated btw. I removed them after test.

But here's the thing. Even with all that rework, going from idea to deployed site took only 5 hours. The AI handled the boilerplate, the architecture setup, and the routing logic. I focused on the parts that mattered: design refinement, data modeling, and content structure.

**The lesson**: For experienced developers, AI tools aren't about writing code you couldn't write. They're about skipping past the boring parts so you can focus on the interesting decisions.

[AI Prompt](https://gist.github.com/haruki-nikaidou/1654776c77b7cd5698924080d070cd53)

## Open Source: CC0

The entire site is open source under CC0, complete public domain dedication. Not MIT, not Apache, CC0.

Why? If someone copies my reviews, that just makes the opinions more distributed. Ideas want to be free. The code especially so.

The implicit message: "This is simple. You can build this too."

## Closing Thoughts

Building this type of site is straightforward for experienced developers working with modern tools. The stack is:

- **Astro** for static generation
- **Svelte** for interactive components
- **SCSS** for styling  
- **fuse.js** for search
- **Markdown** for content
- **JSON** for metadata
- **Vercel** for hosting

Total complexity: Low. 

Total value: High, for me and my friends who want recommendations.

No analytics. No tracking. No SEO games. Just honest reviews of light novels, searchable in Japanese, hosted statically, built in an afternoon.
