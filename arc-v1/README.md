# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Multi-Character Conversation System

### Latency Budgets
- **First Meaningful Token**: < 2s (95th percentile).
- **Voice Playback**: Starts within 4s of user finishing speech.
- **Thinking Indicator**: Appears within 300ms of user input.
- **Latency Timer**: A visible countdown appears if response time exceeds 3s.

### Retry Policy
- **Exponential Backoff**:
  - Max Attempts: 3
  - Initial Delay: 500ms
  - Multiplier: 2x
- **Timeouts**: 5s per request.
- **Fallbacks**: Gemini -> Groq -> Graceful Persona Message.

### Voice Pipeline
- **TTS Caching**: Audio is cached based on a hash of the persona and text content.
- **Streaming**: STT chunks are processed every 100ms.
- **TTS Fallback**: If generation exceeds 3s, a "please wait" audio prompt is played from cache.

### Observability & Metrics
Metrics are exported locally and can be adapted for Prometheus:
- `conversation_latency_ms`: Measured for every AI response.
- `brain_response_errors_total`: Total count of failed backend requests.
- `tts_fallback_count`: Count of times the "please wait" fallback was triggered.
- **Alerting**: System alerts if error rate exceeds 5% over a 2-minute window.

### Testing
- **Unit Tests**: Run `npm test` to verify routing, retry, and caching logic.
- **Load Tests**: Use the provided `load-test.js` with k6: `k6 run load-test.js`.
