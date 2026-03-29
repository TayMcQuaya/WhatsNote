# WhatsNote — Real-Time Sync PRD

## Overview

WhatsNote is a WhatsApp-style desktop to-do app built with Electron. Currently all data is stored locally in a JSON file. This PRD outlines the plan to add **real-time sync and project sharing** between multiple users via Firebase.

**Goal**: Two or more users can share projects and see task changes in real-time. No server to build or host — Firebase handles everything.

---

## Current State

- **Platform**: Electron desktop app (Windows portable `.exe`)
- **Tech**: Plain HTML/CSS/JS — no frameworks, no bundler
- **Data**: Single JSON file at `%AppData%/whatsnote/whatsnote-data.json`
- **Avatars**: Copied to `%AppData%/whatsnote/avatars/` as local files
- **Auth**: None — no accounts, no login
- **Network**: Fully offline — nothing is sent to the internet

---

## Target State

- Users can **sign in with Google** (optional — app still works without an account)
- Signed-in users can **upload projects to the cloud** and **share them by email**
- Shared projects **sync in real-time** — adding/checking/deleting tasks appears instantly for all members
- **Offline support** — local JSON file is the fallback; changes sync when back online
- Avatars are uploaded to Firebase Storage and shared across devices

---

## Architecture

### Firebase Services Used

| Service | Purpose |
|---------|---------|
| **Firebase Auth** | Google sign-in |
| **Cloud Firestore** | Real-time database for projects, messages, users |
| **Firebase Storage** | Cloud avatar storage |

### Where Firebase Runs

Firebase SDK runs in the **Electron main process** (Node.js via `require()`). The renderer never touches Firebase directly — all operations are proxied through IPC via `preload.js`. This preserves the existing security model (`contextIsolation: true`, `nodeIntegration: false`).

### Sync Architecture

```
Renderer (app.js)                 Main Process (main.js)               Firestore
      │                                    │                               │
      ├── user action ──────► IPC ────────►├── write to Firestore ────────►│
      │                                    │                               │
      │◄── sync:data-update ◄── IPC ◄─────├◄── onSnapshot listener ◄──────│
      │                                    │                               │
      ├── save() ─────────► local JSON     │                               │
```

- **Local writes** happen immediately (optimistic UI)
- **Cloud writes** are fire-and-forget via IPC
- **Remote changes** arrive via Firestore `onSnapshot` listeners in main process, pushed to renderer via `webContents.send()`
- **Self-echo suppression**: ignore snapshots where `hasPendingWrites === true`

---

## Firestore Data Model

```
/users/{uid}
  ├── email: string
  ├── displayName: string
  ├── photoURL: string
  └── createdAt: timestamp

/userProjects/{uid}
  └── projectIds: string[]          // denormalized index for efficient queries

/projects/{projectId}
  ├── name: string
  ├── description: string
  ├── pinned: boolean
  ├── createdAt: timestamp
  ├── updatedAt: timestamp
  ├── ownerId: string (uid)
  ├── avatarURL: string | null      // Firebase Storage download URL
  └── members: map
      └── {uid}: "owner" | "editor"

/projects/{projectId}/messages/{messageId}
  ├── text: string
  ├── checked: boolean
  ├── starred: boolean
  ├── createdAt: timestamp
  └── authorId: string (uid)
```

**Why subcollection for messages?**
- Avoids Firestore's 1MB document size limit
- Enables per-message real-time listeners
- Allows granular writes (toggling one checkbox doesn't rewrite all messages)

---

## Conflict Resolution

**Strategy: Last-write-wins at field level**

- Firestore `update()` with specific field paths means two users editing different fields (one renames, one toggles pin) don't conflict
- Messages are individual subcollection documents — two users checking different tasks never conflict
- Same-field conflicts (two users rename simultaneously): last write wins
- `updatedAt` uses `serverTimestamp()` to avoid clock skew
- Delete operations are idempotent

---

## Security Rules

### Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    match /userProjects/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    match /projects/{projectId} {
      allow read: if request.auth.uid in resource.data.members;
      allow create: if request.auth.uid == request.resource.data.ownerId;
      allow update: if request.auth.uid in resource.data.members;
      allow delete: if request.auth.uid == resource.data.ownerId;

      match /messages/{messageId} {
        allow read, write: if request.auth.uid in
          get(/databases/$(database)/documents/projects/$(projectId)).data.members;
      }
    }
  }
}
```

### Firebase Storage

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{projectId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

## New Files

| File | Purpose |
|------|---------|
| `firebase/firebase-config.js` | Initialize Firebase app, export `db`, `auth`, `storage` |
| `firebase/auth-service.js` | Google OAuth via Electron BrowserWindow popup |
| `firebase/firestore-service.js` | All Firestore CRUD operations |
| `firebase/storage-service.js` | Avatar upload/download to Firebase Storage |
| `firebase/sync-manager.js` | Manages `onSnapshot` listeners, pushes updates to renderer |
| `firestore.rules` | Firestore security rules (deployed to Firebase) |
| `storage.rules` | Storage security rules (deployed to Firebase) |

## Modified Files

| File | Changes |
|------|---------|
| `package.json` | Add `firebase` dependency |
| `main.js` | Auth IPC handlers, cloud mutation IPC handlers, sync manager init |
| `preload.js` | ~15 new IPC bridges (auth, cloud mutations, sync event listeners) |
| `renderer/index.html` | Update CSP, add account button/overlay, share dialog, sync indicator |
| `renderer/app.js` | Dual-write mutations (local + cloud), sync event listeners, merge functions, account & share UI |
| `renderer/styles.css` | Account panel, share dialog, sync status indicator, shared-project badge |
| `.gitignore` | Add `.env`, `.env.local` |

---

## Implementation Phases

### Phase 1: Firebase SDK Scaffolding

- Install `firebase` npm package
- Create `firebase/firebase-config.js` — init app with project config
- Create `firebase/auth-service.js` — Google OAuth via BrowserWindow
- Create `firebase/firestore-service.js` — CRUD operation stubs
- Create `firebase/storage-service.js` — avatar upload/download stubs
- **No user-visible changes**

### Phase 2: Auth UI

- Add account button to sidebar footer
- Add account overlay panel (signed-in / signed-out states)
- Update Content-Security-Policy for Google profile photos and Firebase Storage URLs
- Wire up auth IPC handlers (`auth:sign-in`, `auth:sign-out`, `auth:get-user`)
- Render account state in sidebar, listen to auth state changes

### Phase 3: Data Layer Abstraction

- Add `cloudSyncActive` flag
- Refactor all 13 mutation functions to dual-write: local `save()` + cloud IPC call
- Add cloud mutation IPC bridges and handlers
- Create Firestore user document on first sign-in

### Phase 4: Real-Time Sync (Core)

- Build `sync-manager.js`:
  - Subscribe to `userProjects/{uid}` for project list
  - Subscribe to `/projects/{id}` for project metadata
  - Subscribe to `/projects/{id}/messages` for active project
  - Push changes to renderer via `webContents.send()`
- Add merge functions in `app.js`: `mergeProjects()`, `mergeMessages()`, `applyMessageUpdate()`
- Self-echo suppression via `snapshot.metadata.hasPendingWrites`
- Sync status indicator in sidebar (green = synced, yellow = syncing, gray = offline)

### Phase 5: Avatar Cloud Storage

- On avatar upload when signed in: upload to Firebase Storage, store `avatarURL` on project
- Renderer uses `avatarURL || avatar` for display
- Download remote avatars locally for offline display

### Phase 6: Project Sharing

- Add "Share Project" to project context menu
- Share dialog: email input, member list, invite button
- Backend: lookup user by email, update project `members` map + `userProjects`
- Show shared indicator (member count badge) on sidebar project items

### Phase 7: Migration & Local/Cloud Toggle

- First sign-in prompt: "Upload N local projects to cloud?"
- Per-project `cloudId` field — `null` = local-only, set = cloud-synced
- Context menu options: "Upload to Cloud" / "Remove from Cloud"

### Phase 8: Offline Hardening

- Pending mutation queue in `sync-manager.js` (persisted to local file)
- Flush queue on reconnect
- Handle edge cases: simultaneous deletes, network failures, auth token expiry

> **Phases 5, 6, and 7 can be done in parallel after Phase 4 is stable.**

---

## Sharing Flow

```
User A                              Firebase                          User B
  │                                    │                                │
  ├── "Share with bob@email.com" ─────►│                                │
  │                                    ├── lookup /users by email       │
  │                                    ├── add Bob's UID to members     │
  │                                    ├── update /userProjects/bob     │
  │                                    │                                │
  │                                    ├── onSnapshot fires ───────────►│
  │                                    │                                ├── project appears
  │                                    │                                │   in sidebar
```

---

## Offline Flow

```
Online                    Goes Offline                 Reconnects
  │                           │                            │
  ├── mutations write ──►     │                            │
  │   local + Firestore       │                            │
  │                           ├── mutations write ──►      │
  │                           │   local JSON only          │
  │                           │   + queued for sync        │
  │                           │                            ├── flush queue ──► Firestore
  │                           │                            ├── onSnapshot catches up
  │                           │                            │   from other users
```

---

## User-Facing Changes Summary

| Feature | Before | After |
|---------|--------|-------|
| Sign-in | None | Google sign-in (optional) |
| Data storage | Local JSON only | Local JSON + Firestore |
| Sharing | Not possible | Share by email |
| Real-time sync | Not possible | Instant across devices |
| Avatars | Local file only | Cloud-synced |
| Offline | Always works | Still works, syncs on reconnect |
| Multi-device | Not supported | Supported when signed in |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Firebase JS SDK `signInWithPopup` doesn't work in Node.js | Use manual OAuth flow: BrowserWindow → Google consent → auth code → `signInWithCredential` |
| Too many Firestore listeners for users with many projects | Only listen to messages for the active project; listen to project metadata (lightweight) for all |
| Remote sync events cause render glitches | All updates go through dedicated merge functions; existing renderers do full DOM rebuilds |
| Two users delete same project simultaneously | Firestore delete is idempotent; `onSnapshot` fires "removed" for both |
| API keys in source code | Firebase client API keys are not secret (restricted by security rules); still kept out of renderer |

---

## Verification Checklist

- [ ] Sign in with Google on two instances of WhatsNote
- [ ] Create a project on instance A → appears on instance B
- [ ] Add/check/star/delete messages → reflected in real-time on both
- [ ] Share a project by email → recipient sees it appear
- [ ] Go offline → local changes persist → reconnect → changes sync
- [ ] Upload avatar → visible on both instances
- [ ] Sign out → app continues working in local-only mode
- [ ] Delete shared project as owner → removed for all members
- [ ] Non-owner cannot delete project (only leave/unshare)
