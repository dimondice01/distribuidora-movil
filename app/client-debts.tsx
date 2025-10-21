import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, runTransaction, Timestamp } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useData } from '../context/DataContext';
import { db } from '../db/firebase-service';
import { COLORS } from '../styles/theme';

// --- INTERFACES ---
interface DebtSale {
    id: string;
    fecha: { seconds: number };
    totalVenta: number;
    saldoPendiente: number;
    clienteNombre?: string;
    numeroFactura?: string;
    vendedorId?: string;
    vendedorNombre?: string;
    porcentajeComision?: number;
    totalComision?: number;
}

// --- CORRECCIÓN 1: Se define una interfaz para los props del Modal ---
interface RegisterPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    debt: DebtSale | null;
    onPaymentSuccess: () => void;
}

// --- COMPONENTE MODAL PARA REGISTRAR PAGO ---
const RegisterPaymentModal = ({ visible, onClose, debt, onPaymentSuccess }: RegisterPaymentModalProps) => {
    const [amount, setAmount] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { clientName } = useLocalSearchParams();

    // CORRECCIÓN 3: Se añade un chequeo para asegurar que 'debt' no sea nulo
    if (!debt) return null;

    const handleConfirmPayment = async () => {
        const paymentAmount = parseFloat(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            Alert.alert("Error", "Por favor, ingresa un monto válido.");
            return;
        }
        if (paymentAmount > debt.saldoPendiente) {
            Alert.alert("Error", `El monto no puede ser mayor al saldo pendiente de $${debt.saldoPendiente.toFixed(2)}.`);
            return;
        }

        setIsSaving(true);
        try {
            await runTransaction(db, async (transaction) => {
                await addDoc(collection(db, 'ventas'), {
                    clientName: `Cobro Saldo - ${clientName}`,
                    estado: "Pagada",
                    fecha: Timestamp.now(),
                    numeroFactura: `COBRO-${debt.numeroFactura || debt.id.substring(0,6)}`,
                    pagoEfectivo: paymentAmount,
                    pagoTransferencia: 0,
                    saldoPendiente: 0,
                    vendedorId: debt.vendedorId,
                    vendedorNombre: debt.vendedorNombre,
                });

                const saleRef = doc(db, 'ventas', debt.id);
                const saleDoc = await transaction.get(saleRef);
                if (!saleDoc.exists()) throw new Error("La factura original no fue encontrada.");
                
                const data = saleDoc.data();
                const newBalance = (data.saldoPendiente || 0) - paymentAmount;
                const newStatus = newBalance <= 0.01 ? "Pagada" : "Adeuda";
                
                const finalCommission = newStatus === 'Pagada' 
                    ? data.totalVenta * ((data.porcentajeComision || 0) / 100) 
                    : (data.totalComision || 0);

                transaction.update(saleRef, {
                    saldoPendiente: newBalance,
                    estado: newStatus,
                    totalComision: finalCommission,
                });
            });

            Toast.show({ type: 'success', text1: 'Cobro registrado con éxito!' });
            onPaymentSuccess();
            onClose();

        } catch (error) {
            console.error("Error en la transacción de cobro:", error);
            Toast.show({ type: 'error', text1: 'Error al registrar el cobro', text2: (error as Error).message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Registrar Cobro</Text>
                    <Text style={styles.modalSubtitle}>Venta del {new Date(debt.fecha.seconds * 1000).toLocaleDateString('es-AR')}</Text>
                    <Text style={styles.modalDebt}>Saldo actual: ${debt.saldoPendiente.toFixed(2)}</Text>
                    
                    <TextInput
                        style={styles.input}
                        placeholder="Monto Cobrado"
                        keyboardType="numeric"
                        value={amount}
                        onChangeText={setAmount}
                        autoFocus
                    />

                    <View style={styles.modalActions}>
                        <TouchableOpacity onPress={onClose} style={styles.modalButtonCancel}>
                            <Text style={styles.modalButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleConfirmPayment} disabled={isSaving} style={styles.modalButtonConfirm}>
                            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>Confirmar</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};


const ClientDebtsScreen = () => {
    const { clientId, clientName } = useLocalSearchParams();
    const { sales, isLoading, syncData } = useData();

    const [modalVisible, setModalVisible] = useState(false);
    const [selectedDebt, setSelectedDebt] = useState<DebtSale | null>(null);

    const debts: DebtSale[] = useMemo(() => {
        return sales
            .filter(sale => sale.clienteId === clientId && sale.estado === 'Adeuda' && (sale.saldoPendiente || 0) > 0)
            .sort((a, b) => (a.fecha?.seconds || 0) - (b.fecha?.seconds || 0));
    }, [sales, clientId]);
    
    const formatFirebaseDate = (timestamp: { seconds: number }) => {
        if (!timestamp?.seconds) return 'Fecha inválida';
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString('es-AR');
    };

    const handleOpenModal = (debt: DebtSale) => {
        setSelectedDebt(debt);
        setModalVisible(true);
    };

    if (isLoading && sales.length === 0) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Saldos a Cobrar</Text>
            </View>
            <Text style={styles.clientName}>{clientName}</Text>

            <FlatList
                data={debts}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 15 }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Feather name="check-circle" size={40} color={COLORS.success} />
                        <Text style={styles.emptyText}>¡Este cliente no tiene saldos pendientes!</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        style={styles.debtCard}
                        onPress={() => handleOpenModal(item)}
                    >
                        <View>
                            <Text style={styles.debtDate}>Venta del {formatFirebaseDate(item.fecha)} (Total: ${item.totalVenta.toFixed(2)})</Text>
                            <Text style={styles.debtAmount}>Saldo: ${(item.saldoPendiente || 0).toFixed(2)}</Text>
                        </View>
                        <Feather name="dollar-sign" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                )}
            />
            
            {/* CORRECCIÓN 2: El prop `debt` ahora se pasa correctamente y cumple con el tipo `DebtSale | null` */}
            <RegisterPaymentModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                debt={selectedDebt}
                onPaymentSuccess={syncData}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundEnd },
    background: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.backgroundEnd },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 10, paddingHorizontal: 20 },
    backButton: { position: 'absolute', left: 20, top: 60, padding: 10, zIndex: 1 },
    title: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary },
    clientName: { color: COLORS.textSecondary, fontSize: 18, textAlign: 'center', marginBottom: 15 },
    
    emptyContainer: { alignItems: 'center', marginTop: 80, gap: 15 },
    emptyText: { color: COLORS.textSecondary, fontSize: 16 },
    
    debtCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.glass, padding: 20, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: COLORS.glassBorder },
    debtDate: { color: COLORS.textSecondary, fontSize: 14, },
    debtAmount: { color: COLORS.warning, fontSize: 18, fontWeight: 'bold', marginTop: 5 },

    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalContent: { width: '90%', backgroundColor: COLORS.backgroundStart, borderRadius: 20, padding: 25, borderWidth: 1, borderColor: COLORS.glassBorder },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, textAlign: 'center' },
    modalSubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 15 },
    modalDebt: { fontSize: 18, fontWeight: '600', color: COLORS.warning, textAlign: 'center', marginBottom: 20 },
    input: { backgroundColor: COLORS.glass, color: COLORS.textPrimary, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 10, fontSize: 18, textAlign: 'center', borderWidth: 1, borderColor: COLORS.glassBorder },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25, gap: 10 },
    modalButtonCancel: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: COLORS.disabled },
    modalButtonConfirm: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: COLORS.success },
    modalButtonText: { color: COLORS.primaryDark, fontWeight: 'bold', textAlign: 'center', fontSize: 16 },
});

export default ClientDebtsScreen;