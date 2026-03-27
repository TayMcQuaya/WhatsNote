# WhatsNote

A WhatsApp-style desktop to-do app where each "chat" is a project and each message is a task. Built with Electron — runs as a single portable `.exe` on Windows. No installation, no account, no internet required.

![WhatsNote Screenshot](https://img.shields.io/badge/Platform-Windows-blue) ![License](https://img.shields.io/badge/License-MIT-green)

---

## Download & Run

1. Go to [Releases](../../releases) and download **`WhatsNote.exe`**
2. Double-click to launch — that's it

No installer. No setup. Just the `.exe` file. Your data is saved locally to `%AppData%/whatsnote/`.

---

## Features

### Projects (Chats)
- Each project is a "chat" in the sidebar
- Click **+** to create a new project
- **Double-click** a project name to rename it inline
- **Right-click** a project for options: Pin Chat, Change Avatar, Rename, Delete
- **Pin projects** to keep them at the top of the sidebar (pin icon shown)
- Projects are sorted by last activity (pinned first, then most recent)
- Search bar filters projects by name
- Delete confirmation dialog prevents accidental deletion

### Tasks (Messages)
- Type a task and press **Enter** to send it as a message bubble
- **Click anywhere on a message** to check/uncheck it
- Checked tasks get a strikethrough but stay in place
- **Shift+Enter** adds a new line before sending
- **Right-click** a message for options: Star, Delete
- Messages show timestamps and date separators (Today, Yesterday, full dates)

### Links
- Paste a URL and it's automatically detected
- Link messages appear with a link icon instead of a checkbox (no toggle)
- Links are styled in blue and **clickable** — opens in your default browser
- **Right-click** a link message to Copy or Open the URL

### Starred Messages
- **Right-click** any message → "Star Message" to mark it as a favorite
- Starred messages show a gold star next to the timestamp
- Click the **star icon** in the sidebar header to view all starred messages across all projects
- Each starred message shows which project it belongs to
- Right-click to unstar

### Project Info
- **Click** the project avatar (sidebar or chat header) to open the Project Info window
- View and upload a **custom avatar** (hover over the avatar → click to upload)
- Add a **project description**
- See project stats: total tasks, completed tasks, creation date

### Themes
- **Dark mode** and **Light mode** — toggle with the sun/moon button in the sidebar header
- Auto-detects your system theme on first launch
- WhatsApp-accurate colors for both themes
- Real WhatsApp chat background patterns

---

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Send message | `Enter` |
| New line in message | `Shift + Enter` |
| Close info panel / modal | `Escape` |

---

## Data Storage

All data is stored locally in a single JSON file:

```
Windows: %AppData%/whatsnote/whatsnote-data.json
```

Avatars are stored in:

```
Windows: %AppData%/whatsnote/avatars/
```

Nothing is sent to the internet. Your data stays on your machine.

### Backup

To back up your data, copy the `whatsnote` folder from `%AppData%`:
1. Press `Win + R`, type `%AppData%`, press Enter
2. Find the `whatsnote` folder
3. Copy it somewhere safe

To restore, paste it back.

---

## Building From Source

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later)

### Setup

```bash
git clone https://github.com/TayMcQuaya/WhatsNote.git
cd WhatsNote
npm install
```

### Run in Development

```bash
npm start
```

### Build Portable .exe

```bash
npm run build
```

The output is in `dist/WhatsNote X.X.X.exe` — a single portable executable. No installer needed.

> **Note:** Building must be done from **Windows PowerShell** (not WSL). If you get a symlink error, run PowerShell as Administrator.

---

## Project Structure

```
WhatsNote/
├── main.js              # Electron main process (window, IPC, menus)
├── preload.js           # Secure IPC bridge (contextBridge)
├── renderer/
│   ├── index.html       # App shell
│   ├── styles.css       # WhatsApp themes (dark + light)
│   ├── app.js           # All UI logic and state
│   ├── bg-chat-light.png # WhatsApp light background
│   └── bg-chat-dark.png  # WhatsApp dark background
├── assets/
│   ├── icon.png         # App icon (PNG for taskbar)
│   └── icon.svg         # App icon (SVG for header)
├── package.json
├── LICENSE
└── README.md
```

---

## Tech Stack

- **Electron** — Desktop app framework
- **Plain HTML/CSS/JS** — No frameworks, no bundlers, no build tools
- **JSON file** — Local data persistence
- **electron-builder** — Portable `.exe` packaging

---

## FAQ

**Q: Where is my data stored?**
A: `%AppData%/whatsnote/whatsnote-data.json` on Windows. Press `Win+R`, type `%AppData%`, and look for the `whatsnote` folder.

**Q: Can I sync across devices?**
A: Not built-in. You could put the `whatsnote` AppData folder in a synced cloud folder (Dropbox, OneDrive) and symlink it, but this isn't officially supported.

**Q: Is there a limit on projects or tasks?**
A: No hard limits. It's a JSON file, so practically it handles thousands of tasks without issues.

**Q: Can I use this on Mac/Linux?**
A: The source code works cross-platform with Electron. Run `npm start` on any OS. For building, change the target in `package.json` from `--win portable` to `--mac` or `--linux`.

**Q: Will WhatsApp/Meta sue me?**
A: WhatsNote is an independent open-source to-do app. It doesn't connect to WhatsApp, doesn't use WhatsApp's services, and doesn't claim any affiliation. The UI layout/style is inspired by WhatsApp but UI layouts aren't copyrightable. If you're distributing publicly, consider using your own custom icon instead of the WhatsApp logo to be safe.

---

## Author

Made by [TayMcQuaya](https://x.com/TayMcQuaya)

---

## Contributing

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## Disclaimer

WhatsNote is not affiliated with, endorsed by, or connected to WhatsApp or Meta Platforms, Inc. in any way. WhatsApp is a registered trademark of Meta Platforms, Inc. This is an independent open-source project inspired by WhatsApp's UI design for personal productivity purposes.
