# Elegant

A desktop app for software projects, notes, and tasks. No account. Your data stays on this computer.

The interface is available in Turkish and English. Appearance can follow the system, or stay light or dark.

## Features

- Projects in three groups: Work, Personal, and General
- Pins, colors, and project settings
- Notes and tasks, with formatted text
- Collapsible panels and search

## Install

Download the Windows installer from [Releases](https://github.com/sahinsalih/elegant/releases).

Setup installs Elegant to `C:\Program Files\Elegant` and asks for administrator permission. Notes and tasks are kept in `%APPDATA%\Elegant`. Uninstalling the app does not delete that folder.

## Develop

Requires Node.js 22.

```bash
git clone https://github.com/sahinsalih/elegant.git
cd elegant
npm install
npm test
npm start
```

| Path | What it holds |
| --- | --- |
| `src/` | Electron main process, interface, and local data |
| `assets/` | App icon and logo |
| `tests/` | Data store tests |

`npm start` opens the app. `npm test` checks the store. `npm run dist` writes a Windows installer into `release/`, which is not committed.

## License

[MIT](LICENSE)
