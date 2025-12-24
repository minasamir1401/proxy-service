# Proxy Service for Meih Movies API

This is a Node.js proxy service designed to bypass anti-bot measures when scraping content from Arabic streaming sites. It's part of the Meih Movies API backend infrastructure.

## Features

- **Anti-bot Bypass**: Uses advanced stealth headers to mimic real browser requests
- **Multiple Fallbacks**: Implements several strategies to bypass different types of protections
- **Performance Optimized**: Uses undici for efficient HTTP requests
- **Retry Logic**: Automatically retries failed requests with different configurations

## Installation

1. Clone the repository:
```bash
git clone https://github.com/minasamir1401/proxy-service.git
```

2. Install dependencies:
```bash
npm install
```

## Configuration

The proxy service can be configured using environment variables:

- `PORT`: Port to run the proxy service on (default: 3001)

## Usage

Start the proxy service:

```bash
npm start
```

Or run in development mode:

```bash
npm run dev
```

## API Endpoints

- `POST /fetch` - Main endpoint for making proxied requests
- `GET /health` - Health check endpoint

### Fetch Endpoint

```bash
curl -X POST http://localhost:3001/fetch \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "timeout": 20000}'
```

### Request Format

```json
{
  "url": "https://example.com",
  "timeout": 20000
}
```

### Response Format

```json
{
  "status": 200,
  "html": "HTML content",
  "headers": {}
}
```

## Integration with Meih Movies API

This proxy service is designed to work with the Meih Movies API backend. Set the `NODE_PROXY_URL` environment variable in the main backend to point to this proxy service.

## Architecture

This proxy service is part of a larger architecture that includes:
- Main backend API (FastAPI/Python) - https://github.com/minasamir1401/meih-movies-api
- Frontend application - https://github.com/minasamir1401/meih-netflix-clone
- This proxy service for anti-bot bypass

## Deployment

The proxy service can be deployed to platforms like Render, Heroku, or any Node.js hosting provider. For serverless deployment, see the Vercel proxy alternative in the main repository.

## License

MIT