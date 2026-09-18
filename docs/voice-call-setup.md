# Voice call setup (demo)

The chat window's call button places a real browser call through Twilio. Each
patient is deterministically mapped to one of the numbers in
`TWILIO_DEMO_NUMBERS`, so clicking Call on any patient rings one of your own
phones — never the fixture's fake number. Until the env vars below are set the
button renders disabled with a tooltip, and nothing else changes.

## One-time Twilio console setup (~10 minutes, free trial)

1. **Account** — sign up at twilio.com (or reuse the account behind the SMS
   adapter). Note the **Account SID** from the console home; you already have
   `TWILIO_ACCOUNT_SID` in `.env` if SMS is configured.
2. **Trial phone number** — Console → Phone Numbers → Manage → Active numbers.
   Trial accounts get one free number; this is the number your phone will see
   as the caller.
3. **API key** — Console → Account → API keys & tokens → Create API key
   (type: Standard). Copy the **SID** (`SKxxxx…`) into `TWILIO_API_KEY_SID`
   and the **Secret** into `TWILIO_API_KEY_SECRET` (shown only once).
4. **TwiML Bin** (this is why no public webhook or ngrok is needed) —
   Console → Developer tools → TwiML Bins → Create. Name it e.g.
   `browser-dial`, paste the following, replacing the caller ID with your
   trial number from step 2:

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <Response>
     <Dial callerId="+441234567890">
       <Number>{{To}}</Number>
     </Dial>
   </Response>
   ```

   `{{To}}` is filled from the parameter the browser passes when it starts the
   call.
5. **TwiML App** — Console → Voice → TwiML apps → Create new TwiML App.
   Name it e.g. `clinic-demo-voice`, set **Request URL** under Voice to the
   TwiML Bin URL from step 4 (method POST). Copy the app **SID** (`APxxxx…`)
   into `TWILIO_TWIML_APP_SID`.
6. **Verify your demo phones** — Console → Phone Numbers → Manage → Verified
   Caller IDs → Add. Verify each of the (up to 5 on trial) numbers you want
   calls routed to. Put them in `TWILIO_DEMO_NUMBERS` as comma-separated E.164
   numbers, e.g. `TWILIO_DEMO_NUMBERS=+447700900001,+447700900002,+447700900003`.
7. Restart the dev server so the new env vars load.

## Trial account realities

- Calls only connect to **verified** numbers (step 6) and only within your
  signup country.
- Your phone shows the call as coming from the Twilio trial number, and Twilio
  plays a short trial notice before connecting.
- Calls are capped at 10 minutes; the trial includes roughly 75 voice minutes
  in total. Upgrading the account removes all of this.

## How the pieces connect

Browser (Call button) → `getVoiceCallToken` server fn mints an AccessToken
(HS256 JWT signed with the API key secret, VoiceGrant pointing at the TwiML
App) → `@twilio/voice-sdk` `Device.connect({ params: { To } })` → Twilio runs
the TwiML Bin → `<Dial>` rings the pool number chosen by
`getVoiceCallTarget` for that patient. The attempt is logged to the patient's
comms trail via the existing `logCallAttempt`.
