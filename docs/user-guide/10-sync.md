# 10. Syncing Two Machines

[← Prev: YouTube Import](./09-youtube-import.md) · [Back to User Guide](./README.md) · [Next: Keyboard Shortcuts →](./11-keyboard-shortcuts.md)

---

DNDj can keep **two computers** in sync — for example a home PC where you build
your library and a laptop/Mac you bring to a friend's house. One machine acts as
the **server**, the other **pulls** from it, copying over any new or changed audio
files and the whole database (tracks, tags, playlists, scenes, cue points).

Either machine can be the server — you decide each time.

All of this lives in **Settings (⚙) → Sync** tab.

## The mental model

- **Server** = the machine that *has* the latest stuff and shares it.
- **Client** = the machine that *pulls* and ends up matching the server.

A pull is **one-way**: after it finishes, the client looks like the server. It is
**last-write-wins** — there's no merging. So always pull *into* the machine that's
behind, *from* the machine that's ahead.

## Step 1 — Start the server (on the machine with the latest library)

1. Open **⚙ → Sync**.
2. Under **Server Mode**, click **Start Server**.
3. DNDj shows two things you'll need on the other machine:
   - a **Local** address like `http://192.168.1.103:7432`, and
   - a **Token** (a short code). Click the copy button to grab it.

The token is **persistent** — it stays the same across restarts, so you only need
to note it once. Leave this machine running with the server on.

## Step 2 — Pull (on the other machine)

1. Open **⚙ → Sync** on the second machine.
2. Under **Pull from Server**, enter:
   - the **server URL** (the Local address from step 1), and
   - the **token**.
3. Click **Pull from Server**.

A progress bar shows it connecting, downloading the database, then copying only
the audio files that are missing or have changed (it compares by file size, so
unchanged files aren't re-downloaded). When it's done, the app **reloads itself**
and now matches the server — same tracks, playlists, scenes, everything.

## Saving connections

Typing the URL and token every time is tedious. Once both fields are filled, a
**+ Save as connection** button appears:

- Give the connection a name (e.g. "Home PC") and a colour.
- It shows up as a coloured **chip**. Click the chip to instantly fill in its URL
  and token; click again-ready, then **Pull**.
- Hover a chip to **edit** (✎) or **delete** (×) it.

Saved connections (and your server token and DuckDNS settings) are **kept on each
machine locally** and survive a sync — pulling a new database won't wipe them.

## Accessing over the internet (DuckDNS)

Your home address (`192.168.x.x`) only works on your home network. To pull from
somewhere else (a friend's house), the server needs to be reachable over the
internet. DNDj integrates with the free [DuckDNS](https://www.duckdns.org/)
service to handle the fact that home IP addresses change.

On the **server** machine, with the server running:

1. Register a free subdomain at duckdns.org (e.g. `akpchome.duckdns.org`) and copy
   your DuckDNS **API token**.
2. In **⚙ → Sync → DuckDNS — WAN Access**, enter the domain (e.g. `akpchome`) and
   the API token, then click **Save & Update Now**.

DNDj will keep that domain pointed at your home's current public IP automatically
(refreshing every 30 minutes).

You also need to **forward port `7432`** on your home router to the server
computer (TCP). After that, on the client you can pull using
`http://yourdomain.duckdns.org:7432` plus the same token, from anywhere.

> **Security note:** the token protects access to your library over the network.
> Don't share it publicly. Anyone with the URL *and* token can pull your files.

## Deleting tracks across machines

When you delete a track and choose **⚠ Everywhere (on next sync)**, that deletion
is queued. The next time the *other* machine pulls, DNDj also removes that file
there. See [Library & Tracks → Deleting](./03-library-and-tracks.md#deleting-a-track).

## What gets synced vs. what stays local

| Synced (server → client) | Stays on each machine |
|--------------------------|------------------------|
| All audio files (new/changed) | Saved sync connections |
| Tracks, names, tags, categories | This machine's server token |
| Playlists & folders | DuckDNS domain & token |
| Scenes & cue points | Whether this machine runs the server |
| Queued "delete everywhere" actions | |

## Troubleshooting

- **"Invalid auth token"** — the token on the client doesn't match the server's.
  Re-copy it from the server's Sync tab.
- **"Connection timed out"** — the client can't reach the server. On the same
  network, check the IP. Over the internet, check port forwarding and that
  DuckDNS is updated.
- **Server shows a weird IP** (like `10.x` or `172.x`) — DNDj prefers your real
  home-network address (`192.168.x.x`) and skips virtual adapters, but if you have
  an unusual setup the displayed Local address may differ; use the one that
  matches your actual LAN.

---

[← Prev: YouTube Import](./09-youtube-import.md) · [Back to User Guide](./README.md) · [Next: Keyboard Shortcuts →](./11-keyboard-shortcuts.md)
