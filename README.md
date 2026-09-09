# NFL Pick'em App

A free, friends-only NFL weekly pick'em application built with Next.js 14, TypeScript, and Vercel Postgres.

## Features

- **6 Fixed Users**: Victor, Mihir, Dakota, Chris, Ryan, Jihoo
- **Lightweight Authentication**: Name selection + shared league passcode
- **Weekly Picks**: Submit picks for all NFL games in a week
- **Time Lock**: Picks lock every Thursday 8:00 PM ET
- **All-or-Nothing Scoring**: Score one point per lock if every lock hits, 0 if any misses
- **Automated Results & Odds**: Scores and betting lines pull from ESPN without manual entry
- **Pick Visibility**: See others' picks only after submitting your own
- **Auto Schedule**: ESPN API integration for automatic game loading
- **Manual Admin**: Fallback for manual result entry
- **Scoreboard**: Season totals and weekly breakdowns
- **Free Deployment**: Runs entirely on free tiers

## Tech Stack

- **Frontend/Backend**: Next.js 14 (App Router, TypeScript)
- **Database**: Vercel Postgres (free tier)
- **ORM**: Drizzle ORM
- **Styling**: Tailwind CSS
- **Authentication**: JWT with httpOnly cookies
- **Time Management**: Luxon
- **Hosting**: Vercel (free tier)
- **Cron Jobs**: Vercel Cron (free tier)

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd football-locks-project
npm install
```

### 2. Environment Setup

Copy `env.example` to `.env.local` and configure:

```bash
cp env.example .env.local
```

Required environment variables:
- `DATABASE_URL`: Vercel Postgres connection string
- `LEAGUE_PASSCODE`: Shared passcode for league access
- `JWT_SECRET`: Secret key for JWT tokens
- `ADMIN_PASSCODE`: Admin passcode for manual results
- `CRON_SECRET`: Secret for cron job authentication

### 3. Database Setup

```bash
# Generate and run migrations
npm run db:generate
npm run db:migrate
```

### 4. Development

```bash
npm run dev
```

Visit `http://localhost:3000` and log in with any of the 6 user names and the league passcode.

## Deployment

### 1. Vercel Setup

1. Push code to GitHub
2. Connect repository to Vercel
3. Add Vercel Postgres database
4. Configure environment variables in Vercel dashboard

### 2. Database Migration

```bash
# Deploy migrations
npm run db:migrate
```

### 3. Cron Jobs

Cron jobs are declared in `vercel.json` and deploy automatically. Vercel runs
them in **UTC**, and Hobby-plan jobs fire within the hour they are scheduled
for (a 7:00 PM job can run as late as 7:59 PM).

| Job | Expression | Eastern | Purpose |
| --- | --- | --- | --- |
| `/api/cron/fetch-schedule` | `0 13 * * 1` | Mon 9:00 AM | Refresh next week's kickoff times |
| `/api/cron/fetch-odds` | `0 23 * * 4` | Thu 7:00 PM | Snapshot the week's lines before picks lock at 8:00 PM |
| `/api/cron/resolve-results` | `0 8 * * *` | Daily 4:00 AM | Pull results and rescore the week |

All three require `Authorization: Bearer $CRON_SECRET`.

Eastern times shift an hour during standard time (Nov–Mar); every job still
lands well inside its window.

### Odds

One ESPN scoreboard request returns moneyline, spread and total for the whole
slate, so no betting API key is needed. The Thursday pull is stored as *the*
line for that week — a single row per game in `gameodds`, overwritten on each
run rather than kept as history.

### Results

Results land on their own. The nightly cron is the safety net, and the
scoreboard also calls `/api/results/refresh` when it loads, which pulls fresh
scores whenever a game has kicked off but has no result yet. Hobby crons cannot
run more than once a day, so that on-demand call is what keeps the board
current mid-slate. The admin page remains as a manual fallback.

## API Routes

### Authentication
- `POST /api/login` - User login
- `GET /api/me` - Get current user
- `POST /api/logout` - User logout

### NFL Data
- `GET /api/week` - Get current NFL week
- `GET /api/schedule` - Get games for a week

### Picks
- `POST /api/picks/submit` - Submit weekly picks
- `GET /api/picks/my` - Get user's picks
- `GET /api/picks/all` - Get all picks (after submission)

### Scoring
- `GET /api/scoreboard` - Get season scoreboard

### Admin
- `POST /api/admin/manual-results` - Update game results manually

### Results
- `POST /api/results/refresh` - Pull fresh results for the live week (used by the scoreboard)

### Cron Jobs
- `POST /api/cron/fetch-schedule` - Fetch next week's schedule
- `POST /api/cron/fetch-odds` - Snapshot this week's betting lines
- `POST /api/cron/resolve-results` - Update game results and scores

## Database Schema

### Users
- Fixed set of 6 users (Victor, Mihir, Dakota, Chris, Ryan, Jihoo)

### Games
- NFL games with ESPN event IDs
- Season, week, teams, start time, status, winner

### Picks
- User picks for each game
- One pick per user per game

### Weekly Scores
- Computed weekly scores
- All-or-nothing scoring system

### Game Odds
- Moneyline, spread and total per game
- One row per game, refreshed each Thursday before lock

## Scoring Rules

1. **All-or-Nothing**: If all your locks for a week hit, you score one point per lock
2. **Zero Points**: If any lock misses, you score 0 for that week
3. **Pick However Many You Like**: Lock any subset of the slate — more locks means more upside and more risk
4. **Ties Lose**: A lock only hits if the picked team wins
5. **No Partial Credit**: No points for partial weeks

## Time Management

- **Picks Window**: Monday 9:00 AM ET → Thursday 8:00 PM ET
- **Lock Time**: Thursday 8:00 PM ET (America/New_York timezone)
- **Schedule Fetch**: Mondays 9:00 AM ET
- **Results Update**: Daily 3:00 AM ET

## Security

- JWT tokens stored in httpOnly cookies
- Secure cookie settings in production
- Admin routes protected by passcode
- Cron jobs protected by secret headers
- No email/password required (friends-only)

## Free Tier Limits

- **Vercel**: 100GB bandwidth, 100 serverless function executions/day
- **Vercel Postgres**: 256MB storage, 100 connections
- **Vercel Cron**: 2 cron jobs, 1000 executions/month

## Troubleshooting

### ESPN API Issues
If ESPN API fails, use the admin panel to manually enter game results.

### Database Connection
Ensure `DATABASE_URL` is correctly set in Vercel environment variables.

### Cron Jobs Not Running
Check Vercel cron job configuration and ensure `CRON_SECRET` is set.

### Authentication Issues
Clear browser cookies and ensure `JWT_SECRET` is set.

## Contributing

This is a friends-only application, but feel free to fork for your own league!

## License

MIT License - feel free to use for your own projects.
