import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LoginScreen from "./src/screens/auth/LoginScreen";
import BranchDashboardScreen from "./src/screens/franchise/BranchDashboardScreen";
import CreateOrderScreen from "./src/screens/franchise/CreateOrderScreen";
import OrderDetailScreen from "./src/screens/orders/OrderDetailScreen";
import OrderHistoryScreen from "./src/screens/orders/OrderHistoryScreen";
import AdminDashboardScreen from "./src/screens/admin/AdminDashboardScreen";
import CashLedgerScreen from "./src/screens/ledger/CashLedgerScreen";
import WorkerSalaryScreen from "./src/screens/salary/WorkerSalaryScreen";
import { getUser, UserSession } from "./src/services/storage";
import { registerDeviceToken, setupNotificationListeners } from "./src/services/notificationService";

type ScreenType =
    | "login"
    | "branch_dashboard"
    | "create_order"
    | "order_detail"
    | "admin_dashboard"
    | "order_history"
    | "cash_ledger"
    | "worker_salary";

export default function App() {
    const [user, setUser] = useState<UserSession | null>(null);
    const [currentScreen, setCurrentScreen] = useState<ScreenType>("login");
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [historyTab, setHistoryTab] = useState<"orders" | "report">("orders");
    const [initializing, setInitializing] = useState(true);

    // Setup Notification Listeners
    useEffect(() => {
        const unsubscribe = setupNotificationListeners((orderId) => {
            setSelectedOrderId(orderId);
            setCurrentScreen("order_detail");
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const storedUser = await getUser();
                if (storedUser) {
                    setUser(storedUser);
                    // Register FCM push token for this device
                    registerDeviceToken();

                    if (storedUser.role === "admin" || storedUser.role === "sub_admin") {
                        setCurrentScreen("admin_dashboard");
                    } else {
                        setCurrentScreen("branch_dashboard");
                    }
                } else {
                    setCurrentScreen("login");
                }
            } catch (e) {
                console.error("Failed to load session:", e);
                setCurrentScreen("login");
            } finally {
                setInitializing(false);
            }
        };

        checkSession();
    }, []);

    const handleLoginSuccess = (loggedInUser: UserSession) => {
        setUser(loggedInUser);
        // Register FCM push token upon login
        registerDeviceToken();

        if (loggedInUser.role === "admin" || loggedInUser.role === "sub_admin") {
            setCurrentScreen("admin_dashboard");
        } else {
            setCurrentScreen("branch_dashboard");
        }
    };

    const handleLogout = () => {
        setUser(null);
        setSelectedOrderId(null);
        setCurrentScreen("login");
    };

    const handleViewOrder = (orderId: number) => {
        setSelectedOrderId(orderId);
        setCurrentScreen("order_detail");
    };

    const handleBackFromDetail = () => {
        setSelectedOrderId(null);
        if (user?.role === "admin" || user?.role === "sub_admin") {
            setCurrentScreen("admin_dashboard");
        } else {
            setCurrentScreen("branch_dashboard");
        }
    };

    const handleViewHistory = (tab: "orders" | "report" = "orders") => {
        setHistoryTab(tab);
        setCurrentScreen("order_history");
    };

    const handleBackFromHistory = () => {
        if (user?.role === "admin" || user?.role === "sub_admin") {
            setCurrentScreen("admin_dashboard");
        } else {
            setCurrentScreen("branch_dashboard");
        }
    };

    const handleViewLedger = () => {
        setCurrentScreen("cash_ledger");
    };

    const handleBackFromLedger = () => {
        if (user?.role === "admin" || user?.role === "sub_admin") {
            setCurrentScreen("admin_dashboard");
        } else {
            setCurrentScreen("branch_dashboard");
        }
    };

    const handleViewSalary = () => {
        setCurrentScreen("worker_salary");
    };

    const handleBackFromSalary = () => {
        if (user?.role === "admin" || user?.role === "sub_admin") {
            setCurrentScreen("admin_dashboard");
        } else {
            setCurrentScreen("branch_dashboard");
        }
    };

    const renderContent = () => {
        if (initializing) {
            return (
                <View
                    style={{
                        flex: 1,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "#F8FAFC",
                    }}
                >
                    <ActivityIndicator size="large" color="#16A34A" />
                </View>
            );
        }

        // 1. Login Screen
        if (currentScreen === "login" || !user) {
            return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
        }

        // 2. Create Order Screen (Franchise & Admin)
        if (currentScreen === "create_order") {
            return (
                <CreateOrderScreen
                    onBack={() => {
                        if (user?.role === "admin" || user?.role === "sub_admin") {
                            setCurrentScreen("admin_dashboard");
                        } else {
                            setCurrentScreen("branch_dashboard");
                        }
                    }}
                    onOrderCreated={(newOrderId) => {
                        setSelectedOrderId(newOrderId);
                        setCurrentScreen("order_detail");
                    }}
                />
            );
        }

        // 3. Order Detail Screen (View items, upload bill photo, admin approve)
        if (currentScreen === "order_detail" && selectedOrderId) {
            return (
                <OrderDetailScreen
                    orderId={selectedOrderId}
                    currentUser={user}
                    onBack={handleBackFromDetail}
                />
            );
        }

        // 4. Order History Screen (All & Date-wise customize history & Monthly expense report)
        if (currentScreen === "order_history") {
            return (
                <OrderHistoryScreen
                    user={user}
                    onBack={handleBackFromHistory}
                    onViewOrder={handleViewOrder}
                    initialTab={historyTab}
                />
            );
        }

        // 5. Cash Ledger Screen (Brother Cash Tracking & Settlement)
        if (currentScreen === "cash_ledger") {
            return (
                <CashLedgerScreen
                    currentUser={user}
                    onBack={handleBackFromLedger}
                />
            );
        }

        // 6. Worker Attendance & Salary Management Screen
        if (currentScreen === "worker_salary") {
            return (
                <WorkerSalaryScreen
                    currentUser={user}
                    onBack={handleBackFromSalary}
                />
            );
        }

        // 7. Admin Dashboard (Strictly Today's Orders Details)
        if (currentScreen === "admin_dashboard" && (user.role === "admin" || user.role === "sub_admin")) {
            return (
                <AdminDashboardScreen
                    user={user}
                    onLogout={handleLogout}
                    onCreateOrder={() => setCurrentScreen("create_order")}
                    onViewOrder={handleViewOrder}
                    onViewHistory={handleViewHistory}
                    onViewLedger={handleViewLedger}
                    onViewSalary={handleViewSalary}
                />
            );
        }

        // 8. Default: Branch Dashboard
        return (
            <BranchDashboardScreen
                user={user}
                onLogout={handleLogout}
                onCreateOrder={() => setCurrentScreen("create_order")}
                onViewOrder={handleViewOrder}
                onViewHistory={handleViewHistory}
                onViewLedger={handleViewLedger}
                onViewSalary={handleViewSalary}
            />
        );
    };

    useEffect(() => {
        StatusBar.setBarStyle("dark-content");
    }, []);

    return (
        <SafeAreaProvider>
            <StatusBar barStyle="dark-content" />
            <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
                {renderContent()}
            </View>
        </SafeAreaProvider>
    );
}
