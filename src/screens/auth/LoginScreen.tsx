import React, { useState } from "react";
import {
    SafeAreaView,
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
} from "react-native";
import api, { CURRENT_HOST, setCustomHost } from "../../services/api";
import { saveAuthData, UserSession } from "../../services/storage";

interface Props {
    onLoginSuccess: (user: UserSession) => void;
}

export default function LoginScreen({ onLoginSuccess }: Props) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [serverHost, setServerHost] = useState(CURRENT_HOST);
    const [showServerConfig, setShowServerConfig] = useState(false);

    const handleLogin = async (customEmail?: string, customPass?: string) => {
        const loginEmail = (customEmail || email).trim();
        const loginPassword = customPass || password;

        if (!loginEmail || !loginPassword) {
            Alert.alert("माहिती भरा", "कृपया ईमेल आणि पासवर्ड टाका");
            return;
        }

        try {
            setLoading(true);
            setCustomHost(serverHost.trim());

            const response = await api.post("/auth/login", {
                email: loginEmail,
                password: loginPassword,
            });

            const { token, user } = response.data;
            await saveAuthData(token, user);

            Alert.alert(
                "लॉगिन यशस्वी! ✅",
                `स्वागत आहे, ${user.name} (${user.role === "admin" ? "केंद्रीय ॲडमिन" : user.franchise_name})`
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

    const handleQuickLogin = (roleEmail: string, rolePass: string) => {
        setEmail(roleEmail);
        setPassword(rolePass);
        handleLogin(roleEmail, rolePass);
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>🛒 MART SUPPLY & ORDER</Text>
                        </View>
                        <Text style={styles.title}>मार्ट फ्रँचायझी सिस्टीम</Text>
                        <Text style={styles.subtitle}>
                            दैनिक मटेरियल मागणी आणि बिल व्यवस्थापन
                        </Text>
                    </View>

                    {/* Quick Login Chips for Ease of Testing */}
                    <View style={styles.quickLoginCard}>
                        <Text style={styles.quickLoginTitle}>
                            ⚡ १-क्लिक टेस्ट लॉगिन (Quick Login):
                        </Text>
                        <View style={styles.chipsRow}>
                            <TouchableOpacity
                                style={[styles.chip, styles.chipBranch]}
                                onPress={() => handleQuickLogin("branch1@mart.com", "branch123")}
                                disabled={loading}
                            >
                                <Text style={styles.chipText}>शाखा १ (Shivaji Nagar)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.chip, styles.chipBranch]}
                                onPress={() => handleQuickLogin("branch2@mart.com", "branch123")}
                                disabled={loading}
                            >
                                <Text style={styles.chipText}>शाखा २ (Kothrud)</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.chipsRow}>
                            <TouchableOpacity
                                style={[styles.chip, styles.chipBranch]}
                                onPress={() => handleQuickLogin("branch3@mart.com", "branch123")}
                                disabled={loading}
                            >
                                <Text style={styles.chipText}>शाखा ३ (Hadapsar)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.chip, styles.chipBranch]}
                                onPress={() => handleQuickLogin("branch4@mart.com", "branch123")}
                                disabled={loading}
                            >
                                <Text style={styles.chipText}>शाखा ४ (Wakad)</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[styles.chip, styles.chipAdmin]}
                            onPress={() => handleQuickLogin("admin@mart.com", "admin123")}
                            disabled={loading}
                        >
                            <Text style={styles.chipAdminText}>👑 मुख्य ॲडमिन (Central Admin)</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Form Card */}
                    <View style={styles.card}>
                        <Text style={styles.cardHeader}>ईमेलद्वारे लॉगिन करा</Text>

                        <Text style={styles.label}>ईमेल (Email ID)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="उदा. branch1@mart.com किंवा admin@mart.com"
                            placeholderTextColor="#94A3B8"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />

                        <Text style={styles.label}>पासवर्ड (Password)</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="तुमचा पासवर्ड टाका"
                                placeholderTextColor="#94A3B8"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
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

                    {/* Server Configuration Toggle */}
                    <TouchableOpacity
                        style={styles.serverToggle}
                        onPress={() => setShowServerConfig(!showServerConfig)}
                    >
                        <Text style={styles.serverToggleText}>
                            ⚙️ सर्व्हर IP सेटिंग ({serverHost})
                        </Text>
                    </TouchableOpacity>

                    {showServerConfig && (
                        <View style={styles.serverCard}>
                            <Text style={styles.serverLabel}>
                                सर्व्हर होस्ट (Emulator साठी 10.0.2.2:5001 / Wi-Fi मोबाईलसाठी तुमचा संगणकाचा IP:5001):
                            </Text>
                            <TextInput
                                style={styles.serverInput}
                                value={serverHost}
                                onChangeText={setServerHost}
                                placeholder="10.0.2.2:5001"
                                placeholderTextColor="#94A3B8"
                            />
                        </View>
                    )}
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
        marginBottom: 24,
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
    quickLoginCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        elevation: 2,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 6,
    },
    quickLoginTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#334155",
        marginBottom: 12,
    },
    chipsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 10,
        gap: 8,
    },
    chip: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    chipBranch: {
        backgroundColor: "#F0FDF4",
        borderWidth: 1,
        borderColor: "#BBF7D0",
    },
    chipText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#166534",
    },
    chipAdmin: {
        backgroundColor: "#EFF6FF",
        borderWidth: 1,
        borderColor: "#BFDBFE",
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 2,
    },
    chipAdminText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1D4ED8",
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
    serverToggle: {
        alignItems: "center",
        marginTop: 20,
    },
    serverToggleText: {
        color: "#64748B",
        fontSize: 12,
        textDecorationLine: "underline",
    },
    serverCard: {
        backgroundColor: "#F1F5F9",
        padding: 12,
        borderRadius: 10,
        marginTop: 10,
    },
    serverLabel: {
        fontSize: 11,
        color: "#475569",
        marginBottom: 6,
    },
    serverInput: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 13,
        color: "#0F172A",
    },
});
