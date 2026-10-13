import React, { useEffect, useState, useCallback } from "react";
import {
    SafeAreaView,
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    TextInput,
    Modal,
    Platform,
} from "react-native";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import api, { getMediaUrl } from "../../services/api";
import { UserSession } from "../../services/storage";

interface Props {
    orderId: number;
    currentUser: UserSession;
    onBack: () => void;
}

interface OrderDetail {
    id: number;
    franchise_id: number;
    order_date: string;
    status: "pending" | "approved" | "dispatched" | "delivered" | "rejected";
    notes: string;
    bill_image_url: string | null;
    bill_amount: string | null;
    created_at: string;
    franchise_name: string;
    franchise_code: string;
    franchise_address: string;
    user_name: string;
    items: Array<{
        id: number;
        item_name: string;
        quantity: number;
        unit: string;
        notes?: string;
    }>;
}

export default function OrderDetailScreen({ orderId, currentUser, onBack }: Props) {
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [billAmount, setBillAmount] = useState("");
    const [imageModalVisible, setImageModalVisible] = useState(false);

    const loadOrder = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/orders/${orderId}`);
            setOrder(res.data.order);
            if (res.data.order?.bill_amount) {
                setBillAmount(String(res.data.order.bill_amount));
            }
        } catch (error: any) {
            console.error("Load order error:", error);
            Alert.alert("एरर", "ऑर्डर लोड करता आली नाही");
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useEffect(() => {
        loadOrder();
    }, [loadOrder]);

    const handlePickImage = async (fromCamera: boolean) => {
        try {
            const options: any = {
                mediaType: "photo",
                quality: 0.8,
                includeBase64: false,
            };

            const result = fromCamera
                ? await launchCamera(options)
                : await launchImageLibrary(options);

            if (result.didCancel) return;
            if (result.errorCode) {
                Alert.alert("एरर", result.errorMessage || "फोटो निवडता आला नाही");
                return;
            }

            if (result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                uploadBillFile(asset);
            }
        } catch (error: any) {
            console.error("Picker error:", error);
            Alert.alert("एरर", "कॅमेरा किंवा गॅलरी उघडताना अडचण आली");
        }
    };

    const uploadBillFile = async (asset: any) => {
        try {
            setUploading(true);

            const formData = new FormData();
            formData.append("bill", {
                uri:
                    Platform.OS === "android"
                        ? asset.uri
                        : asset.uri.replace("file://", ""),
                type: asset.type || "image/jpeg",
                name: asset.fileName || `bill_${orderId}_${Date.now()}.jpg`,
            } as any);

            if (billAmount.trim()) {
                formData.append("bill_amount", billAmount.trim());
            }

            await api.post(`/orders/${orderId}/upload-bill`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            Alert.alert("यशस्वी! ✅", "बिलाचा फोटो यशस्वीरित्या अपलोड झाला!");
            loadOrder();
        } catch (error: any) {
            console.error("Bill upload error:", error);
            Alert.alert(
                "अपलोड अयशस्वी",
                error?.response?.data?.message || "बिल अपलोड करताना समस्या आली"
            );
        } finally {
            setUploading(false);
        }
    };

    const handleUpdateStatus = async (newStatus: string) => {
        try {
            setUpdatingStatus(true);
            await api.patch(`/orders/${orderId}/status`, { status: newStatus });
            Alert.alert("स्टेटस अपडेट केले! ✅", `ऑर्डर आता '${newStatus}' झाली आहे.`);
            loadOrder();
        } catch (error: any) {
            console.error("Status update error:", error);
            Alert.alert("एरर", "स्टेटस अपडेट करता आले नाही");
        } finally {
            setUpdatingStatus(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#16A34A" />
                <Text style={{ marginTop: 12, color: "#64748B" }}>
                    ऑर्डर माहिती लोड होत आहे...
                </Text>
            </SafeAreaView>
        );
    }

    if (!order) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <Text style={{ fontSize: 16, color: "#DC2626" }}>ऑर्डर सापडली नाही</Text>
                <TouchableOpacity style={styles.backBtnSimple} onPress={onBack}>
                    <Text style={{ color: "#16A34A", fontWeight: "700" }}>◀ मागे जा</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const billUrl = getMediaUrl(order.bill_image_url);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.backBtnText}>◀ मागे</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>ऑर्डर तपशील #{order.id}</Text>
                <View style={{ width: 50 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Branch Info Card */}
                <View style={styles.card}>
                    <View style={styles.branchRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.branchName}>{order.franchise_name}</Text>
                            <Text style={styles.branchCode}>
                                कोड: {order.franchise_code} • {order.franchise_address}
                            </Text>
                        </View>
                        <View style={styles.statusPill}>
                            <Text style={styles.statusPillText}>
                                {order.status.toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.dateLabel}>
                        तारीख: {new Date(order.created_at).toLocaleString("mr-IN")}
                    </Text>

                    {order.notes ? (
                        <View style={styles.notesBox}>
                            <Text style={styles.notesTitle}>📝 शेरा / सूचना:</Text>
                            <Text style={styles.notesContent}>{order.notes}</Text>
                        </View>
                    ) : null}
                </View>

                {/* Items Table */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                        🛒 मागवलेल्या वस्तूंची यादी ({order.items.length} आयटम)
                    </Text>

                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, { flex: 0.5 }]}>#</Text>
                        <Text style={[styles.th, { flex: 2 }]}>सामानाचे नाव</Text>
                        <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>
                            प्रमाण
                        </Text>
                    </View>

                    {order.items.map((item, idx) => (
                        <View key={item.id} style={styles.tableRow}>
                            <Text style={[styles.td, { flex: 0.5, color: "#64748B" }]}>
                                {idx + 1}
                            </Text>
                            <Text
                                style={[
                                    styles.td,
                                    { flex: 2, fontWeight: "700", color: "#1E293B" },
                                ]}
                            >
                                {item.item_name}
                            </Text>
                            <Text
                                style={[
                                    styles.td,
                                    {
                                        flex: 1,
                                        textAlign: "right",
                                        fontWeight: "800",
                                        color: "#16A34A",
                                    },
                                ]}
                            >
                                {item.quantity} {item.unit}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Bill Photo Section */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🧾 बिलाचा फोटो (Bill / Invoice Image)</Text>

                    {billUrl ? (
                        <View style={styles.billPreviewContainer}>
                            <TouchableOpacity
                                onPress={() => setImageModalVisible(true)}
                                activeOpacity={0.9}
                            >
                                <Image
                                    source={{ uri: billUrl }}
                                    style={styles.billImage}
                                    resizeMode="cover"
                                />
                                <View style={styles.zoomHint}>
                                    <Text style={styles.zoomHintText}>
                                        🔍 पूर्ण स्क्रीनवर पाहण्यासाठी टॅप करा
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {order.bill_amount ? (
                                <Text style={styles.billAmountText}>
                                    💰 बिलाची एकूण रक्कम: ₹{order.bill_amount}
                                </Text>
                            ) : null}
                        </View>
                    ) : (
                        <View style={styles.noBillBox}>
                            <Text style={styles.noBillIcon}>📷</Text>
                            <Text style={styles.noBillText}>
                                अद्याप या ऑर्डरसाठी बिलाचा फोटो अपलोड केलेला नाही
                            </Text>
                        </View>
                    )}

                    {/* Upload / Re-Upload Controls for Branch or Admin */}
                    <View style={styles.uploadControls}>
                        <Text style={styles.uploadSubtitle}>
                            {billUrl
                                ? "नवीन फोटो अपलोड करायचा असल्यास बदला:"
                                : "पावती किंवा बिलाचा फोटो जोडा:"}
                        </Text>

                        <TextInput
                            style={styles.amountInput}
                            placeholder="बिलाची रक्कम टाका (उदा. ₹ 4500) - पर्यायी"
                            placeholderTextColor="#94A3B8"
                            keyboardType="numeric"
                            value={billAmount}
                            onChangeText={setBillAmount}
                        />

                        <View style={styles.btnRow}>
                            <TouchableOpacity
                                style={[styles.photoBtn, styles.cameraBtn]}
                                onPress={() => handlePickImage(true)}
                                disabled={uploading}
                            >
                                <Text style={styles.photoBtnText}>📸 कॅमेऱ्यातून काढा</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.photoBtn, styles.galleryBtn]}
                                onPress={() => handlePickImage(false)}
                                disabled={uploading}
                            >
                                <Text style={styles.photoBtnText}>🖼️ गॅलरीतून निवडा</Text>
                            </TouchableOpacity>
                        </View>

                        {uploading && (
                            <View style={styles.uploadingBox}>
                                <ActivityIndicator color="#16A34A" />
                                <Text style={styles.uploadingText}>
                                    बिलाचा फोटो अपलोड होत आहे...
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Admin Status Controls */}
                {currentUser.role === "admin" && (
                    <View style={[styles.card, { borderColor: "#BFDBFE" }]}>
                        <Text style={[styles.cardTitle, { color: "#1D4ED8" }]}>
                            👑 ॲडमिन कृती (Change Order Status)
                        </Text>
                        <Text style={styles.adminActionHint}>
                            या ऑर्डरची सद्यस्थिती बदला:
                        </Text>

                        <View style={styles.statusButtonsGrid}>
                            <TouchableOpacity
                                style={[
                                    styles.actionPill,
                                    { backgroundColor: "#DBEAFE" },
                                    order.status === "approved" && styles.actionPillActive,
                                ]}
                                onPress={() => handleUpdateStatus("approved")}
                                disabled={updatingStatus}
                            >
                                <Text style={[styles.actionPillText, { color: "#2563EB" }]}>
                                    📋 मंजूर करा (Approve)
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.actionPill,
                                    { backgroundColor: "#E0E7FF" },
                                    order.status === "dispatched" && styles.actionPillActive,
                                ]}
                                onPress={() => handleUpdateStatus("dispatched")}
                                disabled={updatingStatus}
                            >
                                <Text style={[styles.actionPillText, { color: "#4F46E5" }]}>
                                    🚚 माल पाठवला (Dispatch)
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.actionPill,
                                    { backgroundColor: "#DCFCE7" },
                                    order.status === "delivered" && styles.actionPillActive,
                                ]}
                                onPress={() => handleUpdateStatus("delivered")}
                                disabled={updatingStatus}
                            >
                                <Text style={[styles.actionPillText, { color: "#16A34A" }]}>
                                    ✅ डिलिव्हरी झाली (Delivered)
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {updatingStatus && (
                            <ActivityIndicator
                                color="#2563EB"
                                style={{ marginTop: 10 }}
                            />
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Fullscreen Image Zoom Modal */}
            <Modal
                visible={imageModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setImageModalVisible(false)}
            >
                <View style={styles.modalBackground}>
                    <TouchableOpacity
                        style={styles.closeModalBtn}
                        onPress={() => setImageModalVisible(false)}
                    >
                        <Text style={styles.closeModalText}>✕ बंद करा</Text>
                    </TouchableOpacity>

                    {billUrl ? (
                        <Image
                            source={{ uri: billUrl }}
                            style={styles.modalFullImage}
                            resizeMode="contain"
                        />
                    ) : null}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
    },
    header: {
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    backBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    backBtnText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#16A34A",
    },
    backBtnSimple: {
        marginTop: 14,
        padding: 10,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: "#0F172A",
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    branchRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 8,
    },
    branchName: {
        fontSize: 17,
        fontWeight: "800",
        color: "#0F172A",
    },
    branchCode: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    statusPill: {
        backgroundColor: "#DCFCE7",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: "800",
        color: "#15803D",
    },
    dateLabel: {
        fontSize: 12,
        color: "#94A3B8",
        marginBottom: 6,
    },
    notesBox: {
        backgroundColor: "#FEF3C7",
        padding: 10,
        borderRadius: 8,
        marginTop: 8,
    },
    notesTitle: {
        fontSize: 12,
        fontWeight: "700",
        color: "#92400E",
    },
    notesContent: {
        fontSize: 13,
        color: "#78350F",
        marginTop: 2,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: "#1E293B",
        marginBottom: 12,
    },
    tableHeader: {
        flexDirection: "row",
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    th: {
        fontSize: 12,
        fontWeight: "800",
        color: "#64748B",
    },
    tableRow: {
        flexDirection: "row",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        alignItems: "center",
    },
    td: {
        fontSize: 13,
    },
    billPreviewContainer: {
        alignItems: "center",
        marginBottom: 16,
    },
    billImage: {
        width: 280,
        height: 240,
        borderRadius: 12,
        backgroundColor: "#E2E8F0",
    },
    zoomHint: {
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 6,
        alignSelf: "center",
    },
    zoomHintText: {
        color: "#FFFFFF",
        fontSize: 11,
        fontWeight: "600",
    },
    billAmountText: {
        fontSize: 15,
        fontWeight: "800",
        color: "#15803D",
        marginTop: 8,
    },
    noBillBox: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 10,
        padding: 24,
        alignItems: "center",
        marginBottom: 16,
    },
    noBillIcon: {
        fontSize: 34,
        marginBottom: 6,
    },
    noBillText: {
        fontSize: 13,
        color: "#64748B",
        textAlign: "center",
    },
    uploadControls: {
        marginTop: 4,
    },
    uploadSubtitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#334155",
        marginBottom: 8,
    },
    amountInput: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: "#0F172A",
        marginBottom: 10,
    },
    btnRow: {
        flexDirection: "row",
        gap: 10,
    },
    photoBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    cameraBtn: {
        backgroundColor: "#16A34A",
    },
    galleryBtn: {
        backgroundColor: "#0284C7",
    },
    photoBtnText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "700",
    },
    uploadingBox: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 12,
        gap: 8,
    },
    uploadingText: {
        color: "#16A34A",
        fontSize: 13,
        fontWeight: "600",
    },
    adminActionHint: {
        fontSize: 13,
        color: "#64748B",
        marginBottom: 10,
    },
    statusButtonsGrid: {
        gap: 8,
    },
    actionPill: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        alignItems: "center",
    },
    actionPillActive: {
        borderWidth: 2,
        borderColor: "#1E3A8A",
    },
    actionPillText: {
        fontSize: 13,
        fontWeight: "700",
    },
    modalBackground: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.92)",
        justifyContent: "center",
        alignItems: "center",
    },
    closeModalBtn: {
        position: "absolute",
        top: 50,
        right: 20,
        backgroundColor: "rgba(255,255,255,0.25)",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        zIndex: 10,
    },
    closeModalText: {
        color: "#FFFFFF",
        fontWeight: "800",
        fontSize: 14,
    },
    modalFullImage: {
        width: "92%",
        height: "80%",
    },
});
