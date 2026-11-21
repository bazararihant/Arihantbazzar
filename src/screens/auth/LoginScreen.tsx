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
    useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../services/api";
import { saveAuthData, UserSession } from "../../services/storage";

interface Props {
    onLoginSuccess: (user: UserSession) => void;
}

export default function LoginScreen({ onLoginSuccess }: Props) {
    const insets = useSafeAreaInsets();
    const { height, width } = useWindowDimensions();

    // Responsive sizing for smaller budget phones like Redmi 8, Moto E3 (height < 750dp)
    const isSmallScreen = height < 750;

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
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            flexGrow: 1,
                            justifyContent: isSmallScreen ? "flex-start" : "center",
                            paddingTop: isSmallScreen ? 12 : 24,
                            paddingBottom: Math.max(insets.bottom + 80, 100),
                        },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                >
                    {/* Header */}
                    <View style={[styles.header, isSmallScreen && { marginBottom: 12 }]}>
                        <Image
                            source={require("../../assets/images/logo.png")}
                            style={[
                                styles.logoImage,
                                isSmallScreen ? { width: 64, height: 64, marginBottom: 8 } : { width: 84, height: 84, marginBottom: 10 },
                            ]}
                            resizeMode="contain"
                        />
                        <View style={[styles.badge, isSmallScreen && { paddingVertical: 4, paddingHorizontal: 10, marginBottom: 6 }]}>
                            <Text style={[styles.badgeText, isSmallScreen && { fontSize: 11 }]}>🛒 ARIHANT BAZAR</Text>
                        </View>
                        <Text style={[styles.title, isSmallScreen && { fontSize: 20, marginBottom: 3 }]}>
                            अरिहंत बाजार (भिलवडी, सांगली)
                        </Text>
                        <Text style={[styles.subtitle, isSmallScreen && { fontSize: 12 }]}>
                            दैनिक मटेरियल मागणी आणि हिशोब व्यवस्थापन
                        </Text>
                    </View>

                    {/* Form Card */}
                    <View style={[styles.card, isSmallScreen && { padding: 16 }]}>
                        <Text style={[styles.cardHeader, isSmallScreen && { fontSize: 15, marginBottom: 12 }]}>
                            लॉगिन करा
                        </Text>

                        <Text style={styles.label}>
                            वापरकर्ता नाव किंवा मोबाईल (Username / Mobile)
                        </Text>
                        <TextInput
                            style={[styles.input, isSmallScreen && { paddingVertical: 10, fontSize: 13 }]}
                            placeholder="उदा. amit, bagesh किंवा मोबाईल नंबर"
                            placeholderTextColor="#94A3B8"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <Text style={[styles.label, { marginBottom: 0 }]}>
                                पासवर्ड (Password / Mobile)
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Text style={styles.toggleVisibilityLink}>
                                    {showPassword ? "🙈 पासवर्ड लपवा" : "👁️ पासवर्ड पहा"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.passwordContainer, isSmallScreen && { marginBottom: 16 }]}>
                            <TextInput
                                style={[styles.passwordInput, isSmallScreen && { paddingVertical: 10, fontSize: 13 }]}
                                placeholder="तुमचा पासवर्ड किंवा मोबाईल नंबर टाका"
                                placeholderTextColor="#94A3B8"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                textContentType="password"
                                selectionColor="#16A34A"
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={[styles.eyeButton, isSmallScreen && { paddingVertical: 10, paddingHorizontal: 10 }]}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.eyeText}>
                                    {showPassword ? "🙈 लपवा" : "👁️ पहा"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Helper Hint */}
                        <Text style={styles.hintText}>
                            💡 टीप: पासवर्ड टाईप करताना पाहण्यासाठी उजवीकडील "👁️ पहा" बटनावर टॅप करा.
                        </Text>

                        <TouchableOpacity
                            style={[styles.loginButton, isSmallScreen && { paddingVertical: 12, marginTop: 8 }]}
                            onPress={() => handleLogin()}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={[styles.loginButtonText, isSmallScreen && { fontSize: 14 }]}>
                                    लॉगिन करा (LOGIN) ➔
                                </Text>
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
        paddingHorizontal: 18,
    },
    header: {
        alignItems: "center",
        marginBottom: 16,
    },
    logoImage: {
        borderRadius: 16,
    },
    badge: {
        backgroundColor: "#DCFCE7",
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        marginBottom: 8,
    },
    badgeText: {
        color: "#15803D",
        fontWeight: "800",
        fontSize: 12,
        letterSpacing: 0.5,
    },
    title: {
        fontSize: 24,
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 4,
        textAlign: "center",
    },
    subtitle: {
        fontSize: 13,
        color: "#64748B",
        textAlign: "center",
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
    },
    cardHeader: {
        fontSize: 17,
        fontWeight: "800",
        color: "#1E293B",
        marginBottom: 14,
    },
    label: {
        fontSize: 12,
        fontWeight: "700",
        color: "#334155",
        marginBottom: 6,
    },
    toggleVisibilityLink: {
        fontSize: 12,
        fontWeight: "700",
        color: "#16A34A",
    },
    input: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1.5,
        borderColor: "#CBD5E1",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: "#0F172A",
        marginBottom: 14,
    },
    passwordContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1.5,
        borderColor: "#CBD5E1",
        borderRadius: 10,
        marginBottom: 8,
    },
    passwordInput: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: "#0F172A",
    },
    eyeButton: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: "#F1F5F9",
        borderTopRightRadius: 9,
        borderBottomRightRadius: 9,
    },
    eyeText: {
        color: "#0F172A",
        fontWeight: "700",
        fontSize: 12,
    },
    hintText: {
        fontSize: 11,
        color: "#64748B",
        marginBottom: 14,
        fontStyle: "italic",
    },
    loginButton: {
        backgroundColor: "#16A34A",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        elevation: 2,
        shadowColor: "#16A34A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    loginButtonText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "800",
        letterSpacing: 0.5,
    },
});
