import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useData } from '../context/DataContext';
import { COLORS } from '../styles/theme';

// --- INTERFACES ---
interface Sale {
    id: string;
    clienteId: string;
    clientName?: string;
    fecha: { seconds: number };
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
    const { clients, sales, isLoading } = useData();

    const client: Client | undefined = useMemo(() => clients.find(c => c.id === clientId), [clients, clientId]);
    
    const clientSales: Sale[] = useMemo(() => {
        if (!sales || !clientId) return [];
        return sales
            .filter(s => s.clienteId === clientId)
            .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
    }, [sales, clientId]);

    const totalDebt = useMemo(() => clientSales.reduce((sum, sale) => {
        if (sale.estado === 'Adeuda') {
            return sum + (sale.saldoPendiente || 0);
        }
        return sum;
    }, 0), [clientSales]);
    
    const formatFirebaseDate = (timestamp: { seconds: number }) => {
        if (!timestamp?.seconds) return 'Fecha inválida';
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString('es-AR');
    };
    
    const statusDetails = {
        'Pagada': { icon: 'check-circle', color: COLORS.success },
        'Adeuda': { icon: 'alert-circle', color: COLORS.warning },
        'Repartiendo': { icon: 'truck', color: COLORS.primary },
        'Pendiente de Pago': { icon: 'clock', color: COLORS.textSecondary },
        'Anulada': { icon: 'x-circle', color: COLORS.danger },
        'default': { icon: 'file-text', color: COLORS.textSecondary }
    };

    if (isLoading && !client) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    if (!client) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.emptyText}>Cliente no encontrado.</Text>
                <TouchableOpacity onPress={() => router.back()} style={{marginTop: 20}}>
                    <Text style={{color: COLORS.primary}}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Feather name="arrow-left" size={24} color={COLORS.textPrimary} /></TouchableOpacity>
                <Text style={styles.title} numberOfLines={1}>{client.nombre}</Text>
            </View>

            <View style={styles.clientCard}>
                {client.direccion && <Text style={styles.clientInfo}><Feather name="map-pin" size={14} color={COLORS.textSecondary}/> {client.direccion}</Text>}
                {client.telefono && <Text style={styles.clientInfo}><Feather name="phone" size={14} color={COLORS.textSecondary}/> {client.telefono}</Text>}
                <View style={styles.debtContainer}>
                    <Text style={styles.debtLabel}>Deuda Activa:</Text>
                    <Text style={styles.debtAmount}>${totalDebt.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
            </View>

            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={styles.mainActionButton}
                    onPress={() => router.push({ pathname: "/create-sale", params: { clientId: clientId as string, clientName: client.nombre } })}
                >
                    <Feather name="plus-circle" size={20} color={COLORS.primaryDark} />
                    <Text style={styles.mainActionButtonText}>Crear Venta</Text>
                </TouchableOpacity>

                {totalDebt > 0 && (
                    <TouchableOpacity
                        style={styles.secondaryActionButton}
                        onPress={() => router.push({ pathname: '/client-debts', params: { clientId: clientId as string, clientName: client.nombre } })}
                    >
                        <Feather name="dollar-sign" size={20} color={COLORS.primary} />
                        <Text style={styles.secondaryActionButtonText}>Gestionar Cobranza</Text>
                    </TouchableOpacity>
                )}
            </View>

            <Text style={styles.listHeader}>Historial de Movimientos</Text>
            <FlatList
                data={clientSales}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 40 }}
                ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>Este cliente no tiene ventas registradas.</Text></View>}
                renderItem={({ item }) => {
                    const statusInfo = statusDetails[item.estado] || statusDetails.default;
                    return (
                        // --- CORRECCIÓN AQUÍ ---
                        // Se pasa 'saleId' en lugar de 'saleJSON'
                        <TouchableOpacity onPress={() => router.push({ pathname: '/sale-detail', params: { saleId: item.id } })}>
                            <View style={[styles.saleCard, item.estado === 'Anulada' && styles.anuladaCard]}>
                                <View style={{...styles.statusIcon, backgroundColor: statusInfo.color }}>
                                    <Feather name={statusInfo.icon as any} size={22} color="white" />
                                </View>
                                <View style={styles.saleInfo}>
                                    <Text style={styles.saleDate}>{formatFirebaseDate(item.fecha)} - {item.estado}</Text>
                                    <Text style={styles.saleTotal}>
                                        Total: <Text style={{fontWeight: 'bold'}}>${(item.totalVenta || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                    </Text>
                                    {(item.saldoPendiente || 0) > 0 && item.estado === 'Adeuda' && (
                                        <Text style={styles.saleDebt}>
                                            Saldo: <Text style={{fontWeight: 'bold'}}>${(item.saldoPendiente || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                        </Text>
                                    )}
                                </View>
                                <Feather name="chevron-right" size={24} color={COLORS.textSecondary} />
                            </View>
                        </TouchableOpacity>
                    )
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundEnd },
    background: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.backgroundEnd },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 60 },
    backButton: { position: 'absolute', left: 15, top: 55, padding: 10, zIndex: 1 },
    title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
    
    clientCard: { backgroundColor: COLORS.glass, marginHorizontal: 15, borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: COLORS.glassBorder },
    clientName: { color: COLORS.textPrimary, fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
    clientInfo: { color: COLORS.textSecondary, fontSize: 16, marginTop: 5, flexDirection: 'row', alignItems: 'center' },
    debtContainer: { borderTopColor: COLORS.glassBorder, borderTopWidth: 1, marginTop: 15, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    debtLabel: { color: COLORS.textSecondary, fontSize: 16 },
    debtAmount: { color: COLORS.warning, fontSize: 22, fontWeight: 'bold' },
    
    actionsContainer: { marginHorizontal: 15, marginBottom: 25, gap: 10 },
    mainActionButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: COLORS.primary, padding: 15, borderRadius: 15 },
    mainActionButtonText: { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 18 },
    secondaryActionButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: COLORS.primary, padding: 15, borderRadius: 15 },
    secondaryActionButtonText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 18 },
    
    listHeader: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary, paddingHorizontal: 20, marginBottom: 10 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 20, marginTop: 30},
    emptyText: { color: COLORS.textSecondary, textAlign: 'center', fontStyle: 'italic' },
    
    saleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.glass, padding: 15, borderRadius: 12, marginBottom: 10 },
    anuladaCard: { opacity: 0.6, backgroundColor: 'rgba(255, 255, 255, 0.05)'},
    statusIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    saleInfo: { flex: 1 },
    saleDate: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
    saleTotal: { color: COLORS.textPrimary, fontSize: 16, marginTop: 2 },
    saleDebt: { color: COLORS.warning, fontSize: 16, marginTop: 2 },
});

export default ClientDashboardScreen;