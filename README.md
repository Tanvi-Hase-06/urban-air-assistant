# Urban Air Quality Assistant

GenAI assistant for Indian families facing winter smog. Built for PromptWars Virtual, Challenge 06.

Live app: https://urban-air-quality-assistant.ai.studio

## What it does
- Live US AQI, PM2.5 and PM10 for any place in India (Open-Meteo), with source and timestamp
- "Use my location" (GPS), place search and a manual option
- Household profile (just me, children, seniors, breathing issues), commute type, mask and purifier
- One Gemini call returns a risk level, a yes/no for children playing outside, a morning/afternoon/evening plan, commute alternatives, indoor air actions, sustainable alternatives and approximate impact estimates
- English and Hinglish, offline sample data, retry and fallback if the AI is busy

## Tools
Google AI Studio (Build mode) with Gemini, Open-Meteo APIs, Vitest for tests.

## Limits
Air quality is a model estimate for a roughly 11 km grid. Impact numbers are approximate. This is not medical advice.

## Run locally
npm install, add GEMINI_API_KEY in .env.local, npm run dev. Tests: npm test
