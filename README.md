# Stash

Stash is a learning feed. Sign in, pick a topic, and give it a PDF or a link. Stash reads the source and turns it into a short lesson: 4–8 ordered posts that explain the topic in plain language. Lessons appear in an Instagram-style feed where people can like, comment, share, follow each other, post 24-hour stories, and send direct messages. A **For you** tab recommends lessons based on what you engage with.

```
client/   React (Vite) + React Router + Auth0 SPA SDK, plain CSS
server/   Node.js + Express 5 + Mongoose, Auth0 JWT verification
```

All application data lives in one MongoDB database. Uploaded PDFs are stored on disk in `server/uploads/`. MongoDB keeps the file path, the original filename and the extracted text, never the PDF bytes.

---

## Requirements

- Node.js 22 or newer
- MongoDB 6 or newer: a local install, Docker, or a MongoDB Atlas cluster
- A free Auth0 tenant
- (Optional) An OpenAI API key

## 1. MongoDB

Pick one:

- **Docker:** `docker run -d --name stash-mongo -p 27017:27017 mongo:7`, then use `MONGODB_URI=mongodb://127.0.0.1:27017/stash`.
- **Local install:** start `mongod` and use the same URI.
- **Atlas:** create a cluster and a database user, allow your IP, and copy the connection string. Add a database name to the path, for example `mongodb+srv://user:pass@cluster0.xxxx.mongodb.net/stash`.

On startup the server builds every index it needs:

- unique likes per user and post
- unique follows
- case-insensitive unique topic names
- a TTL index that deletes stories after 24 hours

You don't need a seed script. Sign in and create a lesson to get content.

## 2. Auth0

You need two things in Auth0: an **API**, which the Express server trusts, and a **Single Page Application**, which the React app logs in with.

### Create the API

1. Go to **Applications → APIs → Create API**.
2. Name it `Stash API`.
3. Set **Identifier** to `https://stash-api`. The identifier doesn't need to be a real URL. This value is your **audience**.
4. Keep the signing algorithm as **RS256**.
5. Open the API's **Settings**, turn on **Allow Offline Access**, and save. The SPA uses refresh tokens, so people stay signed in after a reload, including in browsers that block third-party cookies.

### Create the SPA application

1. Go to **Applications → Applications → Create Application** and choose **Single Page Web Applications**.
2. In **Settings**, fill in these URLs for local development:

   | Setting | Value |
   | --- | --- |
   | Allowed Callback URLs | `http://localhost:5173` |
   | Allowed Logout URLs | `http://localhost:5173` |
   | Allowed Web Origins | `http://localhost:5173` |

   When you deploy, add your production origin to all three, for example `https://stash.example.com`, comma-separated.
3. Under **Refresh Token Rotation**, make sure **Rotation** is on. It is on by default for new SPAs.
4. Copy the **Domain** and the **Client ID**.

### How sign-in works

- The client requests an access token for the API audience with `openid profile email offline_access` scopes.
- The server verifies every token's signature against your tenant's JWKS, and checks the issuer (`https://AUTH0_DOMAIN/`) and the audience (`AUTH0_AUDIENCE`). It uses Auth0's `express-oauth2-jwt-bearer`.
- On a user's first authenticated request, the server upserts a local `User` keyed by the token's `sub`. It reads name, email and picture from Auth0's `/userinfo` endpoint.
- Visitors can read the feed, posts, topics, profiles and stories.
- Liking, commenting, sharing, creating, following, posting stories and messaging all require sign-in. When a visitor tries one of these, they go through Auth0 and come back to the page they were on.

## 3. Environment variables

Each app has its own `.env`. Copy the examples, then fill them in. Never commit `.env` files; `.gitignore` already excludes them.

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### `server/.env`

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string, including the database name |
| `AUTH0_DOMAIN` | yes | Auth0 tenant domain, e.g. `your-tenant.us.auth0.com` (no `https://`) |
| `AUTH0_AUDIENCE` | yes | Your Auth0 API identifier, e.g. `https://stash-api` |
| `CLIENT_ORIGIN` | yes | Browser origin allowed by CORS, e.g. `http://localhost:5173`. Comma-separate several. |
| `PORT` | yes | API port, e.g. `4000` |
| `OPENAI_API_KEY` | no | Turns on model-written posts. See [Post conversion](#post-conversion). |
| `OPENAI_MODEL` | no | Defaults to `gpt-4o-mini` |

### `client/.env`

| Variable | Description |
| --- | --- |
| `VITE_AUTH0_DOMAIN` | Same tenant domain as the server |
| `VITE_AUTH0_CLIENT_ID` | Client ID of the SPA application |
| `VITE_AUTH0_AUDIENCE` | Same value as the server's `AUTH0_AUDIENCE` |
| `VITE_API_URL` | Base URL of the API, e.g. `http://localhost:4000` (no `/api`) |

If any client variable is missing, the app shows a screen that lists the ones it needs instead of failing silently.

## 4. Run it

Use two terminals.

```bash
# Terminal 1: API on http://localhost:4000
cd server
npm install
npm run dev
```

```bash
# Terminal 2: web app on http://localhost:5173
cd client
npm install
npm run dev
```

Open http://localhost:5173, sign in, go to **Create**, enter a topic, and upload a PDF or paste an article link.

To build for production, run `cd client && npm run build` and serve `client/dist/` as static files. For client-side routing, rewrite unknown paths to `index.html`. Then run the API with `cd server && npm start`.

Check the server with `curl http://localhost:4000/api/health`. The response shows whether the database is connected and which converter is active.

---

## Post conversion

Conversion runs inside the `POST /api/sources` request; there is no queue. The create screen shows a pending state until the request finishes, then routes to the new lesson.

1. **Extract**
   - **PDF:** only `application/pdf`, up to 15 MB. The server reads text from the first 60 pages and stops at 120,000 characters. It rejects:
     - files that aren't PDFs
     - encrypted or password-protected files
     - unreadable or damaged files
     - image-only (scanned) PDFs
     - PDFs with too little text

     Each rejection has its own message.
   - **URL:** `http` or `https` only. The server fetches the page with a 12-second budget and a 3 MB cap, following up to 5 redirects. It refuses links that resolve to private or local addresses. It rejects:
     - any final response other than HTTP 200
     - non-HTML responses
     - pages with almost no readable text, such as pages that need JavaScript or a login

     It strips navigation, sidebars, references and similar boilerplate before reading.
2. **Store:** the source document stores the extracted text, capped at 50,000 characters.
3. **Convert** to 4–8 posts. Each post has a title, a 2–4 sentence body, and an example or analogy when the source supports one.

### With `OPENAI_API_KEY`

The server sends up to 24,000 characters to the Chat Completions API and asks for **strict JSON** (a JSON schema with `title`, `body`, `example`). It then validates the reply:

- the reply has 4–8 posts
- every title length is valid
- every body has at least 2 sentences; longer bodies are trimmed to 4
- example lengths are valid
- citations and URLs are removed

The prompt tells the model to use only facts from the source, explain more simply than the source, and add no citations.

If the request fails, times out, is refused, returns invalid JSON, or fails validation, the server **falls back to the local converter**. A missing or broken key never blocks a lesson.

### Without `OPENAI_API_KEY` (local converter)

The app runs fully without an OpenAI key. The local converter is deterministic, so the same text always produces the same posts:

- It removes citations, parentheticals and URLs, and stops reading at sections like References or See also.
- It splits the text into clean sentences and groups them into 4–8 contiguous parts. Where the source has its own headings, the parts follow those sections.
- Each part becomes a post:
  - **Title:** the section heading, or the part's most distinctive phrase. Titles don't repeat within a lesson.
  - **Body:** the 2–3 clearest, most on-topic sentences, kept in source order.
  - **Example:** a sentence that signals an example or analogy ("for example", "imagine", "like a"…), if the part has one.

The local converter can't paraphrase. It simplifies by choosing short, self-contained sentences. If the text has fewer than 8 usable sentences, the request fails with an error rather than inventing a lesson.

The `server/src/services/` folder holds `extract-pdf.js`, `extract-url.js`, `convert-local.js` and `convert-openai.js`.

---

## Features beyond the core feed

- **Follows:** follow other learners from their profile (`/users/:id`). The **Following** feed tab shows lessons from people you follow. Follower and following counts are stored on the user document.
- **Direct messages:** 1:1 conversations at `/messages`. You can search people by name or tap **Message** on a profile.
  - An open conversation checks for new messages every 4 seconds, and the inbox refreshes every 15 seconds.
  - The nav badge shows unread conversations.
  - Messages are stored in MongoDB.
- **Stories:** short text cards ("Today I learned…") with a background theme and an optional link to a post. You can post one from the tray or with **Add to your story** on any post.
  - Stories expire after 24 hours through a MongoDB TTL index.
  - The tray shows you first, then people you follow, then everyone else.
  - Seen rings and view counts are tracked per viewer.
- **Recommendations** (`server/src/services/recommend.js`): **For you** ranks the 300 most recent lessons with an explainable score:

  | Signal | Weight |
  | --- | --- |
  | Topic affinity: topics you liked (×1), commented on (×2), shared (×3) or created (×2), normalized | 3.0 |
  | The author is someone you follow | 2.0 |
  | Popularity: log of likes + 2×comments + 3×shares | 1.5 |
  | Recency: decays over about 4 days | 2.0 |
  | You already engaged with this lesson | −1.5 |

  - A greedy re-rank keeps one topic or author from filling a page.
  - Each recommended lesson shows its reason, such as "Because you're into Photosynthesis".
  - **Suggested for you** lists people to follow and topics to explore. Topic suggestions use co-engagement: topics liked by people who like your topics.
  - Signed-out visitors get the same ranking without the personal signals.

## API

JSON under `/api`, CORS limited to `CLIENT_ORIGIN`. Errors look like `{ "error": "human-readable message" }`:

- `400` bad input
- `401` missing or invalid token
- `404` missing record
- `500` unexpected failure

"auth" means a valid Auth0 access token is required. "optional" means a token is used when present, for example to show which posts you liked.

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/health` | | Health check |
| `GET /api/me` | auth | Current user, their topics and their recent sources (with status) |
| `GET /api/feed?topic=&author=&source=&tab=latest\|following&cursor=&limit=` | optional | Feed, newest lesson first, posts in order. Cursor-paginated. |
| `GET /api/feed/for-you?page=&limit=` | optional | Recommended lessons |
| `GET /api/posts/:id` | optional | Post detail plus the other posts in its lesson |
| `GET /api/topics` | | Topics that have posts |
| `GET /api/topics/:slug` | | One topic |
| `POST /api/sources` | auth | Multipart `topic` + `file` (PDF), or JSON `{ topic, url }` |
| `GET /api/sources/:id` | auth (owner) | Source status: `pending`, `ready` or `failed`, with an error message |
| `POST /api/posts/:id/like`, `DELETE /api/posts/:id/like` | auth | Like or unlike. Idempotent. |
| `GET /api/posts/:id/comments` | | Comments, oldest first |
| `POST /api/posts/:id/comments` | auth | `{ text }`, 1–500 characters |
| `POST /api/posts/:id/share` | auth | Records a share event |
| `GET /api/users?q=` | auth | Search people by name |
| `GET /api/users/:id` | optional | Public profile |
| `POST`/`DELETE /api/users/:id/follow` | auth | Follow or unfollow |
| `GET /api/users/:id/followers`, `/following` | optional | Follow lists |
| `GET /api/recommendations` | optional | Suggested people and topics |
| `GET /api/stories` | optional | Story tray |
| `POST /api/stories` | auth | `{ text, theme, postId? }` |
| `DELETE /api/stories/:id` | auth (owner) | Delete your story |
| `POST /api/stories/:id/view` | auth | Mark a story as seen |
| `GET /api/conversations` | auth | Your inbox |
| `GET /api/conversations/unread` | auth | Unread conversation count |
| `POST /api/conversations` | auth | `{ userId }`: open or create a 1:1 conversation |
| `GET /api/conversations/:id/messages?after=&before=` | auth (member) | Messages. Use `after` to poll for new ones and `before` to load older ones. |
| `POST /api/conversations/:id/messages` | auth (member) | `{ text }`, 1–1000 characters |
| `POST /api/conversations/:id/read` | auth (member) | Mark a conversation as read |

### Data model

All models use Mongoose with timestamps:

- `User`: `auth0Sub`, `name`, `email`, `picture`, follower and following counts
- `Topic`: `name`, `nameKey` (lower-cased, unique: this makes names unique case-insensitively), `slug`, `postCount`
- `Source`: `topic`, `author`, `kind`, `url` or `filePath` + `originalName`, `title`, `extractedText`, `status`, `error`, `converter`, plus lesson totals for the recommender
- `Post`: `topic`, `source`, `author`, `title`, `body`, `example`, `order`, `likeCount`, `commentCount`, `shareCount`
- `Like` (unique on `post` + `user`), `Comment`, `Share`
- `Follow` (unique on `follower` + `following`)
- `Conversation`, `Message`
- `Story` (TTL), `StoryView`

Counts are kept on documents and updated with `$inc` whenever a like, comment, share or follow changes. Decrements never go below zero, so the feed never aggregates on read. Liking twice and unliking twice are both no-ops, so counts stay correct when a like is toggled off.

## Project layout

```
server/src/
  index.js            startup: env check, Mongo connection, indexes, listen
  app.js              Express app, CORS, routes, error handling
  config.js           env loading and limits
  middleware/         Auth0 JWT verification + user upsert, error responses
  models/             Mongoose models
  routes/             feed, posts, topics, sources, me, users, stories, messages, recommendations
  services/           extraction, conversion, recommendation, serialization
client/src/
  main.jsx, App.jsx   router and providers
  auth/               Auth0 provider (returns to the page you came from)
  api/                fetch wrapper and useApi hook (adds the access token)
  components/         post card, like/share, feed list, stories, toasts, layout
  pages/              Feed, Post, Create, Topic, Sequence, Profile, User, Messages, Conversation
  styles.css          mobile-first CSS, light and dark
```

## Notes and limits

- Conversion runs in the request. A slow page or a long OpenAI call keeps the request open, up to about 75 seconds in the worst case. The server allows 3 minutes per request.
- Uploaded PDFs stay in `server/uploads/`. Failed uploads are deleted. Back up or move this folder when you deploy; production would usually use object storage.
- PDFs with an encryption dictionary are rejected even when they open without a password, so their text is never read.
- The SPA caches tokens in `localStorage` so refresh tokens survive reloads. As with any SPA, keep your Content Security Policy strict.
