import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../services/api";
import { saveAuthData, UserSession } from "../../services/storage";

interface Props {
    onLoginSuccess: (user: UserSession) => void;
}

export default function LoginScreen({ onLoginSuccess }: Props) {
    const insets = useSafeAreaInsets();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        const loginIdentifier = email.trim();
        const loginPassword = password.trim();

        if (!loginIdentifier || !loginPassword) {
            Alert.alert("माहिती भरा", "कृपया वापरकर्ता नाव/मोबाईल आणि पासवर्ड टाका");
            return;
        }

        try {
            setLoading(true);

            const response = await api.post("/auth/login", {
                username: loginIdentifier,
                email: loginIdentifier,
                password: loginPassword,
            });

            const { token, user } = response.data;
            await saveAuthData(token, user);

            const roleText =
                user.role === "admin"
                    ? "मुख्य ॲडमिन"
                    : user.role === "sub_admin"
                    ? "सब-ॲडमिन / व्यवस्थापक"
                    : user.role === "worker"
                    ? "कर्मचारी (Worker)"
                    : user.franchise_name || "भिलवडी शाखा";

            Alert.alert(
                "लॉगिन यशस्वी! ✅",
                `स्वागत आहे, ${user.name} (${roleText})`
            );

            onLoginSuccess(user);
        } catch (error: any) {
            console.error("Login Error:", error);
            const msg =
                error?.response?.data?.message ||
                error?.message ||
                "सर्व्हरशी संपर्क होऊ शकला नाही. सर्व्हर चालू असल्याची खात्री करा.";
            Alert.alert("लॉगिन अयशस्वी", msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]} edges={["top", "bottom"]}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 20, 32) }]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Image
                            source={require("../../assets/images/logo.png")}
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>🛒 ARIHANT BAZAR</Text>
                        </View>
                        <Text style={styles.title}>अरिहंत बाजार (भिलवडी, सांगली)</Text>
                        <Text style={styles.subtitle}>
                            दैनिक मटेरियल मागणी आणि हिशोब व्यवस्थापन
                        </Text>
                    </View>

                    {/* Form Card */}
                    <View style={styles.card}>
                        <Text style={styles.cardHeader}>लॉगिन करा</Text>

                        <Text style={styles.label}>वापरकर्ता नाव किंवा मोबाईल (Username / Mobile)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="उदा. amit, bagesh किंवा मोबाईल नंबर"
                            placeholderTextColor="#94A3B8"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                        />

                        <Text style={styles.label}>पासवर्ड (Password / Mobile)</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="तुमचा मोबाईल नंबर टाका"
                                placeholderTextColor="#94A3B8"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                keyboardType="phone-pad"
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeButton}
                            >
                                <Text style={styles.eyeText}>
                                    {showPassword ? "लपवा" : "पहा"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.loginButton}
                            onPress={() => handleLogin()}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.loginButtonText}>लॉगिन करा (LOGIN)</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 40,
    },
    header: {
        alignItems: "center",
        marginBottom: 20,
    },
    logoImage: {
        width: 100,
        height: 100,
        marginBottom: 12,
        borderRadius: 20,
    },
    badge: {
        backgroundColor: "#DCFCE7",
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 10,
    },
    badgeText: {
        color: "#15803D",
        fontWeight: "700",
        fontSize: 12,
        letterSpacing: 0.5,
    },
    title: {
        fontSize: 26,
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        color: "#64748B",
        textAlign: "center",
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        elevation: 2,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    cardHeader: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1E293B",
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: "600",
        color: "#475569",
        marginBottom: 6,
    },
    input: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: "#0F172A",
        marginBottom: 16,
    },
    passwordContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 10,
        marginBottom: 20,
    },
    passwordInput: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: "#0F172A",
    },
    eyeButton: {
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    eyeText: {
        color: "#16A34A",
        fontWeight: "600",
        fontSize: 12,
    },
    loginButton: {
        backgroundColor: "#16A34A",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        elevation: 2,
    },
    loginButtonText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
});
