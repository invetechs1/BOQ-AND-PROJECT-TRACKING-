# Frontend structure — نظام إدارة المستخلصات والإنتاجية

## What changed (Phase 1 — modularization)

The frontend used to live in a single `public/index.html` (~6,500 lines: CSS + HTML + JS).
It is now split into ordered modules with **zero behavior change** (the concatenation of the
JS modules is byte-identical to the original inline script, verified at split time):

```
public/
├── index.html          # markup only + <link>/<script> tags
├── css/
│   └── app.css         # all styles
└── js/                 # classic scripts, loaded in order (shared global scope)
    ├── 00-core-prelude.js        # 'use strict', shared prelude
    ├── 01-i18n-core.js           # T(), LANG, I18N_EN base
    ├── 02-i18n-extra.js          # additional translations
    ├── 03-state-api.js           # state, API client, save/flush/versioning
    ├── 04-auth-projects.js       # login/session, roles (editsGated/canApproveEdits), projects CRUD
    ├── 05-computed.js            # derived values (statusOf, pendingApprovalQty, ...)
    ├── 06-render-shared.js       # renderAll + shared render helpers
    ├── 07-projects-tab.js
    ├── 08-users.js
    ├── 09-dashboard.js
    ├── 10-action-plan.js
    ├── 11-boq-items.js           # items table, setItemQty, markItemDone
    ├── 12-consultant-approval.js # اعتماد الاستشاري + الاستلامات الموقعة
    ├── 13-item-modal.js          # add/edit/delete item (deleteItem → applyItemDelete)
    ├── 14-item-split.js          # تقسيم سعر البند
    ├── 15..17-mustakhlas-*.js    # builder / history / document
    ├── 18-documents.js           # blocker letter + progress report
    ├── 19-csv-export.js
    ├── 20-blockers.js
    ├── 21-villas.js
    ├── 22-productivity.js        # daily work logs (auto-apply to completion %)
    ├── 23-edit-requests.js       # owner-approval workflow for edits/deletions
    ├── 24-subcontractors.js
    ├── 25-pricedb.js
    ├── 26-boq-import.js
    ├── 27-settings.js
    ├── 28-boot.js                # boot() entry point
    └── 29-i18n-static.js         # data-i18n static translations
```

## Rules

- **Load order matters.** Files are classic `<script>` tags sharing one global scope,
  loaded in the numbered order from `index.html`. A module may call functions from any
  other module *at runtime* (event handlers, boot), but top-level code must only use
  what earlier modules define.
- Every module starts with `'use strict';` (the original single script was strict).
- New feature → new numbered file (or extend the matching module), then add its
  `<script src>` tag to `index.html` **and** its path to `SHELL` in `public/sw.js`
  (bump the `CACHE` version so PWA clients pick it up).
- i18n: keep adding `Object.assign(I18N_EN, {...})` blocks next to the feature that
  uses the strings.

## Phase 2 (optional, when committing long-term)

This split is the safe foundation. If the platform keeps growing, the next step is a
proper build setup (Vite) migrating module-by-module to ES modules and then to
components — each module above maps naturally to one future component/store. Do it
incrementally per tab (start with the smallest, e.g. blockers), never as a big-bang
rewrite, and keep the Playwright E2E suite green at every step.
