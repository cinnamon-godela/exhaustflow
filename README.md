
## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key (optional, for chat).
3. **Chiller temperatures from the model (optional):**  
   The chiller prediction API is **hosted on AWS**. Set `VITE_CHILLER_API_URL` in `.env` to your AWS API base URL (e.g. `https://xxxxxx.execute-api.us-east-1.amazonaws.com/prod`) with no trailing slash. The app will call `POST {url}/predict` and `GET {url}/health`.  
   Leave unset or empty to use Supabase for temperatures instead.
4. Run the app: `npm run dev`
