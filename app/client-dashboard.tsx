import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { deleteDoc, doc } from 'firebase/firestore'; // Se añade
import React, { useMemo, useState } from 'react'; // Se añade useState
import {
    ActivityIndicator,
    Alert // Se añade Alert
    ,
    FlatList,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Toast from 'react-native-toast-message'; // Se añade Toast
import { useData } from '../context/DataContext';
import { db } from '../db/firebase-service'; // Se añade
import { COLORS } from '../styles/theme';

// --- INTERFACES ---
interface Sale {
    id: string;
    clienteId: string;
    clientName?: string;
    // CORRECCIÓN: Asegurar que fecha pueda ser un objeto Date o un objeto Firestore Timestamp
    fecha: { seconds: number } | Date;
    totalVenta: number;
    estado: 'Pagada' | 'Adeuda' | 'Pendiente de Pago' | 'Repartiendo' | 'Anulada';
    saldoPendiente: number;
}
interface Client {
    id: string;
    nombre: string;
    direccion?: string;
    telefono?: string;
}

const ClientDashboardScreen = () => {
    const { clientId } = useLocalSearchParams();
    // Se añade refreshAllData para actualizar la UI después de eliminar
    const { clients, sales, isLoading, refreshAllData } = useData();

    // NUEVO ESTADO: Para controlar el proceso de eliminación
    const [isDeleting, setIsDeleting] = useState(false);

    const client: Client | undefined = useMemo(() => clients.find(c => c.id === clientId), [clients, clientId]);
    
    const clientSales: Sale[] = useMemo(() => {
        if (!sales || !clientId) return [];
        return sales
            .filter(s => s.clienteId === clientId)
            .sort((a, b) => {
                // Función de ayuda para convertir fecha
                const getDate = (sale: Sale) => {
                    if (sale.fecha instanceof Date) {
                        return sale.fecha.getTime();
                    }
                    // Asumir objeto Firestore Timestamp
                    return (sale.fecha?.seconds || 0) * 1000; 
                };
                return getDate(b) - getDate(a);
            });
    }, [sales, clientId]);

    // --- NUEVA FUNCIÓN: Eliminar Venta ---
    const handleDeleteSale = async (saleId: string) => {
        if (isDeleting) return; // Evitar doble clic

        // 1. Confirmación
        Alert.alert(
            "Confirmar Eliminación",
            "¿Está seguro de que desea eliminar esta venta pendiente? Esta acción no se puede deshacer.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            // 2. Eliminar de Firestore
                            const saleRef = doc(db, 'ventas', saleId);
                            await deleteDoc(saleRef);

                            Toast.show({
                                type: 'success',
                                text1: 'Venta Eliminada',
                                text2: 'La venta ha sido eliminada correctamente.',
                                position: 'bottom'
                            });

                            // 3. Actualizar datos locales
                            await refreshAllData();

                        } catch (error) {
                            console.error("Error al eliminar la venta:", error);
                            Toast.show({
                                type: 'error',
                                text1: 'Error',
                                text2: 'No se pudo eliminar la venta.',
                                position: 'bottom'
                            });
                        } finally {
                            setIsDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    // --- Funciones de ayuda para el renderizado ---
    const getStatusColor = (estado: Sale['estado']) => {
        switch (estado) {
            case 'Pagada': return COLORS.success;
            case 'Adeuda': return COLORS.warning;
            case 'Pendiente de Pago': return COLORS.textSecondary;
            case 'Repartiendo': return COLORS.warning;
            case 'Anulada': return COLORS.danger;
            default: return COLORS.textSecondary;
        }
    };

    const getStatusIcon = (estado: Sale['estado']) => {
        switch (estado) {
            case 'Pagada': return 'check-circle';
            case 'Adeuda': return 'alert-circle';
            case 'Pendiente de Pago': return 'clock';
            case 'Repartiendo': return 'truck';
            case 'Anulada': return 'x-circle';
            default: return 'help-circle';
        }
    };

    // Función de ayuda para formatear fecha
    const formatDate = (date: Sale['fecha']) => {
        try {
            let d: Date;
            if (date instanceof Date) {
                d = date;
            } else {
                d = new Date((date?.seconds || 0) * 1000);
            }
            if (isNaN(d.getTime())) {
                return 'Fecha inválida';
            }
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) {
            console.error("Error formateando fecha:", date, e);
            return "Fecha errónea";
        }
    };

    // --- Renderizado de cada item de venta ---
    // --- MODIFICADO: Añade botones de acción ---
    const renderSaleCard = ({ item }: { item: Sale }) => {
        const color = getStatusColor(item.estado);
        const icon = getStatusIcon(item.estado);

        // Comprueba si la venta es editable/eliminable
        const isPending = item.estado === 'Pendiente de Pago';

        return (
            <TouchableOpacity
                style={[styles.saleCard, item.estado === 'Anulada' && styles.anuladaCard]}
                onPress={() => router.push({ pathname: '/sale-detail', params: { saleId: item.id } })}
                activeOpacity={0.8}
            >
                <View style={[styles.statusIcon, { backgroundColor: `${color}30` }]}>
                    <Feather name={icon} size={24} color={color} />
                </View>

                <View style={styles.saleInfo}>
                    <Text style={styles.saleDate}>{formatDate(item.fecha)}</Text>
                    <Text style={styles.saleTotal}>${item.totalVenta.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</Text>
                    <Text style={[styles.saleStatus, { color: color }]}>{item.estado}</Text>
                </View>

                {/* --- NUEVOS BOTONES DE ACCIÓN --- */}
                <View style={styles.actionButtonsContainer}>
                    {isPending ? (
                        <>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={(e) => {
                                    e.stopPropagation(); // Evita que se active el onPress de la tarjeta
                                    // Navega a la pantalla de crear/editar venta, pasando el ID de la venta
                                    router.push({
                                        pathname: '/create-sale',
                                        params: {
                                            clientId: client?.id,
                                            saleId: item.id,
                                            isEditing: 'true' // Flag para que create-sale sepa que está editando
                                        }
                                    });
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Feather name="edit" size={22} color={COLORS.primary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={(e) => {
                                    e.stopPropagation(); // Evita que se active el onPress de la tarjeta
                                    handleDeleteSale(item.id);
                                }}
                                disabled={isDeleting} // Deshabilita mientras se borra
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Feather name="trash-2" size={22} color={isDeleting ? COLORS.textSecondary : (COLORS.danger || '#E53E3E')} />
                            </TouchableOpacity>
                        </>
                    ) : (
                        // Muestra la flecha normal si no está pendiente
                        <Feather name="chevron-right" size={24} color={COLORS.textSecondary} />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    if (isLoading && !client) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={StyleSheet.absoluteFill} />
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (!client) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                        <Feather name="arrow-left" size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                </View>
                <View style={styles.emptyContainer}>
                    <Feather name="user-x" size={48} color={COLORS.textSecondary} />
                    <Text style={styles.title}>Cliente no encontrado</Text>
                    <Text style={styles.subtitle}>No se pudo cargar la información del cliente.</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.backgroundStart} />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
            
            <FlatList
                ListHeaderComponent={
                    <>
                        <View style={styles.header}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                                <Feather name="arrow-left" size={24} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push({ pathname: '/edit-client', params: { clientId: client.id } })} style={styles.headerButton}>
                                <Feather name="edit" size={24} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.infoContainer}>
                            <View style={styles.avatar}>
                                <Feather name="user" size={40} color={COLORS.primary} />
                            </View>
                            <Text style={styles.title} numberOfLines={2}>{client.nombre}</Text>
                            {client.direccion && <Text style={styles.subtitle}><Feather name="map-pin" size={14} /> {client.direccion}</Text>}
                            {client.telefono && <Text style={styles.subtitle}><Feather name="phone" size={14} /> {client.telefono}</Text>}
                        </View>

                        <View style={styles.actionsContainer}>
                            <TouchableOpacity
                                style={styles.mainActionButton}
                                onPress={() => router.push({ pathname: '/create-sale', params: { clientId: client.id } })}
                            >
                                <Feather name="plus-circle" size={22} color={COLORS.primaryDark} />
                                <Text style={styles.mainActionButtonText}>Nueva Venta</Text>
                            </TouchableOpacity>
                            <View style={styles.secondaryActionsRow}>
                                <TouchableOpacity
                                    style={[styles.secondaryActionButton, { flex: 1 }]}
                                    onPress={() => router.push({ pathname: '/register-payment', params: { clientId: client.id } })}
                                >
                                    <Feather name="dollar-sign" size={20} color={COLORS.primary} />
                                    <Text style={styles.secondaryActionButtonText}>Registrar Pago</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.secondaryActionButton, { width: 60 }]}
                                    onPress={() => router.push({ pathname: '/client-debts', params: { clientId: client.id } })}
                                >
                                    <Feather name="list" size={20} color={COLORS.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        
                        <Text style={styles.listHeader}>Historial de Ventas</Text>
                    </>
                }
                data={clientSales}
                keyExtractor={(item) => item.id}
                renderItem={renderSaleCard}
                contentContainerStyle={styles.listContentContainer}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Feather name="file-text" size={32} color={COLORS.textSecondary} />
                        <Text style={styles.emptyText}>Este cliente aún no tiene ventas registradas.</Text>
                    </View>
                }
                ListFooterComponent={<View style={{ height: 40 }} />}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundEnd },
    background: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: (StatusBar.currentHeight || 0) + 10,
        paddingBottom: 10,
        paddingHorizontal: 10,
        backgroundColor: 'transparent',
    },
    headerButton: { padding: 10 },
    
    infoContainer: { paddingHorizontal: 20, alignItems: 'center', marginBottom: 25 },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.glass, justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: COLORS.glassBorder },
    title: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 5 },
    
    actionsContainer: { paddingHorizontal: 20, marginBottom: 30, gap: 15 },
    secondaryActionsRow: { flexDirection: 'row', gap: 15 },
    mainActionButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: COLORS.primary, padding: 15, borderRadius: 15 },
    mainActionButtonText: { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 18 },
    secondaryActionButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: COLORS.glass, padding: 15, borderRadius: 15, borderWidth: 1, borderColor: COLORS.glassBorder },
    secondaryActionButtonText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 16 }, // Ajustado
    
    listHeader: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary, paddingHorizontal: 20, marginBottom: 10 },
    listContentContainer: { paddingBottom: 20 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 20, marginTop: 30, gap: 10 },
    emptyText: { color: COLORS.textSecondary, textAlign: 'center', fontStyle: 'italic', fontSize: 15 },
    
    saleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.glass,
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        marginHorizontal: 20, // Añadido para consistencia
        borderWidth: 1,
        borderColor: COLORS.glassBorder
    },
    anuladaCard: { opacity: 0.6, backgroundColor: 'rgba(255, 255, 255, 0.05)'},
    statusIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    saleInfo: { flex: 1, marginRight: 10 },
    saleDate: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 2 },
    saleTotal: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '600' },
    saleStatus: { fontSize: 14, fontWeight: '500', marginTop: 3 },

    // --- NUEVOS ESTILOS ---
    actionButtonsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    actionButton: {
        padding: 8, // Área de toque
        marginLeft: 8, // Espacio entre botones
    },
});

export default ClientDashboardScreen;