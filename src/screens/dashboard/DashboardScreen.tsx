
import React, { useEffect, useState } from "react";
import {
    SafeAreaView,
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from "react-native";
import { getUser } from "../../services/storage";

type User = {
    id: number;
    name: string;
    email: string;
    role: string;
};

function DashboardScreen() {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const loadUser = async () => {
            const storedUser = await getUser();

            if (storedUser) {
                setUser(storedUser);
            }
        };

        loadUser();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* HEADER */}

                <View style={styles.header}>
                    <View>
                        <Text style={styles.welcome}>
                            Welcome back 👋
                        </Text>

                        <Text style={styles.userName}>
                            {user?.name || "Shop Owner"}
                        </Text>

                        <Text style={styles.shopText}>
                            Automotive Shop Management
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.notificationButton}>
                        <Text style={styles.notificationIcon}>
                            🔔
                        </Text>

                        <View style={styles.notificationDot} />
                    </TouchableOpacity>
                </View>

                {/* SHOP STATUS */}

                <View style={styles.statusCard}>
                    <View>
                        <Text style={styles.statusLabel}>
                            SHOP STATUS
                        </Text>

                        <Text style={styles.statusTitle}>
                            Your shop is running smoothly
                        </Text>

                        <Text style={styles.statusSubtitle}>
                            Everything looks good today.
                        </Text>
                    </View>

                    <View style={styles.onlineBadge}>
                        <View style={styles.onlineDot} />

                        <Text style={styles.onlineText}>
                            ONLINE
                        </Text>
                    </View>
                </View>

                {/* OVERVIEW */}

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                        Today's Overview
                    </Text>

                    <Text style={styles.dateText}>
                        Today
                    </Text>
                </View>

                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statIcon}>
                            💰
                        </Text>

                        <Text style={styles.statValue}>
                            ₹24,500
                        </Text>

                        <Text style={styles.statLabel}>
                            Today's Sales
                        </Text>
                    </View>

                    <View style={styles.statCard}>
                        <Text style={styles.statIcon}>
                            🚗
                        </Text>

                        <Text style={styles.statValue}>
                            12
                        </Text>

                        <Text style={styles.statLabel}>
                            Active Services
                        </Text>
                    </View>

                    <View style={styles.statCard}>
                        <Text style={styles.statIcon}>
                            👥
                        </Text>

                        <Text style={styles.statValue}>
                            86
                        </Text>

                        <Text style={styles.statLabel}>
                            Customers
                        </Text>
                    </View>

                    <View style={styles.statCard}>
                        <Text style={styles.statIcon}>
                            📦
                        </Text>

                        <Text style={styles.statValue}>
                            8
                        </Text>

                        <Text style={styles.statLabel}>
                            Low Stock Items
                        </Text>
                    </View>
                </View>

                {/* QUICK ACTIONS */}

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                        Quick Actions
                    </Text>
                </View>

                <View style={styles.actionsContainer}>
                    <TouchableOpacity style={styles.actionCard}>
                        <View style={styles.actionIcon}>
                            <Text>🚘</Text>
                        </View>

                        <View>
                            <Text style={styles.actionTitle}>
                                New Service
                            </Text>

                            <Text style={styles.actionSubtitle}>
                                Create service order
                            </Text>
                        </View>

                        <Text style={styles.arrow}>
                            →
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard}>
                        <View style={styles.actionIcon}>
                            <Text>👤</Text>
                        </View>

                        <View>
                            <Text style={styles.actionTitle}>
                                Add Customer
                            </Text>

                            <Text style={styles.actionSubtitle}>
                                Register a customer
                            </Text>
                        </View>

                        <Text style={styles.arrow}>
                            →
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard}>
                        <View style={styles.actionIcon}>
                            <Text>📦</Text>
                        </View>

                        <View>
                            <Text style={styles.actionTitle}>
                                Inventory
                            </Text>

                            <Text style={styles.actionSubtitle}>
                                Manage spare parts
                            </Text>
                        </View>

                        <Text style={styles.arrow}>
                            →
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* RECENT SERVICES */}

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                        Recent Services
                    </Text>

                    <TouchableOpacity>
                        <Text style={styles.viewAll}>
                            View All
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.serviceCard}>
                    <View style={styles.carIcon}>
                        <Text>🚙</Text>
                    </View>

                    <View style={styles.serviceInfo}>
                        <Text style={styles.serviceCustomer}>
                            Rahul Sharma
                        </Text>

                        <Text style={styles.serviceVehicle}>
                            Hyundai Creta • MH 12 AB 1234
                        </Text>

                        <Text style={styles.serviceType}>
                            General Service
                        </Text>
                    </View>

                    <View style={styles.completedBadge}>
                        <Text style={styles.completedText}>
                            Done
                        </Text>
                    </View>
                </View>

                <View style={styles.serviceCard}>
                    <View style={styles.carIcon}>
                        <Text>🚗</Text>
                    </View>

                    <View style={styles.serviceInfo}>
                        <Text style={styles.serviceCustomer}>
                            Amit Patil
                        </Text>

                        <Text style={styles.serviceVehicle}>
                            Honda City • MH 14 XY 5678
                        </Text>

                        <Text style={styles.serviceType}>
                            Brake Service
                        </Text>
                    </View>

                    <View style={styles.progressBadge}>
                        <Text style={styles.progressText}>
                            Active
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F6F7",
    },

    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 35,
    },

    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 22,
    },

    welcome: {
        fontSize: 14,
        color: "#777777",
        marginBottom: 3,
    },

    userName: {
        fontSize: 27,
        fontWeight: "900",
        color: "#111111",
    },

    shopText: {
        fontSize: 12,
        color: "#888888",
        marginTop: 3,
    },

    notificationButton: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
        elevation: 3,
        shadowColor: "#000000",
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },

    notificationIcon: {
        fontSize: 20,
    },

    notificationDot: {
        position: "absolute",
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#DFFF00",
    },

    statusCard: {
        backgroundColor: "#111111",
        borderRadius: 20,
        padding: 20,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 25,
    },

    statusLabel: {
        color: "#DFFF00",
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 1.5,
        marginBottom: 7,
    },

    statusTitle: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "800",
        maxWidth: 220,
    },

    statusSubtitle: {
        color: "#AAAAAA",
        fontSize: 12,
        marginTop: 5,
    },

    onlineBadge: {
        backgroundColor: "#222222",
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
    },

    onlineDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: "#DFFF00",
        marginRight: 6,
    },

    onlineText: {
        color: "#DFFF00",
        fontSize: 9,
        fontWeight: "900",
    },

    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        marginTop: 2,
    },

    sectionTitle: {
        fontSize: 19,
        fontWeight: "900",
        color: "#111111",
    },

    dateText: {
        fontSize: 12,
        color: "#888888",
    },

    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginBottom: 24,
    },

    statCard: {
        width: "48%",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 17,
        marginBottom: 12,
        elevation: 2,
        shadowColor: "#000000",
        shadowOpacity: 0.05,
        shadowRadius: 6,
    },

    statIcon: {
        fontSize: 23,
        marginBottom: 10,
    },

    statValue: {
        fontSize: 21,
        fontWeight: "900",
        color: "#111111",
    },

    statLabel: {
        fontSize: 11,
        color: "#888888",
        marginTop: 4,
    },

    actionsContainer: {
        marginBottom: 24,
    },

    actionCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        elevation: 2,
        shadowColor: "#000000",
        shadowOpacity: 0.04,
        shadowRadius: 5,
    },

    actionIcon: {
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: "#F1F2F2",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 13,
    },

    actionTitle: {
        fontSize: 14,
        fontWeight: "800",
        color: "#111111",
    },

    actionSubtitle: {
        fontSize: 11,
        color: "#888888",
        marginTop: 3,
    },

    arrow: {
        marginLeft: "auto",
        fontSize: 22,
        color: "#999999",
    },

    viewAll: {
        color: "#111111",
        fontSize: 12,
        fontWeight: "800",
    },

    serviceCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 17,
        padding: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        elevation: 2,
        shadowColor: "#000000",
        shadowOpacity: 0.04,
        shadowRadius: 5,
    },

    carIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: "#F1F2F2",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },

    serviceInfo: {
        flex: 1,
    },

    serviceCustomer: {
        fontSize: 14,
        fontWeight: "800",
        color: "#111111",
    },

    serviceVehicle: {
        fontSize: 10,
        color: "#777777",
        marginTop: 3,
    },

    serviceType: {
        fontSize: 10,
        color: "#999999",
        marginTop: 3,
    },

    completedBadge: {
        backgroundColor: "#EEF7C7",
        borderRadius: 8,
        paddingHorizontal: 9,
        paddingVertical: 6,
    },

    completedText: {
        fontSize: 9,
        fontWeight: "900",
        color: "#667000",
    },

    progressBadge: {
        backgroundColor: "#FFF3D6",
        borderRadius: 8,
        paddingHorizontal: 9,
        paddingVertical: 6,
    },

    progressText: {
        fontSize: 9,
        fontWeight: "900",
        color: "#996900",
    },
});

export default DashboardScreen;

