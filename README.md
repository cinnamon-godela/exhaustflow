<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1VgcBSDNARH2lHLckK5BJafBJmXMvrBjc

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key (optional, for chat).
3. **Chiller temperatures from the model (optional):**  
   The chiller prediction API is **hosted on AWS**. Set `VITE_CHILLER_API_URL` in `.env` to your AWS API base URL (e.g. `https://xxxxxx.execute-api.us-east-1.amazonaws.com/prod`) with no trailing slash. The app will call `POST {url}/predict` and `GET {url}/health`.  
   Leave unset or empty to use Supabase for temperatures instead.
4. Run the app: `npm run dev`
