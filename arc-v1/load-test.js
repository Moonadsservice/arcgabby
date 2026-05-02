import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:5173'; // Assuming a proxy or direct API access

export default function () {
  const payload = JSON.stringify({
    messages: [
      { role: 'user', content: 'Gabby, what do you think about the weather?' }
    ],
    persona: 'Gabby'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/api/ai`, payload, params);

  check(res, {
    'is status 200': (r) => r.status === 200,
    'correct persona response': (r) => {
      const body = r.json();
      // This is a placeholder for actual persona validation logic
      // In a real scenario, you'd check if the response is from Gabby
      return body && !body.content.toLowerCase().includes('jenny');
    },
  });

  sleep(1);
}
