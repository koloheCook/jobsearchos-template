# Start here

**Date:** 2026-10-21
**Model, effort:** Claude Opus 5.5, default effort

New to AI tools like Claude or Codex? This page is for you. You will not write any code. You will copy a few messages into an AI assistant, answer its questions, and it does the setup.

## What jobSearchOS does

Every morning it checks the job boards of companies you choose, saves any new posting that matches the jobs you want, and scores each one against what matters to you (pay, location, the kind of work). You get a short list: **PURSUE**, **EXPLORE** or **PASS**, with the reason. It never applies for you and never sends anything. Your job data stays on your own computer.

## What you need

- **A Mac.** Linux should work too. Windows is untested.
- **A paid Claude plan** (Pro or higher), so you can use **Claude Code**, the part of Claude that can work with files on your computer. Get the Claude desktop app from claude.ai/download and open its **Code** tab. If you use Codex instead, that works for setup too (see "Using Codex" below).
- **About 30 minutes** for setup. Your assistant will check for and help you install the three free tools this needs (Node.js, git and jq). You do not need to know what they are.

## How working with an AI assistant goes

- **You type plain sentences.** No special commands needed. "What did you just do?" and "Explain that like I'm new to this" are good questions.
- **It asks permission before it runs anything** on your computer. Read what it wants to do, and allow it if it matches what you asked. If you are unsure, ask it "what will this do?" before allowing.
- **Words that start with a slash**, like `/jd-intake`, are shortcuts for a saved set of instructions. You can type them, or just say "run jd-intake".
- **If something fails**, paste the error back and say "this failed, what does it mean and what should I do?"
- **It works inside one folder.** Before step 1, pick where the folder should live (your Documents folder is fine) and open Claude Code there.

## Setup, one message at a time

Copy each message into Claude Code, send it, and answer its questions. Wait for each step to finish before the next.

**1. Install**

```
I'm new to this. Please set up jobSearchOS for me from https://github.com/koloheCook/jobsearchos-template in a new folder called jobsearchos, and work inside that folder from now on.
First check whether Node.js, git and jq are installed on my computer. For anything missing, explain in one sentence what it is and walk me through installing it.
Then run the project's setup and self-tests from its README (the Quickstart and Setup sections). Tell me in plain words whether everything passed. Don't change any of the project's files.
```

**2. Choose the companies to watch.** It will ask you which companies and which job titles.

```
Help me choose which job boards jobSearchOS watches. Read board-watch/README.md first.
Ask me which companies I'm interested in and which job titles I want (and any titles to skip). For each company, find out whether its job board can be watched automatically. Tell me plainly which ones can't, so I know to save those jobs by hand.
Then update board-watch/boards.json, show me what you changed in plain words, and do a test run.
```

**3. Teach it what a good job looks like for you.** It will ask about pay, location, the kind of work you want, and deal-breakers. This takes the longest; take your time.

```
Walk me through filling in my job-scoring rubric in the rubric folder. Ask me one simple question at a time, in plain words, and tell me how many questions are left. Never guess an answer for me; if I'm unsure, give me two or three example answers to pick from. Also ask me where my resume is, so it can check my experience against each job.
When we're done, save my answers, mark the rubric as calibrated with today's date, and give me a short summary.
```

Until this step is done, every job scores EXPLORE at most, so a half-finished setup can never tell you to go after a job.

**4. Try it.**

```
Run the job-board check, save any new postings, then score them with jd-intake. Show me each job with its score and one sentence on why. Explain anything I might not understand.
```

The first check only learns what's already posted, so it usually finds nothing new. That's expected. Tomorrow's check shows only new postings.

**5. Make it run every morning.**

```
Set up a scheduled task that runs every morning at a time I choose (ask me): check the job boards, save new postings, score them with jd-intake, and give me a short summary. Never apply to anything.
```

## Using it day to day

- **Each morning:** read the summary. For a PURSUE, open its assessment, decide, and apply yourself.
- **Found a job somewhere else?** Save it with the Chrome extension (ask your assistant to set it up), or drop the PDF into the `landing` folder, then say "run jd-intake".
- **Got a call booked?** Say "run meeting-brief" and give it 2 or 3 goals for the call. After the call, say "run debrief" the same day. These are **beta**: built but not yet tested on real calls.

## Using Codex

The setup messages above work in Codex too. Codex reads its rules from `AGENTS.md` and its skills from `.agents/skills/`. Instead of a slash shortcut, say "use the jd-intake skill".

## Words you might see

| Word | Meaning |
|---|---|
| repo, repository | The project's folder of files, kept on GitHub |
| clone | Download a copy of the repo to your computer |
| terminal, command | A text window for typing instructions to your computer; your assistant uses it for you |
| skill | A saved set of instructions, like jd-intake |
| rubric | Your written rules for what makes a job a good fit |
| verdict | The score result: PURSUE, EXPLORE or PASS |
| board-watch | The part that checks job boards every morning |

The full reference, for when you're curious, is in [README.md](README.md).
