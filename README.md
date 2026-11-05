<div align="center">

<img src="public/img/anfro-logo.png" alt="Anfro logo" width="160">

# Anfro — AI Math Misconception Diagnosis Assistant

**Upload your solution, and the AI helps you find where it went wrong.**

🏆 **Grand Prize (1st Place)** · 2026 AX-Edu Hackathon · Team 물개 (Mulgae)

[Live Service](https://math-misconception.vercel.app/) · [Presentation (KR)](Anfro%20발표_물개.pdf) · [Deployment Guide (KR)](배포안내.md)

</div>

---

> **About this repository**
> This project was built and submitted to the **2026 AX-Edu Hackathon**, where it won the **Grand Prize (1st place)**.
> The hackathon was held in Korean, and the service targets Korean middle school students, so **the app UI, source comments, data files, and documents (presentation, reports, deployment guide) are all in Korean.** This README is an English overview.

## Motivation

While writing a *minimum achievement level remedial plan* for 9th-grade (middle school 3rd-year) students during our student-teaching practicum, we saw firsthand how students' learning gaps in math pile up.

1. Math is a subject with an especially **strong hierarchy** between concepts.
2. As a result, **gaps in earlier concepts heavily affect** later learning.
3. Yet it is practically very hard for a teacher to identify each individual student's gaps.

→ Students need **a tutor that helps them find and fill their own gaps**, and teachers need **a dashboard that shows each student's gaps at a glance**.

## Key Features

### 🧑‍🎓 For Students — AI Tutor
| Step | Description |
|---|---|
| ① Upload a solution | Upload a photo of a handwritten solution. The AI transcribes it, and the student reviews and corrects the transcription. |
| ② Error check & misconception diagnosis | Diagnoses the stage where the error occurred and the underlying concept using **Newman's 5-stage error analysis model** (Reading, Comprehension, Transformation, Process Skills, Encoding). |
| ③ Explore & fill prerequisite gaps | Instead of giving the answer, the tutor asks **guiding questions**. When the student gets stuck, it **traces prerequisite concepts backward** and revisits more fundamental concepts first. |

If the AI's confidence falls below a threshold, it withholds judgment and **asks the teacher to review**.

### 👩‍🏫 For Teachers — Dashboard
- **Learning history**: each student's submissions, error stages, and the AI's reasoning
- **Misconception map**: visualizes a student's misconceptions linked by prerequisite relationships
- **Learning report**: a total score weighted by item discrimination, plus a **learning-gap diagnosis against the minimum achievement level** (teacher-only)
- **Class dashboards**: assign and publish problems per class, handle review requests

## Screenshots

| Grading result & guiding questions | Misconception map (teacher view) |
|---|---|
| <img src="Claude%20outputs/4_채점결과_유도질문.png" width="420"> | <img src="Claude%20outputs/5_교사_오개념지도.png" width="420"> |

| Learning report | Solving a problem |
|---|---|
| <img src="Claude%20outputs/6_학습리포트.png" width="420"> | <img src="Claude%20outputs/3_문제풀이.png" width="420"> |

## Theoretical Background

**Newman's Error Analysis Model** — e.g., *"Find the sum of the roots of a quadratic equation."*

| Stage | Example error |
|---|---|
| 1. Reading | Cannot read the symbols or numbers |
| 2. Comprehension | Does not understand what the expression means |
| 3. Transformation | Understands the problem but cannot factor the expression |
| 4. Process Skills | Makes a calculation mistake |
| 5. Encoding | Finds the roots but never reports their sum |

**Item Response Theory (2PL-IRT)** — Estimates item difficulty and discrimination from correct/incorrect response data. We fit a 2PL model separately for each of the 9 grades (elementary 1 – middle 3) ([`2PL_IRT/2PL_IRT.ipynb`](2PL_IRT/2PL_IRT.ipynb)), and use the estimated discrimination parameters as weights for the total score in learning reports.

$$\mathrm{logit}\,P(x_{ij}=1 \mid \theta_i) = A_j\,\theta_i - d_j,\qquad \theta_i \sim N(0,1)$$

## Tech Stack & Use of AI

| Area | Tools |
|---|---|
| Frontend | Vanilla JS · HTML/CSS (`src/client` is built into `public/index.html`) |
| Server | Vercel Functions (Node.js, Seoul region) |
| Database & files | Supabase (Postgres · Storage, RLS enabled on all tables) |
| AI | OpenAI API — solution image recognition, error diagnosis, guiding-question tutor, report evaluation |
| Data analysis | Python — 2PL-IRT item parameter estimation |
| Development agent | Claude Code as the primary development tool |
| Safety | A jailbreak-response manual built with ChatGPT ([report, KR](탈옥시도_방어분석_보고서.pdf)) |

## Data

- AI Hub **"Math Learner Competency Measurement Data"** (수학분야 학습자 역량 측정 데이터) — response data for 2PL-IRT item parameter estimation
- AI Hub **"Math Problem-Solving Process Data"** (수학 교과 문제 풀이과정 데이터) — item and concept information
- `data/` — CSVs of the concept list, prerequisite relationships between concepts, and item information

## Project Structure

```
├── api/rpc.js            # Entry point for browser → server requests
├── src/server/           # Server logic source (auth, LLM, tutor, analysis, reports, ...)
├── src/client/           # UI source (student & teacher screens, styles)
├── lib/                  # Runtime, DB & Storage adapters (server-async.js is auto-generated)
├── db/schema.sql         # Database schema
├── data/                 # Concept, prerequisite, and item CSVs
├── 2PL_IRT/              # 2PL-IRT estimation notebook and results
├── tools/                # Build, test, and admin scripts
└── test/                 # Test scenarios and mock services
```

See [배포안내.md](배포안내.md) (Korean) for full run, deploy, and admin commands.

```bash
npm install
npm run gen   # build server & client code
npm test      # mock services, PGlite, and concurrency tests
```

## Team 물개 (Mulgae)

박근형 · 양지운 · 차혁찬 · 최연서
