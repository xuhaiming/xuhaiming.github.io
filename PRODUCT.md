# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + TypeScript + vanilla Three.js + GSAP (ScrollTrigger) + Lenis, custom GLSL. No UI framework. Chosen by the owner over React Three Fiber + Next.js and over Three.js WebGPU. Deployed as a static site to GitHub Pages at xuhaiming.github.io.

## Users

Primary: recruiters, hiring managers and interviewers for AI / agent engineering roles. They arrive from a resume or LinkedIn link and decide within tens of seconds whether to arrange an interview.

## Product Purpose

The personal site of Xu Haiming, Staff Software Engineer (Full-Stack & AI Agent Platforms), Singapore. Success: the visitor leaves remembering him as a hybrid of full-stack engineering, AI agents and visual craft, with the site itself as the evidence, and reaches out through LinkedIn.

## Positioning

One engineer who covers backend, production agent systems and WebGL / generative visuals. The site is built by him with the same tools it describes (agents, ComfyUI, Blender, custom shaders).

## Operating Context

A single page with a cinematic scroll. English only. Sections as built: Hero, Range, Work, Path, About, Ask the site, Contact. After the comp round the owner asked for more general copy with less weight on AI agents, so the separate agent-loop section was folded into the Ask demo. Viewed mostly on desktop from a link; must still read on phones and when WebGL fails.

## Capabilities and Constraints

- Never name the owner's current employer or its industry, in copy, metadata, assets or filenames.
- Work done since July 2025 appears only as agent system case studies with no employer and no timeline entry. The career timeline ends at Trustana (June 2025).
- "Ask the agent" is a scripted, front-end-only demo. No live LLM, no backend, no API keys.
- Contact is LinkedIn and GitHub only. No email, no phone number, no resume download.
- A stylised 3D bust generated from the owner's own photo appears in About.
- Visual concept chosen by the owner: "Agent Core", a glowing 3D core sculpture that persists through the whole scroll, with four disciplines orbiting it (frontend, backend, AI agents, visual craft). Dark, WebGL-led, cold light. Brand name on the page: Haiming Pages; the owner's name is not set large.
- Text content lives in real HTML so the page reads without WebGL.
- Generated assets are made locally (ComfyUI: Flux, Qwen Image, Z-Image, Trellis 2, MiniMax H3; Blender 5.0 CLI).

## Brand Commitments

Name: Xu Haiming. Title: Staff Software Engineer · Full-Stack & AI Agent Platforms. Location: Singapore. The previous site's look is discarded entirely; only its facts carry over.

## Evidence on Hand

- Resume: `C:\projects\my-profile\Xu_Haiming_Resume.html` (contains the employer name that must not appear).
- Agent systems, employer unnamed: a company-wide vibe-coding platform where 80+ employees published their own apps in the first month; an agent platform built from zero serving 130+ monthly active users, with evals, tracing, cost and latency work, permissions and guardrails, delivered as a web app and a chat bot; a RAG knowledge base over documentation, refreshed daily and exposed as an MCP server; an agent-assisted documentation workflow with design-file context.
- Trustana (Aug 2023 to Jun 2025), Senior Staff Software Engineer: AI product-enhancement agents using GPT and Gemini, vision models, web search, embeddings and vector search (Milvus, DocumentDB); ComfyUI image pipelines; AWS serverless.
- Shopee (2020 to 2023), Expert Engineer and frontend team lead of seven. Tencent (2017 to 2020). EPAM Systems for Burberry (2016 to 2017). ThoughtWorks for PwC US (2015 to 2016). Earlier roles in the Netherlands, including Philips Healthcare. Fontys University of Applied Sciences, 2010 to 2014.
- Links: linkedin.com/in/xu-haiming-48502869, github.com/xuhaiming.
- Photo for the bust: `assets/haiming_profile.png` in git history (commit f1e6871~1).
- No testimonials, press, or public repositories of the agent systems exist; none may be invented.

## Product Principles

1. The site is the proof: every claim about craft is demonstrated by the page itself.
2. A recruiter gets the who, what and how-to-reach in the first screen; depth is there for those who scroll.
3. Agent work is described in general engineering terms, with real numbers and no employer.
4. Spectacle never blocks reading: content is in HTML and survives a WebGL failure.

## Accessibility & Inclusion

Respect reduced-motion preferences; keep text readable over the 3D scene; provide a simplified scene on phones and low-power devices.
