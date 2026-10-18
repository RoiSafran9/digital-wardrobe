# Digital Wardrobe — Multi-User Architecture, Research & Implementation

We are moving Digital Wardrobe into the next major development phase: **Multi-User Accounts, Authentication, Data Persistence, and User Isolation**.

GitHub repository: `RoiSafran9/digital-wardrobe`

I want you to act as a **Senior Software Architect and Senior Full-Stack Engineer**.

Your responsibility is to research the recommended architecture, understand our existing implementation, produce a solid technical plan, and then begin implementing it incrementally.

## 1. Project Context

Digital Wardrobe is an iPhone application that allows users to photograph their actual clothes and create a digital wardrobe.

The app currently includes:

- An Expo / React Native mobile application.
- A Python FastAPI backend.
- An AI image-processing pipeline using Gemini.
- AI-generated catalog images.
- Optional back-side garment generation.
- Optional AI-generated 360-degree garment views.
- Local filesystem-based data persistence.
- Local network communication between the iPhone and backend.

**The current application is primarily designed around a single user and a locally running backend.**

Our goal is to transform it into a secure, cloud-backed application supporting multiple independent users.

We want to **preserve and reuse the existing application and AI pipeline wherever practical**, not rebuild everything.

Before making changes, inspect the latest repository structure, code, branches, pull requests, tests, and documentation.

Read `PRODUCT.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, and the relevant files in `docs/`.

Some older planning documents may describe functionality that has since changed. Treat the current implementation and most recent approved decisions as important evidence, identify discrepancies, and document them rather than silently assuming everything is current.

## 2. Proposed Architecture

My preferred architecture is:

**Mobile App**
- Expo / React Native.
- User authentication and session management.
- User-specific wardrobe, account information, and future AI credit balance.

**Supabase**
- Authentication.
- PostgreSQL database.
- Private image storage.
- Row Level Security.
- User account and wardrobe ownership.

**Python Backend**
- Retain our existing FastAPI application.
- Authenticate and authorize incoming requests.
- Execute the existing AI image-generation pipeline.
- Manage generation jobs and their results.
- Persist user-owned results securely.

**Gemini**
- Continue handling the AI image-generation and analysis operations.

This is my preferred direction, not an instruction to avoid evaluating alternatives.

## 3. Research Before Implementation

Before writing implementation code, perform a short, focused technical research task.

Use current official documentation wherever possible.

Research the following:

1. **Supabase Auth with Expo / React Native**
   - Recommended authentication flow.
   - Email OTP versus magic links.
   - Secure session persistence.
   - Token refresh and sign-out.

2. **Supabase with FastAPI**
   - Securely validating Supabase-issued user access tokens.
   - Associating every backend request with an authenticated user.
   - Preventing users from impersonating other users.
   - Service-role credentials and safe server-side usage.

3. **User Data Isolation**
   - Recommended PostgreSQL schema for multi-user applications.
   - Row Level Security policies.
   - Private Supabase Storage buckets and object access policies.
   - Secure access to original and AI-generated clothing images.

4. **Background AI Processing**
   - Recommended approach for long-running generation jobs.
   - How to associate each generation with a specific user.
   - Job status, retries, failures, and idempotency.
   - How to ensure jobs can finish even if the iPhone disconnects.
   - Whether our current FastAPI background-task approach is sufficient for a hosted application.

5. **Alternative Approaches**
   - Briefly compare Supabase with one reasonable alternative, such as Firebase.
   - Focus on suitability for our existing Expo + FastAPI + Python AI stack.
   - Recommend the simplest maintainable solution for a small team.

Keep the research concise and practical. Include links to the main official sources and explain which findings affect our architectural decisions.

Do not overengineer the system.

## 4. Proposed User Data Model

Evaluate a database model based on these entities:

**Profiles**
- User ID.
- Email/account relationship.
- Creation date.
- Account status.

**Wardrobe Items**
- Unique item ID.
- Owner user ID.
- Category and other garment metadata.
- Original photo reference.
- Generated catalog image reference.
- Creation and update timestamps.
- Deletion/recovery status where applicable.

**Generation Jobs**
- Unique job ID.
- Owner user ID.
- Related item, if applicable.
- Operation type: garment, back image, or 360.
- Processing status.
- Error information.
- Relevant timestamps and idempotency information.

**AI Credit Wallet — Future Integration**
- Each user will have one unified AI Credits balance.
- Every billable AI creation action will consume credits.
- We will eventually maintain an auditable credit transaction history.

**Important:** The credit system is a confirmed product direction, but we are not implementing payments or full credit billing in this development phase.

Design the data model so that credit management can be added cleanly in a later phase.

Use appropriate database relationships, indexes, constraints, and authorization rules. Do not automatically create unnecessary tables.

## 5. User Experience Requirements

The user should eventually be able to:

1. Open Digital Wardrobe.
2. Sign up or log in using their email.
3. Stay logged in across app restarts.
4. Access their own private wardrobe.
5. Upload clothing images.
6. Generate catalog images using our existing AI pipeline.
7. Save and view their items across devices.
8. Access their optional back images and 360 views.
9. Edit or delete their items.
10. Sign out securely.

Different users must never be able to access each other's wardrobe items, images, or generation jobs.

The app's user-facing interface must remain in English.

## 6. Security and Data Integrity

Security is especially important because we are moving from a trusted local prototype to a multi-user application.

Requirements:

- Every user-owned database record must have clear ownership.
- Use Row Level Security where appropriate.
- Never trust a client-supplied user ID for authorization.
- Keep original and generated photos private.
- Do not expose permanent public image URLs.
- Never ship service-role keys or AI provider credentials in the mobile application.
- Authenticate and authorize every sensitive backend operation.
- Prevent cross-user access to generation jobs and image endpoints.
- Avoid duplicate records and duplicate AI operations caused by retries.
- Handle partial upload failures and orphaned files.
- Preserve existing data safely during migration.
- Support local development without using production user data or credentials.

Implement tests proving that two different accounts cannot access each other's data.

## 7. Preserve Our Existing Work

Do not rebuild the garment-generation pipeline unless there is a strong technical reason.

Reuse the current:

- Gemini provider integration.
- Detection and metadata extraction.
- Catalog-image generation.
- Background removal and quality checks.
- Optional back-image pipeline.
- 360-generation pipeline.
- Mobile UI components and existing screens.

Identify the smallest changes necessary to make these components work with authenticated user data.

Also propose how to migrate existing local wardrobe data to the new architecture without losing files or corrupting item relationships.

## 8. Implementation Plan

After researching and examining the repository, create a detailed but pragmatic implementation plan.

Break the work into milestones:

**Milestone 1 — Authentication Foundation**
- Configure Supabase.
- Implement email authentication.
- Securely persist sessions.
- Add authenticated navigation.

**Milestone 2 — User Data and Private Storage**
- Create the necessary database schema.
- Implement Row Level Security.
- Introduce user-owned wardrobe items.
- Configure secure image storage.
- Test account isolation.

**Milestone 3 — Backend Integration**
- Connect the existing FastAPI backend to authenticated users.
- Replace or adapt local-only persistence.
- Connect AI jobs to user accounts.
- Store and retrieve generated images securely.
- Preserve existing AI processing behavior.

**Milestone 4 — End-to-End Multi-User Flow**
- Test two independent users.
- Verify item creation, viewing, editing, and deletion.
- Verify private image access.
- Test generation failures and retries.
- Verify persistence across devices and app restarts.

**Milestone 5 — Credit System Readiness**
- Ensure the architecture supports future per-user AI credit balances and billing.
- Document the integration points.
- Do not implement purchasing or paid billing yet.

For every milestone, specify:
- What will be implemented.
- Expected files and components affected.
- Important technical decisions.
- Dependencies.
- Main security risks.
- Tests and acceptance criteria.

## 9. Start Implementing

This task is not research-only.

After the research and implementation plan:

1. Present your recommended architecture and explain any significant tradeoffs.
2. Record the research findings, technical decisions, and milestone plan in the repository documentation.
3. Begin implementing **Milestone 1** in a focused, reviewable feature branch based on the latest `main`.
4. Add the necessary tests and configuration examples.
5. Run relevant tests, linting, and type checks.
6. Commit your changes and open a Pull Request to `main`.

Use a branch such as `feat/multiuser-auth-foundation`.

Do not commit directly to `main` or merge your own Pull Request.

Before editing, inspect the working tree and active branches to avoid overwriting existing work.

Do not modify or merge unrelated pending Pull Requests, including the AI Credits documentation PR.

If external setup is required — for example, creating a Supabase project or configuring credentials — clearly distinguish what you can implement yourself from the specific actions I must perform.

Never invent credentials, add real secrets to Git, or falsely report that external services have been configured.

Do not attempt to implement every milestone in one enormous change.

## 10. Expected First Deliverables

I expect:

1. **A short research summary** with links to authoritative technical sources.
2. **Your recommended architecture** for the multi-user application.
3. **A database and storage model** showing user ownership.
4. **A milestone-based implementation plan**.
5. **The first completed, tested implementation milestone**, submitted as a Pull Request.
6. **A clear explanation of what I need to configure manually**, if anything.

Prioritize simplicity, security, and maintainability.

We are building a real product, but we are still a small team. Avoid unnecessary infrastructure and preserve the fast development workflow we already have.
