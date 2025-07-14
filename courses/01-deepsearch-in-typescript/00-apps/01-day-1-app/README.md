## TODO

Do related followup questions.

Handle anonymous requests to the API, rate limit by IP.

Use a chunking system on the crawled information.

Add 'edit' button, and 'rerun from here' button.

Add evals.

Handle conversations longer than the context window by summarizing.

How do you get the LLM to ask followup questions?

## Setup

1. Install dependencies with `pnpm`

```bash
pnpm install
```

2. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)

3. Run `./start-database.sh` to start the database.

4. Run `./start-redis.sh` to start the Redis server.

5. Set up Discord Authentication:

   a. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   b. Create a new application
   c. Go to the "OAuth2" section
   d. Copy your "Client ID" and "Client Secret"
   e. Add the following redirect URI: `http://localhost:3000/api/auth/callback/discord`
   f. Create a `.env` file in the root directory with the following variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# Redis
REDIS_URL="redis://localhost:6379"

# Authentication
AUTH_SECRET="your-auth-secret-here"
AUTH_DISCORD_ID="your-discord-client-id"
AUTH_DISCORD_SECRET="your-discord-client-secret"

# AI
GOOGLE_GENERATIVE_AI_API_KEY="your-google-ai-api-key"
```

6. Run the database migrations:

```bash
pnpm run db:push
```

7. Start the development server:

```bash
pnpm run dev
```
