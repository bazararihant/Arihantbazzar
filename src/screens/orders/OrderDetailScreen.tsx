import React, { useEffect, useState, useCallback } from "react";
import {
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import api, { getMediaUrl } from "../../services/api";
import { UserSession } from "../../services/storage";
import { ORDER_UNITS, formatUnitMarathi } from "../../utils/unitHelper";

interface Props {
    orderId: number;
    currentUser: UserSession;
    onBack: () => void;
}

interface OrderItem {
    id: number;
    item_name: string;
    quantity: number;
    unit: string;
    notes?: string;
    is_checked?: boolean;
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
    user_role?: string;
    items: OrderItem[];
}

const UNITS = ORDER_UNITS;

export default function OrderDetailScreen({ orderId, currentUser, onBack }: Props) {
    const insets = useSafeAreaInsets();
    const isAdmin = currentUser.role === "admin";

    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [billAmount, setBillAmount] = useState("");
    const [imageModalVisible, setImageModalVisible] = useState(false);

    // Edit Item Modal
    const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
    const [editItemName, setEditItemName] = useState("");
    const [editItemQty, setEditItemQty] = useState("");
    const [editItemUnit, setEditItemUnit] = useState("kg");
    const [editItemNotes, setEditItemNotes] = useState("");

    // Add New Item Modal
    const [addItemModalVisible, setAddItemModalVisible] = useState(false);
    const [newItemName, setNewItemName] = useState("");
    const [newItemQty, setNewItemQty] = useState("");
    const [newItemUnit, setNewItemUnit] = useState("kg");
    const [newItemNotes, setNewItemNotes] = useState("");

    // Edit Order Notes Modal
    const [editNotesModalVisible, setEditNotesModalVisible] = useState(false);
    const [orderNotesDraft, setOrderNotesDraft] = useState("");

    const loadOrder = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/orders/${orderId}`);
            setOrder(res.data.order);
            if (res.data.order?.bill_amount) {
                setBillAmount(String(res.data.order.bill_amount));
            }
            if (res.data.order?.notes) {
                setOrderNotesDraft(res.data.order.notes);
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

    // 1. Toggle Item Check (Admin Checklist / Packing verification)
    const handleToggleCheck = async (item: OrderItem) => {
        const targetState = !item.is_checked;

        // Optimistically update UI
        setOrder((prev) => {
            if (!prev) return null;
            return {
                ...prev,
                items: prev.items.map((i) =>
                    i.id === item.id ? { ...i, is_checked: targetState } : i
                ),
            };
        });

        try {
            await api.patch(`/orders/${orderId}/items/${item.id}/check`, {
                is_checked: targetState,
            });
        } catch (error) {
            // In case backend is not yet redeployed, keep optimistic state
            console.warn("Item check API error (fallback to local state):", error);
        }
    };

    // 2. Check All Items
    const handleCheckAll = async () => {
        if (!order) return;
        const allChecked = order.items.every((i) => i.is_checked);
        const newState = !allChecked;

        setOrder((prev) => {
            if (!prev) return null;
            return {
                ...prev,
                items: prev.items.map((i) => ({ ...i, is_checked: newState })),
            };
        });

        // Sync with API in background
        for (const item of order.items) {
            try {
                await api.patch(`/orders/${orderId}/items/${item.id}/check`, {
                    is_checked: newState,
                });
            } catch (e) {
                // ignore
            }
        }
    };

    // 3. Open Edit Item Modal
    const handleOpenEditItem = (item: OrderItem) => {
        setEditingItem(item);
        setEditItemName(item.item_name);
        setEditItemQty(String(item.quantity));
        setEditItemUnit(item.unit);
        setEditItemNotes(item.notes || "");
    };

    // 4. Save Edited Item
    const handleSaveEditItem = async () => {
        if (!editingItem) return;
        const trimmedName = editItemName.trim();
        const parsedQty = parseFloat(editItemQty.trim());

        if (!trimmedName || isNaN(parsedQty) || parsedQty <= 0) {
            Alert.alert("अवैध माहिती", "कृपया योग्य नाव आणि प्रमाण टाका.");
            return;
        }

        // Optimistically update
        setOrder((prev) => {
            if (!prev) return null;
            return {
                ...prev,
                items: prev.items.map((i) =>
                    i.id === editingItem.id
                        ? {
                              ...i,
                              item_name: trimmedName,
                              quantity: parsedQty,
                              unit: editItemUnit,
                              notes: editItemNotes.trim() || undefined,
                          }
                        : i
                ),
            };
        });

        try {
            await api.put(`/orders/${orderId}/items/${editingItem.id}`, {
                item_name: trimmedName,
                quantity: parsedQty,
                unit: editItemUnit,
                notes: editItemNotes.trim() || null,
            });
            Alert.alert("यशस्वी! ✅", "वस्तू माहिती अपडेट केली.");
        } catch (error: any) {
            console.warn("Item update API notice:", error?.message);
        } finally {
            setEditingItem(null);
        }
    };

    // 4b. Adjust Item Quantity (+ / -) directly
    const handleAdjustItemQty = async (item: OrderItem, delta: number) => {
        const newQty = Math.max(0.5, parseFloat((Number(item.quantity) + delta).toFixed(2)));

        setOrder((prev) => {
            if (!prev) return null;
            return {
                ...prev,
                items: prev.items.map((i) => (i.id === item.id ? { ...i, quantity: newQty } : i)),
            };
        });

        try {
            await api.put(`/orders/${orderId}/items/${item.id}`, { quantity: newQty });
        } catch (error) {
            console.warn("Item qty adjust notice:", error);
        }
    };

    // 5. Delete Item from Order (Allows deleting last item by offering to delete whole order)
    const handleDeleteItem = (item: OrderItem) => {
        if (!order) return;
        const isLastItem = order.items.length <= 1;

        Alert.alert(
            isLastItem ? "शेवटची वस्तू काढा? ⚠️" : "वस्तू काढा",
            isLastItem
                ? `'${item.item_name}' ही यादीतील शेवटची वस्तू आहे. ही काढून टाकल्यास संपूर्ण ऑर्डर हटवली जाईल. तुम्हाला ऑर्डर हटवायची आहे का?`
                : `तुम्हाला '${item.item_name}' ऑर्डरमधून काढून टाकायचे आहे का?`,
            [
                { text: "रद्द करा", style: "cancel" },
                {
                    text: "काढून टाका",
                    style: "destructive",
                    onPress: async () => {
                        if (isLastItem) {
                            try {
                                await api.delete(`/orders/${orderId}`);
                                Alert.alert("हटवली! 🗑️", "ऑर्डर हटवली गेली.", [
                                    { text: "ठीक आहे", onPress: onBack },
                                ]);
                            } catch (error: any) {
                                Alert.alert("एरर", error?.response?.data?.message || "ऑर्डर हटवता आली नाही");
                            }
                            return;
                        }

                        // Optimistic delete
                        setOrder((prev) => {
                            if (!prev) return null;
                            return {
                                ...prev,
                                items: prev.items.filter((i) => i.id !== item.id),
                            };
                        });

                        try {
                            await api.delete(`/orders/${orderId}/items/${item.id}`);
                            Alert.alert("हटवले! 🗑️", `'${item.item_name}' ऑर्डरमधून काढले.`);
                        } catch (error) {
                            console.warn("Delete item API notice:", error);
                        }
                    },
                },
            ]
        );
    };

    // 6. Add New Item to Existing Order
    const handleAddNewItem = async () => {
        const trimmedName = newItemName.trim();
        const parsedQty = parseFloat(newItemQty.trim());

        if (!trimmedName || isNaN(parsedQty) || parsedQty <= 0) {
            Alert.alert("अवैध माहिती", "कृपया योग्य नाव आणि प्रमाण टाका.");
            return;
        }

        try {
            const res = await api.post(`/orders/${orderId}/items`, {
                item_name: trimmedName,
                quantity: parsedQty,
                unit: newItemUnit,
                notes: newItemNotes.trim() || null,
            });

            const createdItem = res.data.item || {
                id: Date.now(),
                item_name: trimmedName,
                quantity: parsedQty,
                unit: newItemUnit,
                notes: newItemNotes.trim() || undefined,
                is_checked: false,
            };

            setOrder((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    items: [...prev.items, createdItem],
                };
            });

            Alert.alert("यशस्वी! ✅", "नवीन वस्तू ऑर्डरमध्ये जोडली गेली.");
            setAddItemModalVisible(false);
            setNewItemName("");
            setNewItemQty("");
            setNewItemNotes("");
        } catch (error: any) {
            // Fallback optimistic
            const createdItem = {
                id: Date.now(),
                item_name: trimmedName,
                quantity: parsedQty,
                unit: newItemUnit,
                notes: newItemNotes.trim() || undefined,
                is_checked: false,
            };
            setOrder((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    items: [...prev.items, createdItem],
                };
            });
            setAddItemModalVisible(false);
            setNewItemName("");
            setNewItemQty("");
            setNewItemNotes("");
        }
    };

    // 7. Update Order Notes
    const handleSaveOrderNotes = async () => {
        try {
            await api.put(`/orders/${orderId}`, { notes: orderNotesDraft.trim() });
            setOrder((prev) => (prev ? { ...prev, notes: orderNotesDraft.trim() } : null));
            setEditNotesModalVisible(false);
            Alert.alert("यशस्वी! ✅", "ऑर्डर सूचना अपडेट केल्या.");
        } catch (error) {
            console.warn("Update notes notice:", error);
            setOrder((prev) => (prev ? { ...prev, notes: orderNotesDraft.trim() } : null));
            setEditNotesModalVisible(false);
        }
    };

    // 7b. Update Bill Amount Directly
    const handleSaveBillAmount = async () => {
        const trimmed = billAmount.trim();
        try {
            await api.put(`/orders/${orderId}`, {
                bill_amount: trimmed ? parseFloat(trimmed) : null,
            });
            setOrder((prev) => (prev ? { ...prev, bill_amount: trimmed || null } : null));
            Alert.alert("यशस्वी! ✅", "बिलाची रक्कम सेव्ह केली गेली.");
        } catch (error: any) {
            console.error("Save bill amount error:", error);
            Alert.alert("एरर", error?.response?.data?.message || "रक्कम सेव्ह करता आली नाही");
        }
    };

    // 8. Delete Entire Order (Admin Only)
    const handleDeleteOrder = () => {
        Alert.alert(
            "ऑर्डर हटवा ⚠️",
            `तुम्हाला ऑर्डर #${orderId} कायमची हटवायची आहे का? ही कृती परत करता येणार नाही.`,
            [
                { text: "रद्द करा", style: "cancel" },
                {
                    text: "कायमचे हटवा",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`/orders/${orderId}`);
                            Alert.alert("हटवली! 🗑️", "ऑर्डर डेटाबेसमधून हटवली गेली.", [
                                { text: "ठीक आहे", onPress: onBack },
                            ]);
                        } catch (error: any) {
                            Alert.alert("एरर", error?.response?.data?.message || "ऑर्डर हटवता आली नाही");
                        }
                    },
                },
            ]
        );
    };

    // 9. Camera / Image Picker for Bill
    const handlePickImage = async (fromCamera: boolean) => {
        try {
            const options: any = {
                mediaType: "photo",
                quality: 0.7,
                maxWidth: 1200,
                maxHeight: 1200,
                includeBase64: true,
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
                uploadBillFile(result.assets[0]);
            }
        } catch (error: any) {
            console.error("Picker error:", error);
            Alert.alert("एरर", "कॅमेरा किंवा गॅलरी उघडताना अडचण आली");
        }
    };

    const uploadBillFile = async (asset: any) => {
        try {
            setUploading(true);

            const mimeType = asset.type || "image/jpeg";
            const dataUri = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : null;

            let uploadSuccess = false;

            // Strategy 1: Multipart FormData
            try {
                const formData = new FormData();
                formData.append("bill", {
                    uri:
                        Platform.OS === "android"
                            ? asset.uri
                            : asset.uri.replace("file://", ""),
                    type: mimeType,
                    name: asset.fileName || `bill_${orderId}_${Date.now()}.jpg`,
                } as any);

                if (billAmount.trim()) {
                    formData.append("bill_amount", billAmount.trim());
                }

                await api.post(`/orders/${orderId}/upload-bill`, formData, {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                    timeout: 25000,
                });
                uploadSuccess = true;
            } catch (formErr) {
                console.warn("Multipart upload notice, attempting JSON Base64 fallback:", formErr);
            }

            // Strategy 2: Base64 JSON Fallback (Works 100% on serverless / Vercel)
            if (!uploadSuccess && dataUri) {
                await api.post(`/orders/${orderId}/upload-bill`, {
                    image_base64: dataUri,
                    bill_amount: billAmount.trim() || undefined,
                }, {
                    headers: { "Content-Type": "application/json" },
                    timeout: 25000,
                });
                uploadSuccess = true;
            }

            if (uploadSuccess) {
                Alert.alert("यशस्वी! ✅", "बिलाचा फोटो यशस्वीरित्या सेव्ह झाला!");
                loadOrder();
            } else {
                throw new Error("दोन्ही अपलोड पद्धती अयशस्वी झाल्या");
            }
        } catch (error: any) {
            console.error("Bill upload error:", error);
            Alert.alert(
                "अपलोड अयशस्वी",
                error?.response?.data?.message || "बिल अपलोड करताना समस्या आली. कृपया इंटरनेट तपासा."
            );
        } finally {
            setUploading(false);
        }
    };

    // 10. Update Status (Admin)
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
                <Text style={{ marginTop: 12, color: "#64748B", fontWeight: "600" }}>
                    ऑर्डर माहिती लोड होत आहे...
                </Text>
            </SafeAreaView>
        );
    }

    if (!order) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <Text style={{ fontSize: 16, color: "#DC2626", fontWeight: "700" }}>ऑर्डर सापडली नाही</Text>
                <TouchableOpacity style={styles.backBtnSimple} onPress={onBack}>
                    <Text style={{ color: "#16A34A", fontWeight: "700" }}>◀ मागे जा</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const billUrl = getMediaUrl(order.bill_image_url);
    const checkedCount = order.items.filter((i) => i.is_checked).length;
    const progressPercent = order.items.length > 0 ? Math.round((checkedCount / order.items.length) * 100) : 0;

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            {/* Top Header Bar */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.backBtnText}>◀ मागे</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={styles.headerTitle}>ऑर्डर तपशील #{order.id}</Text>
                    <Text style={styles.headerBranchText}>अरिहंत बाजार (भिलवडी, सांगली)</Text>
                </View>
                {isAdmin ? (
                    <TouchableOpacity style={styles.deleteOrderIconBtn} onPress={handleDeleteOrder}>
                        <Text style={{ fontSize: 16 }}>🗑️</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 44 }} />
                )}
            </View>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 30, 48) }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Branch Info Card */}
                <View style={styles.card}>
                    <View style={styles.branchRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.branchName}>{order.franchise_name || "अरिहंत बाजार (भिलवडी, सांगली)"}</Text>
                            <Text style={styles.branchCode}>
                                कोड: {order.franchise_code || "BHILWADI"} • {order.franchise_address || "भिलवडी, ता. पलूस, सांगली"}
                            </Text>
                        </View>
                        <View style={[styles.statusPill, getStatusBg(order.status)]}>
                            <Text style={[styles.statusPillText, getStatusColor(order.status)]}>
                                {getStatusLabel(order.status)}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.dateLabel}>
                        📅 तारीख: {new Date(order.created_at).toLocaleString("mr-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                        })}
                    </Text>

                    <View style={{ backgroundColor: "#F0FDF4", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: "#DCFCE7" }}>
                        <Text style={{ fontSize: 13, color: "#166534", fontWeight: "700" }}>
                            👤 ऑर्डर नोंदवणारे: <Text style={{ color: "#0F172A", fontWeight: "800" }}>{order.user_name || "माहिती नाही"}</Text> {order.user_role === "worker" ? "👷‍♂️ (कामगार)" : order.user_role === "sub_admin" ? "🏢 (सब-ॲडमिन / व्यवस्थापक)" : order.user_role === "admin" ? "👑 (ॲडमिन)" : ""}
                        </Text>
                    </View>

                    {/* Order Notes */}
                    <View style={styles.notesBox}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <Text style={styles.notesTitle}>📝 शेरा / विशेष सूचना:</Text>
                            <TouchableOpacity onPress={() => setEditNotesModalVisible(true)}>
                                <Text style={styles.editNotesLink}>✏️ बदला</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.notesContent}>
                            {order.notes ? order.notes : "(कोणतीही विशेष सूचना दिलेली नाही)"}
                        </Text>
                    </View>
                </View>

                {/* MATERIAL CHECKLIST CARD */}
                <View style={[styles.card, { borderColor: "#86EFAC" }]}>
                    <View style={styles.cardHeaderRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>
                                📦 मागवलेले साहित्य & चेकलिस्ट ({order.items.length} वस्तू)
                            </Text>
                            <Text style={styles.checklistHint}>
                                साहित्य गोळा करताना किंवा मिळताना टिक करा:
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.checkAllBtn} onPress={handleCheckAll}>
                            <Text style={styles.checkAllBtnText}>
                                {checkedCount === order.items.length ? "सर्व अनटिक" : "सर्व टिक करा"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressBarWrapper}>
                        <View style={styles.progressBarBackground}>
                            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                        </View>
                        <Text style={styles.progressPercentText}>
                            {checkedCount} / {order.items.length} साहित्य गोळा केले ({progressPercent}%)
                        </Text>
                    </View>

                    {/* Items Checklist Table */}
                    {order.items.map((item, idx) => {
                        const isChecked = !!item.is_checked;

                        return (
                            <View
                                key={item.id}
                                style={[
                                    styles.itemCheckCard,
                                    isChecked && styles.itemCheckCardActive,
                                ]}
                            >
                                <View style={styles.itemMainRow}>
                                    {/* Interactive Tick Box */}
                                    <TouchableOpacity
                                        style={[
                                            styles.checkboxBtn,
                                            isChecked && styles.checkboxBtnChecked,
                                        ]}
                                        onPress={() => handleToggleCheck(item)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.checkboxIcon}>
                                            {isChecked ? "✓" : ""}
                                        </Text>
                                    </TouchableOpacity>

                                    {/* Item Details */}
                                    <View style={{ flex: 1, marginHorizontal: 8 }}>
                                        <Text
                                            style={[
                                                styles.checkItemName,
                                                isChecked && styles.checkItemNameDone,
                                            ]}
                                        >
                                            {idx + 1}. {item.item_name}
                                        </Text>
                                        {item.notes ? (
                                            <Text style={styles.checkItemNote}>
                                                📝 {item.notes}
                                            </Text>
                                        ) : null}
                                    </View>

                                    {/* Interactive Quantity Stepper */}
                                    <View style={styles.inlineStepper}>
                                        <TouchableOpacity
                                            style={styles.inlineStepBtn}
                                            onPress={() => handleAdjustItemQty(item, -1)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Text style={styles.inlineStepBtnText}>−</Text>
                                        </TouchableOpacity>
                                        <View style={styles.inlineQtyBox}>
                                            <Text
                                                style={[
                                                    styles.inlineQtyText,
                                                    isChecked && styles.checkItemQtyDone,
                                                ]}
                                            >
                                                {item.quantity} {formatUnitMarathi(item.unit)}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.inlineStepBtn}
                                            onPress={() => handleAdjustItemQty(item, 1)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Text style={styles.inlineStepBtnText}>＋</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Action Buttons: Edit and Delete for each item */}
                                <View style={styles.itemControlsRow}>
                                    <TouchableOpacity
                                        style={styles.itemEditBadgeBtn}
                                        onPress={() => handleOpenEditItem(item)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.itemEditBadgeText}>✏️ संपादन करा (Edit)</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.itemDeleteBadgeBtn}
                                        onPress={() => handleDeleteItem(item)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.itemDeleteBadgeText}>🗑️ काढून टाका (Delete)</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}

                    {/* Add Item Button */}
                    <TouchableOpacity
                        style={styles.addNewItemBtn}
                        onPress={() => setAddItemModalVisible(true)}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.addNewItemBtnText}>＋ यादीत आणखी वस्तू जोडा (Add Item)</Text>
                    </TouchableOpacity>
                </View>

                {/* BILL / INVOICE SECTION - Admin Only */}
                {isAdmin && (
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
                                        🔍 मोठा फोटो पाहण्यासाठी येथे टॅप करा
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

                    {/* Upload / Re-Upload Controls */}
                    <View style={styles.uploadControls}>
                        <Text style={styles.uploadSubtitle}>
                            {billUrl
                                ? "नवीन फोटो अपलोड करायचा असल्यास बदला:"
                                : "पावती किंवा बिलाचा फोटो जोडा:"}
                        </Text>

                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                            <TextInput
                                style={[styles.amountInput, { flex: 1, marginBottom: 0, marginRight: 8 }]}
                                placeholder="बिलाची रक्कम टाका (उदा. ₹ 4500)"
                                placeholderTextColor="#94A3B8"
                                keyboardType="numeric"
                                value={billAmount}
                                onChangeText={setBillAmount}
                            />
                            <TouchableOpacity
                                style={styles.saveAmountBtn}
                                onPress={handleSaveBillAmount}
                            >
                                <Text style={styles.saveAmountBtnText}>💾 सेव्ह</Text>
                            </TouchableOpacity>
                        </View>

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
                )}

                {/* ADMIN STATUS CONTROLS */}
                {isAdmin && (
                    <View style={[styles.card, { borderColor: "#BFDBFE" }]}>
                        <Text style={[styles.cardTitle, { color: "#1D4ED8" }]}>
                            👑 ॲडमिन कृती (Order Status Update)
                        </Text>
                        <Text style={styles.adminActionHint}>
                            ऑर्डरची स्थिती थेट बदला:
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
                                    🚚 मार्गस्थ (Dispatch)
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
                                    ✅ डिलिव्हरी पूर्ण (Delivered)
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.actionPill,
                                    { backgroundColor: "#FEE2E2" },
                                    order.status === "rejected" && styles.actionPillActive,
                                ]}
                                onPress={() => handleUpdateStatus("rejected")}
                                disabled={updatingStatus}
                            >
                                <Text style={[styles.actionPillText, { color: "#DC2626" }]}>
                                    ❌ नाकारा (Reject)
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

            {/* FULLSCREEN IMAGE MODAL */}
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

            {/* EDIT ITEM MODAL */}
            {editingItem && (
                <Modal visible transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <Text style={styles.modalCardTitle}>वस्तू संपादन करा (Edit Item)</Text>

                            <Text style={styles.modalInputLabel}>वस्तूचे नाव</Text>
                            <TextInput
                                style={styles.modalTextInput}
                                value={editItemName}
                                onChangeText={setEditItemName}
                            />

                            <View style={{ flexDirection: "row", marginTop: 8 }}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.modalInputLabel}>प्रमाण (Qty)</Text>
                                    <TextInput
                                        style={styles.modalTextInput}
                                        keyboardType="numeric"
                                        value={editItemQty}
                                        onChangeText={setEditItemQty}
                                    />
                                </View>
                                <View style={{ flex: 1.2 }}>
                                    <Text style={styles.modalInputLabel}>युनिट (Unit)</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {UNITS.map((u) => (
                                            <TouchableOpacity
                                                key={u.value}
                                                style={[
                                                    styles.modalUnitPill,
                                                    editItemUnit === u.value && styles.modalUnitPillActive,
                                                ]}
                                                onPress={() => setEditItemUnit(u.value)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.modalUnitPillText,
                                                        editItemUnit === u.value && styles.modalUnitPillTextActive,
                                                    ]}
                                                >
                                                    {u.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>

                            <Text style={[styles.modalInputLabel, { marginTop: 8 }]}>टीप (Notes)</Text>
                            <TextInput
                                style={styles.modalTextInput}
                                value={editItemNotes}
                                onChangeText={setEditItemNotes}
                            />

                            <View style={styles.modalBtnRow}>
                                <TouchableOpacity
                                    style={styles.modalCancelBtn}
                                    onPress={() => setEditingItem(null)}
                                >
                                    <Text style={styles.modalCancelText}>रद्द करा</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalSaveBtn}
                                    onPress={handleSaveEditItem}
                                >
                                    <Text style={styles.modalSaveText}>जतन करा ✅</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* ADD NEW ITEM MODAL */}
            {addItemModalVisible && (
                <Modal visible transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <Text style={styles.modalCardTitle}>＋ नवीन वस्तू जोडा</Text>

                            <Text style={styles.modalInputLabel}>वस्तूचे नाव *</Text>
                            <TextInput
                                style={styles.modalTextInput}
                                placeholder="उदा. साखर, तेल, तांदूळ..."
                                placeholderTextColor="#94A3B8"
                                value={newItemName}
                                onChangeText={setNewItemName}
                            />

                            <View style={{ flexDirection: "row", marginTop: 8 }}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.modalInputLabel}>प्रमाण (Qty) *</Text>
                                    <TextInput
                                        style={styles.modalTextInput}
                                        placeholder="उदा. 10"
                                        placeholderTextColor="#94A3B8"
                                        keyboardType="numeric"
                                        value={newItemQty}
                                        onChangeText={setNewItemQty}
                                    />
                                </View>
                                <View style={{ flex: 1.2 }}>
                                    <Text style={styles.modalInputLabel}>युनिट (Unit)</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {UNITS.map((u) => (
                                            <TouchableOpacity
                                                key={u.value}
                                                style={[
                                                    styles.modalUnitPill,
                                                    newItemUnit === u.value && styles.modalUnitPillActive,
                                                ]}
                                                onPress={() => setNewItemUnit(u.value)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.modalUnitPillText,
                                                        newItemUnit === u.value && styles.modalUnitPillTextActive,
                                                    ]}
                                                >
                                                    {u.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>

                            <Text style={[styles.modalInputLabel, { marginTop: 8 }]}>टीप (Notes - पर्यायी)</Text>
                            <TextInput
                                style={styles.modalTextInput}
                                placeholder="विशेष सूचना"
                                placeholderTextColor="#94A3B8"
                                value={newItemNotes}
                                onChangeText={setNewItemNotes}
                            />

                            <View style={styles.modalBtnRow}>
                                <TouchableOpacity
                                    style={styles.modalCancelBtn}
                                    onPress={() => setAddItemModalVisible(false)}
                                >
                                    <Text style={styles.modalCancelText}>रद्द करा</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalSaveBtn}
                                    onPress={handleAddNewItem}
                                >
                                    <Text style={styles.modalSaveText}>यादीत जोडा ＋</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* EDIT ORDER NOTES MODAL */}
            {editNotesModalVisible && (
                <Modal visible transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <Text style={styles.modalCardTitle}>📝 ऑर्डर सूचना बदला</Text>

                            <TextInput
                                style={[styles.modalTextInput, { minHeight: 90, textAlignVertical: "top" }]}
                                multiline
                                numberOfLines={4}
                                value={orderNotesDraft}
                                onChangeText={setOrderNotesDraft}
                                placeholder="ऑर्डरविषयी शेरा किंवा सूचना लिहा..."
                                placeholderTextColor="#94A3B8"
                            />

                            <View style={styles.modalBtnRow}>
                                <TouchableOpacity
                                    style={styles.modalCancelBtn}
                                    onPress={() => setEditNotesModalVisible(false)}
                                >
                                    <Text style={styles.modalCancelText}>रद्द करा</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalSaveBtn}
                                    onPress={handleSaveOrderNotes}
                                >
                                    <Text style={styles.modalSaveText}>जतन करा ✅</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </SafeAreaView>
    );
}

function getStatusLabel(status: string) {
    switch (status) {
        case "pending":
            return "प्रलंबित (Pending)";
        case "approved":
            return "मंजूर (Approved)";
        case "dispatched":
            return "मार्गस्थ (Dispatched)";
        case "delivered":
            return "डिलिव्हर (Delivered)";
        case "rejected":
            return "नाकारले (Rejected)";
        default:
            return status;
    }
}

function getStatusBg(status: string) {
    switch (status) {
        case "pending":
            return { backgroundColor: "#FEF3C7" };
        case "approved":
            return { backgroundColor: "#DBEAFE" };
        case "dispatched":
            return { backgroundColor: "#E0E7FF" };
        case "delivered":
            return { backgroundColor: "#DCFCE7" };
        case "rejected":
            return { backgroundColor: "#FEE2E2" };
        default:
            return { backgroundColor: "#F1F5F9" };
    }
}

function getStatusColor(status: string) {
    switch (status) {
        case "pending":
            return { color: "#D97706" };
        case "approved":
            return { color: "#2563EB" };
        case "dispatched":
            return { color: "#4F46E5" };
        case "delivered":
            return { color: "#16A34A" };
        case "rejected":
            return { color: "#DC2626" };
        default:
            return { color: "#64748B" };
    }
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
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    backBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: "#F1F5F9",
        borderRadius: 8,
    },
    backBtnText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#334155",
    },
    backBtnSimple: {
        marginTop: 12,
        padding: 10,
    },
    deleteOrderIconBtn: {
        padding: 6,
        backgroundColor: "#FEE2E2",
        borderRadius: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: "#0F172A",
    },
    headerBranchText: {
        fontSize: 12,
        color: "#16A34A",
        fontWeight: "600",
    },
    scrollContent: {
        padding: 14,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    branchRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
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
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
    },
    statusPillText: {
        fontSize: 12,
        fontWeight: "800",
    },
    dateLabel: {
        fontSize: 13,
        color: "#475569",
        marginTop: 10,
    },
    notesBox: {
        marginTop: 12,
        backgroundColor: "#F8FAFC",
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    notesTitle: {
        fontSize: 12,
        fontWeight: "700",
        color: "#475569",
    },
    editNotesLink: {
        fontSize: 12,
        fontWeight: "700",
        color: "#2563EB",
    },
    notesContent: {
        fontSize: 14,
        color: "#1E293B",
        marginTop: 4,
    },
    cardHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: "#0F172A",
    },
    checklistHint: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 2,
    },
    checkAllBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: "#DCFCE7",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#86EFAC",
    },
    checkAllBtnText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#15803D",
    },
    progressBarWrapper: {
        marginBottom: 12,
    },
    progressBarBackground: {
        height: 8,
        backgroundColor: "#E2E8F0",
        borderRadius: 4,
        overflow: "hidden",
    },
    progressBarFill: {
        height: "100%",
        backgroundColor: "#16A34A",
        borderRadius: 4,
    },
    progressPercentText: {
        fontSize: 12,
        color: "#15803D",
        fontWeight: "700",
        marginTop: 4,
        textAlign: "right",
    },
    itemCheckCard: {
        backgroundColor: "#F8FAFC",
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    itemCheckCardActive: {
        backgroundColor: "#F0FDF4",
        borderColor: "#86EFAC",
    },
    itemMainRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    checkboxBtn: {
        width: 26,
        height: 26,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: "#94A3B8",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
    },
    checkboxBtnChecked: {
        backgroundColor: "#16A34A",
        borderColor: "#16A34A",
    },
    checkboxIcon: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "900",
    },
    checkItemName: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1E293B",
    },
    checkItemNameDone: {
        color: "#15803D",
        textDecorationLine: "line-through",
    },
    checkItemNote: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 1,
    },
    inlineStepper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#CBD5E1",
    },
    inlineStepBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    inlineStepBtnText: {
        fontSize: 16,
        fontWeight: "900",
        color: "#16A34A",
    },
    inlineQtyBox: {
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    inlineQtyText: {
        fontSize: 13,
        fontWeight: "800",
        color: "#0F172A",
    },
    checkItemQtyDone: {
        color: "#16A34A",
    },
    itemControlsRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    itemEditBadgeBtn: {
        backgroundColor: "#EFF6FF",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#BFDBFE",
        marginRight: 8,
    },
    itemEditBadgeText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#1D4ED8",
    },
    itemDeleteBadgeBtn: {
        backgroundColor: "#FEF2F2",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#FECACA",
    },
    itemDeleteBadgeText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#DC2626",
    },
    addNewItemBtn: {
        backgroundColor: "#F0FDF4",
        borderWidth: 1.5,
        borderColor: "#86EFAC",
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center",
        marginTop: 8,
    },
    addNewItemBtnText: {
        fontSize: 14,
        fontWeight: "800",
        color: "#15803D",
    },
    billPreviewContainer: {
        alignItems: "center",
        marginVertical: 10,
    },
    billImage: {
        width: 260,
        height: 200,
        borderRadius: 12,
        backgroundColor: "#E2E8F0",
    },
    zoomHint: {
        marginTop: 6,
        alignItems: "center",
    },
    zoomHintText: {
        fontSize: 12,
        color: "#2563EB",
        fontWeight: "600",
    },
    billAmountText: {
        fontSize: 15,
        fontWeight: "800",
        color: "#16A34A",
        marginTop: 8,
    },
    noBillBox: {
        backgroundColor: "#F8FAFC",
        borderRadius: 10,
        padding: 20,
        alignItems: "center",
        marginVertical: 8,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderStyle: "dashed",
    },
    noBillIcon: {
        fontSize: 30,
        marginBottom: 6,
    },
    noBillText: {
        fontSize: 13,
        color: "#64748B",
        textAlign: "center",
    },
    uploadControls: {
        marginTop: 8,
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
        paddingVertical: 8,
        fontSize: 14,
        marginBottom: 10,
        color: "#1E293B",
    },
    saveAmountBtn: {
        backgroundColor: "#16A34A",
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    saveAmountBtnText: {
        color: "#FFFFFF",
        fontWeight: "800",
        fontSize: 13,
    },
    btnRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    photoBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: "center",
        marginHorizontal: 4,
    },
    cameraBtn: {
        backgroundColor: "#16A34A",
    },
    galleryBtn: {
        backgroundColor: "#0284C7",
    },
    photoBtnText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 13,
    },
    uploadingBox: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 10,
    },
    uploadingText: {
        marginLeft: 8,
        fontSize: 13,
        color: "#16A34A",
        fontWeight: "600",
    },
    adminActionHint: {
        fontSize: 12,
        color: "#64748B",
        marginBottom: 10,
    },
    statusButtonsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginHorizontal: -4,
    },
    actionPill: {
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 8,
        margin: 4,
        borderWidth: 1,
        borderColor: "transparent",
    },
    actionPillActive: {
        borderColor: "#000000",
    },
    actionPillText: {
        fontSize: 12,
        fontWeight: "800",
    },
    modalBackground: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.9)",
        justifyContent: "center",
        alignItems: "center",
    },
    closeModalBtn: {
        position: "absolute",
        top: 40,
        right: 20,
        backgroundColor: "rgba(255,255,255,0.3)",
        paddingHorizontal: 14,
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
        width: "90%",
        height: "80%",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 20,
        width: "100%",
        maxWidth: 400,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    modalCardTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 12,
        textAlign: "center",
    },
    modalInputLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#475569",
        marginBottom: 4,
    },
    modalTextInput: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 14,
        color: "#1E293B",
    },
    modalUnitPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: "#F1F5F9",
        borderRadius: 6,
        marginRight: 6,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    modalUnitPillActive: {
        backgroundColor: "#16A34A",
        borderColor: "#16A34A",
    },
    modalUnitPillText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#475569",
    },
    modalUnitPillTextActive: {
        color: "#FFFFFF",
    },
    modalBtnRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 18,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 11,
        backgroundColor: "#F1F5F9",
        borderRadius: 8,
        alignItems: "center",
        marginRight: 8,
    },
    modalCancelText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#64748B",
    },
    modalSaveBtn: {
        flex: 1.5,
        paddingVertical: 11,
        backgroundColor: "#16A34A",
        borderRadius: 8,
        alignItems: "center",
        marginLeft: 8,
    },
    modalSaveText: {
        fontSize: 14,
        fontWeight: "800",
        color: "#FFFFFF",
    },
});
