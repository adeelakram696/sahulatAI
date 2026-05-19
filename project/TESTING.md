# Testing & Demo Guide

This guide explains how to walk through the complete **SahuliatAI** core loop using the pre-seeded demo accounts. 

## 1. Starting the Application
Make sure your environment variables are configured correctly in `.env.local` and your database is running.

Start the development server:
```bash
pnpm dev
```
Navigate to `http://localhost:3000` (or the port defined in your `.env.local`).

---

## 2. Pre-Seeded Accounts
The database seeding script provisions three main test accounts to help you experience the product from both sides of the marketplace:

| Role | Name | Email | Password | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | Ayesha | `ayesha@example.com` | `Demo!1234` | The person requesting a service. |
| **Provider** | Ali AC Services | `ali@example.com` | `Demo!1234` | A service provider (AC Repair). |
| **Provider** | Bright Tutors | `tutor@example.com` | `Demo!1234` | A service provider (Tutoring). |

---

## 3. Recommended Test Flow (Two-Browser Approach)

To fully test the real-time communication and booking flow, it is highly recommended to use **two different browsers** (e.g., Chrome and Safari) or an Incognito window alongside your normal window.

### Step A: Log in as the Customer (Browser 1)
1. In your first browser, go to `http://localhost:3000/auth/signin`.
2. Sign in as the **Customer**:
   - Email: `ayesha@example.com`
   - Password: `Demo!1234`
3. **Onboarding / GPS Test:** If prompted, use the location onboarding screen to drop a pin using the "Use My Current GPS Location" button.
4. **Chat & Search Test:** Go to the AI Chat (`/chat`). Type a prompt like:
   - *"My AC is leaking water inside my room, can you help?"*
5. The conversational AI should recognize the AC repair intent, query Google Places based on your GPS pin, and suggest nearby AC repair services.
6. Look for "Ali AC Services" in the results and initiate a booking request.

### Step B: Log in as the Provider (Browser 2)
1. In your second browser (or incognito window), go to `http://localhost:3000/auth/signin`.
2. Sign in as the **Provider**:
   - Email: `ali@example.com`
   - Password: `Demo!1234`
3. Navigate to the **Provider Dashboard** (e.g., `/provider/dashboard`).
4. You should see the incoming booking request from "Ayesha".
5. **Accept the Booking:** Click accept to trigger the real-time status update.

### Step C: Verify Real-Time Sync
1. Switch back to **Browser 1** (Customer). 
2. The UI should instantly reflect that the provider has accepted the job without requiring a page refresh.
3. You can now test the trace logs or completion flow!

---

## 4. Troubleshooting
- **No Google Places Results?** Ensure your `GOOGLE_MAPS_SERVER_KEY` is valid and the "Places API (New)" and "Geocoding API" are enabled in the Google Cloud Console.
- **AI Not Responding?** Check that `GOOGLE_GEMINI_API_KEY` is set correctly.
- **No Push Notifications?** Make sure you have allowed notification permissions in your browser. (Note: standard HTTP localhost may block notifications in some browsers; use `http://127.0.0.1` or set up HTTPS if necessary).
- **No Users in DB?** If you reset the database, run `pnpm db:seed` to repopulate these accounts.
