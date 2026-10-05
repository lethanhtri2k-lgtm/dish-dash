# Dish Dash — self-hosted

A live food quiz for English learners. You run the game from `host.html`; students join
from `index.html` with a 4-digit PIN. No accounts, no sign-in, no app.

Five dishes, one per round. Students see the photo and tick everything they think is
true about it — country, ingredients, type of dish, way of cooking. Each dish is worth
up to **1000 points**: a wrong tick cancels a right one, and the faster they lock in,
the more of the points they keep. 5000 points in a full game.

---

## Setup, once (about 15 minutes)

### 1. Put the files on GitHub Pages

1. Create a new repository on GitHub — for example `dish-dash`. Make it **Public**.
2. Upload everything in this folder, keeping the structure (`index.html`, `host.html`,
   and the whole `assets/` folder with `photos/` inside it).
3. In the repo, go to **Settings › Pages**. Under *Source* choose **Deploy from a branch**,
   pick branch `main` and folder `/ (root)`, then **Save**.
4. Wait a minute. Your site appears at `https://YOUR-NAME.github.io/dish-dash/`.

### 2. Create the database

1. Go to [supabase.com](https://supabase.com) and sign in with GitHub. Create a new project
   (the free plan is plenty — a class of thirty uses a tiny fraction of it).
2. Open **SQL Editor › New query**, paste the whole of `supabase-setup.sql`, press **Run**.
   It should say *Success*.
3. Open **Project Settings › API**. Copy the **Project URL** and the **anon public** key.
4. Open `assets/config.js` in your repo, paste both values in, and commit the change:

   ```js
   const CONFIG = {
     url: "https://abcdefgh.supabase.co",
     anonKey: "eyJhbGciOi..."
   };
   ```

That's it. The anon key is designed to be public — it is in every page that uses Supabase.
The database holds nothing but nicknames and scores.

---

## Running a game

1. On the classroom projector, open **`host.html`** (`https://YOUR-NAME.github.io/dish-dash/host.html`).
   Bookmark it.
2. Click **Start a new game**. The screen shows a PIN, a QR code and the student link.
3. Students open the link (or scan the code), type the PIN and their name. Their names
   appear on your screen as they join.
4. Pick the time per dish — 45, 60, 90 or 120 seconds — then **Start the game**.
5. For each dish: the class answers, you watch the *"12 of 28 answered"* counter, then
   **Show the answers**. The correct ticks light up, the scoreboard appears, and
   **Next dish** moves on.
6. After the last dish you get the final scores. **Play again with the same PIN** starts
   a fresh round; students reload once and keep their names.

During a round you can change the clock, or add 15 seconds, without losing anybody's
ticked answers. Every student's countdown follows instantly.

---

## Changing the quiz

Everything students see lives in **`assets/dishes.js`**. One dish looks like this:

```js
{ name:"Beef tacos", photo:"assets/photos/tacos.jpg",
  origin:["Mexican"],   originWrong:["Thai","Japanese","French"],
  ingr:["beef","tortilla","tomatoes","lettuce"], ingrWrong:["mango","rice paper","noodles"],
  type:["Main dish"],   typeWrong:["Appetizer","Side dish","Dessert"],
  prep:["fried"],       prepWrong:["steamed","chilled","pickled"] }
```

The `...Wrong` lists are the distractors. To add a dish, drop a square photo into
`assets/photos/` and copy one of these blocks. To cut a dish, delete its block. The
scoring adjusts itself — each dish is always worth up to 1000 points no matter how many
answers it has.

Only put answers in the correct lists that are genuinely visible in the photo. Wrong
ticks cost points, and students should never be punished for something the picture
doesn't show.

---

## If something goes wrong

**"Nearly there" on both pages** — `assets/config.js` still has the placeholder values.
Paste your real Supabase URL and anon key.

**"Could not start a game"** — the SQL in step 2 hasn't run, or ran with an error.
Open the SQL editor and run `supabase-setup.sql` again; it is safe to run twice.

**Scores appear slowly, a second or two late** — realtime isn't switched on for the
tables. The last two lines of `supabase-setup.sql` do that. The game still works
regardless: every screen also refreshes itself every 2.5 seconds as a safety net.

**A student's phone shows "No game with that PIN"** — check they typed the four digits
on the board, and that you haven't started a second game since (a new PIN replaces the
old one on your screen).

---

## Files

| File | What it is |
|---|---|
| `index.html` | the student page — join and play |
| `host.html` | the teacher screen — PIN, QR, controls |
| `assets/game.js` | all the game logic, shared by both pages |
| `assets/dishes.js` | the dishes, answers and distractors — edit this to change the quiz |
| `assets/config.js` | your Supabase URL and anon key |
| `assets/style.css` | the look |
| `assets/photos/` | the five dish photos |
| `supabase-setup.sql` | database tables, permissions and realtime |
