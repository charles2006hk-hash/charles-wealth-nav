import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, doc, addDoc, setDoc, deleteDoc, updateDoc, 
  onSnapshot, query, orderBy, writeBatch,
  QuerySnapshot, DocumentData, DocumentSnapshot
} from "firebase/firestore";

// --- 1. Firebase 設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyAeP-GggvT31EUY4TXEnX3GYVD8bcs8NJg",
  authDomain: "charles-wealth-nav.firebaseapp.com",
  projectId: "charles-wealth-nav",
  storageBucket: "charles-wealth-nav.firebasestorage.app",
  messagingSenderId: "1066128740156",
  appId: "1:1066128740156:web:b69065931e28d7b4b59839",
  measurementId: "G-82MQGSGT3B"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 2. 類型定義 (Types) ---
interface Transaction {
  id: string; 
  date: string;
  merchant: string;
  amount: number;
  category: string;
  member: string;
  note: string;
  year: number;
  month: number;
  propertyId?: string; 
  tags?: string[]; 
  isVerified?: boolean; 
}

interface Lease {
  id: string;
  propertyId: string;
  tenantName: string;
  tenantID: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number;
  status: 'Active' | 'Terminated';
  rentFreeStart?: string;
  rentFreeEnd?: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  type: 'Investment' | 'Self-use';
  status: 'Occupied' | 'Vacant' | 'Renovation';
  
  // 財務數據
  currentValue: number; 
  purchasePrice: number; 
  mortgageAmount: number; 
  outstandingLoan: number; 
  estRent: number; 
  tenure: number;  

  // 支出設定
  managementFee: number;
  govtRates: number;
  govtRent: number;
}

interface PropertyWithStats extends Property {
    income: number;
    expense: number;
    net: number;
    activeLease?: Lease;
    isLate: boolean;
}

interface EduConfig {
  name: string;
  years: number;
  tuition: number;
  living: number;
  salary: number;
  notes: string;
  paths: { academic: string; vocational: string; };
}

interface DocConfig {
  type: 'receipt' | 'lease' | 'statement';
  propId: string;
  tenant: string;
  tenantID?: string; 
  period: string; 
  amount: number;
  deposit: number;
  startDate: string;
  endDate: string;
  landlord: string;
  landlordID?: string; 
  paymentMethod: 'Cash' | 'Cheque' | 'Bank Transfer';
  statementDateStart?: string;
  statementDateEnd?: string;
}

// --- 3. 常數與圖示 ---
const ICONS = {
  Home: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  LayoutDashboard: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>,
  Data: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  FileText: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Printer: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>,
  Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>,
  Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>,
  Edit: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
  Tag: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/></svg>,
  DollarSign: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  PieChart: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
  Shield: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  GraduationCap: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
};

// --- Constants ---
const CATEGORIES = [
  'Rental Income (租金收入)', 'Management Fee (管理費)', 'Govt Rates (差餉)', 'Govt Rent (地租)',
  'Mortgage Payment (按揭供款)', 'Repair & Maint (維修)', 'Tax (稅項)', 
  'Insurance (保險)', 'Utilities (水電煤)', 'Agent Fee (佣金)', 'Other (其他)',
  'Credit Card', 'Education', 'Transport', 'Telecom', 'Shopping', 'Dining', 'Medical', 'General'
];
const MEMBERS = ['Charles', 'Carmen', 'Virginia', 'Jason', 'Family'];

const INITIAL_PROPERTIES_DATA: Property[] = [
    { id: 'p1', name: '京瑞二期 16E', address: '沙田安群街1號京瑞廣場二期16樓E室', type: 'Investment', status: 'Occupied', currentValue: 8000000, purchasePrice: 6000000, mortgageAmount: 15000, outstandingLoan: 3000000, managementFee: 1200, govtRates: 1500, govtRent: 900, estRent: 25000, tenure: 15 },
    { id: 'p2', name: '京瑞二期 16F', address: '沙田安群街1號京瑞廣場二期16樓F室', type: 'Investment', status: 'Occupied', currentValue: 8000000, purchasePrice: 6000000, mortgageAmount: 15000, outstandingLoan: 3000000, managementFee: 1200, govtRates: 1500, govtRent: 900, estRent: 25000, tenure: 15 },
    { id: 'p3', name: '帝欣苑 (Parc Versailles)', address: '大埔梅樹坑路8號帝欣苑', type: 'Investment', status: 'Occupied', currentValue: 12000000, purchasePrice: 9000000, mortgageAmount: 0, outstandingLoan: 0, managementFee: 2500, govtRates: 3000, govtRent: 1800, estRent: 38000, tenure: 0 },
    { id: 'p4', name: '太湖花園 (Serenity Park)', address: '大埔大逸街太湖花園', type: 'Investment', status: 'Occupied', currentValue: 6500000, purchasePrice: 4000000, mortgageAmount: 0, outstandingLoan: 0, managementFee: 1500, govtRates: 1200, govtRent: 700, estRent: 18000, tenure: 0 },
    { id: 'p5', name: '農圃道18號 (18 Farm Road)', address: '土瓜灣農圃道18號', type: 'Self-use', status: 'Occupied', currentValue: 15000000, purchasePrice: 13000000, mortgageAmount: 25000, outstandingLoan: 6000000, managementFee: 3000, govtRates: 4000, govtRent: 2400, estRent: 0, tenure: 10 },
];

const INITIAL_EDUCATION_DB: Record<string, EduConfig> = {
  HK: { name: '香港 (HK)', years: 4, tuition: 42100, living: 60000, salary: 19000, notes: '本地', paths: { academic: 'HKU/CUHK', vocational: 'IVE/THEi' } },
  UK: { name: '英國 (UK)', years: 3, tuition: 200000, living: 150000, salary: 28000, notes: 'BNO', paths: { academic: 'Russell Group', vocational: 'BTEC' } },
  AUS: { name: '澳洲 (AUS)', years: 3, tuition: 180000, living: 180000, salary: 32000, notes: '環境好', paths: { academic: 'Go8', vocational: 'TAFE' } },
  CAN: { name: '加拿大 (CAN)', years: 2, tuition: 150000, living: 120000, salary: 26000, notes: '移民', paths: { academic: 'UBC/UT', vocational: 'College' } }
};

const FAMILY_INFO = {
  Virginia: { age: 16, role: '女兒', educationStart: 2026 },
  Jason: { age: 13, role: '兒子', educationStart: 2029 }
};

const convertNumberToEnglish = (n: number) => n.toString(); 
const formatCurrency = (val: number) => `$${val.toLocaleString()}`;

// --- 4. 輔助組件 (StatCard) ---
const StatCard = ({ title, value, subtext, color, iconName }: any) => {
  const Icon = ICONS[iconName as keyof typeof ICONS] || ICONS.Tag;
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 h-full">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg bg-${color}-50 text-${color}-600`}><Icon /></div>
        {subtext && <span className={`text-xs px-2 py-1 rounded-full bg-${color}-50 text-${color}-600`}>{subtext}</span>}
      </div>
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
    </div>
  );
};

// --- 5. 主應用程式 (Main App) ---
const App: React.FC = () => {
  // 資料庫狀態
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [eduDB, setEduDB] = useState<Record<string, EduConfig>>(INITIAL_EDUCATION_DB);
  const [dataLoaded, setDataLoaded] = useState(false);

  // 介面狀態
  const [activeTab, setActiveTab] = useState('dashboard');
  const [propertyViewId, setPropertyViewId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'none' | 'transaction' | 'property' | 'doc'>('none');

  // 表單與文件設定
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingProp, setEditingProp] = useState<Property | null>(null);
  const [docConfig, setDocConfig] = useState<DocConfig>({ 
      type: 'receipt', propId: '', tenant: '', period: '', amount: 0, 
      deposit: 0, startDate: '', endDate: '', landlord: 'Charles Lam', 
      paymentMethod: 'Cash', statementDateStart: '', statementDateEnd: '' 
  });
  
  // 文書生成器列印模式開關 (用於隱藏選單)
  const [reportMode, setReportMode] = useState(false);

  // Filters
  const [ledgerFilter, setLedgerFilter] = useState('');
  
  // Dashboard Filters (Placeholder for future)
  const [filterYear, setFilterYear] = useState('All');
  const [filterMember, setFilterMember] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // 載入資料 (Firebase Listeners)
  useEffect(() => {
    const qTx = query(collection(db, "transactions"), orderBy("date", "desc"));
    const unsubTx = onSnapshot(qTx, s => 
        setTransactions(s.docs.map(d => ({id: d.id, ...d.data()} as Transaction))));
    
    const unsubProp = onSnapshot(collection(db, "properties"), s => 
        setProperties(s.docs.map(d => ({id: d.id, ...d.data()} as Property))));
    
    const unsubLease = onSnapshot(collection(db, "leases"), s => 
        setLeases(s.docs.map(d => ({id: d.id, ...d.data()} as Lease))));
    
    // 使用 onSnapshot 讀取但忽略參數，避免 TS6133 錯誤
    const unsubEdu = onSnapshot(doc(db, "settings", "education"), (docSnap) => {
      if (docSnap.exists()) {
        setEduDB(docSnap.data() as Record<string, EduConfig>);
      } else {
        setDoc(doc(db, "settings", "education"), INITIAL_EDUCATION_DB);
      }
    });

    setDataLoaded(true);
    return () => { unsubTx(); unsubProp(); unsubLease(); unsubEdu(); };
  }, []);

  // --- 計算屬性 (Derived Stats) ---
  const propStats = useMemo(() => {
    return properties.map(p => {
        const pTxs = transactions.filter(t => t.propertyId === p.id);
        const income = pTxs.filter(t => t.category.includes('Income')).reduce((sum, t) => sum + t.amount, 0);
        const expense = pTxs.filter(t => !t.category.includes('Income')).reduce((sum, t) => sum + t.amount, 0);
        const activeLease = leases.find(l => l.propertyId === p.id && l.status === 'Active');
        
        let isLate = false;
        if (activeLease && p.status === 'Occupied') {
            const lastRentTx = pTxs
                .filter(t => t.category.includes('Rental Income'))
                .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            if (lastRentTx) {
                const daysSince = (new Date().getTime() - new Date(lastRentTx.date).getTime()) / (1000 * 3600 * 24);
                if (daysSince > 35) isLate = true;
            }
        }
        return { ...p, income, expense, net: income - expense, activeLease, isLate } as PropertyWithStats;
    });
  }, [properties, transactions, leases]);

  const totalValuation = properties.reduce((sum, p) => sum + (p.currentValue || 0), 0);
  const totalMonthlyRent = leases.filter(l => l.status === 'Active').reduce((sum, l) => sum + (l.monthlyRent || 0), 0);

  // --- 操作函數 (Actions) ---
  const initializeDefaults = async () => {
    if(!window.confirm("初始化預設物業？")) return;
    const batch = writeBatch(db);
    INITIAL_PROPERTIES_DATA.forEach(p => {
        const ref = doc(collection(db, "properties"));
        batch.set(ref, p);
    });
    await batch.commit();
  };

  const handleSaveTransaction = async () => {
      if(!editingTx) return;
      try {
        const txData = { ...editingTx, amount: Number(editingTx.amount), year: new Date(editingTx.date).getFullYear(), month: new Date(editingTx.date).getMonth() + 1 };
        if(editingTx.id) await setDoc(doc(db, "transactions", editingTx.id), txData);
        else await addDoc(collection(db, "transactions"), txData);
        setModalMode('none');
      } catch(e) { alert(e); }
  };

  const handleSaveProperty = async () => {
      if(!editingProp) return;
      try {
        const pData = { 
            ...editingProp, 
            currentValue: Number(editingProp.currentValue), 
            purchasePrice: Number(editingProp.purchasePrice),
            mortgageAmount: Number(editingProp.mortgageAmount),
            estRent: Number(editingProp.estRent),
            tenure: Number(editingProp.tenure)
        };
        if(editingProp.id) await setDoc(doc(db, "properties", editingProp.id), pData);
        else await addDoc(collection(db, "properties"), pData);
        setModalMode('none');
      } catch(e) { alert(e); }
  };

  const deleteItem = async (col: string, id: string) => {
      if(window.confirm('確定刪除?')) await deleteDoc(doc(db, col, id));
  };

  const handlePrint = () => {
      setReportMode(true);
      setTimeout(() => {
          window.print();
          setReportMode(false);
      }, 100);
  };
  
  const handleExportJSON = () => {
      const jsonString = JSON.stringify({ meta: { generated: new Date() }, data: transactions }, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `Charles_Finance_Data.json`;
      document.body.appendChild(link);
      link.click();
  };

  // --- 視圖組件 (Views) ---

  const PropertyDashboard = () => (
      <div className="space-y-8 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard title="物業總估值 Total Valuation" value={formatCurrency(totalValuation)} color="blue" iconName="Home" subtext={`${properties.length} Properties`} />
              <StatCard title="每月租金收入 Monthly Rent" value={formatCurrency(totalMonthlyRent)} color="emerald" iconName="DollarSign" />
              <StatCard title="整體出租率 Occupancy Rate" value={`${properties.length ? (properties.filter(p=>p.status==='Occupied').length / properties.length * 100).toFixed(0) : 0}%`} color="indigo" iconName="PieChart" />
              <StatCard title="應收未收 Arrears" value={propStats.filter(p=>p.isLate).length} color="red" iconName="Shield" subtext="Units Late" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {propStats.map(p => (
                  <div key={p.id} onClick={() => setPropertyViewId(p.id)} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition cursor-pointer overflow-hidden group relative">
                      <div className={`h-2 w-full ${p.status==='Occupied' ? (p.isLate ? 'bg-orange-500' : 'bg-emerald-500') : 'bg-red-500'}`} />
                      <div className="p-5">
                          <div className="flex justify-between items-start mb-2">
                              <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition truncate">{p.name}</h3>
                              <span className={`px-2 py-1 text-xs rounded-full font-bold whitespace-nowrap ${p.status==='Occupied' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {p.status === 'Occupied' ? (p.isLate ? '欠租 Arrears' : '出租 Occupied') : '空置 Vacant'}
                              </span>
                          </div>
                          <p className="text-sm text-slate-500 mb-4 truncate">{p.address || 'No Address'}</p>
                          <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-3 rounded-lg">
                              <div><p className="text-xs text-slate-400">現時估值</p><p className="font-mono font-bold">{formatCurrency(p.currentValue)}</p></div>
                              <div><p className="text-xs text-slate-400">每月租金</p><p className="font-mono font-bold text-emerald-600">{p.activeLease ? formatCurrency(p.activeLease.monthlyRent) : '-'}</p></div>
                          </div>
                      </div>
                  </div>
              ))}
              
              {properties.length === 0 ? (
                  <button onClick={initializeDefaults} className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl hover:bg-blue-100 transition text-blue-500"><ICONS.Plus /><span className="mt-2 font-bold">初始化預設物業</span></button>
              ) : (
                  <button onClick={() => { setEditingProp({ id: '', name: '', address: '', type: 'Investment', status: 'Vacant', currentValue: 0, purchasePrice: 0, mortgageAmount: 0, outstandingLoan: 0, managementFee: 0, govtRates: 0, govtRent: 0, estRent: 0, tenure: 0 }); setModalMode('property'); }} className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-xl hover:bg-slate-50 transition text-slate-400 hover:text-slate-600"><ICONS.Plus /><span className="mt-2 font-bold">新增物業 Add Property</span></button>
              )}
          </div>
      </div>
  );

  const PropertyDetailView = ({ propId }: { propId: string }) => {
    // 使用 propStats 確保能讀取到 activeLease
    const p = propStats.find(x => x.id === propId);
    if (!p) return <div>Property not found</div>;
    
    const [viewTab, setViewTab] = useState<'overview'|'ledger'|'tenants'>('overview');
    
    const pTransactions = transactions.filter(t => t.propertyId === propId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const pLeases = leases.filter(l => l.propertyId === propId);
    
    return (
        <div className="space-y-6 animate-in fade-in">
            <button onClick={() => setPropertyViewId(null)} className="text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1">← 返回總覽 Back to Dashboard</button>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">{p.name} <span className={`text-sm px-2 py-1 rounded-full font-normal ${p.status==='Occupied'?'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}>{p.status}</span></h1>
                    <p className="text-slate-500 mt-1">{p.address}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setDocConfig({ ...docConfig, propId: p.id, type: 'lease', amount: p.activeLease?.monthlyRent || 0, tenant: p.activeLease?.tenantName || '' }); setModalMode('doc'); }} className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-100">建立租約</button>
                     <button onClick={() => { setDocConfig({ ...docConfig, propId: p.id, type: 'receipt', amount: p.activeLease?.monthlyRent || 0, tenant: p.activeLease?.tenantName || '' }); setModalMode('doc'); }} className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-bold hover:bg-emerald-100">開收據</button>
                     <button onClick={() => { setDocConfig({ ...docConfig, propId: p.id, type: 'statement', amount: 0, tenant: p.activeLease?.tenantName || '' }); setModalMode('doc'); }} className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-100">租務對數</button>
                    <button onClick={() => { setEditingProp(p); setModalMode('property'); }} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><ICONS.Edit /></button>
                </div>
            </div>

            <div className="flex gap-4 border-b border-slate-200">
                {['overview', 'ledger', 'tenants'].map(t => (
                    <button key={t} onClick={() => setViewTab(t as any)} className={`pb-2 px-1 text-sm font-bold capitalize ${viewTab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>{t}</button>
                ))}
            </div>

            {viewTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border space-y-4">
                        <h3 className="font-bold border-b pb-2">財務摘要 Financials</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><p className="text-slate-500">買入價 Purchase</p><p className="font-mono">{formatCurrency(p.purchasePrice)}</p></div>
                            <div><p className="text-slate-500">現估值 Value</p><p className="font-mono font-bold text-blue-600">{formatCurrency(p.currentValue)}</p></div>
                            <div><p className="text-slate-500">尚餘按揭 Loan</p><p className="font-mono">{formatCurrency(p.outstandingLoan)}</p></div>
                            <div><p className="text-slate-500">月供款 Mortgage</p><p className="font-mono text-red-500">-{formatCurrency(p.mortgageAmount)}</p></div>
                        </div>
                    </div>
                </div>
            )}

            {viewTab === 'ledger' && (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 flex justify-between items-center border-b">
                        <div className="flex gap-2">
                            <input type="text" placeholder="Search..." className="border rounded px-2 py-1 text-sm" value={ledgerFilter} onChange={e => setLedgerFilter(e.target.value)} />
                        </div>
                        <button onClick={() => { setEditingTx({ propertyId: p.id, date: new Date().toISOString().split('T')[0] } as any); setModalMode('transaction'); }} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 font-bold">+ 新增紀錄 Add Record</button>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0"><tr><th className="p-3">Date</th><th className="p-3">Category</th><th className="p-3">Detail</th><th className="p-3">Amount</th><th className="p-3">Tags</th><th className="p-3">Action</th></tr></thead>
                            <tbody className="divide-y">
                                {pTransactions.filter(t => JSON.stringify(t).toLowerCase().includes(ledgerFilter.toLowerCase())).map(t => (
                                    <tr key={t.id} className="hover:bg-blue-50">
                                        <td className="p-3">{t.date}</td>
                                        <td className="p-3"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{t.category}</span></td>
                                        <td className="p-3 font-medium">{t.merchant} <span className="text-slate-400 text-xs">{t.note}</span></td>
                                        <td className={`p-3 font-mono font-bold ${t.category.includes('Income') ? 'text-emerald-600' : 'text-red-500'}`}>{t.category.includes('Income') ? '+' : '-'}{formatCurrency(t.amount)}</td>
                                        <td className="p-3 flex gap-1">{t.tags?.map(tag => <span key={tag} className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">#{tag}</span>)}</td>
                                        <td className="p-3"><button onClick={() => deleteItem('transactions', t.id)} className="text-red-400 hover:text-red-600"><ICONS.Trash /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {viewTab === 'tenants' && (
                <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <h3 className="font-bold">租約紀錄 Lease History</h3>
                        <button onClick={()=>{
                            // 這裡簡化，實際應有新增租約的介面
                            const newLease = { propertyId: p.id, tenantName: 'New Tenant', status: 'Active', startDate: '2026-01-01', endDate: '2027-01-01', monthlyRent: 15000 };
                            addDoc(collection(db, "leases"), newLease);
                        }} className="text-sm text-blue-600 hover:underline">+ Register New Lease (Demo)</button>
                     </div>
                     {pLeases.map(l => (
                         <div key={l.id} className={`p-4 rounded-xl border ${l.status === 'Active' ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                             <div className="flex justify-between">
                                 <div>
                                     <p className="font-bold text-slate-800">{l.tenantName} <span className="text-xs font-normal text-slate-500">({l.tenantID})</span></p>
                                     <p className="text-sm">{l.startDate} to {l.endDate}</p>
                                 </div>
                                 <div className="text-right">
                                     <p className="font-bold font-mono">{formatCurrency(l.monthlyRent)}/mo</p>
                                     {l.status === 'Active' && <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">Active</span>}
                                 </div>
                             </div>
                         </div>
                     ))}
                </div>
            )}
        </div>
    );
  };

  const DocModal = () => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-[1200px] h-[95vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-xl font-bold flex items-center gap-2"><ICONS.FileText /> 文書生成器</h3>
                    <button onClick={() => setModalMode('none')} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <div className="flex gap-6 flex-1 overflow-hidden">
                    <div className="w-1/4 space-y-4 overflow-y-auto pr-2 border-r">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">文件類型</label>
                            <div className="flex rounded bg-slate-100 p-1">
                                {['receipt', 'lease', 'statement'].map(t => (
                                    <button key={t} onClick={() => setDocConfig({ ...docConfig, type: t as any })} className={`flex-1 text-xs py-1 rounded capitalize ${docConfig.type === t ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>{t}</button>
                                ))}
                            </div>
                        </div>
                        
                        <div><label className="block text-xs font-bold text-slate-500">Property</label><select className="w-full border rounded p-1" value={docConfig.propId} onChange={e=>{
                             // 使用 propStats 確保能讀取到 activeLease
                             const p = propStats.find(x=>x.id===e.target.value);
                             if(p) setDocConfig({...docConfig, propId: p.id, amount: p.activeLease?.monthlyRent || 0, tenant: p.activeLease?.tenantName || '' });
                        }}>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                        
                        {docConfig.type === 'statement' && (
                             <div className="p-3 bg-blue-50 rounded text-sm space-y-2">
                                 <p className="font-bold text-blue-800">對數設定</p>
                                 <div><label className="text-xs">Start Date</label><input type="date" className="w-full border rounded" value={docConfig.statementDateStart} onChange={e=>setDocConfig({...docConfig, statementDateStart: e.target.value})} /></div>
                                 <div><label className="text-xs">End Date</label><input type="date" className="w-full border rounded" value={docConfig.statementDateEnd} onChange={e=>setDocConfig({...docConfig, statementDateEnd: e.target.value})} /></div>
                             </div>
                        )}
                        
                        <div className="space-y-2">
                            <label className="block text-xs font-bold">Tenant Name</label><input type="text" className="w-full border rounded p-1" value={docConfig.tenant} onChange={e=>setDocConfig({...docConfig, tenant: e.target.value})} />
                            <label className="block text-xs font-bold">Period / Date</label><input type="text" className="w-full border rounded p-1" value={docConfig.period} onChange={e=>setDocConfig({...docConfig, period: e.target.value})} />
                            <label className="block text-xs font-bold">Amount ($)</label><input type="number" className="w-full border rounded p-1" value={docConfig.amount} onChange={e=>setDocConfig({...docConfig, amount: Number(e.target.value)})} />
                        </div>

                        <button onClick={handlePrint} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow mt-4 flex justify-center items-center gap-2"><ICONS.Printer /> Print / Save PDF</button>
                    </div>
                    <div className="w-3/4 bg-slate-200 rounded-lg p-8 overflow-y-auto flex justify-center shadow-inner">
                        <div className="doc-print-container">
                            <DocPreviewContent docConfig={docConfig} properties={properties} transactions={transactions} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const DocPreviewContent = ({ docConfig, properties, transactions }: { docConfig: DocConfig, properties: Property[], transactions: Transaction[] }) => {
    // 這裡只需要基礎資料，無需 activeLease
    const prop = properties.find(p => p.id === docConfig.propId) || { name: 'Unknown Property', address: '' } as Property;

    if (docConfig.type === 'receipt') {
        return (
             <div className="border border-black p-8 w-[210mm] h-[148mm] mx-auto bg-white text-black font-serif relative">
                <h1 className="text-2xl font-bold text-center underline mb-2">OFFICIAL RECEIPT 正式收據</h1>
                <div className="absolute top-8 right-8 text-sm"><div>Receipt No. {new Date().getFullYear()}-{Math.floor(Math.random()*10000)}</div><div>Date: {new Date().toLocaleDateString()}</div></div>
                <div className="mt-8 space-y-4 text-sm leading-loose">
                    <div className="flex"><span className="w-32 font-bold">Received from:</span><span className="border-b border-black flex-1 px-2">{docConfig.tenant}</span></div>
                    <div className="flex"><span className="w-32 font-bold">The Sum of:</span><span className="border-b border-black flex-1 px-2">HK$ {docConfig.amount.toLocaleString()} (Words: {convertNumberToEnglish(docConfig.amount)})</span></div>
                    <div className="flex"><span className="w-32 font-bold">For Rent of:</span><span className="border-b border-black flex-1 px-2">{prop.name} {prop.address}</span></div>
                    <div className="flex"><span className="w-32 font-bold">Period:</span><span className="border-b border-black flex-1 px-2">{docConfig.period}</span></div>
                    <div className="mt-8 text-right border-t border-black w-64 ml-auto pt-2 text-center">Signature of Landlord<br/>{docConfig.landlord}</div>
                </div>
            </div>
        );
    } 
    
    if (docConfig.type === 'statement') {
        const filteredTxs = transactions
            .filter(t => t.propertyId === docConfig.propId && (!docConfig.statementDateStart || t.date >= docConfig.statementDateStart) && (!docConfig.statementDateEnd || t.date <= docConfig.statementDateEnd))
            .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        return (
            <div className="bg-white p-10 w-[210mm] min-h-[297mm] text-black font-serif">
                <h1 className="text-2xl font-bold text-center underline mb-6">RENTAL STATEMENT 租務對數單</h1>
                <div className="flex justify-between mb-8">
                    <div><p><strong>Property:</strong> {prop.name}</p><p><strong>Address:</strong> {prop.address}</p></div>
                    <div className="text-right"><p><strong>Tenant:</strong> {docConfig.tenant}</p><p><strong>Period:</strong> {docConfig.statementDateStart || 'Start'} to {docConfig.statementDateEnd || 'Now'}</p></div>
                </div>
                <table className="w-full border-collapse border border-black text-sm">
                    <thead><tr className="bg-gray-100"><th className="border border-black p-2">Date</th><th className="border border-black p-2">Description / Note</th><th className="border border-black p-2 text-right">Debit (Due)</th><th className="border border-black p-2 text-right">Credit (Paid)</th></tr></thead>
                    <tbody>
                        {filteredTxs.length === 0 && <tr><td colSpan={4} className="p-4 text-center">No records found for this period.</td></tr>}
                        {filteredTxs.map(t => (
                            <tr key={t.id}>
                                <td className="border border-black p-2">{t.date}</td>
                                <td className="border border-black p-2">{t.category} - {t.note}</td>
                                <td className="border border-black p-2 text-right">{t.category.includes('Income') ? '' : formatCurrency(t.amount)}</td>
                                <td className="border border-black p-2 text-right">{t.category.includes('Income') ? formatCurrency(t.amount) : ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="doc-print-container text-black font-serif text-sm leading-relaxed">
          {/* Page 1 */}
          <div className="w-[210mm] min-h-[297mm] p-10 bg-white mx-auto relative page-break">
            <h1 className="text-2xl font-bold text-center mb-6 underline">TENANCY AGREEMENT 租約</h1>
            <div className="mb-4"><p><strong>An Agreement</strong> made the <span className="underline">{new Date().toLocaleDateString()}</span> between the Landlord and the Tenant as more particularly described in Schedule I.</p></div>
            <ol className="list-decimal pl-6 space-y-4">
                <li>The Tenant shall pay to the Landlord the Rent in advance on the 1st day of each and every calendar month during the Term.</li>
                <li>The Tenant shall not make any alteration and/or additions to the Premises without the prior written consent of the Landlord.</li>
                <li>The Tenant shall not assign, transfer, sublet or part with the possession of the Premises or any part thereof to any other person.</li>
                <li>The Tenant shall comply with all ordinances, regulations and rules of Hong Kong and Deed of Mutual Covenant.</li>
                <li>The Tenant shall during the Term pay and discharge all charges in respect of water, electricity, gas and telephone.</li>
                <li>The Tenant shall during the Term keep the interior of the Premises in good and tenantable repair and condition.</li>
                <li>The Tenant shall pay to the Landlord the Security Deposit set out in Schedule I.</li>
                <li>The Landlord shall refund the Security Deposit to the Tenant without interest within 7 days from the date of delivery of vacant possession.</li>
            </ol>
             <div className="absolute bottom-4 right-10 text-xs">Page 1 of 4</div>
          </div>
          {/* Page 2 */}
          <div className="w-[210mm] min-h-[297mm] p-10 bg-white mx-auto relative page-break">
             <div className="mb-12">
                <h2 className="font-bold text-lg mb-4 border-b pb-2">SECURITY DEPOSIT RECEIPT 按金收據</h2>
                <div className="flex justify-between items-end mb-4"><span>Received HK$: <span className="font-bold underline text-xl">{docConfig.deposit.toLocaleString()}</span></span></div>
             </div>
             <div className="grid grid-cols-2 gap-16 mb-16">
                 <div><p className="mb-8">Signed by <strong>Landlord</strong>:</p><div className="h-24 border-b border-black mb-2"></div><p>Name: {docConfig.landlord}</p></div>
                 <div><p className="mb-8">Signed by <strong>Tenant</strong>:</p><div className="h-24 border-b border-black mb-2"></div><p>Name: {docConfig.tenant}</p></div>
             </div>
             <div className="absolute bottom-4 right-10 text-xs">Page 2 of 4</div>
          </div>
           {/* Page 3: Schedule I */}
           <div className="w-[210mm] min-h-[297mm] p-10 bg-white mx-auto relative page-break">
            <h1 className="text-2xl font-bold text-center mb-8 underline">Schedule I 附表一</h1>
            <table className="w-full border-collapse border border-black">
                <tbody>
                    <tr><td className="border border-black p-4 font-bold bg-gray-50">The Premises</td><td className="border border-black p-4">{prop.name} <br/> {prop.address}</td></tr>
                    <tr><td className="border border-black p-4 font-bold bg-gray-50">The Landlord</td><td className="border border-black p-4">{docConfig.landlord} (ID: {docConfig.landlordID})</td></tr>
                    <tr><td className="border border-black p-4 font-bold bg-gray-50">The Tenant</td><td className="border border-black p-4">{docConfig.tenant} (ID: {docConfig.tenantID})</td></tr>
                    <tr><td className="border border-black p-4 font-bold bg-gray-50">Term</td><td className="border border-black p-4">{docConfig.startDate} to {docConfig.endDate}</td></tr>
                    <tr><td className="border border-black p-4 font-bold bg-gray-50">Rent</td><td className="border border-black p-4">HK$ {docConfig.amount.toLocaleString()} / month</td></tr>
                    <tr><td className="border border-black p-4 font-bold bg-gray-50">Deposit</td><td className="border border-black p-4">HK$ {docConfig.deposit.toLocaleString()}</td></tr>
                </tbody>
            </table>
            <div className="absolute bottom-4 right-10 text-xs">Page 3 of 4</div>
          </div>
          {/* Page 4: Schedule II */}
          <div className="w-[210mm] min-h-[297mm] p-10 bg-white mx-auto relative page-break">
             <h1 className="text-2xl font-bold text-center mb-8 underline">Schedule II 附表二</h1>
             <div className="space-y-6">
                 <p>1. User: Residential Purpose Only.</p>
                 <p>2. Mgt Fee & Rates: Paid by Landlord.</p>
                 <p>3. Break Clause: 12 months fixed + 2 months notice.</p>
                 <div className="pt-8 border-t-2 border-dashed border-gray-300">
                     <h3 className="font-bold mb-4">Furniture List</h3>
                     <div className="grid grid-cols-2 gap-4 text-sm">
                         <label><input type="checkbox" /> Air-conditioner</label><label><input type="checkbox" /> Water Heater</label>
                         <label><input type="checkbox" /> Fridge</label><label><input type="checkbox" /> Washer</label>
                     </div>
                 </div>
             </div>
             <div className="absolute bottom-4 right-10 text-xs">Page 4 of 4</div>
          </div>
        </div>
    );
  };

  if (!dataLoaded) {
       return <div className="h-screen flex items-center justify-center text-slate-500 animate-pulse">正在連接到 Firebase 雲端資料庫...</div>;
  }

  return (
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900 font-sans">
          <style>{`
            @media print {
                @page { size: A4; margin: 10mm; }
                body { background-color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow: visible !important; height: auto !important; }
                #root { overflow: visible !important; height: auto !important; }
                .no-print, nav, .sidebar, .modal-overlay { display: none !important; }
                .doc-print-container { 
                    display: block !important; position: absolute; top: 0; left: 0; width: 100%; background: white; z-index: 9999; padding: 0;
                }
                .report-container { display: block !important; width: 100%; box-shadow: none; }
                .page-break { page-break-before: always; }
                body.printing-doc #root > div { visibility: hidden; }
                body.printing-doc .doc-print-container { visibility: visible; }
                .bg-slate-50 { background-color: #f8fafc !important; }
            }
            ::-webkit-scrollbar { width: 6px; height: 6px; }
            ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
            .modal-overlay { background-color: rgba(0, 0, 0, 0.5); }
            .paper { background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); padding: 40px; min-height: 800px; font-family: "Times New Roman", "MingLiU", serif; }
          `}</style>

          {!reportMode && (
              <div className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col sticky top-0 h-screen overflow-y-auto no-print">
                  <div className="p-6">
                      <h1 className="text-xl font-bold text-white flex items-center gap-2"><ICONS.Home /> Charles's 導航</h1>
                  </div>
                  <nav className="flex-1 px-3 space-y-1">
                      {[
                          {id: 'dashboard', icon: 'LayoutDashboard', label: '物業總覽 Overview'},
                          {id: 'data', icon: 'Data', label: '數據中心 Data Hub'},
                          {id: 'insurance', icon: 'Shield', label: '保險庫 Insurance'},
                          {id: 'education', icon: 'GraduationCap', label: '升學 Education'}
                      ].map(item => (
                          <button key={item.id} onClick={() => { setActiveTab(item.id); setPropertyViewId(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab===item.id && !propertyViewId ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
                              {item.id === 'dashboard' ? <ICONS.LayoutDashboard /> : item.id === 'data' ? <ICONS.Data /> : item.id === 'insurance' ? <ICONS.Shield /> : <ICONS.GraduationCap />} {item.label}
                          </button>
                      ))}
                  </nav>
              </div>
          )}

          <div className="flex-1 p-8 overflow-y-auto print-container">
              {activeTab === 'dashboard' && (
                  propertyViewId ? <PropertyDetailView propId={propertyViewId} /> : <PropertyDashboard />
              )}
              {activeTab === 'data' && (
                  <div className="bg-white p-10 rounded-xl shadow animate-in fade-in">
                      <h2 className="text-2xl font-bold mb-4">數據中心 Data Hub</h2>
                      <p className="text-slate-500 mb-6">所有交易紀錄一覽 Table of All Transactions</p>
                      <div className="flex gap-4 mb-4">
                        <input type="text" placeholder="Search..." className="border rounded px-2 py-1 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <select className="border rounded px-2 py-1" value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}><option value="All">All Categories</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
                        <select className="border rounded px-2 py-1" value={filterMember} onChange={e=>setFilterMember(e.target.value)}><option value="All">All Members</option>{MEMBERS.map(m=><option key={m} value={m}>{m}</option>)}</select>
                        <select className="border rounded px-2 py-1" value={filterYear} onChange={e=>setFilterYear(e.target.value)}><option value="All">All Years</option>{[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}</select>
                        <button onClick={handleExportJSON} className="px-3 py-1 bg-slate-600 text-white text-xs rounded hover:bg-slate-700">Export JSON</button>
                      </div>
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0"><tr><th className="p-3">Date</th><th className="p-3">Merchant</th><th className="p-3">Amount</th><th className="p-3">Category</th><th className="p-3">Member</th></tr></thead>
                          <tbody className="divide-y">
                              {transactions
                                .filter(t => (filterCategory==='All'||t.category===filterCategory) && (searchTerm===''||t.merchant.includes(searchTerm)))
                                .slice(0, 50).map(t => (
                                  <tr key={t.id} className="hover:bg-slate-50">
                                      <td className="p-3">{t.date}</td>
                                      <td className="p-3 font-medium">{t.merchant}</td>
                                      <td className="p-3 font-mono">{formatCurrency(t.amount)}</td>
                                      <td className="p-3"><span className="px-2 py-1 bg-gray-100 rounded text-xs">{t.category}</span></td>
                                      <td className="p-3">{t.member}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}
              
              {activeTab === 'insurance' && <div className="bg-white p-10 rounded-xl shadow"><h3>保險庫功能開發中...</h3></div>}
              
              {activeTab === 'education' && (
                   <div className="space-y-6 animate-in fade-in">
                      <div className="grid grid-cols-2 gap-6">
                          <div className="bg-white p-6 rounded-xl shadow-sm border">
                              <h3 className="font-bold text-lg mb-2">Virginia ({FAMILY_INFO.Virginia.age})</h3>
                              <p>目標: {eduDB['UK'].name}</p>
                              <p>預算: {formatCurrency(eduDB['UK'].tuition + eduDB['UK'].living)} / year</p>
                          </div>
                          <div className="bg-white p-6 rounded-xl shadow-sm border">
                              <h3 className="font-bold text-lg mb-2">Jason ({FAMILY_INFO.Jason.age})</h3>
                              <p>目標: {eduDB['AUS'].name}</p>
                              <p>預算: {formatCurrency(eduDB['AUS'].tuition + eduDB['AUS'].living)} / year</p>
                          </div>
                      </div>
                   </div>
              )}
          </div>

          {/* Modals */}
          {modalMode === 'doc' && <DocModal />}
          
          {modalMode === 'transaction' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
                  <div className="bg-white rounded-xl shadow-2xl p-6 w-96 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold mb-4">新增交易 Record</h3>
                        <div className="space-y-3">
                            <input type="date" className="w-full border rounded p-2" value={editingTx?.date} onChange={e=>setEditingTx({...editingTx, date: e.target.value} as any)} />
                            <input type="text" placeholder="Detail/Merchant" className="w-full border rounded p-2" value={editingTx?.merchant} onChange={e=>setEditingTx({...editingTx, merchant: e.target.value} as any)} />
                            <input type="number" placeholder="Amount" className="w-full border rounded p-2" value={editingTx?.amount} onChange={e=>setEditingTx({...editingTx, amount: Number(e.target.value)} as any)} />
                            <select className="w-full border rounded p-2" value={editingTx?.category} onChange={e=>setEditingTx({...editingTx, category: e.target.value} as any)}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
                            <select className="w-full border rounded p-2" value={editingTx?.member} onChange={e=>setEditingTx({...editingTx, member: e.target.value} as any)}>{MEMBERS.map(m=><option key={m} value={m}>{m}</option>)}</select>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button onClick={handleSaveTransaction} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">Save</button>
                            <button onClick={()=>setModalMode('none')} className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300">Cancel</button>
                        </div>
                    </div>
              </div>
          )}

          {modalMode === 'property' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
                  <div className="bg-white rounded-xl shadow-2xl p-6 w-[500px] animate-in fade-in zoom-in duration-200">
                      <h3 className="font-bold mb-4">Edit Property</h3>
                      <div className="space-y-3">
                          <input className="border w-full p-2" placeholder="Name" value={editingProp?.name} onChange={e => setEditingProp({...editingProp, name: e.target.value} as any)} />
                          <input className="border w-full p-2" placeholder="Address" value={editingProp?.address} onChange={e => setEditingProp({...editingProp, address: e.target.value} as any)} />
                          <select className="border w-full p-2" value={editingProp?.status} onChange={e => setEditingProp({...editingProp, status: e.target.value} as any)}><option value="Occupied">Occupied</option><option value="Vacant">Vacant</option></select>
                          <div className="grid grid-cols-2 gap-2">
                               <input className="border p-2" type="number" placeholder="Value" value={editingProp?.currentValue} onChange={e => setEditingProp({...editingProp, currentValue: Number(e.target.value)} as any)} />
                               <input className="border p-2" type="number" placeholder="Rent Est." value={editingProp?.estRent} onChange={e => setEditingProp({...editingProp, estRent: Number(e.target.value)} as any)} />
                          </div>
                      </div>
                      <div className="flex gap-2 mt-6">
                          <button onClick={handleSaveProperty} className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Save</button>
                          <button onClick={() => setModalMode('none')} className="flex-1 bg-gray-200 p-2 rounded hover:bg-gray-300">Cancel</button>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );
};

export default App;
