import axios from "axios";

export const api = axios.create({
  baseURL: "${BASE_URL}/api/UIHis", // from swagger
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});
