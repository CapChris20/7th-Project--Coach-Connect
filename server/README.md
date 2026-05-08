# CoachConnect Server

Express server for GPT with web search capabilities using Serper API.

## Environment Variables

Required:
- `SERPER_API_KEY` - Your Serper API key for web search
- `OPENAI_API_KEY` - Your OpenAI API key (optional, can be passed via header)

Optional:
- `PORT` - Server port (default: 4000)

## Deployment

### Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Add environment variables:
   - `SERPER_API_KEY`
   - `OPENAI_API_KEY` (optional)
5. Set root directory to `server/`
6. Deploy!

### Render

1. Go to [render.com](https://render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repo
4. Settings:
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && npm start`
   - Environment: Node
5. Add environment variables:
   - `SERPER_API_KEY`
   - `OPENAI_API_KEY` (optional)
6. Deploy!

## Local Development

```bash
cd server
npm install
npm start
```









