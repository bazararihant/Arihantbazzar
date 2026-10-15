import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    TextInput,
    Alert,
    ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../services/api";

interface UserItem {
    id: number;
    name: string;
    username: string | null;
    phone: string | null;
    email: string;
    role: "admin" | "sub_admin" | "worker" | "franchise";
    franchise_name?: string | null;
    created_at?: string;
}

interface Props {
    visible: boolean;
    onClose: () => void;
}

export default function UserManagementModal({ visible, onClose }: Props) {
    const insets = useSafeAreaInsets();
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddMode, setIsAddMode] = useState(false);

    // Form state
    const [newName, setNewName] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [newRole, setNewRole] = useState<"worker" | "sub_admin">("sub_admin");
    const [saving, setSaving] = useState(false);

    const loadUsers = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get("/auth/users");
            setUsers(res.data.users || []);
        } catch (err: any) {
            console.error("Failed to load users:", err);
            Alert.alert("त्रुटी", err?.response?.data?.message || "वापरकर्त्यांची यादी लोड करता आली नाही");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            loadUsers();
            setIsAddMode(false);
        }
    }, [visible, loadUsers]);

    const handleCreateUser = async () => {
        const cleanName = newName.trim();
        const cleanPhone = newPhone.trim();

        if (!cleanName || !cleanPhone) {
            Alert.alert("माहिती भरा", "कृपया नाव आणि १० अंकी मोबाईल नंबर टाका.");
            return;
        }

        if (cleanPhone.length < 10) {
            Alert.alert("अवैध मोबाईल", "कृपया अचूक १० अंकी मोबाईल नंबर टाका (हाच युजरचा पासवर्ड असेल).");
            return;
        }

        try {
            setSaving(true);
            const res = await api.post("/auth/users", {
                name: cleanName,
                phone: cleanPhone,
                role: newRole,
            });

            Alert.alert(
                "यशस्वी! ✅",
                `नवीन युजर '${cleanName}' जोडला गेला!\n\nलॉगिन नाव: ${cleanName}\nपासवर्ड: ${cleanPhone}`
            );
            setNewName("");
            setNewPhone("");
            setNewRole("worker");
            setIsAddMode(false);
            loadUsers();
        } catch (err: any) {
            console.error("Failed to create user:", err);
            Alert.alert("त्रुटी", err?.response?.data?.message || "युजर जोडता आला नाही");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = (user: UserItem) => {
        Alert.alert(
            "युजर डिलीट करा ⚠️",
            `तुम्हाला नक्की '${user.name}' (${user.phone || user.username || ""}) हे खाते डिलीट करायचे आहे का?`,
            [
                { text: "रद्द करा", style: "cancel" },
                {
                    text: "डिलीट करा",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`/auth/users/${user.id}`);
                            Alert.alert("यशस्वी! ✅", `'${user.name}' युजर यशस्वीरित्या हटवला.`);
                            loadUsers();
                        } catch (err: any) {
                            Alert.alert("त्रुटी", err?.response?.data?.message || "युजर डिलीट करता आला नाही");
                        }
                    },
                },
            ]
        );
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case "admin":
                return { label: "👑 मुख्य ॲडमिन", bg: "#EFF6FF", text: "#1D4ED8" };
            case "sub_admin":
                return { label: "🏢 सब-ॲडमिन / व्यवस्थापक", bg: "#F0FDF4", text: "#15803D" };
            case "worker":
                return { label: "👷‍♂️ कामगार (फक्त ऑर्डर)", bg: "#FEF3C7", text: "#B45309" };
            default:
                return { label: "🏢 शाखा", bg: "#F1F5F9", text: "#475569" };
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Text style={styles.closeBtnText}>✕ बंद करा</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>👥 युजर व्यवस्थापन (Users)</Text>
                    <TouchableOpacity
                        onPress={() => setIsAddMode(!isAddMode)}
                        style={[styles.addToggleBtn, isAddMode && styles.addToggleBtnActive]}
                    >
                        <Text style={styles.addToggleText}>{isAddMode ? "यादी पहा" : "＋ नवीन युजर"}</Text>
                    </TouchableOpacity>
                </View>

                {isAddMode ? (
                    /* ADD USER FORM */
                    <View style={styles.formContainer}>
                        <Text style={styles.formTitle}>नवीन व्यवस्थापक / मॅनेजर जोडा</Text>
                        <Text style={styles.formSub}>
                            शाखा मॅनेजरसाठी नवीन ॲप लॉगिन तयार करा. मोबाईल नंबर हाच पासवर्ड असेल. (लेबर कामगारांची हजेरी व पगार स्वतंत्र मेनूमध्ये आहे).
                        </Text>

                        <Text style={styles.inputLabel}>व्यवस्थापकाचे / मॅनेजरचे नाव *</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="उदा. बागेश / सचिन"
                            placeholderTextColor="#94A3B8"
                            value={newName}
                            onChangeText={setNewName}
                        />

                        <Text style={styles.inputLabel}>मोबाईल नंबर (हाच पासवर्ड असेल) *</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="उदा. 7507111008"
                            placeholderTextColor="#94A3B8"
                            value={newPhone}
                            onChangeText={setNewPhone}
                            keyboardType="phone-pad"
                            maxLength={10}
                        />

                        <Text style={styles.inputLabel}>भूमिका निवडा (Role) *</Text>
                        <View style={styles.roleSelector}>
                            <TouchableOpacity
                                style={[styles.roleOption, newRole === "sub_admin" && styles.roleOptionActive]}
                                onPress={() => setNewRole("sub_admin")}
                            >
                                <Text style={[styles.roleOptionTitle, newRole === "sub_admin" && styles.roleOptionTitleActive]}>
                                    🏢 मॅनेजर / सब-ॲडमिन (Manager)
                                </Text>
                                <Text style={styles.roleOptionDesc}>
                                    ऑर्डर टाकणे + पैशांची खतावणी (Cash Ledger) + कामगार हजेरी पाहण्याची परवानगी.
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.roleOption, newRole === "worker" && styles.roleOptionActive]}
                                onPress={() => setNewRole("worker")}
                            >
                                <Text style={[styles.roleOptionTitle, newRole === "worker" && styles.roleOptionTitleActive]}>
                                    📝 शाखा मदतनीस (फक्त ऑर्डर)
                                </Text>
                                <Text style={styles.roleOptionDesc}>
                                    केवळ सामानाची ऑर्डर नोंदवू शकतील. पैशांचे व्यवहार / बिल दिसणार नाही.
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.submitBtn, saving && { opacity: 0.6 }]}
                            onPress={handleCreateUser}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.submitBtnText}>✅ युजर तयार करा</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    /* USER LIST */
                    <View style={{ flex: 1 }}>
                        <View style={styles.listHeaderRow}>
                            <Text style={styles.listCountText}>एकूण युजर्स ({users.length})</Text>
                            <TouchableOpacity onPress={loadUsers}>
                                <Text style={styles.refreshText}>🔄 रिफ्रेश</Text>
                            </TouchableOpacity>
                        </View>

                        {loading ? (
                            <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
                        ) : users.length === 0 ? (
                            <View style={styles.emptyBox}>
                                <Text style={styles.emptyText}>कोणतेही युजर्स सापडले नाहीत.</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={users}
                                keyExtractor={(item) => String(item.id)}
                                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                                renderItem={({ item }) => {
                                    const badge = getRoleBadge(item.role);
                                    const isSelf = item.role === "admin";

                                    return (
                                        <View style={styles.userCard}>
                                            <View style={{ flex: 1 }}>
                                                <View style={styles.cardTopRow}>
                                                    <Text style={styles.userName}>{item.name}</Text>
                                                    <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
                                                        <Text style={[styles.badgePillText, { color: badge.text }]}>
                                                            {badge.label}
                                                        </Text>
                                                    </View>
                                                </View>

                                                <Text style={styles.userMeta}>
                                                    📱 मोबाईल / पासवर्ड: <Text style={{ fontWeight: "700", color: "#0F172A" }}>{item.phone || "नाही"}</Text>
                                                </Text>
                                                <Text style={styles.userMeta}>
                                                    👤 वापरकर्ता नाव (Username): <Text style={{ fontWeight: "600" }}>{item.username || item.name}</Text>
                                                </Text>
                                                {item.franchise_name ? (
                                                    <Text style={styles.userMetaSub}>
                                                        📍 शाखा: {item.franchise_name}
                                                    </Text>
                                                ) : null}
                                            </View>

                                            {!isSelf && (
                                                <TouchableOpacity
                                                    style={styles.deleteBtn}
                                                    onPress={() => handleDeleteUser(item)}
                                                >
                                                    <Text style={styles.deleteBtnText}>🗑️ डिलीट</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                }}
                            />
                        )}
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    closeBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: "#F1F5F9",
        borderRadius: 8,
    },
    closeBtnText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#64748B",
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#0F172A",
    },
    addToggleBtn: {
        backgroundColor: "#2563EB",
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    addToggleBtnActive: {
        backgroundColor: "#64748B",
    },
    addToggleText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 12,
    },
    listHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 6,
    },
    listCountText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#334155",
    },
    refreshText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#2563EB",
    },
    userCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        padding: 14,
        borderRadius: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        elevation: 1,
    },
    cardTopRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 6,
    },
    userName: {
        fontSize: 16,
        fontWeight: "800",
        color: "#0F172A",
    },
    badgePill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    badgePillText: {
        fontSize: 11,
        fontWeight: "700",
    },
    userMeta: {
        fontSize: 13,
        color: "#475569",
        marginTop: 2,
    },
    userMetaSub: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    deleteBtn: {
        backgroundColor: "#FEE2E2",
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        marginLeft: 10,
    },
    deleteBtnText: {
        color: "#DC2626",
        fontWeight: "700",
        fontSize: 12,
    },
    emptyBox: {
        alignItems: "center",
        marginTop: 40,
    },
    emptyText: {
        fontSize: 14,
        color: "#64748B",
    },
    formContainer: {
        flex: 1,
        padding: 20,
    },
    formTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 4,
    },
    formSub: {
        fontSize: 13,
        color: "#64748B",
        marginBottom: 18,
        lineHeight: 18,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: "#334155",
        marginBottom: 6,
    },
    textInput: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: "#0F172A",
        marginBottom: 16,
    },
    roleSelector: {
        gap: 10,
        marginBottom: 20,
    },
    roleOption: {
        backgroundColor: "#FFFFFF",
        borderWidth: 2,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        padding: 12,
    },
    roleOptionActive: {
        borderColor: "#2563EB",
        backgroundColor: "#EFF6FF",
    },
    roleOptionTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#334155",
        marginBottom: 4,
    },
    roleOptionTitleActive: {
        color: "#1D4ED8",
    },
    roleOptionDesc: {
        fontSize: 12,
        color: "#64748B",
        lineHeight: 16,
    },
    submitBtn: {
        backgroundColor: "#16A34A",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        elevation: 2,
    },
    submitBtnText: {
        color: "#FFFFFF",
        fontWeight: "800",
        fontSize: 15,
    },
});
