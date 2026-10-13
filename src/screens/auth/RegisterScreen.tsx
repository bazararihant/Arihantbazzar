
import React, { useState } from "react";
import {
    SafeAreaView,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ImageBackground,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import api from "../../services/api";

function RegisterScreen({
    onRegistrationSuccess,
}: {
    onRegistrationSuccess: () => void;
}) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!name.trim() || !email.trim() || !password.trim()) {
            Alert.alert("Missing Information", "Please fill all fields");
            return;
        }

        try {
            setLoading(true);

            const response = await api.post("/auth/register", {
                name: name.trim(),
                email: email.trim(),
                password,
            });

            console.log("REGISTER RESPONSE:", response.data);

            Alert.alert(
                "Account Created",
                "Your shop owner account has been created successfully!",
                [
                    {
                        text: "Continue",
                        onPress: onRegistrationSuccess,
                    },
                ]
            );

            setName("");
            setEmail("");
            setPassword("");
        } catch (error: any) {
            console.error(
                "REGISTER ERROR:",
                error?.response?.data
            );

            Alert.alert(
                "Registration Failed",
                error?.response?.data?.message ||
                    "Something went wrong"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <ImageBackground
            source={require("../../assets/images/automotive-bg.jpg")}
            style={styles.background}
            resizeMode="cover"
        >
            <View style={styles.overlay}>
                <SafeAreaView style={styles.container}>
                    <KeyboardAvoidingView
                        style={styles.keyboardView}
                        behavior={
                            Platform.OS === "ios"
                                ? "padding"
                                : undefined
                        }
                    >
                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.header}>
                                <View style={styles.logoCircle}>
                                    <Text style={styles.logoText}>
                                        A
                                    </Text>
                                </View>

                                <Text style={styles.brandName}>
                                    AUTOCARE
                                </Text>

                                <Text style={styles.brandSubtitle}>
                                    SHOP MANAGEMENT
                                </Text>
                            </View>

                            <View style={styles.card}>
                                <Text style={styles.title}>
                                    Create Account
                                </Text>

                                <Text style={styles.subtitle}>
                                    Set up your shop owner account
                                </Text>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputIcon}>
                                        👤
                                    </Text>

                                    <TextInput
                                        style={styles.input}
                                        placeholder="Full Name"
                                        placeholderTextColor="#8A8A8A"
                                        value={name}
                                        onChangeText={setName}
                                        autoCapitalize="words"
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputIcon}>
                                        ✉
                                    </Text>

                                    <TextInput
                                        style={styles.input}
                                        placeholder="Email Address"
                                        placeholderTextColor="#8A8A8A"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        value={email}
                                        onChangeText={setEmail}
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputIcon}>
                                        🔒
                                    </Text>

                                    <TextInput
                                        style={styles.input}
                                        placeholder="Password"
                                        placeholderTextColor="#8A8A8A"
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                    />

                                    <TouchableOpacity
                                        onPress={() =>
                                            setShowPassword(
                                                !showPassword
                                            )
                                        }
                                        style={styles.eyeButton}
                                    >
                                        <Text style={styles.eyeText}>
                                            {showPassword ? "🙈" : "👁"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    style={[
                                        styles.button,
                                        loading &&
                                            styles.buttonDisabled,
                                    ]}
                                    onPress={handleRegister}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator
                                            size="small"
                                            color="#111111"
                                        />
                                    ) : (
                                        <Text style={styles.buttonText}>
                                            CREATE ACCOUNT
                                        </Text>
                                    )}
                                </TouchableOpacity>

                                <View style={styles.dividerRow}>
                                    <View style={styles.divider} />

                                    <Text style={styles.dividerText}>
                                        SHOP OWNER
                                    </Text>

                                    <View style={styles.divider} />
                                </View>

                                <TouchableOpacity
                                    onPress={onRegistrationSuccess}
                                    disabled={loading}
                                >
                                    <Text style={styles.loginText}>
                                        Already have an account?{" "}
                                        <Text style={styles.loginLink}>
                                            Login
                                        </Text>
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.footerText}>
                                Manage your automotive business smarter
                            </Text>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
    },

    overlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.62)",
    },

    container: {
        flex: 1,
    },

    keyboardView: {
        flex: 1,
    },

    scrollContent: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 22,
        paddingVertical: 35,
    },

    header: {
        alignItems: "center",
        marginBottom: 24,
    },

    logoCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: "#DFFF00",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 10,
    },

    logoText: {
        fontSize: 30,
        fontWeight: "900",
        color: "#111111",
    },

    brandName: {
        color: "#FFFFFF",
        fontSize: 24,
        fontWeight: "900",
        letterSpacing: 3,
    },

    brandSubtitle: {
        color: "#DFFF00",
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 2,
        marginTop: 3,
    },

    card: {
        backgroundColor: "rgba(255, 255, 255, 0.97)",
        borderRadius: 24,
        padding: 24,
        shadowColor: "#000000",
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },

    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#111111",
        marginBottom: 7,
    },

    subtitle: {
        fontSize: 14,
        color: "#666666",
        marginBottom: 24,
    },

    inputContainer: {
        height: 56,
        borderWidth: 1,
        borderColor: "#E1E1E1",
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        marginBottom: 14,
        backgroundColor: "#F8F8F8",
    },

    inputIcon: {
        fontSize: 18,
        width: 30,
        textAlign: "center",
    },

    input: {
        flex: 1,
        fontSize: 15,
        color: "#111111",
        paddingVertical: 0,
    },

    eyeButton: {
        padding: 6,
    },

    eyeText: {
        fontSize: 18,
    },

    button: {
        height: 56,
        backgroundColor: "#DFFF00",
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 6,
    },

    buttonDisabled: {
        opacity: 0.7,
    },

    buttonText: {
        fontSize: 15,
        fontWeight: "900",
        color: "#111111",
        letterSpacing: 0.8,
    },

    dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 22,
    },

    divider: {
        flex: 1,
        height: 1,
        backgroundColor: "#E5E5E5",
    },

    dividerText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#999999",
        marginHorizontal: 10,
        letterSpacing: 1,
    },

    loginText: {
        textAlign: "center",
        fontSize: 14,
        color: "#666666",
    },

    loginLink: {
        color: "#111111",
        fontWeight: "800",
    },

    footerText: {
        color: "#FFFFFF",
        textAlign: "center",
        fontSize: 12,
        marginTop: 22,
        opacity: 0.8,
    },
});

export default RegisterScreen;

