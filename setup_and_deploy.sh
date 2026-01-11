#!/bin/bash

echo "🚀 開始自動部署腳本 (語法修正版)..."

# 1. 清理舊檔案
rm -f package.json package-lock.json tsconfig.json vite.config.ts index.html
rm -rf src

# 2. 建立資料夾
mkdir -p src

# 3. 建立 package.json
echo "📦 建立設定檔..."
cat > package.json << 'EOF'
{
  "name": "charles-finance-app",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "firebase": "^10.8.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "recharts": "^2.10.3",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1",
    "idb-keyval": "^6.2.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
EOF

# 4. 建立 tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

# 5. 建立 tsconfig.node.json
cat > tsconfig.node.json << 'EOF'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
EOF

# 6. 建立 vite.config.ts
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})
EOF

# 7. 建立 index.html
cat > index.html << 'EOF'
<!doctype html>
<html lang="zh-HK">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Charles's 家庭導航</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

# 8. 建立 tailwind.config.js
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

# 9. 建立 postcss.config.js
cat > postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# 10. 建立 .gitignore
cat > .gitignore << 'EOF'
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs
*.njsproj
*.sln
*.sw?
EOF

# 11. 建立 src/vite-env.d.ts
cat > src/vite-env.d.ts << 'EOF'
/// <reference types="vite/client" />
EOF

# 12. 建立 src/main.tsx
cat > src/main.tsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF

# 13. 建立 src/index.css
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Segoe UI', 'Microsoft JhengHei', sans-serif;
  background-color: #f0f2f5;
}

/* 打印專用樣式 */
@media print {
  @page {
    size: A4;
    margin: 10mm;
  }
  body {
    background-color: white;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    overflow: visible !important;
    height: auto !important;
  }
  #root {
    overflow: visible !important;
    height: auto !important;
  }
  
  .no-print, nav, .sidebar, .modal-overlay {
    display: none !important;
  }
  
  .doc-print-container { 
    display: block !important; 
    position: absolute; 
    top: 0; 
    left: 0; 
    width: 100%; 
    background: white; 
    z-index: 9999;
    padding: 0;
  }
  .report-container {
    display: block !important;
    width: 100%;
    box-shadow: none;
  }
  .page-break {
    page-break-before: always;
  }
  
  body.printing-doc #root > div {
    visibility: hidden;
  }
  body.printing-doc .doc-print-container {
    visibility: visible;
  }
  
  .bg-slate-50 {
    background-color: #f8fafc !important;
  }
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}
.modal-overlay {
  background-color: rgba(0, 0, 0, 0.5);
}
.paper {
  background: white;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  padding: 40px;
  min-height: 800px;
  font-family: "Times New Roman", "MingLiU", serif;
}
EOF

# 14. 建立 src/App.tsx (核心邏輯 - 含 Firebase 與 語法修正)
echo "📝 寫入 App.tsx..."
cat > src/App.tsx << 'EOF'
import React, { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, doc, addDoc, setDoc, deleteDoc, updateDoc, 
  onSnapshot, query, orderBy, writeBatch
} from "firebase/firestore";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAeP-GggvT31EUY4TXEnX3GYVD8bcs8NJg",
  authDomain: "charles-wealth-nav.firebaseapp.com",
  projectId: "charles-wealth-nav",
  storageBucket: "charles-wealth-nav.firebasestorage.app",
  messagingSenderId: "1066128740156",
  appId: "1:1066128740156:web:b69065931e28d7b4b59839",
  measurementId: "G-82MQGSGT3B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Types ---
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
  property?: string;
}

interface Property {
  id: string;
  name: string;
  type: 'Investment' | 'Self-use';
  estRent: number;
  value: number;
  mortgage: number;
  tenure: number;
  monthlyExpense?: number;
  stressedExpense?: number;
  netFlow?: number;
  yieldRate?: number;
  dsr?: number;
  netAnnual?: number;
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
  type: 'receipt' | 'lease';
  propId: string;
  tenant: string;
  period: string;
  amount: number;
  deposit: number;
  startDate: string;
  endDate: string;
  landlord: string;
  tenantID?: string;
}

// --- Icons ---
const Icons = {
  Tag: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/></svg>,
  DollarSign: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Activity: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  PieChart: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
  Home: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Shield: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  LayoutDashboard: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>,
  Database: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  Printer: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>,
  UploadCloud: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>,
  GraduationCap: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  ShieldCheck: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>,
  Download: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>,
  Book: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  Edit2: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
  FilePen: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v10"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10.4 12.6a2 2 0 1 1 3 3L8 21l-4 1 1-4Z"/></svg>,
  FileText: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>,
};

// --- Constants ---
const CATEGORIES = [
  'Insurance (保險)', 'Management Fee (管理費)', 'Tax/Govt (稅項/差餉)', 
  'Utilities (水電煤)', 'Credit Card (信用卡)', 'Mortgage (供樓/按揭)',
  'Education (教育)', 'Transport (交通)', 'Telecom (電訊)', 
  'Shopping (購物)', 'Dining (餐飲)', 'Medical (醫療)', 'General (其他)', 'Property Expense (物業支出)'
];

const MEMBERS = ['Charles', 'Carmen', 'Virginia', 'Jason', 'Family (公用)'];

const INITIAL_EDUCATION_DB = {
  HK: { 
      name: '香港 (HK)', years: 4, tuition: 42100, living: 60000, salary: 19000, 
      notes: '性價比最高，人脈在本地。',
      paths: { academic: '傳統大學 (HKU, CUHK)...', vocational: '職訓局 (IVE/THEi)...' }
  },
  UK: { 
      name: '英國 (UK)', years: 3, tuition: 200000, living: 150000, salary: 28000, 
      notes: 'BNO 優勢，學制短。',
      paths: { academic: 'Russell Group...', vocational: 'BTEC / Foundation...' }
  },
  AUS: { 
      name: '澳洲 (AUS)', years: 3, tuition: 180000, living: 180000, salary: 32000, 
      notes: '生活環境好，藍領薪水高。',
      paths: { academic: '八大名校...', vocational: 'TAFE (技術學院)...' }
  },
  CAN: { 
      name: '加拿大 (CAN)', years: 2, tuition: 150000, living: 120000, salary: 26000, 
      notes: 'College 移民政策友善。',
      paths: { academic: 'University...', vocational: 'College (學院)...' }
  }
};

const FAMILY_INFO = {
  Virginia: { age: 16, role: '女兒', educationStart: 2026 },
  Jason: { age: 13, role: '兒子', educationStart: 2029 }
};

// --- Helper Components ---
const StatCard = ({ title, value, subtext, color, iconName }) => {
  const IconComp = Icons[iconName] || Icons.Tag;
  return (
      <div className={`bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between h-full`}>
          <div className="flex justify-between items-start mb-2">
              <div className={`p-2 rounded-lg bg-${color}-50 text-${color}-600`}>
                  <IconComp />
              </div>
              {subtext && <span className={`text-xs px-2 py-1 rounded-full bg-${color}-50 text-${color}-600 font-medium`}>{subtext}</span>}
          </div>
          <div>
              <p className="text-slate-500 text-sm font-medium">{title}</p>
              <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
          </div>
      </div>
  );
};

// --- Main App Component ---
const App = () => {
  // --- Firestore States ---
  const [data, setData] = useState([]);
  const [properties, setProperties] = useState([]);
  const [eduDB, setEduDB] = useState(INITIAL_EDUCATION_DB);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingTx, setEditingTx] = useState(null);
  const [reportMode, setReportMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Property Modal State
  const [isPropModalOpen, setPropModalOpen] = useState(false);
  const [editingProp, setEditingProp] = useState({ id: '', name: '', type: 'Investment', estRent: 0, value: 0, mortgage: 0, tenure: 0 });
  
  // Transaction Modal State
  const [isEntryModalOpen, setEntryModalOpen] = useState(false);
  const [newTx, setNewTx] = useState({ date: new Date().toISOString().split('T')[0], merchant: '', amount: '', category: 'General (其他)', member: 'Family (公用)', note: '' });

  // Document Modal State
  const [isDocModalOpen, setDocModalOpen] = useState(false);
  const [docConfig, setDocConfig] = useState({ type: 'receipt', propId: '', tenant: '', period: '', amount: 0, deposit: 0, startDate: '', endDate: '', landlord: 'Charles Lam' });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterMember, setFilterMember] = useState('All');

  // Analysis Parameters
  const [eduRegionV, setEduRegionV] = useState('UK');
  const [eduRegionJ, setEduRegionJ] = useState('AUS');
  const [childType, setChildType] = useState('Vocational');
  const [stressRate, setStressRate] = useState(0);
  const [rentDrop, setRentDrop] = useState(0);

  // --- Firestore Subscriptions ---
  useEffect(() => {
    // 1. Transactions
    const q = query(collection(db, "transactions"), orderBy("date", "desc"));
    const unsubTx = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(txs);
      setDataLoaded(true);
    });

    // 2. Properties
    const unsubProp = onSnapshot(collection(db, "properties"), (snapshot) => {
      const props = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProperties(props);
    });

    // 3. Education Config
    const unsubEdu = onSnapshot(doc(db, "settings", "education"), (docSnap) => {
      if (docSnap.exists()) {
        setEduDB(docSnap.data());
      } else {
        setDoc(doc(db, "settings", "education"), INITIAL_EDUCATION_DB);
      }
    });

    return () => {
      unsubTx();
      unsubProp();
      unsubEdu();
    };
  }, []);

  // --- Handlers ---

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if(!window.confirm("確定要將此 JSON 檔案的內容匯入到 Firebase 資料庫嗎？這將會新增大量記錄。")) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const result = ev.target?.result;
            if (typeof result !== 'string') return;
            const json = JSON.parse(result);
            const list = Array.isArray(json) ? json : (json.data || []);
            
            const batchSize = 450;
            let chunks = [];
            for (let i = 0; i < list.length; i += batchSize) {
                chunks.push(list.slice(i, i + batchSize));
            }

            let count = 0;
            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach((item) => {
                    const docRef = doc(collection(db, "transactions"));
                    const txData = {
                        date: item.date,
                        merchant: item.merchant,
                        amount: Number(item.amount),
                        category: item.category || 'General (其他)',
                        member: item.member || 'Family (公用)',
                        note: item.note || '',
                        year: new Date(item.date).getFullYear(),
                        month: new Date(item.date).getMonth() + 1,
                        property: item.property || null
                    };
                    batch.set(docRef, txData);
                });
                await batch.commit();
                count += chunk.length;
                console.log(`Uploaded ${count} records...`);
            }
            alert(`成功匯入 ${count} 筆記錄到雲端！`);
        } catch (err) { 
            console.error(err);
            alert("匯入失敗: " + err); 
        } finally { 
            setIsProcessing(false); 
        }
    };
    reader.readAsText(file);
  };

  const clearData = async () => {
      if(window.confirm('危險：確定清除雲端所有交易記錄？此操作無法復原。')) {
          setIsProcessing(true);
          alert("為防止誤刪，請聯絡管理員進行批量刪除，或手動刪除特定項目。");
          setIsProcessing(false);
      }
  };

  const updateCategory = async (id, newCat, _merchant, applyToAll) => {
      try {
          const txRef = doc(db, "transactions", id);
          await updateDoc(txRef, { category: newCat });

          if (applyToAll) {
              alert("批量更新功能在雲端模式下暫時停用，以節省寫入配額。");
          }
      } catch (e) {
          console.error("Update failed", e);
      }
      setEditingTx(null);
  };

  const handleSaveProperty = async () => {
      const p = {
          ...editingProp,
          value: Number(editingProp.value),
          estRent: Number(editingProp.estRent),
          mortgage: Number(editingProp.mortgage),
          tenure: Number(editingProp.tenure)
      };
      
      try {
          if (p.id) {
            await setDoc(doc(db, "properties", p.id), p);
          } else {
            await addDoc(collection(db, "properties"), p);
          }
          setPropModalOpen(false);
      } catch(e) {
          alert("儲存失敗: " + e);
      }
  };
  
  const handleDeleteProperty = async (id) => {
      if(window.confirm('確定刪除此物業？')) {
          await deleteDoc(doc(db, "properties", id));
      }
  };

  const handleAddTx = async () => {
      if(!newTx.amount || !newTx.merchant) return alert("請填寫金額和商戶");
      try {
          await addDoc(collection(db, "transactions"), {
              ...newTx,
              amount: parseFloat(newTx.amount),
              year: new Date(newTx.date).getFullYear(),
              month: new Date(newTx.date).getMonth() + 1,
              note: newTx.note || ''
          });
          setEntryModalOpen(false);
          setNewTx({ date: new Date().toISOString().split('T')[0], merchant: '', amount: '', category: 'General (其他)', member: 'Family (公用)', note: '' });
      } catch (e) {
          alert("新增失敗: " + e);
      }
  };

  const deleteTx = async (id) => {
      if(window.confirm("確定刪除此記錄？")) {
          await deleteDoc(doc(db, "transactions", id));
      }
  };

  const updateEduDB = async (newConfig) => {
      setEduDB(newConfig); 
      await setDoc(doc(db, "settings", "education"), newConfig);
  };

   const exportJSON = () => {
      const jsonString = JSON.stringify({ meta: { generated: new Date() }, data: data }, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `Charles_Finance_Data.json`;
      document.body.appendChild(link);
      link.click();
  };
  
  const handlePrint = () => {
      setTimeout(() => window.print(), 100);
  }
  
  const handlePrintDoc = () => {
      document.body.classList.add('printing-doc');
      window.print();
      setTimeout(() => document.body.classList.remove('printing-doc'), 1000);
  };

  // Calculations
  const stats = useMemo(() => {
      let filtered = data;
      if(filterYear !== 'All') filtered = filtered.filter(d => d.year === parseInt(filterYear));
      if(filterMember !== 'All') filtered = filtered.filter(d => d.member === filterMember);
      if(filterCategory !== 'All') filtered = filtered.filter(d => d.category === filterCategory);
      if(searchTerm) filtered = filtered.filter(d => d.merchant.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const total = filtered.reduce((a,b) => a + b.amount, 0);
      const byYear = {}; 
      const byCat = {}; 
      const insuranceByMember = {};

      filtered.forEach(d => {
          if(!byYear[d.year]) byYear[d.year] = 0; byYear[d.year] += d.amount;
          const cat = d.category || 'Other'; if(!byCat[cat]) byCat[cat] = 0; byCat[cat] += d.amount;
          if (cat.includes('Insurance')) {
              let memberKey = d.member === 'Family (公用)' ? 'Charles' : d.member;
              if(!insuranceByMember[memberKey]) insuranceByMember[memberKey] = [];
              let policyName = d.merchant;
              if(policyName.includes('Insurance:')) { policyName = policyName.split('Insurance:')[1].trim(); } else { policyName = policyName.replace(/AXA_|Prudential_|Manulift_/gi, '').split('(')[0].trim(); }
              const existing = insuranceByMember[memberKey].find(p => p.name === policyName);
              const txDate = d.date || '';
              if(existing) { 
                  existing.totalPaid += d.amount; 
                  if(d.note && !existing.note) existing.note = d.note; 
                  if(txDate > existing.lastPaid) existing.lastPaid = txDate; 
              } else { 
                  let endYear = null; 
                  if(d.note) { const yearMatch = d.note.match(/20\d{2}/); if(yearMatch) endYear = parseInt(yearMatch[0]); } 
                  insuranceByMember[memberKey].push({ name: policyName, totalPaid: d.amount, note: d.note || '', lastPaid: txDate, endYear: endYear, rawMerchant: d.merchant }); 
              }
          }
      });
      
      const propStats = properties.map(p => {
          const keywords = p.name.split(' ')[0];
          const relatedTx = data.filter(d => (d.property === p.name) || (d.merchant && d.merchant.includes(keywords)));
          const totalExpense = relatedTx.reduce((sum, tx) => sum + tx.amount, 0);
          const yearsCovered = Math.max(1, Object.keys(byYear).length);
          const monthlyExpense = Math.round(totalExpense / (yearsCovered * 12)) || 0; 
          const mortgagePart = p.mortgage || 0; const otherPart = monthlyExpense;
          const stressedMortgage = mortgagePart * (1 + (stressRate * 0.12)); const stressedExpense = otherPart + stressedMortgage;
          const stressedRent = p.estRent * (1 - (rentDrop / 100));
          const netFlow = (p.type === 'Investment' ? (stressedRent) : 0) - stressedExpense;
          const annualNetRent = (p.estRent * 12) - (otherPart * 12);
          const yieldRate = p.value > 0 ? (annualNetRent / p.value) * 100 : 0;
          const dsr = p.estRent > 0 ? (mortgagePart / p.estRent) * 100 : 0;
          return { ...p, monthlyExpense: otherPart + mortgagePart, stressedExpense, stressedRent, netFlow, yieldRate, dsr, netAnnual: netFlow * 12 };
      });
      
      const passiveIncome = propStats.filter(p => p.type === 'Investment').reduce((acc, p) => acc + (p.netFlow || 0), 0);
      return { 
        total, 
        count: filtered.length, 
        byYear: Object.entries(byYear).map(([k,v])=>({year:k, amount:v})).sort((a,b)=>a.year-b.year), 
        byCat: Object.entries(byCat).map(([k,v])=>({name:k, value:v})).sort((a,b)=>b.value-a.value), 
        insuranceByMember, 
        propStats, 
        passiveIncome 
      };
  }, [data, properties, filterYear, filterMember, filterCategory, searchTerm, stressRate, rentDrop]);

  const eduForecast = useMemo(() => {
      const db = eduDB || INITIAL_EDUCATION_DB;
      const regV = db[eduRegionV] || INITIAL_EDUCATION_DB.UK; const regJ = db[eduRegionJ] || INITIAL_EDUCATION_DB.AUS;
      const currentYear = new Date().getFullYear(); const forecast = []; let totalNeeded = 0;
      for(let i=0; i<12; i++) {
          const year = currentYear + i; let vCost = 0; let jCost = 0;
          const vYears = childType === 'Vocational' && eduRegionV === 'CAN' ? 2 : regV.years; const jYears = childType === 'Vocational' && eduRegionJ === 'CAN' ? 2 : regJ.years;
          const vTuition = childType === 'Vocational' ? Number(regV.tuition) * 0.7 : Number(regV.tuition); const jTuition = childType === 'Vocational' ? Number(regJ.tuition) * 0.7 : Number(regJ.tuition);
          const vLiving = Number(regV.living); const jLiving = Number(regJ.living);
          if(year >= FAMILY_INFO.Virginia.educationStart && year < FAMILY_INFO.Virginia.educationStart + vYears) { vCost = (vTuition + vLiving) * Math.pow(1 + 0.03, i); }
          if(year >= FAMILY_INFO.Jason.educationStart && year < FAMILY_INFO.Jason.educationStart + jYears) { jCost = (jTuition + jLiving) * Math.pow(1 + 0.03, i); }
          totalNeeded += (vCost + jCost); forecast.push({ year, vCost: Math.round(vCost), jCost: Math.round(jCost), total: Math.round(vCost+jCost) });
      }
      return { data: forecast, totalNeeded: Math.round(totalNeeded) };
  }, [eduRegionV, eduRegionJ, childType, eduDB]);

  const DocPreview = () => {
      const prop = properties.find(p => p.id === docConfig.propId) || { name: '未知物業' };
      if (docConfig.type === 'receipt') {
          return (
              <div className="doc-print-container">
                  <div className="border-4 border-black p-10 max-w-[800px] mx-auto text-black">
                      <h1 className="text-3xl font-bold text-center mb-8 underline">RENTAL RECEIPT 租金收據</h1>
                      <div className="space-y-6 text-lg font-serif">
                          <div className="flex justify-between"><span><strong>Receipt No (編號):</strong> {new Date().getFullYear()}-{Math.floor(Math.random()*1000)}</span><span><strong>Date (日期):</strong> {new Date().toLocaleDateString()}</span></div>
                          <div className="border-b border-black pb-2"><strong>Received From (租客):</strong> {docConfig.tenant}</div>
                          <div className="border-b border-black pb-2"><strong>The Sum of (金額):</strong> HK${Number(docConfig.amount).toLocaleString()}</div>
                          <div className="border-b border-black pb-2"><strong>For Rent of Premises (物業地址):</strong><br/>{prop.name}</div>
                          <div className="border-b border-black pb-2"><strong>For the Period (租期):</strong> {docConfig.period}</div>
                          <div className="flex justify-between items-end mt-12 pt-12"><div className="border-t border-black w-64 text-center pt-2">Signature of Landlord / Agent<br/>(業主 / 代理人簽署)<br/>{docConfig.landlord}</div></div>
                      </div>
                  </div>
              </div>
          );
      } else {
          return (
              <div className="doc-print-container text-black">
                <div className="max-w-[800px] mx-auto font-serif leading-relaxed">
                  <h1 className="text-2xl font-bold text-center mb-6">TENANCY AGREEMENT<br/>租賃協議</h1>
                  <p className="mb-4"><strong>THIS AGREEMENT</strong> is made on {new Date().toLocaleDateString()}</p>
                  <p className="mb-4"><strong>BETWEEN:</strong></p>
                  <ol className="list-decimal pl-6 mb-6 space-y-2">
                    <li><strong>The Landlord (業主):</strong> {docConfig.landlord}</li>
                    <li><strong>The Tenant (租客):</strong> {docConfig.tenant} (ID: {docConfig.tenantID || '_______'})</li>
                  </ol>
                  <p className="mb-4"><strong>Premises:</strong> {prop.name}</p>
                  <p className="mb-4"><strong>Term:</strong> From {docConfig.startDate} To {docConfig.endDate}</p>
                  <p className="mb-4"><strong>Rent:</strong> HK${Number(docConfig.amount).toLocaleString()} / month</p>
                  <div className="flex justify-between mt-12">
                    <div className="w-5/12 border-t border-black pt-2">Signed by Landlord / Agent (業主 / 代理人簽署)<br/>{docConfig.landlord}</div>
                    <div className="w-5/12 border-t border-black pt-2">Signed by Tenant (租客簽署)</div>
                  </div>
                </div>
              </div>
          );
      }
  };

  const ReportHeader = () => (<div className="border-b-2 border-slate-800 pb-4 mb-8"><h1 className="text-3xl font-bold text-slate-900">Charles's 家庭導航 - 綜合分析報告</h1><div className="flex justify-between mt-2 text-slate-500"><span>生成日期: {new Date().toLocaleDateString()}</span><span>數據來源: {data.length} 筆記錄</span></div></div>);
  
  const ReportView = () => { 
      if (!stats) return null; 
      return (
        <div className="report-container bg-white p-10 max-w-5xl mx-auto shadow-xl print-container">
            <ReportHeader />
            <div className="space-y-10">
                <section>
                    <h2 className="text-xl font-bold mb-4 border-l-4 border-blue-600 pl-3">1. 財務健康總結</h2>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="p-4 bg-slate-50 border rounded"><p className="text-sm text-slate-500">歷史總支出</p><p className="text-2xl font-bold">${(stats.total/1000000).toFixed(2)}M</p></div>
                        <div className="p-4 bg-slate-50 border rounded"><p className="text-sm text-slate-500">主要開支分類</p><p className="text-xl font-bold text-blue-600">{stats.byCat[0]?.name}</p></div>
                        <div className="p-4 bg-slate-50 border rounded"><p className="text-sm text-slate-500">物業總淨年回報</p><p className="text-xl font-bold text-emerald-600">+${Math.round(stats.propStats.reduce((a,b)=>a + (b.netAnnual || 0),0)/1000).toLocaleString()}k</p></div>
                    </div>
                    <div className="h-64 border rounded p-4">
                        <ResponsiveContainer>
                            <AreaChart data={stats.byYear}><XAxis dataKey="year"/><YAxis/><Area type="monotone" dataKey="amount" stroke="#2563EB" fill="#3B82F6"/></AreaChart>
                        </ResponsiveContainer>
                    </div>
                </section>
                <div className="page-break"></div>
                <section>
                    <h2 className="text-xl font-bold mb-4 border-l-4 border-emerald-600 pl-3">2. 物業投資表現</h2>
                    <table className="w-full text-sm border">
                        <thead className="bg-slate-100"><tr><th className="p-2 text-left">物業</th><th className="p-2 text-right">估值</th><th className="p-2 text-right">年淨回報 (Yield)</th><th className="p-2 text-right">供款佔比 (DSR)</th></tr></thead>
                        <tbody>{stats.propStats.map(p=><tr key={p.id} className="border-t"><td className="p-2">{p.name} <span className="text-xs text-slate-500">({p.type})</span></td><td className="p-2 text-right">${(p.value/1000000).toFixed(1)}M</td><td className={`p-2 text-right font-bold ${(p.netAnnual || 0)>=0?'text-emerald-600':'text-red-600'}`}>{(p.yieldRate || 0).toFixed(2)}%</td><td className="p-2 text-right">{(p.dsr || 0) > 0 ? (p.dsr || 0).toFixed(1)+'%' : '-'}</td></tr>)}</tbody>
                    </table>
                </section>
                <section>
                    <h2 className="text-xl font-bold mb-4 border-l-4 border-indigo-600 pl-3">3. AI 建議摘要</h2>
                    <div className="bg-blue-50 p-4 rounded text-sm text-blue-900 leading-relaxed">根據數據分析，您的家庭主要開支集中在 <strong>{stats.byCat[0]?.name}</strong>。物業組合提供穩定的現金流。</div>
                </section>
            </div>
            <div className="mt-8 text-center no-print">
                <button onClick={handlePrint} className="bg-blue-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-blue-700">列印 / 儲存 PDF</button>
                <button onClick={()=>setReportMode(false)} className="ml-4 text-slate-500 hover:underline">返回</button>
            </div>
        </div>
      );
  };

  const EduReportView = () => (
    <div className="report-container bg-white p-10 max-w-5xl mx-auto shadow-xl print-container">
        <ReportHeader />
        <h2 className="text-2xl font-bold mb-6 text-center">子女升學與職業路徑規劃報告 ({childType==='Vocational'?'實用型導向':'傳統學術導向'})</h2>
        <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="bg-pink-50 p-6 rounded-xl border border-pink-100">
                <h3 className="font-bold text-lg text-pink-800 mb-2">Virginia (16歲)</h3>
                <p className="text-sm mb-4">目標地區：<strong>{eduDB[eduRegionV].name}</strong></p>
                <ul className="text-sm space-y-2 text-pink-900"><li>• 預計入學：2026年 (18歲)</li><li>• 總預算：<span className="font-bold">${(eduForecast.data.reduce((a,b)=>a+b.vCost,0)/1000000).toFixed(2)}M</span></li></ul>
            </div>
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                <h3 className="font-bold text-lg text-blue-800 mb-2">Jason (13歲)</h3>
                <p className="text-sm mb-4">目標地區：<strong>{eduDB[eduRegionJ].name}</strong></p>
                <ul className="text-sm space-y-2 text-blue-900"><li>• 預計入學：2029年 (18歲)</li><li>• 總預算：<span className="font-bold">${(eduForecast.data.reduce((a,b)=>a+b.jCost,0)/1000000).toFixed(2)}M</span></li></ul>
            </div>
        </div>
        <div className="mt-8 text-center no-print">
            <button onClick={handlePrint} className="bg-purple-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-purple-700">列印升學報告 (PDF)</button>
            <button onClick={()=>setReportMode(false)} className="ml-4 text-slate-500 hover:underline">返回</button>
        </div>
    </div>
  );

  if (!dataLoaded) {
       return <div className="h-screen flex items-center justify-center text-slate-500 animate-pulse">正在連接到 Firebase 雲端資料庫...</div>;
  }

  return (
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900">
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
                      <h1 className="text-xl font-bold text-white flex items-center gap-2"><span className="text-blue-500"><Icons.Home /></span> Charles's 導航</h1>
                      <div className="mt-4 mb-2"><label className={`flex items-center justify-center gap-2 w-full py-2 ${isProcessing ? 'bg-slate-600 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer'} text-white text-sm font-bold rounded transition`}><Icons.UploadCloud /> {isProcessing ? '處理中...' : '匯入數據'}<input type="file" className="hidden" onChange={handleFileUpload} accept=".json" disabled={isProcessing} /></label></div>
                  </div>
                  <nav className="flex-1 px-3 space-y-1">
                      {[
                          {id: 'dashboard', icon: 'LayoutDashboard', label: '總覽 (Overview)'},
                          {id: 'data', icon: 'Database', label: '數據中心 (Data Hub)'},
                          {id: 'insurance', icon: 'Shield', label: '保險金庫 (Insurance)'},
                          {id: 'education', icon: 'GraduationCap', label: '升學導航 (Education)'},
                          {id: 'property', icon: 'Home', label: '物業管理 (Property)'},
                      ].map(item => { const IconComp = Icons[item.icon]; return (<button key={item.id} onClick={()=>{setActiveTab(item.id); setReportMode(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab===item.id && !reportMode ?'bg-blue-600 text-white':'hover:bg-slate-800'}`}><IconComp /> {item.label}</button>)})}
                  </nav>
                  <div className="p-4 border-t border-slate-800 space-y-2">
                       <button onClick={()=>{setReportMode(true); setActiveTab('report');}} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow"><Icons.Printer /> 綜合報告</button>
                       <button onClick={()=>{setReportMode(true); setActiveTab('edu_report');}} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-bold shadow"><Icons.Book /> 升學報告</button>
                       <button onClick={clearData} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-900 text-slate-400 text-xs rounded">清除資料庫</button>
                  </div>
              </div>
          )}

          <div className="flex-1 p-8 overflow-y-auto print-container">
              {reportMode && activeTab === 'report' && <ReportView />}
              {reportMode && activeTab === 'edu_report' && <EduReportView />}

              {!reportMode && (
                  <>
                      {activeTab === 'dashboard' && (
                          <div className="space-y-6 animate-in fade-in">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                  <StatCard title="歷史總支出" value={`$${(stats.total/1000000).toFixed(2)}M`} subtext="From 2005" color="blue" iconName="DollarSign" />
                                  <StatCard title="物業年淨值" value={`$${Math.round(stats.propStats.reduce((a,b)=>a + (b.netAnnual || 0),0)/1000).toLocaleString()}k`} subtext="被動收入" color="emerald" iconName="Home" />
                                  <StatCard title="保險總投入" value={`$${(Object.values(stats.insuranceByMember).flat().reduce((a,b)=>a+b.totalPaid,0)/1000000).toFixed(2)}M`} subtext="全家保障" color="indigo" iconName="ShieldCheck" />
                                  <StatCard title="最大類別" value={stats.byCat[0]?.name || '-'} subtext={`${((stats.byCat[0]?.value/stats.total)*100).toFixed(0)}%`} color="orange" iconName="PieChart" />
                              </div>
                              <div className="bg-white p-6 rounded-xl border shadow-sm h-96"><h3 className="font-bold text-slate-700 mb-4">支出趨勢</h3><ResponsiveContainer><AreaChart data={stats.byYear}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="year"/><YAxis tickFormatter={(v)=>`${v/1000}k`}/><Tooltip/><Area type="monotone" dataKey="amount" stroke="#2563EB" fill="#3B82F6"/></AreaChart></ResponsiveContainer></div>
                          </div>
                      )}
                      
                      {activeTab === 'property' && (
                          <div className="space-y-6 animate-in fade-in">
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
                                  <div>
                                      <h2 className="text-xl font-bold text-slate-800">物業資產管理</h2>
                                      <button onClick={()=>{setDocConfig({...docConfig, propId: properties[0]?.id}); setDocModalOpen(true);}} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-indigo-700"><Icons.FilePen /> 開單/租約</button>
                                  </div>
                                  <div className="flex gap-4">
                                      <div className="text-center"><label className="block text-xs text-slate-500">利率上升</label><input type="range" min="0" max="5" step="0.5" value={stressRate} onChange={e=>setStressRate(Number(e.target.value))} className="accent-red-500"/><div className="text-red-600 font-bold">+{stressRate}%</div></div>
                                      <div className="text-center"><label className="block text-xs text-slate-500">租金下跌</label><input type="range" min="0" max="30" step="5" value={rentDrop} onChange={e=>setRentDrop(Number(e.target.value))} className="accent-orange-500"/><div className="text-orange-600 font-bold">-{rentDrop}%</div></div>
                                      <button onClick={()=>{setEditingProp({id: '', name: '', type: 'Investment', estRent: 0, value: 0, mortgage: 0, tenure: 20}); setPropModalOpen(true);}} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-emerald-700 h-10 mt-auto"><Icons.Plus /> 新增</button>
                                  </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                  {stats.propStats.map(p => (
                                      <div key={p.id} className="bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition relative group">
                                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition"><button onClick={()=>{setEditingProp(p); setPropModalOpen(true);}} className="p-1.5 bg-slate-100 rounded text-blue-600 hover:bg-blue-100"><Icons.Edit2 /></button><button onClick={()=>handleDeleteProperty(p.id)} className="p-1.5 bg-slate-100 rounded text-red-600 hover:bg-red-100"><Icons.Trash /></button></div>
                                          <div className="mb-4"><h3 className="font-bold text-slate-800 text-lg truncate pr-16">{p.name}</h3><span className={`text-xs px-2 py-0.5 rounded ${p.type==='Self-use'?'bg-slate-200 text-slate-600':'bg-green-100 text-green-700'}`}>{p.type==='Self-use'?'自住':'收租'}</span></div>
                                          <div className="space-y-3 text-sm">
                                              <div className="flex justify-between"><span className="text-slate-500">估值</span><span className="font-bold">${(p.value/1000000).toFixed(1)}M</span></div>
                                              <div className="flex justify-between"><span className="text-slate-500">預估月租</span><span className="text-emerald-600 font-mono">+${p.estRent.toLocaleString()}</span></div>
                                              <div className="flex justify-between"><span className="text-slate-500">壓力後支出</span><span className="text-red-500 font-mono">-${(p.stressedExpense || 0).toLocaleString()}</span></div>
                                              <div className="pt-3 border-t flex justify-between items-center"><span className="font-bold text-slate-700">月淨現金流</span><span className={`font-bold text-lg ${(p.netFlow || 0)>=0?'text-emerald-600':'text-red-600'}`}>{(p.netFlow || 0)>=0?'+':''}${(p.netFlow || 0).toLocaleString()}</span></div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                      
                      {activeTab === 'education' && (
                          <div className="space-y-6 animate-in fade-in">
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl border shadow-sm gap-4">
                                  <div><h2 className="text-xl font-bold text-slate-800">升學與職業導航</h2><p className="text-sm text-slate-500">針對「非學術型」學生的多元出路分析</p></div>
                                  <div className="flex gap-2 items-center bg-slate-100 p-1 rounded-lg">
                                      <button onClick={()=>setChildType('Standard')} className={`px-3 py-1 text-xs rounded-md transition ${childType==='Standard'?'bg-white shadow text-blue-600':'text-slate-500'}`}>傳統學術 (大學)</button>
                                      <button onClick={()=>setChildType('Vocational')} className={`px-3 py-1 text-xs rounded-md transition ${childType==='Vocational'?'bg-white shadow text-purple-600':'text-slate-500'}`}>職業導向 (專科)</button>
                                  </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="bg-pink-50 p-6 rounded-xl border border-pink-100">
                                      <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-pink-800">Virginia (16歲)</h3><select className="border rounded p-1 text-xs" value={eduRegionV} onChange={e=>setEduRegionV(e.target.value)}>{Object.keys(eduDB).map(r=><option key={r} value={r}>{eduDB[r].name}</option>)}</select></div>
                                      <div className="text-sm text-pink-900 mb-4"><strong>推薦路徑 ({childType==='Vocational'?'實用型':'學術型'}):</strong><br/>{childType==='Vocational' ? eduDB[eduRegionV].paths.vocational : eduDB[eduRegionV].paths.academic}</div>
                                      <div className="bg-white p-3 rounded text-xs text-slate-600">預計總開支: <strong>${(eduForecast.data.reduce((a,b)=>a+b.vCost,0)/1000000).toFixed(2)}M</strong></div>
                                  </div>
                                  <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                                      <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-blue-800">Jason (13歲)</h3><select className="border rounded p-1 text-xs" value={eduRegionJ} onChange={e=>setEduRegionJ(e.target.value)}>{Object.keys(eduDB).map(r=><option key={r} value={r}>{eduDB[r].name}</option>)}</select></div>
                                      <div className="text-sm text-blue-900 mb-4"><strong>推薦路徑 ({childType==='Vocational'?'實用型':'學術型'}):</strong><br/>{childType==='Vocational' ? eduDB[eduRegionJ].paths.vocational : eduDB[eduRegionJ].paths.academic}</div>
                                      <div className="bg-white p-3 rounded text-xs text-slate-600">預計總開支: <strong>${(eduForecast.data.reduce((a,b)=>a+b.jCost,0)/1000000).toFixed(2)}M</strong></div>
                                  </div>
                              </div>
                              <div className="bg-white p-6 rounded-xl border shadow-sm h-80">
                                  <h3 className="font-bold text-slate-700 mb-4">未來 10 年資金需求預測</h3>
                                  <ResponsiveContainer><BarChart data={eduForecast.data}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="year" /><YAxis tickFormatter={(v)=>`${v/1000}k`}/><Tooltip formatter={(v)=>`$${v.toLocaleString()}`} /><Legend /><Bar dataKey="vCost" name="Virginia" stackId="a" fill="#EC4899" /><Bar dataKey="jCost" name="Jason" stackId="a" fill="#3B82F6" /></BarChart></ResponsiveContainer>
                              </div>
                              
                              <div className="bg-slate-100 p-4 rounded-xl">
                                  <h4 className="font-bold text-slate-700 mb-2 text-sm flex items-center gap-2"><Icons.Edit2 /> 調整預算參數 (AI Research 基準)</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                      {Object.keys(eduDB).map(region => (
                                          <div key={region} className="bg-white p-3 rounded border">
                                              <div className="font-bold mb-1">{eduDB[region].name}</div>
                                              <div className="flex justify-between items-center mb-1"><span>學費/年:</span><input type="number" value={eduDB[region].tuition} onChange={(e)=>updateEduDB({...eduDB, [region]: {...eduDB[region], tuition: Number(e.target.value)}})} className="w-16 border rounded px-1 text-right"/></div>
                                              <div className="flex justify-between items-center"><span>生活費/年:</span><input type="number" value={eduDB[region].living} onChange={(e)=>updateEduDB({...eduDB, [region]: {...eduDB[region], living: Number(e.target.value)}})} className="w-16 border rounded px-1 text-right"/></div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      )}
                      
                      {activeTab === 'insurance' && (
                          <div className="space-y-6 animate-in fade-in">
                              <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 text-indigo-900 text-sm"><h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Icons.ShieldCheck /> 保險 AI 深度透視</h3>系統已自動分析您導入的 <code>payment_data.json</code> 中的 CSV 備註欄位。</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {Object.entries(stats.insuranceByMember).map(([member, policies]) => (
                                      <div key={member} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                                          <div className="bg-slate-50 px-4 py-3 border-b font-bold text-slate-700 flex justify-between"><span>{member}</span><span className="text-xs font-normal bg-white px-2 py-1 rounded border">總投入: ${(policies.reduce((a,b)=>a+b.totalPaid,0)/1000000).toFixed(2)}M</span></div>
                                          <div className="overflow-x-auto">
                                              <table className="w-full text-xs">
                                                  <thead><tr className="text-slate-400 bg-slate-50/50"><th className="p-2 text-left">計劃名稱</th><th className="p-2 text-right">已繳總額</th><th className="p-2 text-center">進度</th><th className="p-2 text-left">備註 (來自 CSV)</th></tr></thead>
                                                  <tbody>{policies.map((p, idx) => { const remainingYears = p.endYear ? p.endYear - new Date().getFullYear() : null; return (<tr key={idx} className="border-t hover:bg-slate-50"><td className="p-2 font-medium text-slate-700">{p.name}</td><td className="p-2 text-right font-mono text-emerald-600">${p.totalPaid.toLocaleString()}</td><td className="p-2 text-center">{remainingYears ? (remainingYears > 0 ? <span className="text-orange-500 font-bold">{remainingYears}年剩餘</span> : <span className="text-green-500 font-bold">已供滿</span>) : '-'}</td><td className="p-2 text-slate-500 truncate max-w-xs text-[10px]" title={p.note}>{p.note}</td></tr>); })}</tbody>
                                              </table>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      {activeTab === 'data' && (
                          <div className="bg-white rounded-xl border shadow-sm flex flex-col h-[80vh] animate-in fade-in">
                              <div className="p-4 border-b bg-slate-50 flex flex-wrap gap-4 justify-between items-center">
                                  <div className="flex gap-2"><h3 className="font-bold text-slate-700">數據中心</h3><button onClick={()=>setEntryModalOpen(true)} className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"><Icons.Plus /> 新增</button><button onClick={exportJSON} className="flex items-center gap-1 px-3 py-1 bg-slate-600 text-white text-xs rounded hover:bg-slate-700"><Icons.Download /> 導出 JSON</button></div>
                                  <div className="flex gap-2 text-sm">
                                      <input type="text" placeholder="搜尋..." className="border rounded px-2 py-1" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                                      <select className="border rounded px-2 py-1" value={filterYear} onChange={e=>setFilterYear(e.target.value)}>
                                          <option value="All">所有年份</option>
                                          {stats.byYear.map(y => <option key={y.year} value={y.year}>{y.year}</option>)}
                                      </select>
                                      <select className="border rounded px-2 py-1" value={filterMember} onChange={e=>setFilterMember(e.target.value)}>
                                          <option value="All">所有成員</option>
                                          {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                                      </select>
                                      <select className="border rounded px-2 py-1" value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}><option value="All">所有類別</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
                                  </div>
                              </div>
                              <div className="overflow-auto flex-1 p-0">
                                  <table className="w-full text-sm text-left">
                                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10"><tr><th className="px-4 py-3">日期</th><th className="px-4 py-3">商戶</th><th className="px-4 py-3">金額</th><th className="px-4 py-3">成員</th><th className="px-4 py-3">類別</th><th className="px-4 py-3">操作</th></tr></thead>
                                      <tbody className="divide-y divide-slate-100">
                                          {data.filter(d => (filterCategory==='All'||d.category===filterCategory) && (searchTerm===''||d.merchant.toLowerCase().includes(searchTerm.toLowerCase()))).slice(0, 100).map(tx => (
                                              <tr key={tx.id} className="hover:bg-blue-50">
                                                  <td className="px-4 py-2">{tx.date}</td><td className="px-4 py-2 font-medium">{tx.merchant}</td><td className="px-4 py-2 font-mono">${tx.amount.toLocaleString()}</td><td className="px-4 py-2"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{tx.member}</span></td>
                                                  <td className="px-4 py-2">{editingTx === tx.id ? (<select className="border rounded p-1" onChange={(e) => updateCategory(tx.id, e.target.value, tx.merchant, window.confirm('應用到所有同名商戶?'))} defaultValue={tx.category} autoFocus onBlur={() => setEditingTx(null)}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>) : <span className="cursor-pointer hover:text-blue-600" onClick={()=>setEditingTx(tx.id)}>{tx.category}</span>}</td>
                                                  <td className="px-4 py-2 text-center"><button onClick={()=>deleteTx(tx.id)} className="text-red-400 hover:text-red-600"><Icons.Trash /></button></td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )}
                  </>
              )}
          </div>

          {/* Property Modal */}
          {isPropModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
                  <div className="bg-white rounded-xl shadow-2xl p-6 w-96 animate-in fade-in zoom-in duration-200">
                      <h3 className="text-lg font-bold mb-4">{editingProp.id ? '編輯物業' : '新增物業'}</h3>
                      <div className="space-y-3">
                          <div><label className="text-xs text-slate-500">名稱</label><input type="text" value={editingProp.name} onChange={e=>setEditingProp({...editingProp, name:e.target.value})} className="w-full border rounded p-2 text-sm" /></div>
                          <div><label className="text-xs text-slate-500">用途</label><select value={editingProp.type} onChange={e=>setEditingProp({...editingProp, type:e.target.value})} className="w-full border rounded p-2 text-sm"><option value="Investment">收租</option><option value="Self-use">自住</option></select></div>
                          <div><label className="text-xs text-slate-500">估值 ($)</label><input type="number" value={editingProp.value} onChange={e=>setEditingProp({...editingProp, value:Number(e.target.value)})} className="w-full border rounded p-2 text-sm" /></div>
                          <div><label className="text-xs text-slate-500">租金 ($)</label><input type="number" value={editingProp.estRent} onChange={e=>setEditingProp({...editingProp, estRent:Number(e.target.value)})} className="w-full border rounded p-2 text-sm" /></div>
                          <div><label className="text-xs text-slate-500">每月供款 ($)</label><input type="number" value={editingProp.mortgage} onChange={e=>setEditingProp({...editingProp, mortgage:Number(e.target.value)})} className="w-full border rounded p-2 text-sm" /></div>
                          <div><label className="text-xs text-slate-500">尚餘年期 (年)</label><input type="number" value={editingProp.tenure} onChange={e=>setEditingProp({...editingProp, tenure:Number(e.target.value)})} className="w-full border rounded p-2 text-sm" /></div>
                      </div>
                      <div className="flex gap-2 mt-6">
                          <button onClick={handleSaveProperty} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">保存</button>
                          <button onClick={()=>setPropModalOpen(false)} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded hover:bg-slate-300">取消</button>
                      </div>
                  </div>
              </div>
          )}

          {/* Data Entry Modal */}
          {isEntryModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
                  <div className="bg-white rounded-xl shadow-2xl p-6 w-96 animate-in fade-in zoom-in duration-200">
                      <h3 className="text-lg font-bold mb-4 text-slate-800">新增交易</h3>
                      <div className="space-y-3">
                          <input type="date" className="w-full border rounded p-2" value={newTx.date} onChange={e=>setNewTx({...newTx, date: e.target.value})} />
                          <input type="text" placeholder="商戶名稱" className="w-full border rounded p-2" value={newTx.merchant} onChange={e=>setNewTx({...newTx, merchant: e.target.value})} />
                          <input type="number" placeholder="金額" className="w-full border rounded p-2" value={newTx.amount} onChange={e=>setNewTx({...newTx, amount: e.target.value})} />
                          <select className="w-full border rounded p-2" value={newTx.category} onChange={e=>setNewTx({...newTx, category: e.target.value})}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
                          <select className="w-full border rounded p-2" value={newTx.member} onChange={e=>setNewTx({...newTx, member: e.target.value})}>{MEMBERS.map(m=><option key={m} value={m}>{m}</option>)}</select>
                      </div>
                      <div className="flex gap-2 mt-6">
                          <button onClick={handleAddTx} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">保存</button>
                          <button onClick={()=>setEntryModalOpen(false)} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded hover:bg-slate-300">取消</button>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );
};

export default App;
EOF

# 15. 安裝套件
echo "⬇️ 安裝套件中..."
npm install

# 16. Git 初始化與推送
echo "☁️ 初始化 Git 並上傳..."
git init
git add .
git commit -m "Auto deploy with Firebase setup"
git branch -M main
# 注意：這裡使用您的 GitHub 網址
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/charles2006hk-hash/charles-wealth-nav.git
git push -u origin main --force

echo "✅ 部署完成！請等待 Vercel 自動建置。"
