import { Feather } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
// --- MEJORA: Añadimos Timestamp ---
import { collection, doc, increment, runTransaction, Timestamp, writeBatch } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useData } from '../context/DataContext';
import { auth, db } from '../db/firebase-service';
import { generateInvoiceHtml } from '../services/pdfGenerator';
import { COLORS } from '../styles/theme';

// --- INTERFACES ---
interface CartItem { id: string; nombre: string; precio: number; costo: number; quantity: number; comision: number; }

// --- ELIMINADO: La interfaz Promotion no era necesaria aquí ---

// --- CORREGIDO: Esta interfaz ahora se usará explícitamente ---
interface CartItemWithDiscount extends CartItem { discount: number; promoDescription: string | null; }

const ReviewSaleScreen = () => {
    const params = useLocalSearchParams();
    const { clientId, clientName } = params;
    
    const { promotions, clients } = useData();
    const [cart, setCart] = useState<CartItem[]>(() => params.cart ? JSON.parse(params.cart as string) : []);
    const [isSaving, setIsSaving] = useState(false);
    
    const clientData = useMemo(() => clients.find(c => c.id === clientId), [clients, clientId]);

    // --- CORREGIDO: Usamos la interfaz para dar un tipo explícito al resultado ---
    const cartWithDiscounts = useMemo<{ items: CartItemWithDiscount[], totalDiscount: number }>(() => {
        const itemsWithDiscount = cart.map(item => {
            const promo = promotions.find(p => p.productoId === item.id);
            let itemDiscount = 0; let promoDescription: string | null = null;
            if (promo) {
                if (promo.tipo === 'LLEVA_X_PAGA_Y' && item.quantity >= promo.condicion.cantidadMinima) {
                    const numPromos = Math.floor(item.quantity / promo.condicion.cantidadMinima);
                    const unidadesGratis = numPromos * (promo.condicion.cantidadMinima - promo.beneficio.cantidadAPagar);
                    itemDiscount = unidadesGratis * (item.precio || 0);
                    promoDescription = promo.descripcion;
                } else if (promo.tipo === 'DESCUENTO_POR_CANTIDAD' && item.quantity >= promo.condicion.cantidadMinima) {
                    itemDiscount = ((item.precio || 0) * item.quantity) * (promo.beneficio.porcentajeDescuento / 100);
                    promoDescription = promo.descripcion;
                }
            }
            return { ...item, discount: itemDiscount, promoDescription };
        });
        return { items: itemsWithDiscount, totalDiscount: itemsWithDiscount.reduce((sum, i) => sum + i.discount, 0) };
    }, [cart, promotions]);

    const cartTotal = useMemo(() => cart.reduce((total, item) => total + (item.precio || 0) * item.quantity, 0), [cart]);
    const finalTotal = cartTotal - cartWithDiscounts.totalDiscount;

    const totalComision = useMemo(() => {
        return cart.reduce((total, item) => {
            const comisionPorcentaje = item.comision || 0;
            const subtotalItem = (item.precio || 0) * item.quantity;
            return total + ((subtotalItem * comisionPorcentaje) / 100);
        }, 0);
    }, [cart]);

    const handleUpdateQuantity = (productId: string, amount: number) => {
        setCart(currentCart => currentCart.map(item => item.id === productId ? { ...item, quantity: item.quantity + amount } : item).filter(item => item.quantity > 0));
    };

    const handleConfirmSale = async () => {
        if (cart.length === 0 || !clientData) { Alert.alert("Faltan datos", "El carrito o los datos del cliente no están listos."); return; }
        const vendedorId = auth.currentUser?.uid; if (!vendedorId) { Alert.alert("Error", "No se pudo identificar al vendedor."); return; }
        setIsSaving(true);
        const netState = await NetInfo.fetch();
        
        const saleDataForDb = {
            clienteId: clientId as string, clientName: clientName as string, vendedorId,
            items: cartWithDiscounts.items.map(item => ({ 
                productId: item.id, nombre: item.nombre, precio: item.precio, costo: item.costo, quantity: item.quantity, 
                descuentoAplicado: item.discount, promoDescription: item.promoDescription, comision: item.comision 
            })),
            totalVentaBruto: cartTotal, totalDescuento: cartWithDiscounts.totalDiscount, totalVenta: finalTotal,
            totalCosto: cart.reduce((sum, item) => sum + (item.costo || 0) * item.quantity, 0),
            totalComision: totalComision,
            totalNetProfit: finalTotal - cart.reduce((sum, item) => sum + (item.costo || 0) * item.quantity, 0) - totalComision,
            estado: 'Pendiente de Pago', 
            // --- MEJORA: Usamos Timestamp para la fecha ---
            fecha: Timestamp.now(), 
            saldoPendiente: finalTotal, pagoEfectivo: 0, pagoTransferencia: 0,
        };

        const newSaleRef = doc(collection(db, 'ventas'));
        try {
            if (netState.isConnected) {
                await runTransaction(db, async (transaction) => {
                    const productRefs = cart.map(item => doc(db, 'productos', item.id));
                    const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));

                    for (let i = 0; i < productDocs.length; i++) {
                        const productDoc = productDocs[i];
                        const item = cart[i];
                        if (!productDoc.exists()) { throw new Error(`El producto "${item.nombre}" ya no existe.`); }
                        const currentStock = productDoc.data().stock ?? 0;
                        if (currentStock < item.quantity) { throw new Error(`Stock insuficiente para "${item.nombre}". Disponible: ${currentStock}.`); }
                    }

                    transaction.set(newSaleRef, saleDataForDb);
                    cart.forEach((item, index) => {
                        const productRef = productRefs[index];
                        transaction.update(productRef, { stock: increment(-item.quantity) });
                    });
                });
            } else {
                const batch = writeBatch(db);
                batch.set(newSaleRef, saleDataForDb);
                for (const item of cart) {
                    const productRef = doc(db, 'productos', item.id);
                    batch.update(productRef, { stock: increment(-item.quantity) });
                }
                // --- MEJORA: Usamos await para consistencia ---
                await batch.commit();
            }
            
            const invoiceData = { ...saleDataForDb, id: newSaleRef.id, cliente: clientData, distribuidora: { nombre: "Tu Distribuidora S.A.", direccion: "Calle Falsa 123, La Rioja", telefono: "380-4123456" } };
            const html = generateInvoiceHtml(invoiceData);
            const { uri } = await Print.printToFileAsync({ html });
            const alertMessage = netState.isConnected ? "¿Compartir comprobante?" : "Venta guardada offline. ¿Compartir?";
            Alert.alert("Venta Registrada", alertMessage, [
                { text: 'Compartir', onPress: async () => { await Sharing.shareAsync(uri); router.replace('/home'); }},
                { text: 'Finalizar', onPress: () => router.replace('/home'), style: 'cancel' }
            ], { cancelable: false });

        } catch (error: any) {
            console.error("Error al guardar la venta: ", error);
            Alert.alert("Error", `No se pudo registrar la venta. ${error?.message || ''}`);
            setIsSaving(false);
        }
    };
    
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={[COLORS.backgroundStart, COLORS.backgroundEnd]} style={styles.background} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} disabled={isSaving} style={styles.backButton}><Feather name="arrow-left" size={24} color={COLORS.textPrimary} /></TouchableOpacity>
                <Text style={styles.title}>Revisar Venta</Text>
            </View>
            <Text style={styles.clientInfo}>Cliente: <Text style={styles.clientName}>{clientName}</Text></Text>
            <FlatList data={cartWithDiscounts.items} keyExtractor={(item) => item.id} contentContainerStyle={styles.listContentContainer} ListHeaderComponent={<Text style={styles.listHeader}>Resumen del Carrito</Text>} ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>El carrito está vacío.</Text></View>} renderItem={({ item }) => (
                <View style={styles.itemCard}>
                    <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.nombre}</Text>
                        <Text style={[styles.itemSubtotal, item.discount > 0 && styles.strikethrough]}>${((item.precio || 0) * item.quantity).toFixed(2)}</Text>
                        {item.discount > 0 && <Text style={styles.promoText}>{item.promoDescription} (-${(item.discount || 0).toFixed(2)})</Text>}
                    </View>
                    <View style={styles.quantityControls}><TouchableOpacity style={styles.quantityButton} onPress={() => handleUpdateQuantity(item.id, -1)} disabled={isSaving}><Feather name="minus" size={20} color={COLORS.backgroundEnd} /></TouchableOpacity><Text style={styles.quantityText}>{`${item.quantity}`}</Text><TouchableOpacity style={styles.quantityButton} onPress={() => handleUpdateQuantity(item.id, 1)} disabled={isSaving}><Feather name="plus" size={20} color={COLORS.backgroundEnd} /></TouchableOpacity></View>
                </View>
            )} />
            <View style={styles.summaryContainer}>
                {cartWithDiscounts.totalDiscount > 0 && (<View style={styles.totalRow}><Text style={styles.discountText}>Descuento Total:</Text><Text style={styles.discountAmount}>-${(cartWithDiscounts.totalDiscount || 0).toFixed(2)}</Text></View>)}
                <View style={styles.totalRow}><Text style={styles.totalText}>Total Final:</Text><Text style={styles.totalAmount}>${(finalTotal || 0).toFixed(2)}</Text></View>
                <TouchableOpacity style={[styles.confirmButton, isSaving && styles.confirmButtonDisabled]} onPress={handleConfirmSale} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color={COLORS.primaryDark} /> : (<><Feather name="check-circle" size={22} color={COLORS.primaryDark} /><Text style={styles.confirmButtonText}>Confirmar Venta</Text></>)}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundEnd },
    background: { position: 'absolute', top: 0, left: 0, right: 0, height: '100%' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 10, paddingHorizontal: 20, position: 'relative' },
    backButton: { position: 'absolute', left: 20, top: 60, padding: 10 },
    title: { fontSize: 28, fontWeight: 'bold', color: COLORS.textPrimary },
    clientInfo: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20 },
    clientName: { fontWeight: 'bold', color: COLORS.textPrimary },
    listContentContainer: { paddingHorizontal: 15, paddingBottom: 180 },
    listHeader: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 15 },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: COLORS.textSecondary, fontSize: 16 },
    itemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.glass, padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.glassBorder },
    itemInfo: { flex: 1, marginRight: 10 },
    itemName: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
    itemSubtotal: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
    strikethrough: { textDecorationLine: 'line-through' },
    promoText: { color: COLORS.primary, fontSize: 13, fontStyle: 'italic', marginTop: 4 },
    quantityControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.textPrimary, borderRadius: 20 },
    quantityButton: { padding: 8 },
    quantityText: { fontSize: 16, fontWeight: 'bold', color: COLORS.backgroundEnd, marginHorizontal: 12 },
    summaryContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(24, 24, 27, 0.95)', padding: 20, borderTopWidth: 1, borderColor: COLORS.glassBorder, paddingBottom: 40 },
    discountText: { color: COLORS.primary, fontSize: 16 },
    discountAmount: { color: COLORS.primary, fontSize: 18, fontWeight: 'bold' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    totalText: { color: COLORS.textSecondary, fontSize: 18 },
    totalAmount: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold' },
    confirmButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 15, borderRadius: 15, gap: 10 },
    confirmButtonText: { color: COLORS.primaryDark, fontSize: 18, fontWeight: 'bold' },
    confirmButtonDisabled: { backgroundColor: COLORS.disabled },
});

export default ReviewSaleScreen;