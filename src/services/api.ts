import axios from "axios";
import { getToken, clearAuthData } from "./storage";

// Default backend host on Vercel
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
    // For relative paths like /uploads/bill-xxx.jpg
    const cleanPath = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
    return `https://${CURRENT_HOST}${cleanPath}`;
};

// Global session expired callback
let onUnauthorizedCallback: (() => void) | null = null;

export const setOnUnauthorizedCallback = (callback: () => void) => {
    onUnauthorizedCallback = callback;
};

const api = axios.create({
    baseURL: `https://${CURRENT_HOST}/api`,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 30000,
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

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && error.response.status === 401) {
            console.warn("[API Interceptor] 401 Unauthorized detected - Token Expired or Invalid");
            await clearAuthData();
            if (onUnauthorizedCallback) {
                onUnauthorizedCallback();
            }
        }
        return Promise.reject(error);
    }
);

export default api;
