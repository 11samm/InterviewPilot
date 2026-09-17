# InterviewPilot Resume Upgrade Roadmap

## Goal

Turn InterviewPilot from a strong hackathon-style AI application into a
polished project that demonstrates:

-   Real-time AI systems
-   Speech and computer-vision analytics
-   AI evaluation and regression testing
-   Backend/API engineering
-   Database design and persistence
-   Production deployment
-   Testing and CI/CD

The priority is **depth over adding more features**.

------------------------------------------------------------------------

## Recommended Order

### 1. Replace the Stubbed SpeechService

**Priority: Highest**

The current SpeechService contains hardcoded/stubbed values. Replace it
with real deterministic speech analysis.

#### Implement

-   Words per minute (WPM)
-   Filler-word detection
    -   um
    -   uh
    -   like
    -   basically
    -   you know
    -   etc.
-   Answer duration
-   Pause detection, where feasible
-   Repetition detection
-   Response latency
-   Optional sentence-length / verbosity statistics

#### Architecture

``` text
Candidate
   |
   +--> MediaPipe
   |      +--> Eye contact
   |      +--> Head pose
   |
   +--> Speech Analyzer
   |      +--> WPM
   |      +--> Fillers
   |      +--> Pauses
   |      +--> Response timing
   |
   +--> Gemini
          +--> Content quality
          +--> Rubric scoring

                |
                v
          Coaching Engine
```

#### Why this comes first

Do not leave obviously fake or hardcoded analytics in a project being
presented to recruiters. This also gives InterviewPilot more engineering
depth beyond simply calling an LLM API.

------------------------------------------------------------------------

### 2. Fix Grading for Every Interview Question

**Priority: Very High / Quick Win**

The application currently individually analyzes only the first two
questions even though an interview can contain more.

#### Implement

Every question should produce a structured result:

``` text
Question
   |
Candidate Response
   |
Rubric
   |
Score
   |
Supporting Evidence
   |
Feedback
```

Then calculate the overall interview score from all individual question
results.

#### Why this comes second

This should be relatively quick and removes another known limitation
before building larger systems around the grading pipeline.

------------------------------------------------------------------------

### 3. Build an AI Evaluation Framework

**Priority: Very High**

This is the most important upgrade for making InterviewPilot relevant to
AI engineering, AI evaluation, and AI-training-oriented positions.

#### Suggested structure

``` text
/evals
    dataset.json
    run_eval.py
    metrics.py
    /results
```

#### Create an evaluation dataset

Start with approximately 50-100 sample interview answers.

Example:

``` text
Question:
"Tell me about a time you disagreed with a teammate."

Answer:
"One time my teammate wanted to use..."

Human Labels:
- Relevance: 4/5
- Specificity: 5/5
- Structure: 4/5
- Communication: 3/5
```

#### Measure

-   Agreement with human labels
-   Mean absolute scoring error
-   Score consistency across repeated runs
-   Structured-output failure rate
-   Model latency
-   Approximate cost per interview
-   Regression between prompt/model versions

Example:

``` text
Prompt A
MAE: 1.12

Prompt B
MAE: 0.71

Prompt C
MAE: 0.64
```

#### Goal

Be able to explain in an interview that you did not simply trust LLM
output---you created a dataset and evaluation pipeline to measure and
improve the system.

------------------------------------------------------------------------

### 4. Add Persistence + Interview History

**Priority: High**

Add a real database so interview data survives refreshes and users can
track improvement.

A simple option is PostgreSQL through Supabase.

#### Suggested tables

``` text
users
interviews
questions
responses
speech_metrics
presence_metrics
scores
feedback
```

#### Add

-   User authentication
-   Saved interview sessions
-   Interview-history page
-   Detailed previous-session view
-   Progress over time

Example:

``` text
Interview Performance

                 Week 1     Week 4
Eye Contact        64%   ->   81%
WPM                182   ->   151
Filler Words        17   ->     6
Overall Score       68   ->    82
```

#### Resume value

This demonstrates:

-   Relational database design
-   Authentication
-   Persistence
-   Backend APIs
-   Analytics
-   Full-stack application architecture

------------------------------------------------------------------------

### 5. Add Resume + Job Description Interview Mode

**Priority: Medium-High**

This should be the main new user-facing feature after the underlying
engineering is improved.

#### User flow

``` text
Resume
   +
Job Description
   |
   v
Structured Extraction
   |
   +--> Skills
   +--> Experience
   +--> Technologies
   +--> Job requirements
   |
   v
Personalized Interview Plan
   |
   +--> Behavioral question
   +--> Project deep dive
   +--> Technical question
   +--> Follow-up questions
```

The interviewer should ask questions based on experiences actually
listed on the candidate's resume and requirements from the target job.

#### Avoid

Do not keep adding unrelated AI features. This feature directly
strengthens the core InterviewPilot product.

------------------------------------------------------------------------

### 6. Deploy InterviewPilot

**Priority: High before applications**

Recruiters should not have to clone the repository to understand the
project.

The README should eventually provide:

``` text
Live Demo | GitHub | Demo Video
```

#### Example deployment

``` text
Frontend
   |
Vercel

Backend
   |
FastAPI deployment

Database
   |
PostgreSQL / Supabase
```

#### Before deploying

-   Remove localhost-only CORS
-   Make environment configuration production-safe
-   Never expose privileged API keys
-   Add error handling for unavailable AI services
-   Verify microphone/camera permissions
-   Test the complete interview flow from a clean browser

------------------------------------------------------------------------

### 7. Add Automated Tests + CI

**Priority: Medium**

Take advantage of the existing separation between planner, coach,
presence, speech, and deep-dive services.

#### Test

-   Speech metric calculations
-   Presence metric calculations
-   API request/response validation
-   Interview scoring aggregation
-   Invalid inputs
-   LLM structured-output parsing
-   Mocked AI API failures

#### GitHub Actions pipeline

``` text
Push / Pull Request
        |
        v
      Lint
        |
        v
    Type Check
        |
        v
Frontend Tests
        |
        v
      Pytest
        |
        v
      Build
```

Add a passing CI badge to the README when finished.

------------------------------------------------------------------------

### 8. Final Repository and Resume Polish

**Priority: Last**

Only polish presentation after the important engineering work is
complete.

#### README

Include:

-   Strong one-sentence project description
-   Screenshot/GIF near the top
-   Live demo
-   Short demo video
-   Architecture diagram
-   Technical features
-   Evaluation results
-   Tech stack
-   Local setup instructions
-   Testing instructions

#### Remove or update

Once fixed, remove outdated known limitations such as:

-   Stubbed SpeechService
-   First-two-question grading limitation
-   No persistence
-   Localhost-only deployment

Do not advertise limitations that no longer exist.

------------------------------------------------------------------------

# Recommended Development Sequence

``` text
1. Real SpeechService
        |
        v
2. Grade Every Question
        |
        v
3. AI Evaluation Framework
        |
        v
4. PostgreSQL + Persistence
        |
        v
5. Resume/JD Interview Mode
        |
        v
6. Production Deployment
        |
        v
7. Tests + GitHub Actions
        |
        v
8. README + Demo + Resume Polish
```

------------------------------------------------------------------------

# If Time Is Limited

## Minimum Upgrade

Complete these before applications if possible:

1.  Real SpeechService
2.  Grade every question
3.  AI evaluation framework
4.  Production deployment

## Strong Target

Add:

5.  PostgreSQL + interview history
6.  Automated tests/CI

## Ideal Version

Finish all of the above plus:

7.  Resume/job-description personalization
8.  Excellent README, architecture diagram, and demo video

------------------------------------------------------------------------

# What Not to Spend Time On

Avoid adding features simply to make the feature list longer.

Examples of low-priority additions:

-   Generic AI chat
-   Cover-letter generation
-   Motivational coaching
-   Excessive UI animations
-   More interview modes without deeper engineering
-   Additional LLM features that are just another prompt/API call

InterviewPilot already has a compelling concept. The goal now is to make
the underlying implementation **measurable, production-ready, and
technically defensible in an interview**.

------------------------------------------------------------------------

# Target Final Architecture

``` text
INTERVIEWPILOT
|
+-- Gemini Live
|     +-- Real-time voice
|     +-- WebSocket streaming
|
+-- Computer Vision
|     +-- MediaPipe / WASM
|     +-- Eye-contact analysis
|     +-- Head-pose analysis
|
+-- Speech Analytics
|     +-- WPM
|     +-- Filler detection
|     +-- Pauses
|     +-- Response timing
|
+-- AI Evaluation
|     +-- Labeled evaluation dataset
|     +-- Automated eval runner
|     +-- Scoring agreement metrics
|     +-- Regression testing
|
+-- FastAPI Backend
|
+-- PostgreSQL
|     +-- Users
|     +-- Interviews
|     +-- Responses
|     +-- Historical metrics
|
+-- Personalized Interview Planning
|     +-- Resume analysis
|     +-- Job-description analysis
|
+-- Testing / CI
|
+-- Production Deployment
```

## End Goal

InterviewPilot should demonstrate **AI systems + real-time audio +
computer vision + evaluation + backend engineering + persistence +
production deployment**, rather than looking like an LLM wrapper with a
polished interface.
