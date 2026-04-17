# URL-pinned tab state

The app URL is the **single source of truth** for what a tab is viewing.
Every reload lands on exactly the same project, file, and card. Two tabs
with different URLs show two independent states. The server-side
`_workspace.json` is a home-screen convenience — it is never consulted
on reload.

## Query parameters (unified schema)

| Param | Meaning |
|-------|---------|
| `kind` | `template` or `session` |
| `id` | Stable content id (template id, or session dir basename) |
| `file` | Content file basename, e.g. `social.html` |
| `card` | Active card index (0-based), default 0 |

## Examples

Template:

```
http://localhost:PORT/?kind=template&id=linkedin-carousel-concept-story&file=social.html&card=2
```

Session:

```
http://localhost:PORT/?kind=session&id=my-campaign-oct&file=social.html&card=0
```

## Agent usage

The agent can construct a URL directly and send it to the user for
deep-linking. For example, after creating a new session from a template:

```
http://localhost:PORT/?kind=session&id=<newSessionId>&file=social.html&card=0
```

## Legacy parameters

`?project=` and `?preset=` are honored for one release so existing bookmarks
keep working. They are deprecated — always emit the new `kind`/`id`/`file`/`card`
form when constructing URLs for the user.

## Tab-level isolation

Opening the same app at two different URLs in two tabs produces two
independent state machines. Each tab tracks its own `activeFile`,
`activeCard`, and `activeElement` independently. When you send the user a
URL, they can open it in a new tab without disturbing their current work.
