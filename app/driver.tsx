import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, doc, getDoc, increment, onSnapshot, query, runTransaction, Timestamp, where, writeBatch } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useData } from '../context/DataContext';
import { auth, db } from '../db/firebase-service';
import { COLORS } from '../styles/theme';

// --- INTERFACES (ACTUALIZADA) ---
interface Item {
    productId: string;
    nombre: string;
    quantity: number;
    precio: number;
}
interface Invoice {
    id: string;
    clienteId: string;
    clienteNombre: string;
    clienteDireccion: string;
    totalVenta: number;
    // Se añade el nuevo estado 'Adeuda'
    estadoVisita: 'Pendiente' | 'Pagada' | 'Anulada' | 'Adeuda';
    items: Item[];
}
interface Route {
    id: string;
    nombre: string;
    estado: string;
    repartidorId: string;
    facturas: Invoice[];
}

// --- HELPERS ---
const formatCurrency = (value?: number) => (typeof value === 'number' ? `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0,00');

// =================================================================================
// --- MODAL DE AJUSTE DE ENTREGA ---
// =================================================================================
interface DeliveryAdjustmentModalProps {
    visible: boolean;
    onClose: () => void;
    stop: Invoice;
    routeId: string;
    onConfirm: (updatedStop: Invoice) => void;
}

const DeliveryAdjustmentModal = ({ visible, onClose, stop, routeId, onConfirm }: DeliveryAdjustmentModalProps) => {
    const [modifiedItems, setModifiedItems] = useState<Item[]>([]);
    const [pagoEfectivo, setPagoEfectivo] = useState('');
    const [pagoTransferencia, setPagoTransferencia] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (stop) {
            setModifiedItems(JSON.parse(JSON.stringify(stop.items || [])));
        }
    }, [stop]);

    const newTotalVenta = useMemo(() => {
        return modifiedItems.reduce((total, item) => total + (item.precio * item.quantity), 0);
    }, [modifiedItems]);

    const handleQuantityChange = (productId: string, change: 'increment' | 'decrement') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setModifiedItems(currentItems => {
            return currentItems.map(item => {
                if (item.productId === productId) {
                    const newQuantity = change === 'increment' ? item.quantity + 1 : Math.max(0, item.quantity - 1);
                    return { ...item, quantity: newQuantity };
                }
                return item;
            }).filter(item => item.quantity > 0);
        });
    };
    
    // --- LÓGICA DE TRANSACCIÓN ACTUALIZADA ---
    const executeTransaction = async () => {
        setIsSaving(true);
        const efectivo = parseFloat(pagoEfectivo) || 0;
        const transferencia = parseFloat(pagoTransferencia) || 0;
        const totalPagado = efectivo + transferencia;

        try {
            // Se determina el estado final basado en el pago
            const finalStatus = totalPagado < newTotalVenta ? 'Adeuda' : 'Pagada';

            await runTransaction(db, async (transaction) => {
                const ventaRef = doc(db, 'ventas', stop.id);
                const routeRef = doc(db, 'rutas', routeId);
                const routeDoc = await transaction.get(routeRef);
                if (!routeDoc.exists()) throw new Error("La ruta no fue encontrada.");

                const originalItemsMap = new Map(stop.items.map(i => [i.productId, i.quantity]));
                const modifiedItemsMap = new Map(modifiedItems.map(i => [i.productId, i.quantity]));

                for (const [productId, originalQty] of originalItemsMap.entries()) {
                    const newQty = modifiedItemsMap.get(productId) || 0;
                    if (originalQty - newQty !== 0) {
                        const productRef = doc(db, 'productos', productId);
                        transaction.update(productRef, { stock: increment(originalQty - newQty) });
                    }
                }

                transaction.update(ventaRef, {
                    estado: finalStatus, // <--- CAMBIO CLAVE
                    items: modifiedItems,
                    totalVenta: newTotalVenta,
                    pagoEfectivo: efectivo,
                    pagoTransferencia: transferencia,
                    saldoPendiente: newTotalVenta - totalPagado,
                    fechaRendicion: Timestamp.now(),
                });

                const routeData = routeDoc.data() as Route;
                const updatedFacturas = routeData.facturas.map(f =>
                    f.id === stop.id ? { ...f, estadoVisita: finalStatus, totalVenta: newTotalVenta, items: modifiedItems } : f
                );
                transaction.update(routeRef, { facturas: updatedFacturas });
            });

            Toast.show({ type: 'success', text1: `Entrega guardada como "${finalStatus}"` });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onConfirm({ ...stop, estadoVisita: finalStatus, totalVenta: newTotalVenta, items: modifiedItems });
            onClose();

        } catch (error) {
            console.error("Error en la transacción de entrega:", error);
            Toast.show({ type: 'error', text1: (error as Error).message || 'Error al guardar.' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmDelivery = async () => {
        const totalPagado = (parseFloat(pagoEfectivo) || 0) + (parseFloat(pagoTransferencia) || 0);
        if (totalPagado > newTotalVenta) {
            Alert.alert("Error", `El monto pagado (${formatCurrency(totalPagado)}) no puede ser mayor al total de la factura (${formatCurrency(newTotalVenta)}).`);
            return;
        }
        if (totalPagado < newTotalVenta) {
             Alert.alert("Saldo Pendiente", `La factura se marcará como "Adeuda" con un saldo de ${formatCurrency(newTotalVenta - totalPagado)}. ¿Continuar?`, [
                 { text: 'No', style: 'cancel' },
                 { text: 'Sí, Continuar', onPress: executeTransaction }
             ]);
        } else {
           await executeTransaction();
        }
    };

    if (!stop) return null;

    return (
        <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.adjustmentModalContent}>
                    <Text style={styles.modalTitle}>Gestionar Entrega</Text>
                    <Text style={styles.modalSubtitle}>{stop.clienteNombre}</Text>
                    <FlatList data={modifiedItems} keyExtractor={item => item.productId} renderItem={({ item }) => (<View style={styles.itemRow}><Text style={styles.itemName} numberOfLines={1}>{item.nombre}</Text><View style={styles.quantityControl}><TouchableOpacity style={styles.quantityButton} onPress={() => handleQuantityChange(item.productId, 'decrement')}><Feather name="minus" size={16} color={COLORS.primary} /></TouchableOpacity><Text style={styles.quantityText}>{item.quantity}</Text><TouchableOpacity style={styles.quantityButton} onPress={() => handleQuantityChange(item.productId, 'increment')}><Feather name="plus" size={16} color={COLORS.primary} /></TouchableOpacity></View><Text style={styles.itemTotal}>{formatCurrency(item.precio * item.quantity)}</Text></View>)} style={styles.itemList}/>
                    <View style={styles.summaryContainer}><Text style={styles.summaryLabel}>Total Original:</Text><Text style={styles.summaryValueOriginal}>{formatCurrency(stop.totalVenta)}</Text><Text style={styles.summaryLabel}>Nuevo Total a Cobrar:</Text><Text style={styles.summaryValueFinal}>{formatCurrency(newTotalVenta)}</Text></View>
                    <View style={styles.inputContainer}><Feather name="dollar-sign" size={20} color={COLORS.textSecondary} style={styles.inputIcon} /><TextInput style={styles.input} placeholder="Monto en Efectivo" keyboardType="numeric" value={pagoEfectivo} onChangeText={setPagoEfectivo} /></View>
                    <View style={styles.inputContainer}><Feather name="credit-card" size={20} color={COLORS.textSecondary} style={styles.inputIcon} /><TextInput style={styles.input} placeholder="Monto en Transferencia" keyboardType="numeric" value={pagoTransferencia} onChangeText={setPagoTransferencia} /></View>
                    <View style={styles.modalButtons}><TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={handleConfirmDelivery} disabled={isSaving}>{isSaving ? <ActivityIndicator color={COLORS.primaryDark} /> : <Text style={styles.confirmButtonText}>Confirmar</Text>}</TouchableOpacity></View>
                </View>
            </View>
        </Modal>
    );
};


// =================================================================================
// --- PANTALLA DE DETALLE DE RUTA ---
// =================================================================================
const RouteDetailScreen = ({ route: initialRoute, onBack, onRouteUpdate }: { route: Route, onBack: () => void, onRouteUpdate: (updatedRoute: Route) => void }) => {
    const { clients } = useData();
    const [route, setRoute] = useState(initialRoute);
    const [isAdjustmentModalVisible, setAdjustmentModalVisible] = useState(false);
    const [selectedStop, setSelectedStop] = useState<Invoice | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const stops = route.facturas || [];
    const areAllStopsCompleted = useMemo(() => stops.every(stop => stop.estadoVisita !== 'Pendiente'), [stops]);

    const handleNavigate = (stop: Invoice) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); const client = clients.find(c => c.id === stop.clienteId); if (client?.location) { const { latitude, longitude } = client.location; const url = Platform.select({ ios: `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`, android: `google.navigation:q=${latitude},${longitude}&mode=d` }); if (url) Linking.openURL(url).catch(() => Alert.alert("Error", "No se pudo abrir la aplicación de mapas.")); } else { Alert.alert("Sin Ubicación", "Este cliente no tiene una ubicación guardada."); } };
    
    // --- FUNCIÓN 'NO ENTREGADO' CORREGIDA ---
    const handleFailedDelivery = (stop: Invoice) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert("Confirmar Entrega Fallida", `¿Seguro que no se pudo entregar a ${stop.clienteNombre}?`,
            [{ text: 'Cancelar', style: 'cancel' }, {
                text: 'Confirmar', style: 'destructive', onPress: async () => {
                    const batch = writeBatch(db);
                    const ventaRef = doc(db, 'ventas', stop.id);
                    const routeRef = doc(db, 'rutas', route.id);

                    batch.update(ventaRef, { estado: 'Anulada' });
                    
                    const updatedFacturas = stops.map(f => f.id === stop.id ? { ...f, estadoVisita: 'Anulada' as const } : f);
                    
                    // CORRECCIÓN: Se añade la actualización de la ruta al batch
                    batch.update(routeRef, { facturas: updatedFacturas });
                    
                    stop.items.forEach(item => {
                        const productRef = doc(db, 'productos', item.productId);
                        batch.update(productRef, { stock: increment(item.quantity) });
                    });

                    try {
                        await batch.commit();
                        const updatedRoute = { ...route, facturas: updatedFacturas };
                        setRoute(updatedRoute);
                        onRouteUpdate(updatedRoute);
                        Toast.show({ type: 'info', text1: `Parada marcada como Anulada` });
                    } catch (error) {
                        console.error("Error al anular entrega: ", error);
                        Toast.show({ type: 'error', text1: 'Error al anular la entrega.' });
                    }
                }
            }]
        );
    };
    
    const handleOpenAdjustmentModal = (stop: Invoice) => { setSelectedStop(stop); setAdjustmentModalVisible(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); };
    const handleConfirmAndUpdateUI = (updatedStop: Invoice) => { const updatedFacturas = stops.map(s => s.id === updatedStop.id ? updatedStop : s); const updatedRoute = { ...route, facturas: updatedFacturas }; setRoute(updatedRoute); onRouteUpdate(updatedRoute); };

    const handleCompleteRoute = async () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); Alert.alert("Finalizar Ruta", "¿Estás seguro de que has completado todas las entregas?", [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sí, Finalizar', style: 'default', onPress: async () => { setIsSaving(true); try { await runTransaction(db, async (transaction) => { const routeRef = doc(db, 'rutas', route.id); const routeDoc = await transaction.get(routeRef); if (!routeDoc.exists() || routeDoc.data().estado !== 'En Curso') throw new Error("Esta ruta ya no está en curso."); transaction.update(routeRef, { estado: 'Completada' }); }); Toast.show({ type: 'success', text1: '¡Ruta completada con éxito!' }); onBack(); } catch (error) { Toast.show({ type: 'error', text1: 'Error al finalizar la ruta' }); console.error("Error al finalizar la ruta:", error); } finally { setIsSaving(false); } } }]); };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}><TouchableOpacity onPress={onBack} style={styles.backButton}><Feather name="arrow-left" size={24} color={COLORS.textPrimary} /></TouchableOpacity><View style={styles.headerTitleContainer}><Text style={styles.title} numberOfLines={1}>{route.nombre}</Text></View></View>
            <FlatList data={stops} keyExtractor={(item) => item.id} contentContainerStyle={styles.listContentContainer} renderItem={({ item, index }) => {
                // Lógica de color para el nuevo estado
                const statusColor = item.estadoVisita === 'Pagada' ? COLORS.success 
                                  : item.estadoVisita === 'Anulada' ? COLORS.danger
                                  : item.estadoVisita === 'Adeuda' ? COLORS.warning // <--- NUEVO COLOR
                                  : COLORS.primary;

                return (
                    <View style={[styles.card, item.estadoVisita !== 'Pendiente' && styles.cardCompleted]}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.stopNumber}>{index + 1}</Text>
                            <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.clienteNombre}</Text><Text style={styles.cardSubtitle} numberOfLines={1}>{item.clienteDireccion}</Text></View>
                            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}><Text style={styles.statusText}>{item.estadoVisita}</Text></View>
                        </View>
                        <View style={styles.cardBody}><Text style={styles.amountLabel}>Monto a Cobrar:</Text><Text style={styles.amountValue}>{formatCurrency(item.totalVenta)}</Text></View>
                        {item.estadoVisita === 'Pendiente' && (
                            <View style={styles.cardActions}>
                                <TouchableOpacity style={styles.actionButton} onPress={() => handleNavigate(item)}><Feather name="map-pin" size={20} color={COLORS.primary} /><Text style={styles.actionButtonText}>Navegar</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.actionButton} onPress={() => handleFailedDelivery(item)}><Feather name="x-circle" size={20} color={COLORS.danger} /><Text style={[styles.actionButtonText, { color: COLORS.danger }]}>No Entregado</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.actionButton, styles.mainActionButton]} onPress={() => handleOpenAdjustmentModal(item)}><Feather name="edit" size={20} color={COLORS.primaryDark} /><Text style={[styles.actionButtonText, { color: COLORS.primaryDark, fontWeight: 'bold' }]}>Gestionar</Text></TouchableOpacity>
                            </View>
                        )}
                    </View>
                );
            }}/>
            {areAllStopsCompleted && !isSaving && (<View style={styles.footerContainer}><TouchableOpacity style={styles.completeRouteButton} onPress={handleCompleteRoute} disabled={isSaving}>{isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.completeRouteButtonText}>Finalizar Ruta</Text>}</TouchableOpacity></View>)}
            {selectedStop && (<DeliveryAdjustmentModal visible={isAdjustmentModalVisible} onClose={() => setAdjustmentModalVisible(false)} stop={selectedStop} routeId={route.id} onConfirm={handleConfirmAndUpdateUI}/>)}
        </SafeAreaView>
    );
};

// =================================================================================
// --- PANTALLA PRINCIPAL DEL REPARTIDOR (CON SINCRONIZACIÓN Y PESTAÑAS) ---
// =================================================================================
const DriverHomeScreen = ({ onSelectRoute, userData }: { onSelectRoute: (route: Route) => void, userData: any }) => {
    const [allRoutes, setAllRoutes] = useState<Route[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'En Curso' | 'Finalizadas'>('En Curso');
    
    // SOLUCIÓN 1: Listener en tiempo real para las rutas del repartidor.
    useEffect(() => {
        if (!userData?.uid) return;
        
        setIsLoading(true);
        const q = query(
            collection(db, 'rutas'),
            where('repartidorId', '==', userData.uid),
            where('estado', 'in', ['En Curso', 'Completada'])
        );
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const routesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route));
            setAllRoutes(routesData);
            setIsLoading(false);
        }, (error) => {
            console.error("Error al sincronizar rutas:", error);
            Toast.show({ type: 'error', text1: 'No se pudieron sincronizar las rutas.' });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [userData?.uid]);

    // SOLUCIÓN 2: Vistas separadas para rutas en curso y finalizadas.
    const filteredRoutes = useMemo(() => {
        const targetStatus = activeTab === 'Finalizadas' ? 'Completada' : 'En Curso';
        return allRoutes.filter(route => route.estado === targetStatus);
    }, [allRoutes, activeTab]);

    const handleLogout = async () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); Alert.alert("Cerrar Sesión", "¿Estás seguro?", [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sí, Cerrar Sesión', style: 'destructive', onPress: async () => { await signOut(auth); router.replace('/'); } }]); };

    if (isLoading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>Mis Rutas</Text><Text style={styles.subtitle}>Hola, {userData?.nombreCompleto || 'Repartidor'}</Text></View><TouchableOpacity onPress={handleLogout} style={styles.logoutButton}><Feather name="log-out" size={22} color={COLORS.primary} /></TouchableOpacity></View>
            
            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'En Curso' && styles.activeTab]} onPress={() => setActiveTab('En Curso')}><Text style={[styles.tabText, activeTab === 'En Curso' && styles.activeTabText]}>En Curso</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'Finalizadas' && styles.activeTab]} onPress={() => setActiveTab('Finalizadas')}><Text style={[styles.tabText, activeTab === 'Finalizadas' && styles.activeTabText]}>Finalizadas</Text></TouchableOpacity>
            </View>
            
            <FlatList data={filteredRoutes} keyExtractor={(item) => item.id} contentContainerStyle={styles.listContentContainer} ListEmptyComponent={<View style={styles.emptyContainer}><Feather name="truck" size={50} color={COLORS.textSecondary} /><Text style={styles.emptyText}>No tienes rutas {activeTab === 'En Curso' ? 'activas' : 'finalizadas'}.</Text></View>} renderItem={({ item }: { item: Route }) => { const paradasCompletadas = item.facturas.filter(f => f.estadoVisita !== 'Pendiente').length; const totalParadas = item.facturas.length; const progreso = totalParadas > 0 ? (paradasCompletadas / totalParadas) * 100 : 0; return (<TouchableOpacity style={styles.card} onPress={() => { onSelectRoute(item); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }}><View style={styles.cardHeader}><Feather name="map-pin" size={22} color={COLORS.primary} /><Text style={styles.cardTitle} numberOfLines={1}>{item.nombre}</Text></View><View style={styles.cardStats}><View style={styles.statBox}><Text style={styles.statValue}>{paradasCompletadas}</Text><Text style={styles.statLabel}>Completadas</Text></View><View style={styles.statBox}><Text style={styles.statValue}>{totalParadas - paradasCompletadas}</Text><Text style={styles.statLabel}>Pendientes</Text></View><View style={styles.statBox}><Text style={styles.statValue}>{totalParadas}</Text><Text style={styles.statLabel}>Total</Text></View></View><View style={styles.progressBarContainer}><View style={[styles.progressBarFill, { width: `${progreso}%` }]} /></View><View style={styles.cardFooter}><Text style={styles.footerText}>Ver Detalles de Ruta</Text><Feather name="arrow-right" size={16} color={COLORS.primary} /></View></TouchableOpacity>);}}/>
        </SafeAreaView>
    );
};

// =================================================================================
// --- COMPONENTE PRINCIPAL Y GESTOR DE VISTAS ---
// =================================================================================
const DriverFlow = () => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<any>(null);
    const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
    const { syncData } = useData();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const userDocRef = doc(db, 'vendedores', currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) setUserData(userDocSnap.data());
                setUser(currentUser);
            } else {
                router.replace('/');
            }
        });
        return () => unsubscribe();
    }, []);

    const handleRouteUpdate = (updatedRoute: Route) => {
        syncData();
        if (selectedRoute && selectedRoute.id === updatedRoute.id) {
            setSelectedRoute(updatedRoute);
        }
    };

    if (!user || !userData) {
        return (<View style={styles.loadingContainer}><LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={StyleSheet.absoluteFill} /><ActivityIndicator size="large" color={COLORS.primary} /></View>);
    }

    return (
        <View style={{ flex: 1 }}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
            {selectedRoute ? (
                <RouteDetailScreen route={selectedRoute} onBack={() => setSelectedRoute(null)} onRouteUpdate={handleRouteUpdate} />
            ) : (
                <DriverHomeScreen onSelectRoute={setSelectedRoute} userData={{ ...userData, uid: user.uid }} />
            )}
        </View>
    );
};

// --- ESTILOS ---
const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 50, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitleContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 50, },
    title: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary, textAlign: 'center' },
    subtitle: { fontSize: 18, color: COLORS.textSecondary, marginTop: 4 },
    logoutButton: { padding: 12, backgroundColor: COLORS.glass, borderRadius: 15, borderWidth: 1, borderColor: COLORS.glassBorder },
    listContentContainer: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100, gap: 20, backgroundColor: COLORS.glass, borderRadius: 20, padding: 30, marginHorizontal: 20, marginTop: 20 },
    emptyText: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 24 },
    card: { backgroundColor: COLORS.glass, borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: COLORS.glassBorder, },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: COLORS.glassBorder, },
    cardTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary, flex: 1, },
    cardSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
    cardStats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, },
    statBox: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 28, fontWeight: 'bold', color: COLORS.textPrimary, },
    statLabel: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2, },
    progressBarContainer: { height: 8, backgroundColor: COLORS.glassBorder, borderRadius: 4, overflow: 'hidden', marginBottom: 15, },
    progressBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4, },
    cardFooter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.glassBorder, gap: 8, },
    footerText: { color: COLORS.primary, fontSize: 14, fontWeight: '600', },
    backButton: { position: 'absolute', left: 20, top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 50, zIndex: 1, padding: 10 },
    stopNumber: { fontSize: 22, fontWeight: 'bold', color: COLORS.primary, width: 30, textAlign: 'center' },
    cardCompleted: { opacity: 0.6 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginLeft: 'auto' },
    statusText: { color: COLORS.primaryDark, fontSize: 12, fontWeight: 'bold' },
    cardBody: { paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center' },
    amountLabel: { color: COLORS.textSecondary, fontSize: 14 },
    amountValue: { color: COLORS.textPrimary, fontSize: 32, fontWeight: 'bold' },
    cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.glassBorder, justifyContent: 'space-between' },
    actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 8 },
    actionButtonText: { fontWeight: '600', color: COLORS.primary },
    mainActionButton: { backgroundColor: 'rgba(255, 193, 7, 0.2)' },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
    modalContent: { width: '90%', backgroundColor: COLORS.backgroundStart, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.glassBorder },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, textAlign: 'center' },
    modalSubtitle: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, borderRadius: 15, borderWidth: 1, borderColor: COLORS.glassBorder, paddingHorizontal: 15, marginBottom: 15, height: 58 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: COLORS.textPrimary, fontSize: 16 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10 },
    modalButton: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center' },
    cancelButton: { backgroundColor: COLORS.disabled },
    cancelButtonText: { color: COLORS.textPrimary, fontWeight: 'bold' },
    confirmButton: { backgroundColor: COLORS.primary },
    confirmButtonText: { color: COLORS.primaryDark, fontWeight: 'bold' },
    financialSummary: { fontSize: 14, color: COLORS.success, fontWeight: '600', opacity: 0.9 },
    footerContainer: { padding: 20, backgroundColor: COLORS.glass, borderTopWidth: 1, borderColor: COLORS.glassBorder },
    completeRouteButton: { backgroundColor: COLORS.success, padding: 20, borderRadius: 15, alignItems: 'center' },
    completeRouteButtonText: { color: COLORS.primaryDark, fontSize: 18, fontWeight: 'bold' },
    adjustmentModalContent: { width: '95%', maxHeight: '85%', backgroundColor: COLORS.backgroundStart, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.glassBorder },
    itemList: { marginBottom: 15, maxHeight: '40%' },
    itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.glassBorder },
    itemName: { flex: 1, color: COLORS.textPrimary, fontSize: 16, marginRight: 8 },
    quantityControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, borderRadius: 10 },
    quantityButton: { padding: 8 },
    quantityText: { color: COLORS.textPrimary, fontWeight: 'bold', fontSize: 16, paddingHorizontal: 12 },
    itemTotal: { width: 80, textAlign: 'right', color: COLORS.textPrimary, fontWeight: 'bold', fontSize: 16 },
    summaryContainer: { paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.glassBorder, marginBottom: 15 },
    summaryLabel: { fontSize: 14, color: COLORS.textSecondary },
    summaryValueOriginal: { fontSize: 18, color: COLORS.textSecondary, fontWeight: 'bold', textDecorationLine: 'line-through', textAlign: 'right' },
    summaryValueFinal: { fontSize: 24, color: COLORS.success, fontWeight: 'bold', textAlign: 'right' },
    // Estilos para las pestañas
    tabContainer: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: COLORS.glass, marginHorizontal: 20, borderRadius: 15, padding: 5, marginBottom: 10, },
    tabButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    activeTab: { backgroundColor: COLORS.primary },
    tabText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 16 },
    activeTabText: { color: COLORS.primaryDark },
});

export default DriverFlow;