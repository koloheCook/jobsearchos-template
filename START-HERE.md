# Start here

**Date:** 2026-10-21
**Model, effort:** Claude Opus 5.5, default effort

New to AI tools like Claude or Codex? This page is for you. You will not write any code. You will copy a few messages into an AI assistant, answer its questions, and it does the setup.

## What jobSearchOS does

Every morning it checks the job boards of companies you choose, saves any new posting that matches the jobs you want, and scores each one against what matters to you (pay, location, the kind of work). You get a short list: **PURSUE**, **EXPLORE** or **PASS**, with the reason. It never applies for you and never sends anything. Your job data stays on your own computer.

## What you need

- **A Mac.** Linux should work too. On Windows, see "On Windows (untested)" below before you start.
- **A paid Claude plan** (Pro or higher), so you can use **Claude Code**, the part of Claude that can work with files on your computer. Get the Claude desktop app from claude.ai/download and open its **Code** tab. If you use Codex instead, that works for setup too (see "Using Codex" below).
- **About 30 minutes** for setup, plus four free tools your assistant checks for and helps you install:
  - **Node.js** runs jobSearchOS's own small programs, like the daily job-board check.
  - **git** downloads the project and blocks your job data from ever being uploaded with it.
  - **jq** and **Python** let the safety checks read what the assistant is about to write.

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
First check whether Node.js, git, jq and Python 3 are installed on my computer. For anything missing, explain in one sentence what it is and walk me through installing it.
Then run the project's setup and self-tests from its README (the Quickstart and Setup sections). Tell me in plain words whether everything passed (a few "skipped" tests are normal). Don't change the project's files yet.
```

**2. Choose the companies to watch.** It will ask you which companies and which job titles.

```
Help me choose which job boards jobSearchOS watches. Read board-watch/README.md first.
Ask me which companies I'm interested in and which job titles I want (and any titles to skip). For each company, find out whether its job board can be watched automatically. Tell me plainly which ones can't, so I know to save those jobs by hand.
Then update board-watch/boards.json, show me what you changed in plain words, and do a test run.
```

**3. Teach it what a good job looks like for you, and what you bring.** It will ask about pay, location, the kind of work you want, and deal-breakers, then read your resume. This takes the longest; take your time.

```
Walk me through filling in my job-scoring rubric: rubric/fit-rubric.md, rubric/jd-match-rubric.md and rubric/deal-breakers.md. Ask me one simple question at a time, in plain words, and tell me how many questions are left. Never guess an answer for me; if I'm unsure, give me two or three example answers to pick from.
Then ask me where my resume is. Copy templates/career-facts.md to data/career-facts.md and fill it in from my resume, copying facts and numbers exactly as my resume states them. Show me the result so I can correct anything.
When we're done, mark each rubric file's Status line as calibrated with today's date, and give me a short summary.
Finally, save the rubric changes in git: commit the three rubric files in this folder with a short message. If git asks who I am, set my name and email for this folder only. Don't push anything anywhere. data/career-facts.md stays out of git on purpose.
```

Two things to know. Until this step is done, every job scores EXPLORE at most, so a half-finished setup can never tell you to go after a job. And jd-intake won't run while the rubric has unsaved (uncommitted) changes, so it never scores against a half-edited rubric; that's why the last line commits them. Your resume facts live in `data/`, which never goes into git.

**4. Score your first job.** Pick one real job posting you're curious about and copy its link.

```
Score this job for me with jobSearchOS: [paste the job link]
Capture it with node capture/cli/capture-url.mjs --url and the link. If that site can't be captured, tell me in plain words and help me save the page as a PDF into the landing folder instead.
Then run jd-intake on it, then run node scripts/daily-report.mjs. Show me the verdict and the reasons in plain words, and tell me what I should do next with this job.
```

You'll see one of three verdicts. **PURSUE** means it fits; read the reasons, confirm it in the assessment if you agree, and apply yourself. **EXPLORE** means it might fit; read why and decide. **PASS** means it doesn't fit your rubric.

Also run the job-board check once (`node board-watch/board-watch.mjs`, or ask your assistant). The first check only saves what's already posted as a starting point, so it finds nothing new today. That's expected: from tomorrow on it shows only postings that are new.

**5. Make it run every morning.**

```
Set up a scheduled task that runs every morning at a time I choose (ask me): run node board-watch/board-watch.mjs, then node capture/cli/capture-url.mjs --file board-watch/out/new-urls.txt, then score anything new with jd-intake, then run node scripts/daily-report.mjs and give me a short summary of the report. Never apply to anything.
```

The task runs only while your computer is awake and the Claude app is open. Each run writes a report you can open any time: `reports/` followed by the date, for example `reports/2026-10-21.md`. It lists new postings, what was scored, what is waiting on you, and what to do next. Most mornings have nothing new; the report says so.

## Using it day to day

- **Each morning:** open today's report in the `reports` folder (or read the summary your assistant gives you). For a PURSUE, open its assessment, decide, and apply yourself.
- **Found a job somewhere else?** Save it with the Chrome extension (ask your assistant to set it up), or drop the PDF into the `landing` folder, then say "run jd-intake".
- **Changed your rubric, playbook or scripts later?** Ask your assistant to commit the change. jd-intake (and the morning run) won't start while those folders have uncommitted changes, and it will tell you so.
- **Got a call booked?** Say "run meeting-brief" and give it 2 or 3 goals for the call. After the call, say "run debrief" the same day. These are **beta**: built but not yet tested on real calls.

## On Windows (untested)

Nobody has tried jobSearchOS on Windows yet, so expect a bump or two. Do these **before** setup step 1:

1. **Turn on Developer Mode:** Settings > System > For developers > Developer Mode. jobSearchOS uses shortcut links between folders, and Windows only creates them with this on. Without it, the jd-intake and other commands won't load.
2. **Install the tools.** Open PowerShell and run these, one line at a time (or paste them to your assistant and ask it to run them):

```
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install jqlang.jq
winget install Python.Python.3.12
```

Git for Windows includes **Git Bash**, which the safety checks need. Restart the Claude app after installing so it finds the new tools.

3. **In setup step 1, add this line to the message:** "This is Windows: clone with `git clone -c core.symlinks=true`, and check that the folders in `.claude/skills` are links, not small text files."

**If that doesn't work, use WSL** (Windows Subsystem for Linux, Microsoft's built-in way to run Linux inside Windows). Inside WSL, jobSearchOS behaves as it does on a Mac. Ask your assistant: "Help me install WSL and set up jobSearchOS inside it."

## Already track jobs in Notion? (optional)

You don't need Notion; the daily report is the default way to see your pipeline. If you already keep a job tracker in Notion, jobSearchOS can read it (never write to it). That adds two things: roles you marked "Not Interested" stop showing up as new, and the weekly overdue check can see the next-step dates you keep there. Your tracker probably uses different column names than the script expects, so ask your assistant to adapt it:

```
I keep my job tracker in Notion. Help me connect it to jobSearchOS read-only, following the "Connect Notion" section of README.md.
Ask me what my tracker's columns are called and what status values I use, then adapt scripts/refresh-tracker-mirror.mjs to match my tracker instead of asking me to rename anything in Notion. If my Company column is plain text rather than a link to a Companies database, handle that.
Tell me the exact file and variable names for my Notion key and IDs, and where to find each ID in Notion. I'll type the key into .env myself; never ask me for it.
When the script works, commit the script change in this folder (don't push), so jd-intake isn't blocked by it.
```

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
