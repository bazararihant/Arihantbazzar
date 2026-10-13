import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "mart_auth_token";
const USER_KEY = "mart_auth_user";

export interface UserSession {
    id: number;
    name: string;
    email: string;
    role: "admin" | "franchise";
    franchise_id?: number | null;
    franchise_name?: string | null;
    franchise_code?: string | null;
}

export const saveAuthData = async (token: string, user: UserSession) => {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getToken = async (): Promise<string | null> => {
    return await AsyncStorage.getItem(TOKEN_KEY);
};

export const getUser = async (): Promise<UserSession | null> => {
    const user = await AsyncStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
};

export const clearAuthData = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
};