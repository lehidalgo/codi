# Google Sheets OAuth Setup

One-time setup to enable Google Sheets integration. After this, clicking
"Connect Google Account" in the UI handles authorization automatically.

---

## Step 1 — Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **New Project** → give it a name (e.g. "Audio Transcriber")
3. Select the project

## Step 2 — Enable APIs

In the project, go to **APIs & Services → Library** and enable:

- **Google Sheets API**
- **Google Drive API**

## Step 3 — Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. If prompted, configure the OAuth consent screen first:
   - User type: **External**
   - App name: anything (e.g. "Audio Transcriber")
   - Add your email as a test user
4. Back in Create Credentials:
   - Application type: **Desktop app**
   - Name: anything
5. Click **Create** → download the JSON file

## Step 4 — Place the Credentials File

Save the downloaded JSON as:

```
~/.config/gspread/credentials.json
```

Create the directory if needed:

```bash
mkdir -p ~/.config/gspread
mv ~/Downloads/client_secret_*.json ~/.config/gspread/credentials.json
```

## Step 5 — First Connection

Click **Connect Google Account** in the UI. A browser tab opens for Google authorization.
After you approve, a token is cached at `~/.config/gspread/authorized_user.json`.
Future connections use the cached token — no browser needed again.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `credentials.json not found` | Ensure the file is at `~/.config/gspread/credentials.json` |
| `Access blocked: app not verified` | Add yourself as a test user in OAuth consent screen |
| `insufficient permissions` | Make sure both Sheets API and Drive API are enabled |
| Token expired | Delete `~/.config/gspread/authorized_user.json` and reconnect |
