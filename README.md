# NFL Pick'em App

A free, friends-only NFL weekly pick'em application built with Next.js 14, TypeScript, and Vercel Postgres.

## Features

- **6 Fixed Users**: Victor, Mihir, Dakota, Chris, Ryan, Jihoo
- **Lightweight Authentication**: Name selection + shared league passcode
- **Weekly Picks**: Submit picks for all NFL games in a week
- **Time Lock**: Picks lock every Thursday 8:00 PM ET
- **All-or-Nothing Scoring**: Get points equal to number of picks if all correct, 0 if any wrong
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

### 3. Cron Jobs Setup

In Vercel dashboard, add cron jobs:

**Fetch Schedule** (Mondays 9:00 AM ET):
```
0 9 * * 1
POST /api/cron/fetch-schedule
Headers: Authorization: Bearer YOUR_CRON_SECRET
```

**Resolve Results** (Daily 3:00 AM ET):
```
0 3 * * *
POST /api/cron/resolve-results
Headers: Authorization: Bearer YOUR_CRON_SECRET
```

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

### Cron Jobs
- `POST /api/cron/fetch-schedule` - Fetch next week's schedule
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

## Scoring Rules

1. **All-or-Nothing**: If all picks for a week are correct, get points equal to number of picks
2. **Zero Points**: If any pick is wrong, get 0 points for that week
3. **Complete Picks**: Must pick ALL games in a week to be eligible for points
4. **No Partial Credit**: No points for partial weeks

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
