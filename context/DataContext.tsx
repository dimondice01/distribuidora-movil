import AsyncStorage from '@react-native-async-storage/async-storage';
// Se añade 'updateDoc' a la lista de importación
import { collection, doc, getDoc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import { auth, db } from '../db/firebase-service';

// --- Definición de Interfaces Estrictas ---

export interface Product {
    id: string;
    nombre: string;
    precio: number;
    costo: number;
    stock?: number;
    categoriaId?: string;
    comisionEspecifica?: number;
}

export interface CartItem extends Product {
    quantity: number;
    comision: number;
    precioOriginal?: number; // Precio antes de aplicar promociones (Opcional)
}

export interface Client {
    id: string;
    nombre: string;
    nombreCompleto?: string;
    direccion?: string;
    barrio?: string;
    localidad?: string;
    telefono?: string;
    email?: string;
    zonaId?: string;
    vendedorAsignadoId?: string;
    location?: { latitude: number; longitude: number; } | null;
    fechaCreacion?: any; // Puede ser Date o Timestamp
}

export interface Category {
    id: string;
    nombre: string;
}

export interface Promotion {
    id: string;
    nombre: string;
    estado: 'activa' | 'inactiva';
    // --- AÑADIDO: Campos que faltaban para las promos de create-sale ---
    tipo: string;
    productoIds: string[];
    clienteIds?: string[];
    nuevoPrecio?: number;
    // ... otros campos de promoción
}

export interface Zone {
    id: string;
    nombre: string;
}

export interface Vendor {
    id: string;
    nombre: string; // <-- CORREGIDO: Usar 'nombre'
    nombreCompleto?: string; // Mantener por si acaso
    rango: 'Vendedor' | 'Reparto' | 'Admin';
    zonasAsignadas?: string[];
    comisionGeneral?: number;
    firebaseAuthUid?: string; // <-- AÑADIDO: Campo de enlace
}

// --- INTERFAZ SALE CORREGIDA (MOLDE ÚNICO) ---
export interface Sale {
    id: string;
    clienteId: string;
    clientName: string; // <-- Mantenemos este
    clienteNombre?: string; // <-- Y este para compatibilidad
    vendedorId: string;
    vendedorName: string; // <-- Mantenemos este
    vendedorNombre?: string; // <-- Y este para compatibilidad
    items: CartItem[];
    totalVenta: number; // <-- Nombre correcto
    totalCosto: number;
    totalComision: number;
    observaciones: string;
    estado: 'Pagada' | 'Adeuda' | 'Pendiente de Pago' | 'Repartiendo' | 'Anulada'; // <-- Nombre correcto
    fecha: { seconds: number } | Date; // <-- Nombre correcto
    saldoPendiente: number;
    paymentMethod?: 'contado' | 'cuenta_corriente'; // <-- AÑADIDO

    // --- CAMBIO CLAVE: AÑADIDO CAMPO FALTANTE ---
    totalDescuentoPromociones?: number;
}
// --- FIN INTERFAZ SALE ---


export interface Route {
    id: string;
    repartidorId: string;
    fecha: { seconds: number } | Date;
    // ... otros campos de ruta
}


// --- INTERFAZ IDataContext ---
export interface IDataContext {
    products: Product[];
    clients: Client[];
    categories: Category[];
    promotions: Promotion[];
    availableZones: Zone[];
    vendors: Vendor[];
    sales: Sale[];
    routes: Route[];
    syncData: () => Promise<void>;
    refreshAllData: () => Promise<void>;
    isLoading: boolean;
}

// Valor por defecto para el contexto
const defaultContextValue: IDataContext = {
    products: [],
    clients: [],
    categories: [],
    promotions: [],
    availableZones: [],
    vendors: [],
    sales: [],
    routes: [],
    syncData: async () => { console.warn("Llamada a syncData por defecto"); },
    refreshAllData: async () => { console.warn("Llamada a refreshAllData por defecto"); },
    isLoading: true,
};

const DataContext = createContext<IDataContext>(defaultContextValue);

export const DataProvider = ({ children }: { children: ReactNode }) => {
    // --- ESTADOS CON TIPOS ESTRICTOS ---
    const [products, setProducts] = useState<Product[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [availableZones, setAvailableZones] = useState<Zone[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Función auxiliar para parsear fechas al cargar desde AsyncStorage
    const parseWithDates = (jsonString: string | null): any[] => {
        if (!jsonString) return [];
        try {
            return JSON.parse(jsonString, (key, value) => {
                if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
                    return new Date(value);
                }
                return value;
            });
        } catch (e) {
            console.error("Error parseando JSON con fechas:", e);
            return [];
        }
    };

    // Carga inicial desde el almacenamiento local
    useEffect(() => {
        const loadDataFromStorage = async () => {
            setIsLoading(true);
            try {
                console.log("Intentando cargar datos desde el almacenamiento local...");
                const keys = ['products', 'clients', 'categories', 'promotions', 'availableZones', 'vendors', 'sales', 'routes'];
                const storedData = await AsyncStorage.multiGet(keys);
                const dataMap = new Map(storedData);

                const setDataState = (key: string, setter: React.Dispatch<React.SetStateAction<any[]>>, parseDates = false) => {
                    const jsonData = dataMap.get(key);
                    if (jsonData) {
                        try {
                            const parsed = parseDates ? parseWithDates(jsonData) : JSON.parse(jsonData);
                            // Asegurar que los items de las ventas tengan precioOriginal
                            if (key === 'sales') {
                                const salesData = (parsed as Sale[]).map(sale => ({
                                    ...sale,
                                    items: (sale.items || []).map(item => ({
                                        ...item,
                                        precioOriginal: item.precioOriginal ?? item.precio
                                    }))
                                }));
                                setter(salesData);
                            } else {
                                setter(parsed);
                            }
                        } catch (e) {
                            console.warn(`Error parseando ${key} de AsyncStorage`, e);
                            setter([]); // Resetea si está corrupto
                        }
                    } else {
                         setter([]); // Si no hay datos, inicializa como array vacío
                    }
                };

                setDataState('products', setProducts);
                setDataState('clients', setClients);
                setDataState('categories', setCategories);
                setDataState('promotions', setPromotions);
                setDataState('availableZones', setAvailableZones);
                setDataState('vendors', setVendors);
                setDataState('sales', setSales, true); // Asegura manejo de precioOriginal
                setDataState('routes', setRoutes, true);

                console.log("Datos locales cargados.");
            } catch (e) {
                console.error("Error al cargar datos locales:", e);
            } finally {
                setIsLoading(false);
            }
        };

        loadDataFromStorage();
    }, []);

    // Función principal para obtener datos de Firestore y guardar localmente
    const fetchDataAndStore = useCallback(async (showToast = true) => {
        setIsLoading(true);
        console.log("Iniciando obtención de datos desde Firestore...");
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("No hay usuario autenticado para obtener datos.");

            // --- CORRECCIÓN: Buscar vendedor por 'firebaseAuthUid' en lugar de usar UID como Doc ID ---
            const vendorsQuerySnap = await getDocs(query(collection(db, 'vendedores'), where('firebaseAuthUid', '==', currentUser.uid)));

            let vendorDoc;

            if (vendorsQuerySnap.empty) {
                // Si está vacío, intentamos el método antiguo como fallback por si acaso
                console.warn("No se encontró vendedor por 'firebaseAuthUid', intentando por Doc ID (método antiguo)...");
                const vendorRef = doc(db, 'vendedores', currentUser.uid);
                const vendorSnap = await getDoc(vendorRef);
                if (!vendorSnap.exists()) throw new Error("Datos del vendedor actual no encontrados en Firestore.");

                // Si encontramos por el método antiguo, lo registramos y actualizamos
                console.log("Vendedor encontrado por Doc ID. Actualizando documento con 'firebaseAuthUid'...");
                // --- AQUÍ SE USA 'updateDoc' ---
                await updateDoc(vendorRef, { firebaseAuthUid: currentUser.uid });
                vendorDoc = vendorSnap; // Usamos el documento que ya obtuvimos
            } else {
                 vendorDoc = vendorsQuerySnap.docs[0]; // Usamos el documento encontrado
            }
            // --- FIN CORRECCIÓN BÚSQUEDA VENDEDOR ---

            const userData = { id: vendorDoc.id, ...vendorDoc.data() } as Vendor;
            const userRole = userData.rango;

            console.log(`Usuario identificado con rol: ${userRole} (ID: ${userData.id})`);

            // Queries base
            const productsQuery = getDocs(query(collection(db, 'productos')));
            const categoriesQuery = getDocs(query(collection(db, 'categorias')));
            const promosQuery = getDocs(query(collection(db, 'promociones'), where('estado', '==', 'activa')));
            const allVendorsQuery = getDocs(query(collection(db, 'vendedores'))); // Todos los vendedores

            let finalData: IDataContext = { ...defaultContextValue, isLoading: true };

            // Procesador genérico (convierte Timestamp a Date)
            const processFirebaseDoc = (docSnap: any): any => {
                const data = docSnap.data();
                Object.keys(data).forEach(key => {
                    if (data[key] instanceof Timestamp) {
                        data[key] = data[key].toDate();
                    }
                });
                return { id: docSnap.id, ...data };
            };

            // Procesador específico para Sales (asegura 'items' y 'precioOriginal')
             const processFirebaseSale = (docSnap: any): Sale => {
                const rawData = processFirebaseDoc(docSnap); // Primero convierte Timestamps
                const items = (rawData.items || []).map((item: any) => ({
                    ...item,
                    precioOriginal: item.precioOriginal ?? item.precio
                }));

                // --- CORREGIDO: Mapeo explícito y compatible (acepta nombres viejos y nuevos) ---
                return {
                    id: rawData.id,
                    clienteId: rawData.clienteId || rawData.clientId || '', // Acepta ambos
                    clientName: rawData.clientName || rawData.clienteNombre || 'Cliente anónimo',
                    clienteNombre: rawData.clienteNombre || rawData.clientName, // Doble mapeo
                    vendedorId: rawData.vendedorId || rawData.vendorId || '', // Acepta ambos
                    vendedorName: rawData.vendedorName || rawData.vendedorNombre || 'Vendedor anónimo',
                    vendedorNombre: rawData.vendedorNombre || rawData.vendedorName, // Doble mapeo
                    items: items,
                    totalVenta: rawData.totalVenta ?? rawData.totalAmount ?? 0, // Acepta ambos
                    totalCosto: rawData.totalCosto ?? 0,
                    totalComision: rawData.totalComision ?? 0,
                    observaciones: rawData.observaciones || '',
                    estado: rawData.estado || rawData.status || 'Pendiente de Pago', // Acepta ambos
                    fecha: rawData.fecha || rawData.saleDate || new Date(0), // Acepta ambos
                    saldoPendiente: rawData.saldoPendiente ?? 0,
                    paymentMethod: rawData.paymentMethod,
                    totalDescuentoPromociones: rawData.totalDescuentoPromociones ?? 0, // <-- AÑADIDO
                 } as Sale;
            };

            // Ejecuta queries base
            const [productsSnap, categoriesSnap, promosSnap, vendorsSnap] = await Promise.all([
                productsQuery, categoriesQuery, promosQuery, allVendorsQuery
            ]);
            finalData.products = productsSnap.docs.map(processFirebaseDoc) as Product[];
            finalData.categories = categoriesSnap.docs.map(processFirebaseDoc) as Category[];
            finalData.promotions = promosSnap.docs.map(processFirebaseDoc) as Promotion[];
            finalData.vendors = vendorsSnap.docs.map(processFirebaseDoc) as Vendor[];

            // Queries condicionales
            if (userRole === 'Reparto') {
                // --- CORREGIDO: Usar userData.id (Doc ID) en lugar de currentUser.uid (Auth ID) ---
                const routesQuery = getDocs(query(collection(db, 'rutas'), where('repartidorId', '==', userData.id)));
                const routesSnap = await routesQuery;
                finalData.routes = routesSnap.docs.map(processFirebaseDoc) as Route[];

            } else { // Vendedor o Admin
                // --- CORREGIDO: Usar userData.id (Doc ID) en lugar de currentUser.uid (Auth ID) ---
                const clientsQuery = getDocs(query(collection(db, 'clientes'), where('vendedorAsignadoId', '==', userData.id)));
                const salesQuery = getDocs(query(collection(db, 'ventas'), where('vendedorId', '==', userData.id)));
                const [clientsSnap, salesSnap] = await Promise.all([clientsQuery, salesQuery]);

                finalData.clients = clientsSnap.docs.map(processFirebaseDoc) as Client[];
                finalData.sales = salesSnap.docs.map(processFirebaseSale); // Usa el procesador de ventas

                const zoneIds = userData.zonasAsignadas || [];
                 if (zoneIds.length > 0) {
                     if (zoneIds.length > 30) { // Límite de 'in' en Firestore
                         console.warn("Demasiadas zonas asignadas (>30). Cargando solo las primeras 30.");
                         const limitedZoneIds = zoneIds.slice(0, 30);
                         const zonesQuery = getDocs(query(collection(db, 'zonas'), where('__name__', 'in', limitedZoneIds)));
                         finalData.availableZones = (await zonesQuery).docs.map(processFirebaseDoc).filter(Boolean) as Zone[];
                     } else {
                         const zonesQuery = getDocs(query(collection(db, 'zonas'), where('__name__', 'in', zoneIds)));
                         finalData.availableZones = (await zonesQuery).docs.map(processFirebaseDoc).filter(Boolean) as Zone[];
                     }
                } else { finalData.availableZones = []; }
            }

            // Guardar en AsyncStorage
            await Promise.all([
                AsyncStorage.setItem('products', JSON.stringify(finalData.products)),
                AsyncStorage.setItem('categories', JSON.stringify(finalData.categories)),
                AsyncStorage.setItem('promotions', JSON.stringify(finalData.promotions)),
                AsyncStorage.setItem('vendors', JSON.stringify(finalData.vendors)),
                AsyncStorage.setItem('clients', JSON.stringify(finalData.clients)),
                AsyncStorage.setItem('availableZones', JSON.stringify(finalData.availableZones)),
                AsyncStorage.setItem('sales', JSON.stringify(finalData.sales)),
                AsyncStorage.setItem('routes', JSON.stringify(finalData.routes)),
            ]);

            // Actualizar estado de React
            setProducts(finalData.products);
            setCategories(finalData.categories);
            setPromotions(finalData.promotions);
            setVendors(finalData.vendors);
            setClients(finalData.clients);
            setAvailableZones(finalData.availableZones);
            setSales(finalData.sales);
            setRoutes(finalData.routes);

            if (showToast) {
                Toast.show({ type: 'success', text1: 'Datos Sincronizados', text2: 'La información ha sido actualizada. 👋', position: 'bottom', visibilityTime: 3000 });
            }
            console.log("Obtención de datos y guardado local completado.");

        } catch (error: any) {
            console.error("Error durante la obtención de datos:", error);
            if (showToast) {
                Toast.show({ type: 'error', text1: 'Error de Sincronización', text2: error.message || 'No se pudieron obtener los datos.' });
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Funciones sync y refresh (sin cambios)
    const syncData = useCallback(async () => {
        await fetchDataAndStore(true);
    }, [fetchDataAndStore]);

    const refreshAllData = useCallback(async () => {
        await fetchDataAndStore(true);
    }, [fetchDataAndStore]);


    // Valor que se provee a los componentes hijos
    const value: IDataContext = {
        products,
        clients,
        categories,
        promotions,
        availableZones,
        vendors,
        sales,
        routes,
        syncData,
        refreshAllData,
        isLoading
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// Hook personalizado para usar el contexto
export const useData = (): IDataContext => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData debe ser usado dentro de un DataProvider');
    }
    return context;
};