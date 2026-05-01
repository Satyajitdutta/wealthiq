# Technical Design Document (TDD): Artha-IQ

## 1. Product Overview
**Artha-IQ (WealthIQ)** is an AI-powered personal financial intelligence platform designed for **all salaried professionals across India**, including GCC & MNC Employees, BFSI Professionals, Senior Management, and NRIs/Returning Professionals. 

It provides users with:
- **Tax Optimizer:** Comparison between Old vs. New Tax Regimes.
- **Goals Planner:** Inflation-adjusted SIP calculators.
- **Smart Import:** AI-powered extraction of financial data from salary slips, Form 16, and bank statements without manual entry.
- **GOT AI Advisor:** A Graph of Thoughts AI engine delivering a multi-layered financial strategy (investments, debt, tax, estate).
- **Analytics & Dashboards:** Identifies subscription waste (Money Leaks), benchmarking (Cost of Living Index across 20+ metros), and more.

## 2. Architecture & Tech Stack

### High-Level Architecture
The application follows a monolithic client-server architecture deployed as a containerized service.
- **Frontend:** Vanilla HTML/CSS/JS (SPA/MPA mix featuring interactive dashboards).
- **Backend:** Node.js with Express.
- **Data Persistence:** Supabase (PostgreSQL).
- **AI/ML Services:** Backend intelligence is powered by Google Gemini (2.5 Flash). *(Note: Marketing materials attribute AI capabilities as "Powered by Claude AI", but implementation relies on the Gemini API).*

## 3. Architecture Chart

```mermaid
graph TD
    subgraph Client_Layer ["Client Layer (Vanilla JS / Tailwind)"]
        UI["Dashboard & Input UI"]
        PDF_U["Document Uploader (PDF/Img)"]
        AUTH_UI["OTP Auth Interface"]
    end

    subgraph Backend_Layer ["Backend Layer (Node.js/Express on Railway)"]
        API_G["API Gateway / Routing"]
        AUTH_M["Auth Manager (JWT/SHA-256)"]
        DOC_E["Doc-Extract Logic"]
        GOT_E["GOT Reasoning Engine"]
        PAY_M["Payment Module (Pay-per-use)"]
    end

    subgraph Intelligence_Layer ["Intelligence Layer (Google Gemini 2.5 Flash)"]
        GEM_EXT["Extraction Prompt (JSON-strict)"]
        GEM_GOT["Multi-Node Reasoning (GOT)"]
    end

    subgraph Persistence_Layer ["Data Layer (Supabase/PostgreSQL)"]
        DB_USERS[("wealthiq_users Table")]
        DB_PROF[("wealthiq_profiles Table (JSONB)")]
    end

    %% User Flow: Authentication
    AUTH_UI -->|Email/OTP| AUTH_M
    AUTH_M <-->|Verify/Match| DB_USERS
    AUTH_M -->|Return Bearer Token| UI

    %% User Flow: Document Processing
    PDF_U -->|Buffer (up to 50mb)| DOC_E
    DOC_E -->|Raw Text + Prompt| GEM_EXT
    GEM_EXT -->|Structured JSON Data| DOC_E
    DOC_E -->|Mapping & Enrichment| DB_PROF

    %% User Flow: GOT Analysis
    UI -->|Trigger GOT Advice| GOT_E
    DB_PROF -->|Fetch User Profile| GOT_E
    GOT_E -->|Reasoning Context| GEM_GOT
    
    subgraph GOT_Process ["Internal GOT Reasoning Nodes"]
        direction TB
        N1[Tax Optimization]
        N2[Goal Adequacy]
        N3[Insurance Gaps]
        N4[Spending Patterns]
    end
    
    GEM_GOT --- GOT_Process
    GEM_GOT -->|Comprehensive Strategy JSON| GOT_E
    GOT_E -->|Update Profile Cache| DB_PROF
    GOT_E -->|Render Insights| UI

    %% Analytics & Benchmarks
    UI -->|Request Benchmarks| API_G
    API_G -->|City/Metro Metadata| UI
```

## 4. Core Modules & Data Flow

### 4.1. Authentication (OTP / Token Based)
- Logic resides in backend endpoints like `api/_auth.js`, utilizing JWT-style tokens signed with an `AUTH_SECRET` (SHA-256 HMAC) for validation.
- Stateless auth flow: User receives OTP, inputs it, and receives a Bearer token.

### 4.2. Data Persistence (Supabase)
- **`wealthiq_users` Table:** Stores base user records.
- **`wealthiq_profiles` Table:** Stores extensive JSON blobs containing the user's financial profile.

### 4.3. Document Intelligence Extractor (`api/doc-extract.js`)
- Intake user bank statements, Form 16s, or salary slips and extract structured transaction data via Gemini Flash 2.5 `application/json` enforcement.
- Automates correlation of city-level utilities for 20+ metros.

### 4.4. GOT Financial Reasoning Engine (`api/got-advice.js`)
- Formulates analysis across Tax Optimization, Goals Adequacy, Insurance Gaps, and Spending Behaviour based on Gemini-driven logic branches (GOT).

## 5. Security, AI Governance & DPDP Compliance

### 5.1. AI Governance & Prompt Guardrails
- **Document Validation:** The Document Intelligence Extractor (`doc-extract.js`) employs AI-driven guardrails to detect and reject non-financial, dummy, or invalid documents by validating the presence of actual financial data.
- **Deterministic Output:** The AI model is configured with strict constraints (enforced JSON schemas) to prevent prompt injection and ensure predictable, safe parsing of sensitive user data.

### 5.2. Digital Personal Data Protection (DPDP) Readiness
- **Data Minimization & PII Handling:** Only essential financial data points are extracted. Any extracted PII or account numbers are scoped strictly for the user's isolated profile.
- **Storage & Retention:** All data is securely persisted in Supabase with row-level security (RLS). Future iterations will further enforce automatic data purging and explicit user consent mechanisms in alignment with India's DPDP Act.
- **Secure Transmission:** Token-based (Bearer) authentication utilizing SHA-256 HMAC tokens ensures all data transmission is authenticated and secure.

## 6. Deployment Framework
- **Hosting:** Railway (Containerized Node.js Environment).
- **Routing:** `/api/...` proxies dynamic JS files, while static pages (`/app`, etc.) rewrite to HTML files.
