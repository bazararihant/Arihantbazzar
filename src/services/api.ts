import axios from "axios";
import { getToken } from "./storage";

// Default host for Android Emulator accessing host PC is 10.0.2.2
// If running on a physical phone on the same Wi-Fi, change this to your machine's Wi-Fi IP (e.g., 192.168.1.10)
export let CURRENT_HOST = "arihantbazzar-smoky.vercel.app";

export const setCustomHost = (host: string) => {
    CURRENT_HOST = host;
    api.defaults.baseURL = `https://${host}/api`;
};

export const getBaseServerUrl = () => `https://${CURRENT_HOST}`;

export const getMediaUrl = (relativePath?: string | null) => {
    if (!relativePath) return null;
    if (
        relativePath.startsWith("data:") ||
        relativePath.startsWith("http://") ||
        relativePath.startsWith("https://")
    ) {
        return relativePath;
    }
    return `https://${CURRENT_HOST}${relativePath}`;
};

const api = axios.create({
    baseURL: `https://${CURRENT_HOST}/api`,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 15000,
});

api.interceptors.request.use(
    async (config) => {
        const token = await getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;