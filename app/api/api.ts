import axios from 'axios';

export const api = axios.create({
  // baseURL: 'https://hortnet.hortharyana.gov.in/UIHortHar-API/api',
  baseURL: '${BASE_URL}/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});