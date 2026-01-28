# Research Assistant Premium - Product Requirements Document

## Overview
Transform the Research Assistant extension into a freemium product with premium features and Stripe-based monetization.

---

## Phase 1: Foundation (Start Here)

| #  | Task                                       | Effort  |
|----|-------------------------------------------|---------|
| 1  | Set up Stripe integration for payments     | 4-6 hrs |
| 2  | Build free tier with managed API key       | 4-6 hrs |
| 5  | Update backend for current provider models | 2-3 hrs |
| 14 | Add usage analytics and monitoring         | 3-4 hrs |

---

## Phase 2: Premium Infrastructure

| #  | Task                                 | Blocked By | Effort  |
|----|-------------------------------------|------------|---------|
| 9  | Build premium feature gate system    | #1, #2     | 2-3 hrs |
| 10 | Create onboarding flow for new users | #2         | 3-4 hrs |

---

## Phase 3: Premium Features

| #  | Task                             | Blocked By | Effort  |
|----|----------------------------------|------------|---------|
| 3  | Implement Notion integration     | #9         | 4-6 hrs |
| 4  | Implement Obsidian integration   | #9         | 3-4 hrs |
| 6  | Add highlight-to-analyze feature | #9         | 2-3 hrs |
| 7  | Add PDF analysis support         | #9         | 4-5 hrs |
| 8  | Add citation generator           | #9         | 2-3 hrs |

---

## Phase 4: Growth

| #  | Task                                | Blocked By     | Effort   |
|----|-------------------------------------|----------------|----------|
| 11 | Update Chrome Web Store listing     | #3, #4, #6, #7 | 3-4 hrs  |
| 12 | Create landing page for extension   | #11            | 4-6 hrs  |
| 13 | Add cross-device sync (Pro feature) | #1, #2         | 8-10 hrs |

---

## Dependency Graph

```
START
  │
  ├──► [1] Stripe ─────────────┐
  │                            │
  ├──► [2] Free Tier ──────────┼──► [9] Feature Gates ──┬──► [3] Notion
  │         │                  │                        ├──► [4] Obsidian
  │         └──► [10] Onboard  │                        ├──► [6] Highlight
  │                            │                        ├──► [7] PDF
  ├──► [5] Update Models       │                        └──► [8] Citations
  │                            │                                  │
  ├──► [14] Analytics          │                                  ▼
  │                            │                        [11] Store Listing
  │                            │                                  │
  │                            └──► [13] Sync                     ▼
  │                                                     [12] Landing Page
END
```

---

## Recommended Build Order

### Week 1: Get Revenue Flowing
1. #1 Stripe integration
2. #2 Free tier with managed API
3. #9 Premium feature gates
4. #5 Update provider models

### Week 2: Core Premium Features
5. #3 Notion integration
6. #4 Obsidian integration
7. #6 Highlight-to-analyze

### Week 3: Polish & Launch
8. #10 Onboarding flow
9. #7 PDF analysis
10. #8 Citation generator
11. #11 Update store listing

### Week 4+: Growth
12. #12 Landing page
13. #13 Cross-device sync
14. #14 Analytics

---

## Premium Feature Summary

| Feature                           | Tier | Priority    |
|-----------------------------------|------|-------------|
| 10 analyses/month (managed API)   | Free | Critical    |
| Unlimited analyses                | Pro  | Critical    |
| Notion export                     | Pro  | High        |
| Obsidian export                   | Pro  | High        |
| Highlight-to-analyze              | Pro  | High        |
| PDF analysis                      | Pro  | Medium      |
| Citation generator                | Pro  | Medium      |
| Cross-device sync                 | Pro  | Low (later) |

---

## Technical Notes

### Free Tier Architecture
- Managed API key stored server-side (never exposed to client)
- Usage tracking per user (anonymous ID or email)
- 10 analyses/month limit enforced server-side

### Premium Tier Architecture
- Stripe subscription management
- Feature flags controlled by subscription status
- Webhook handlers for subscription events

### Backend Requirements
- Proxy server for managed API calls
- User authentication/identification
- Usage tracking database
- Stripe webhook endpoints
