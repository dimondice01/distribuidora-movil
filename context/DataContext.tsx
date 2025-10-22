import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDoc, getDocs, query, Timestamp, where } from 'firebase/firestore';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import { auth, db } from '../db/firebase-service';

// --- Define tipos más específicos si los tienes ---
// Ejemplo (reemplaza 'any' con tus tipos reales si existen):
type Product = any;
type Client = any;
type Category = any;
type Promotion = any;
type Zone = any;
type Vendor = any;
type Sale = any;
type Route = any;

// --- INTERFAZ ACTUALIZADA ---
// --- CORRECCIÓN: Añadir 'export' aquí ---
export interface IDataContext { // <-- ¡Añadir export!
    products: Product[];
    clients: Client[];
    categories: Category[];
    promotions: Promotion[];
    availableZones: Zone[];
    vendors: Vendor[];
    sales: Sale[];
    routes: Route[];
    syncData: () => Promise<void>; // Función original de sincronización (login)
    refreshAllData: () => Promise<void>; // NUEVA función para pull-to-refresh
    isLoading: boolean;
}

// Valor por defecto para el contexto, incluyendo la nueva función
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
    refreshAllData: async () => { console.warn("Llamada a refreshAllData por defecto"); }, // Función por defecto
    isLoading: true,
};

const DataContext = createContext<IDataContext>(defaultContextValue); // Usa el valor por defecto

export const DataProvider = ({ children }: { children: ReactNode }) => {
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
                // Reconvierte los strings de fecha ISO a objetos Date
                if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
                    return new Date(value);
                }
                return value;
            });
        } catch (e) {
            console.error("Error parseando JSON con fechas:", e);
            return []; // Retorna array vacío en caso de error
        }
    };

    // Carga inicial desde el almacenamiento local
    useEffect(() => {
        const loadDataFromStorage = async () => {
            setIsLoading(true); // Inicia la carga
            try {
                console.log("Intentando cargar datos desde el almacenamiento local...");
                const keys = ['products', 'clients', 'categories', 'promotions', 'availableZones', 'vendors', 'sales', 'routes'];
                const storedData = await AsyncStorage.multiGet(keys);
                const dataMap = new Map(storedData);

                // Función auxiliar para parsear y actualizar estado
                const setDataState = (key: string, setter: React.Dispatch<React.SetStateAction<any[]>>, parseDates = false) => {
                    const jsonData = dataMap.get(key);
                    if (jsonData) {
                        const parsed = parseDates ? parseWithDates(jsonData) : JSON.parse(jsonData);
                        setter(parsed);
                    }
                };

                setDataState('products', setProducts);
                setDataState('clients', setClients);
                setDataState('categories', setCategories);
                setDataState('promotions', setPromotions);
                setDataState('availableZones', setAvailableZones);
                setDataState('vendors', setVendors);
                setDataState('sales', setSales, true); // Parsea fechas para ventas
                setDataState('routes', setRoutes, true); // Parsea fechas para rutas

                console.log("Datos locales cargados.");
            } catch (e) {
                console.error("Error al cargar datos locales:", e);
                // Considera mostrar un Toast de error aquí si es apropiado
            } finally {
                setIsLoading(false); // Finaliza la carga inicial
            }
        };

        loadDataFromStorage();
    }, []); // Se ejecuta solo una vez al montar

    // Función principal para obtener datos de Firestore y guardar localmente
    const fetchDataAndStore = useCallback(async (showToast = true) => { // showToast para controlar notificaciones
        setIsLoading(true);
        console.log("Iniciando obtención de datos desde Firestore...");
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("No hay usuario autenticado para obtener datos.");

            const vendorRef = doc(db, 'vendedores', currentUser.uid);
            const vendorSnap = await getDoc(vendorRef);
            if (!vendorSnap.exists()) throw new Error("Datos del vendedor actual no encontrados en Firestore.");

            const userData = vendorSnap.data();
            const userRole = userData.rango;
            console.log(`Usuario identificado con rol: ${userRole}`);

            // Consultas base (siempre se obtienen)
            const productsQuery = getDocs(query(collection(db, 'productos')));
            const categoriesQuery = getDocs(query(collection(db, 'categorias')));
            const promosQuery = getDocs(query(collection(db, 'promociones'), where('estado', '==', 'activa')));
            const vendorsQuery = getDocs(query(collection(db, 'vendedores')));

            let finalData: {
                products: Product[], categories: Category[], promotions: Promotion[], vendors: Vendor[],
                clients: Client[], availableZones: Zone[], sales: Sale[], routes: Route[]
            } = {
                products: [], categories: [], promotions: [], vendors: [],
                clients: [], availableZones: [], sales: [], routes: []
            };

            // Función auxiliar para procesar documentos de Firebase
            const processFirebaseDoc = (docSnap: any) => {
                const data = docSnap.data();
                // Convertir Timestamps a objetos Date estándar para consistencia
                Object.keys(data).forEach(key => {
                    if (data[key] instanceof Timestamp) {
                        data[key] = data[key].toDate();
                    }
                });
                return { id: docSnap.id, ...data };
            };

            // Ejecuta las consultas base
            const [productsSnap, categoriesSnap, promosSnap, vendorsSnap] = await Promise.all([
                productsQuery, categoriesQuery, promosQuery, vendorsQuery
            ]);
            finalData.products = productsSnap.docs.map(processFirebaseDoc);
            finalData.categories = categoriesSnap.docs.map(processFirebaseDoc);
            finalData.promotions = promosSnap.docs.map(processFirebaseDoc);
            finalData.vendors = vendorsSnap.docs.map(processFirebaseDoc);

            // Consultas condicionales según el rol
            if (userRole === 'Reparto') {
                const routesQuery = getDocs(query(collection(db, 'rutas'), where('repartidorId', '==', currentUser.uid)));
                const routesSnap = await routesQuery; // Espera la consulta de rutas
                finalData.routes = routesSnap.docs.map(processFirebaseDoc);
                // Para Reparto, podrías necesitar clientes de sus rutas, etc. (Añadir lógica si es necesario)

            } else { // Asumimos Vendedor o Admin
                const clientsQuery = getDocs(query(collection(db, 'clientes'), where('vendedorAsignadoId', '==', currentUser.uid)));
                const salesQuery = getDocs(query(collection(db, 'ventas'), where('vendedorId', '==', currentUser.uid)));
                const [clientsSnap, salesSnap] = await Promise.all([clientsQuery, salesQuery]);

                finalData.clients = clientsSnap.docs.map(processFirebaseDoc);
                finalData.sales = salesSnap.docs.map(processFirebaseDoc);

                // Carga las zonas asignadas al vendedor
                const zoneIds = userData.zonasAsignadas || [];
                if (zoneIds.length > 0) {
                    // Firestore 'in' query tiene un límite (usualmente 10 o 30), si tienes muchas zonas, necesitas dividir la consulta
                    const zonesQuery = getDocs(query(collection(db, 'zonas'), where('__name__', 'in', zoneIds)));
                    const zonesSnap = await zonesQuery;
                    finalData.availableZones = zonesSnap.docs.map(processFirebaseDoc);
                }
            }

            // Guarda los datos actualizados en AsyncStorage
            // Usamos JSON.stringify que convierte Date a string ISO
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

            // Actualiza el estado de React con los nuevos datos
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

        } catch (error: any) { // Tipar error como 'any' para acceder a 'message'
            console.error("Error durante la obtención de datos:", error);
            if (showToast) {
                Toast.show({ type: 'error', text1: 'Error de Sincronización', text2: error.message || 'No se pudieron obtener los datos.' });
            }
        } finally {
            setIsLoading(false); // Finaliza el estado de carga
        }
    }, []); // useCallback con array vacío, la función no cambia

    // Función expuesta como 'syncData' (usada en login/inicio)
    const syncData = useCallback(async () => {
        await fetchDataAndStore(true); // Muestra Toast al sincronizar desde login
    }, [fetchDataAndStore]);

    // Función expuesta como 'refreshAllData' (usada para pull-to-refresh)
    const refreshAllData = useCallback(async () => {
        await fetchDataAndStore(true); // Muestra Toast al refrescar manualmente
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
        refreshAllData, // <-- Incluye la nueva función aquí
        isLoading
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// Hook personalizado para usar el contexto
export const useData = (): IDataContext => { // Asegura que el hook retorne el tipo IDataContext
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData debe ser usado dentro de un DataProvider');
    }
    return context;
};