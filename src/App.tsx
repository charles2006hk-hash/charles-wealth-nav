import React, { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, BarChart, Bar, 
  PieChart, Pie, Cell 
} from 'recharts';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, doc, addDoc, setDoc, deleteDoc, updateDoc, 
  onSnapshot, query, orderBy, writeBatch, getDocs
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
// --- 新增：投資模塊類型定義 ---


interface PrivateLoan {
  id: string;
  name: string; // e.g., "建設借款"
  principal: number; // 本金 e.g., 3000000
  rate: number; // 年化利率 e.g., 6%
  term: 'Semi-annual'; // 結算週期
  nextDeductionDate: string; // 下次扣息日
  lastDeductionDate: string; // 上次扣息日
  status: 'Active' | 'Settled';
  notes: string;
}

interface PEProject {
  id: string;
  fundName: string; // e.g., "蟻米基金"
  projectName: string; // e.g., "鑫茂新能源"
  investmentAmount: number; // 投資本金
  valuation: number; // 當前估值 (或是投資成本)
  status: 'Investment' | 'Exit' | 'IPO Prep';
  ipoTargetDate: string; // 預計上市時間
  description: string;
  managementFee: number; // 年管理費率
  feePaidStatus: string; // e.g., "2023 已繳"
}

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
  attachments?: string[]; 
  receiptNo?: string;     
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
  attachments?: string[]; 
}

interface Property {
  id: string;
  name: string;
  address: string;
  type: 'Investment' | 'Self-use';
  status: 'Occupied' | 'Vacant' | 'Renovation' | 'Sold';
  
  owner: string; 
  ownershipType: 'Self-owned' | 'Managed'; 
  tags: string[]; 
  lastViewed?: number;

  purchaseDate: string;       
  purchasePrice: number; 
  purchaseAgent: string;      
  purchaseCommission: number; 
  
  initialDeposit: number; 
  furtherDeposit: number; 
  balancePayment: number; 
  
  mortgageLoan: number; 
  bank: string;
  interestRate: number; 
  mortgageAmount: number; 
  outstandingLoan: number; 
  tenure: number;  
  
  saleDate?: string;
  salePrice?: number;

  currentValue: number; 
  estRent: number; 
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
    estRent: number;
    stressedExpense: number;
    displayTags: string[];
    holdingPeriod: string;
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
  linkedTransactionId?: string; 
  existingReceiptNo?: string;
  // --- 新增：對帳單專用設定 ---
  showDebit?: boolean;  // 獨立控制 Debit
  showCredit?: boolean; // 獨立控制 Credit
  showRowNotes?: boolean;    // 是否顯示流水帳備註
  statementFooterNote?: string; // 表格下方的自定義備註
}

interface InsurancePolicy {
    name: string;
    totalPaid: number;
    note: string;
    lastPaid?: string;
    endYear?: number | null;
    rawMerchant?: string;
}

// 擴充設定介面
interface AppSettings {
    banks: string[];
    insuranceCompanies: string[];
    owners: string[];
    agents: string[];
    tenants: string[];
    categories: CategoryConfig[];
    members: string[]; // <-- 新增：動態成員名單
}

interface CategoryConfig {
  name: string;
  type: 'Income' | 'Expense';
}

// --- 新增：家庭基金類型定義 ---
interface InvestmentRecord {
  startDate: string;
  endDate: string;
  principal: number;
  months: string | number;
  rate: number;
  interest: number;
}

interface InvestmentAdjustment {
  date: string;
  description: string;
  amount: number;
  category: string;
}

interface OtherInvestor {
  name: string;
  records: InvestmentRecord[];
  adjustments: InvestmentAdjustment[];
  stats: {
    principal: number;
    balance: number;
  };
}

// --- 初始數據：從 CSV 解析而來 ---
const INITIAL_OTHER_INVESTORS: OtherInvestor[] = [
  {
    "name": "阿爺 (Grandpa)",
    "records": [
      { "startDate": "2014/5/1", "endDate": "2015/3/1", "principal": 275000, "months": "10", "rate": 0.1, "interest": 23222 },
      { "startDate": "2014/8/1", "endDate": "2015/3/1", "principal": 225000, "months": "7", "rate": 0.1, "interest": 13250 },
      { "startDate": "2015/3/1", "endDate": "2016/3/1", "principal": 500000, "months": "12", "rate": 0.08, "interest": 40667 },
      { "startDate": "2016/4/1", "endDate": "2016/12/1", "principal": 500000, "months": "8", "rate": 0.08, "interest": 27111 },
      { "startDate": "2017/1/1", "endDate": "2017/12/31", "principal": 500000, "months": "12", "rate": 0.08, "interest": 40444 },
      { "startDate": "2018/1/1", "endDate": "2018/12/31", "principal": 500000, "months": "12", "rate": 0.08, "interest": 40444 },
      { "startDate": "2019/1/1", "endDate": "2019/12/31", "principal": 500000, "months": "12", "rate": 0.08, "interest": 40444 },
      { "startDate": "2020/1/1", "endDate": "2020/12/31", "principal": 500000, "months": "12", "rate": 0.06, "interest": 30417 },
      { "startDate": "2021/1/1", "endDate": "2021/12/31", "principal": 500000, "months": "12", "rate": 0.06, "interest": 30333 },
      { "startDate": "2022/1/1", "endDate": "2022/12/31", "principal": 500000, "months": "12", "rate": 0.06, "interest": 30333 },
      { "startDate": "2023/1/1", "endDate": "2023/12/31", "principal": 500000, "months": "12", "rate": 0.06, "interest": 30333 },
      { "startDate": "2024/1/1", "endDate": "2024/12/31", "principal": 500000, "months": "12", "rate": 0.06, "interest": 30417 },
      { "startDate": "2025/1/1", "endDate": "2025/12/31", "principal": 500000, "months": "12", "rate": 0.06, "interest": 30333 },
      { "startDate": "2026/1/1", "endDate": "2026/12/31", "principal": 500000, "months": "12", "rate": 0.06, "interest": 30333 }
    ],
    "adjustments": [
      { "date": "", "description": "到期後利息：", "amount": 438083, "category": "Interest Paid" },
      { "date": "2016/3/30", "description": "股票投資：", "amount": -9850, "category": "Stock" },
      { "date": "2017/5/1", "description": "喜入數林錦堂 利息收入：", "amount": -80000, "category": "Interest Paid" },
      { "date": "2018/11/5", "description": "喜入數農行林錦堂 利息收入：", "amount": -80000, "category": "Interest Paid" },
      { "date": "2019/6/1", "description": "喜入數農行林錦堂 利息收入：", "amount": -80000, "category": "Interest Paid" }
    ],
    "stats": { "principal": 500000, "balance": 688233 }
  },
  {
    "name": "阿嫲 (Grandma)",
    "records": [
      { "startDate": "2014/5/1", "endDate": "2015/3/1", "principal": 400000, "months": "10", "rate": 0.1, "interest": 33778 },
      { "startDate": "2015/3/1", "endDate": "2016/3/1", "principal": 400000, "months": "12", "rate": 0.08, "interest": 32533 },
      { "startDate": "2016/4/1", "endDate": "2016/12/1", "principal": 400000, "months": "8", "rate": 0.08, "interest": 21689 },
      { "startDate": "2017/1/1", "endDate": "2017/12/31", "principal": 400000, "months": "12", "rate": 0.08, "interest": 32356 },
      { "startDate": "2018/1/1", "endDate": "2018/12/31", "principal": 400000, "months": "12", "rate": 0.08, "interest": 32356 },
      { "startDate": "2019/1/1", "endDate": "2019/12/31", "principal": 400000, "months": "12", "rate": 0.08, "interest": 32356 },
      { "startDate": "2020/1/1", "endDate": "2020/12/31", "principal": 400000, "months": "12", "rate": 0.06, "interest": 24333 },
      { "startDate": "2021/1/1", "endDate": "2021/12/31", "principal": 400000, "months": "12", "rate": 0.06, "interest": 24267 },
      { "startDate": "2022/1/1", "endDate": "2022/12/31", "principal": 400000, "months": "12", "rate": 0.06, "interest": 24267 },
      { "startDate": "2023/1/1", "endDate": "2023/12/31", "principal": 400000, "months": "12", "rate": 0.06, "interest": 24267 },
      { "startDate": "2024/1/1", "endDate": "2024/12/31", "principal": 400000, "months": "12", "rate": 0.06, "interest": 24333 },
      { "startDate": "2025/1/1", "endDate": "2025/12/31", "principal": 400000, "months": "12", "rate": 0.06, "interest": 24267 },
      { "startDate": "2026/1/1", "endDate": "2026/12/31", "principal": 400000, "months": "12", "rate": 0.06, "interest": 24267 }
    ],
    "adjustments": [
      { "date": "", "description": "到期後利息：", "amount": 355067, "category": "Interest Paid" },
      { "date": "2016/3/30", "description": "股票投資：", "amount": -9850, "category": "Stock" },
      { "date": "2017/11/1", "description": "喜入數Joyce 利息收入：", "amount": -80000, "category": "Interest Paid" },
      { "date": "2024/1/23", "description": "利息收入：", "amount": -116683, "category": "Interest Paid" }
    ],
    "stats": { "principal": 400000, "balance": 548533 }
  },
  {
    "name": "Katie",
    "records": [
      { "startDate": "2015/11/1", "endDate": "2016/3/1", "principal": 600000, "months": "4", "rate": 0.1, "interest": 20167 },
      { "startDate": "2016/4/1", "endDate": "2016/12/1", "principal": 600000, "months": "8", "rate": 0.08, "interest": 32533 },
      { "startDate": "2017/1/1", "endDate": "2017/12/31", "principal": 142600, "months": "12", "rate": 0.08, "interest": 11535 },
      { "startDate": "2018/1/1", "endDate": "2018/12/31", "principal": 142600, "months": "12", "rate": 0.08, "interest": 11535 },
      { "startDate": "2019/1/1", "endDate": "2019/12/31", "principal": 142600, "months": "12", "rate": 0.08, "interest": 11535 },
      { "startDate": "2020/1/1", "endDate": "2020/12/31", "principal": 142600, "months": "12", "rate": 0.06, "interest": 8675 },
      { "startDate": "2021/1/1", "endDate": "2021/12/31", "principal": 142600, "months": "12", "rate": 0.06, "interest": 8651 },
      { "startDate": "2022/1/1", "endDate": "2022/12/31", "principal": 142600, "months": "12", "rate": 0.06, "interest": 8651 },
      { "startDate": "2023/1/1", "endDate": "2023/12/31", "principal": 142600, "months": "12", "rate": 0.06, "interest": 8651 },
      { "startDate": "2024/1/1", "endDate": "2024/12/31", "principal": 142600, "months": "12", "rate": 0.06, "interest": 8675 },
      { "startDate": "2025/1/1", "endDate": "2025/12/31", "principal": 142600, "months": "12", "rate": 0.06, "interest": 8651 },
      { "startDate": "2026/1/1", "endDate": "2026/12/31", "principal": 142600, "months": "12", "rate": 0.06, "interest": 8651 }
    ],
    "adjustments": [
      { "date": "", "description": "到期後利息：", "amount": 147909, "category": "Interest Paid" }
    ],
    "stats": { "principal": 142600, "balance": 290509 }
  },
  {
      "name": "Charles",
      "records": [
        { "startDate": "2022/4/1", "endDate": "2023/3/31", "principal": 1000000.0, "months": "12", "rate": 0.06, "interest": 60000.0 },
        { "startDate": "2023/4/1", "endDate": "2024/3/30", "principal": 1000000.0, "months": "12", "rate": 0.06, "interest": 60000.0 },
        { "startDate": "2024/4/1", "endDate": "2025/3/31", "principal": 1000000.0, "months": "12", "rate": 0.06, "interest": 60000.0 },
        { "startDate": "2025/4/1", "endDate": "2026/3/31", "principal": 1000000.0, "months": "12", "rate": 0.06, "interest": 60000.0 }
      ],
      "adjustments": [
        { "date": "", "description": "到期後利息：", "amount": 300000.0, "category": "Interest Paid" }
      ],
      "stats": { "principal": 1000000.0, "balance": 1300000.0 }
  }
];


// --- 3. 常數與圖示 ---
const ICONS = {
  Home: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  LayoutDashboard: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>,
  Data: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  FileText: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Printer: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>,
  Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>,
  Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>,
  Edit: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
  Tag: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/></svg>,
  DollarSign: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  PieChart: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
  Shield: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  GraduationCap: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  ShieldCheck: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>,
  Edit2: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
  Upload: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Download: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Image: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>,
  X: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
  Settings: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  Briefcase: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  TrendingUp: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,

};

// --- Constants ---
const DEFAULT_CATEGORIES: CategoryConfig[] = [
  // 收入類
  { name: 'Rental Income (租金收入)', type: 'Income' },
  { name: 'Property Sale (賣樓收入)', type: 'Income' },
  
  // 物業支出類
  { name: 'Management Fee (管理費)', type: 'Expense' },
  { name: 'Govt Rates (差餉)', type: 'Expense' },
  { name: 'Govt Rent (地租)', type: 'Expense' },
  { name: 'Mortgage Payment (按揭供款)', type: 'Expense' },
  { name: 'Repair & Maint (維修)', type: 'Expense' },
  { name: 'Tax (稅項)', type: 'Expense' },
  { name: 'Purchase Commission (買入佣金)', type: 'Expense' },
  { name: 'Agent Fee (招租佣金)', type: 'Expense' },
  { name: 'Insurance (保險)', type: 'Expense' },
  { name: 'Utilities (水電煤)', type: 'Expense' },
  
  // 一般/家庭支出類
  { name: 'Credit Card', type: 'Expense' },
  { name: 'Education', type: 'Expense' },
  { name: 'Transport', type: 'Expense' },
  { name: 'Telecom', type: 'Expense' },
  { name: 'Shopping', type: 'Expense' },
  { name: 'Dining', type: 'Expense' },
  { name: 'Medical', type: 'Expense' },
  { name: 'General', type: 'Expense' },
  { name: 'Other (其他)', type: 'Expense' }
];

const INITIAL_LOANS: PrivateLoan[] = [
    {
        id: 'l1',
        name: '建設借款 (Construction Loan)',
        principal: 3000000,
        rate: 6.0,
        term: 'Semi-annual',
        nextDeductionDate: '2024-01-01', // 下一次結算
        lastDeductionDate: '2023-07-01',
        status: 'Active',
        notes: '先扣原則，每半年(1/1, 7/1)結算。'
    }
];

const INITIAL_PE_PROJECTS: PEProject[] = [
    {
        id: 'pe1',
        fundName: '蟻米基金 (Ant Rice Fund)',
        projectName: '鑫茂新能源 (Xinmao)',
        investmentAmount: 500000,
        valuation: 500000, // 暫按成本計，雖然估值已漲
        status: 'IPO Prep',
        ipoTargetDate: '2024-12-31',
        managementFee: 2.0,
        feePaidStatus: '2023 Paid (20k)',
        description: '2022營收6億，淨利9100萬。計劃2023 Q3申報創業板，2024上市。'
    },
    {
        id: 'pe2',
        fundName: '蟻米基金 (Ant Rice Fund)',
        projectName: '玻思韬 (Bostao)',
        investmentAmount: 500000,
        valuation: 500000,
        status: 'Investment',
        ipoTargetDate: '2025-06-30',
        managementFee: 2.0,
        feePaidStatus: 'Included',
        description: '生物醫藥釋控技術。預計2024報IPO。'
    }
];

const CATEGORIES = [
  'Rental Income (租金收入)', 
  'Property Sale (賣樓收入)', 
  'Management Fee (管理費)', 'Govt Rates (差餉)', 'Govt Rent (地租)',
  'Mortgage Payment (按揭供款)', 'Repair & Maint (維修)', 'Tax (稅項)', 
  'Purchase Commission (買入佣金)', 
  'Agent Fee (招租佣金)', 
  'Insurance (保險)', 'Utilities (水電煤)', 'Other (其他)',
  'Credit Card', 'Education', 'Transport', 'Telecom', 'Shopping', 'Dining', 'Medical', 'General'
];

const INITIAL_PROPERTIES_DATA: Property[] = [
    { id: 'p1', name: '京瑞二期 16E', address: '沙田安群街1號京瑞廣場二期16樓E室', type: 'Investment', status: 'Occupied', currentValue: 8000000, purchasePrice: 6000000, initialDeposit: 300000, furtherDeposit: 300000, balancePayment: 5400000, mortgageLoan: 3000000, mortgageAmount: 15000, outstandingLoan: 3000000, managementFee: 1200, govtRates: 1500, govtRent: 900, estRent: 25000, tenure: 15, interestRate: 3.5, bank: 'BOC', owner: 'Charles', ownershipType: 'Self-owned', tags: [], purchaseDate: '2015-01-01', purchaseAgent: '', purchaseCommission: 0 },
];

const INITIAL_EDUCATION_DB: Record<string, EduConfig> = {
  HK: { name: '香港 (HK)', years: 4, tuition: 42100, living: 60000, salary: 19000, notes: '本地', paths: { academic: 'HKU/CUHK', vocational: 'IVE/THEi' } },
  UK: { name: '英國 (UK)', years: 3, tuition: 200000, living: 150000, salary: 28000, notes: 'BNO', paths: { academic: 'Russell Group', vocational: 'BTEC' } },
  AUS: { name: '澳洲 (AUS)', years: 3, tuition: 180000, living: 180000, salary: 32000, notes: '環境好', paths: { academic: 'Go8', vocational: 'TAFE' } },
  CAN: { name: '加拿大 (CAN)', years: 2, tuition: 150000, living: 120000, salary: 26000, notes: '移民', paths: { academic: 'UBC/UT', vocational: 'College' } }
};

const INITIAL_SETTINGS: AppSettings = {
    banks: ['BOC', 'HSBC', 'OCBC', 'Hang Seng'],
    insuranceCompanies: ['AIA', 'Prudential', 'Manulife'],
    owners: ['Charles', 'Carmen', 'Joint'],
    agents: ['Midland', 'Centaline', 'Ricacorp'],
    tenants: [],
    categories: DEFAULT_CATEGORIES,
    members: ['Charles', 'Carmen', 'Virginia', 'Jason', 'Family', '合夥人A']
};

const FAMILY_INFO = {
  Virginia: { age: 16, role: '女兒', educationStart: 2026 },
  Jason: { age: 13, role: '兒子', educationStart: 2029 }
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// --- 4. 輔助函數 ---
const convertNumberToEnglish = (n: number) => {
    if (n === 0) return "Zero";
    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const convertChunk = (num: number): string => {
        if (num < 20) return units[num];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + units[num % 10] : "");
        if (num < 1000) return units[Math.floor(num / 100)] + " Hundred" + (num % 100 !== 0 ? " and " + convertChunk(num % 100) : "");
        return "";
    };
    let result = "";
    if (n >= 1000000) { result += convertChunk(Math.floor(n / 1000000)) + " Million "; n %= 1000000; }
    if (n >= 1000) { result += convertChunk(Math.floor(n / 1000)) + " Thousand "; n %= 1000; }
    if (n > 0) { result += convertChunk(n); }
    return result.trim() + " ONLY";
};

const formatCurrency = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return '$0.';
    return `$${num.toLocaleString()}.`;
};

const calculateDuration = (start: string, end?: string) => {
    if (!start) return '-';
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const diffTime = Math.abs(e.getTime() - s.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const days = diffDays % 365;
    return `${years}年 ${days}天`;
};

const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6); 
                resolve(dataUrl);
            }
        }
    });
};

const parseCSVLine = (text: string) => {
    const result = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(cell.trim());
            cell = '';
        } else {
            cell += char;
        }
    }
    result.push(cell.trim());
    return result.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
};

const parseChineseDate = (dateStr: string) => {
    if (!dateStr) return '';
    const match = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
    if (match) {
        const y = match[1];
        const m = match[2].padStart(2, '0');
        const d = match[3].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return dateStr.replace(/\//g, '-'); 
};

const parseAmount = (amountStr: string) => {
    if (!amountStr) return 0;
    return parseFloat(amountStr.replace(/[$,]/g, '')) || 0;
};

// --- 5. 獨立組件 ---
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

const OverviewDashboard = ({ transactions, properties, leases }: any) => {
    // 1. 計算所有數據的最早與最晚日期，用於 "All Time" 功能
    const { minDate, maxDate } = useMemo(() => {
        if (transactions.length === 0) return { minDate: new Date().toISOString().split('T')[0], maxDate: new Date().toISOString().split('T')[0] };
        const dates = transactions.map((t:any) => t.date).sort();
        return { minDate: dates[0], maxDate: dates[dates.length - 1] };
    }, [transactions]);

    const [dateRange, setDateRange] = useState({ 
        start: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0], // 預設過去一年
        end: new Date().toISOString().split('T')[0] 
    });
    const [selectedCats, setSelectedCats] = useState<string[]>(CATEGORIES);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const filteredTxs = useMemo(() => {
        return transactions.filter((t: any) => {
            const tDate = t.date;
            const inDate = tDate >= dateRange.start && tDate <= dateRange.end;
            const inCat = selectedCats.includes(t.category);
            return inDate && inCat;
        });
    }, [transactions, dateRange, selectedCats]);

    const expenseTxs = filteredTxs.filter((t:any) => !(t.category || '').includes('Income') && !(t.category || '').includes('Sale'));
    const totalExpense = expenseTxs.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
    
    const propValuation = properties.reduce((sum: number, p: any) => sum + (p.status === 'Sold' ? (p.salePrice || 0) : (p.currentValue || 0)), 0);
    const propDebt = properties.reduce((sum: number, p: any) => sum + (p.outstandingLoan || 0), 0);
    const activeMonthlyRent = leases.filter((l:any) => l.status === 'Active').reduce((sum:number, l:any) => sum + (l.monthlyRent || 0), 0);

    const insuranceTxs = transactions.filter((t:any) => (t.category || '').includes('Insurance'));
    const totalInsurance = insuranceTxs.reduce((sum:number, t:any) => sum + (t.amount || 0), 0);
    const insuranceByMember = insuranceTxs.reduce((acc: any, t: any) => {
        acc[t.member] = (acc[t.member] || 0) + t.amount;
        return acc;
    }, {});

    const trendData = useMemo(() => {
        const data: Record<string, number> = {};
        expenseTxs.forEach((t:any) => {
            const key = t.date.substring(0, 7); 
            data[key] = (data[key] || 0) + t.amount;
        });
        return Object.entries(data)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, amount]) => ({ date, amount }));
    }, [expenseTxs]);

    const categoryData = useMemo(() => {
        const data: Record<string, number> = {};
        expenseTxs.forEach((t:any) => {
            data[t.category] = (data[t.category] || 0) + t.amount;
        });
        return Object.entries(data)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8); 
    }, [expenseTxs]);

    const toggleCategory = (cat: string) => {
        if (selectedCats.includes(cat)) {
            setSelectedCats(selectedCats.filter(c => c !== cat));
        } else {
            setSelectedCats([...selectedCats, cat]);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-4 flex-wrap">
                    <h2 className="font-bold text-lg text-slate-700">總覽篩選</h2>
                    
                    {/* 時間篩選器 (包含 All Time 按鈕) */}
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border">
                         <button 
                            onClick={() => setDateRange({ start: minDate, end: maxDate })}
                            className="px-2 py-1 text-xs bg-white border shadow-sm rounded hover:bg-blue-50 text-blue-600 font-bold transition-colors"
                            title="顯示所有歷史數據"
                         >
                            All Time
                         </button>
                         <span className="w-[1px] h-4 bg-slate-300 mx-1"></span>
                         <span className="text-xs text-slate-400 pl-1">From</span>
                         <input type="date" value={dateRange.start} onChange={e=>setDateRange({...dateRange, start: e.target.value})} className="bg-transparent text-sm font-bold text-slate-700 border-none focus:ring-0 w-32" />
                         <span className="text-xs text-slate-400">To</span>
                         <input type="date" value={dateRange.end} onChange={e=>setDateRange({...dateRange, end: e.target.value})} className="bg-transparent text-sm font-bold text-slate-700 border-none focus:ring-0 w-32" />
                    </div>

                    {/* 數據量統計顯示 */}
                    <div className="text-xs px-3 py-1 bg-slate-100 rounded-full text-slate-600 border border-slate-200">
                        正在分析: <strong className="text-blue-600 text-sm">{filteredTxs.length}</strong> 筆
                        <span className="text-slate-400 mx-2">/</span>
                        總數據庫: {transactions.length} 筆
                    </div>
                </div>

                <div className="relative">
                    <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 flex items-center gap-2">
                        <ICONS.Tag /> 篩選支出類別 ({selectedCats.length}) {isFilterOpen ? '▲' : '▼'}
                    </button>
                    {isFilterOpen && (
                        <div className="absolute right-0 top-12 w-64 bg-white shadow-xl rounded-xl border p-4 z-50 max-h-96 overflow-y-auto">
                            <div className="flex justify-between mb-2">
                                <button onClick={()=>setSelectedCats(CATEGORIES)} className="text-xs text-blue-600 underline">全選</button>
                                <button onClick={()=>setSelectedCats([])} className="text-xs text-slate-400 underline">清空</button>
                            </div>
                            <div className="space-y-2">
                                {CATEGORIES.map(c => (
                                    <label key={c} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded">
                                        <input type="checkbox" checked={selectedCats.includes(c)} onChange={()=>toggleCategory(c)} className="rounded text-blue-600 focus:ring-blue-500" />
                                        <span className="truncate">{c}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-40">
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><ICONS.DollarSign /></div>
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">已選區間</span>
                    </div>
                    <div>
                        <p className="text-slate-500 text-sm">區間總支出 Total Expense</p>
                        <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(totalExpense)}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-40">
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><ICONS.Home /></div>
                        <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full font-bold">被動收入</span>
                    </div>
                    <div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-slate-500 text-xs">總資產 Value</p>
                                <p className="font-bold text-emerald-700">{formatCurrency(propValuation)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-slate-500 text-xs">總負債 Debt</p>
                                <p className="font-bold text-red-400">-{formatCurrency(propDebt)}</p>
                            </div>
                        </div>
                        <div className="mt-2 border-t pt-2 flex justify-between">
                            <span className="text-xs text-slate-500">每月租金流:</span>
                            <span className="text-sm font-bold text-slate-800">{formatCurrency(activeMonthlyRent)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-40">
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><ICONS.Shield /></div>
                        <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full font-bold">全家保障</span>
                    </div>
                    <div>
                         <p className="text-slate-500 text-sm">歷年保險總投入</p>
                         <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(totalInsurance)}</h3>
                         <div className="flex gap-1 mt-1">
                            {Object.entries(insuranceByMember).slice(0,3).map(([m]:any) => (
                                <span key={m} className="text-[10px] bg-slate-100 px-1 rounded text-slate-500">{m}</span>
                            ))}
                         </div>
                    </div>
                </div>

                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-40">
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><ICONS.PieChart /></div>
                        <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-bold">最大支出</span>
                    </div>
                    <div>
                         <p className="text-slate-500 text-sm">{categoryData[0]?.name || 'N/A'}</p>
                         <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(categoryData[0]?.value || 0)}</h3>
                         <p className="text-xs text-orange-400 mt-1">佔總支出 {totalExpense ? ((categoryData[0]?.value || 0)/totalExpense*100).toFixed(1) : 0}%</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><ICONS.LayoutDashboard /> 支出趨勢分析 (Trend)</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tick={{fontSize: 12}} />
                                <YAxis tick={{fontSize: 12}} tickFormatter={(v)=>`$${v/1000}k`} />
                                <Tooltip formatter={(value:any) => formatCurrency(value)} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                                <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorAmt)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-700 mb-6">類別分佈 (Top Categories)</h3>
                    <div className="h-[300px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {categoryData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value:any) => formatCurrency(value)} />
                                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px'}} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
            
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-6">每月支出強度比較 (Bar Chart)</h3>
                <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" />
                            <Tooltip cursor={{fill: 'transparent'}} formatter={(value:any) => formatCurrency(value)} />
                            <Bar dataKey="amount" fill="#8884d8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// --- 在 SettingsView 內部 ---

const SettingsView = ({ settings, setSettings, updateSettings }: { settings: AppSettings, setSettings: (s: AppSettings) => void, updateSettings: (s: AppSettings) => void }) => {
    
    const removeItem = (type: keyof AppSettings, item: string) => {
        // @ts-ignore
        const newSettings = { ...settings, [type]: settings[type].filter((x: string) => x !== item) };
        setSettings(newSettings);
        updateSettings(newSettings);
    };

    const handleAdd = (type: keyof AppSettings, val: string) => {
        if (val) {
            // @ts-ignore
            const newSettings = { ...settings, [type]: [...(settings[type] || []), val] };
            setSettings(newSettings);
            updateSettings(newSettings);
        }
    };

    // --- 類別管理狀態 ---
    const [newCatName, setNewCatName] = useState('');
    const [newCatType, setNewCatType] = useState<'Income' | 'Expense'>('Expense');

    const addCategory = () => {
        if (!newCatName.trim()) return;
        if (settings.categories?.some(c => c.name === newCatName)) {
            alert('此類別名稱已存在');
            return;
        }
        const newEntry = { name: newCatName, type: newCatType };
        const currentCats = settings.categories || [];
        const newSettings = { ...settings, categories: [...currentCats, newEntry] };
        setSettings(newSettings);
        updateSettings(newSettings);
        setNewCatName('');
    };

    const removeCategory = (nameToRemove: string) => {
        if(!window.confirm(`確定刪除類別 "${nameToRemove}" 嗎？`)) return;
        const newSettings = { 
            ...settings, 
            categories: settings.categories.filter(c => c.name !== nameToRemove) 
        };
        setSettings(newSettings);
        updateSettings(newSettings);
    };

    // --- ✅ 新增：強制重置預設分類按鈕 ---
    const handleResetCategories = () => {
        if (!window.confirm("確定要重置所有分類為「系統預設值」嗎？\n(您手動新增的自訂分類將會消失)")) return;
        
        const newSettings = { ...settings, categories: DEFAULT_CATEGORIES };
        setSettings(newSettings);
        updateSettings(newSettings);
        alert("已成功重置分類！");
    };

    return (
        <div className="space-y-8 animate-in fade-in pb-10">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">系統設定 System Settings</h2>
                {/* 重置按鈕 */}
                <button 
                    onClick={handleResetCategories}
                    className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-600 px-3 py-1 rounded flex items-center gap-1"
                >
                    <ICONS.Data /> 初始化/重置預設分類
                </button>
            </div>
            
            {/* 收支類別管理區塊 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-700">
                    <ICONS.Tag /> 收支類別管理 (Transaction Categories)
                </h3>
                
                {/* 輸入區 */}
                <div className="flex gap-2 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100 items-center">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-400 block mb-1">類別名稱 Name</label>
                        <input 
                            className="border rounded px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none" 
                            placeholder="例如: 車位租金..." 
                            value={newCatName}
                            onChange={e => setNewCatName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                        />
                    </div>
                    <div className="w-32">
                        <label className="text-xs font-bold text-slate-400 block mb-1">類型 Type</label>
                        <select 
                            className={`border rounded px-3 py-2 text-sm w-full font-bold cursor-pointer ${newCatType === 'Income' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-500 bg-red-50 border-red-200'}`}
                            value={newCatType}
                            onChange={e => setNewCatType(e.target.value as any)}
                        >
                            <option value="Expense">(-) 支出</option>
                            <option value="Income">(+) 收入</option>
                        </select>
                    </div>
                    <div className="self-end">
                        <button onClick={addCategory} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm h-[38px]">
                            新增 Add
                        </button>
                    </div>
                </div>

                {/* 列表顯示區 */}
                {(!settings.categories || settings.categories.length === 0) ? (
                    <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed">
                        目前沒有分類資料，請點擊右上角「初始化/重置預設分類」
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2">
                        {settings.categories.map((cat) => (
                            <div key={cat.name} className="flex justify-between items-center bg-white border border-slate-200 px-3 py-2.5 rounded-lg text-sm group hover:shadow-md transition-all hover:border-blue-300">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cat.type === 'Income' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                    <span className="truncate font-medium text-slate-700" title={cat.name}>{cat.name}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${cat.type === 'Income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {cat.type === 'Income' ? '收入' : '支出'}
                                    </span>
                                    <button 
                                        onClick={() => removeCategory(cat.name)} 
                                        className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                                    >
                                        <ICONS.Trash />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 通用設定區塊 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                    { key: 'members', title: '成員/合夥人 (Members)' },          
                    { key: 'banks', title: '銀行列表 (Banks)' },
                    { key: 'insuranceCompanies', title: '保險公司 (Insurance)' },
                    { key: 'owners', title: '業主名單 (Owners)' },
                    { key: 'agents', title: '地產代理 (Agents)' },
                    { key: 'tenants', title: '租客名單 (Tenants)' }
                ].map((section) => (
                    <div key={section.key} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-700">
                            {section.title}
                        </h3>
                        <div className="flex gap-2 mb-4">
                            <input 
                                className="border rounded px-3 py-2 text-sm flex-1 outline-none focus:border-blue-400" 
                                placeholder="Add new..." 
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter') {
                                        const target = e.target as HTMLInputElement;
                                        handleAdd(section.key as keyof AppSettings, target.value);
                                        target.value = '';
                                    }
                                }}
                            />
                        </div>
                        <div className="space-y-2 overflow-y-auto flex-1 max-h-48 pr-1">
                            {/* @ts-ignore */}
                            {(settings[section.key] || []).map((item: string) => (
                                <div key={item} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-md text-sm group hover:bg-slate-100 border border-transparent hover:border-slate-200">
                                    <span>{item}</span>
                                    <button 
                                        onClick={() => removeItem(section.key as keyof AppSettings, item)} 
                                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// 位於 App.tsx 中
// [修正] 在參數中加入 settings
const BulkClassifyModal = ({ isOpen, onClose, templateTx, transactions, properties, onConfirmBatch, settings }: any) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [targetCategory, setTargetCategory] = useState('');
    const [targetPropertyId, setTargetPropertyId] = useState('');
    const [targetMember, setTargetMember] = useState('');
    const [candidates, setCandidates] = useState<Transaction[]>([]);

    useEffect(() => {
        if (isOpen && templateTx) {
            // [修正] 現在這裡可以讀取到 settings 了
            const availableCats = (settings?.categories || DEFAULT_CATEGORIES).map((c: any) => c.name);
            
            // 如果範本的分類在列表中，就用範本的；否則強制設為列表的第一個
            const initialCat = availableCats.includes(templateTx.category) 
                ? templateTx.category 
                : availableCats[0];

            setTargetCategory(initialCat);
            setTargetPropertyId(templateTx.propertyId || '');
            setTargetMember(templateTx.member || 'Family');

            const searchName = templateTx.merchant.toLowerCase().replace(/[0-9]/g, '').trim().substring(0, 4);
            const searchAmount = templateTx.amount;
            
            const matches = transactions.filter((t: Transaction) => {
                if (t.id === templateTx.id) return false;
                const nameMatch = t.merchant.toLowerCase().includes(searchName);
                const amountMatch = t.amount === searchAmount;
                return nameMatch || (amountMatch && (t.category === 'Other (其他)' || t.category === 'General'));
            });

            setCandidates(matches);
            setSelectedIds(new Set(matches.map((t:any) => t.id)));
        }
    }, [isOpen, templateTx, transactions, settings]); // 加入 settings 依賴

    // ... (後面的 render 邏輯保持不變，不用動) ...
    // ...
    // ...
    // 請保留原本的 return (...); 
    // 這裡為了節省篇幅省略，您原本的 JSX 是正確的
    
    // 如果您需要完整的 BulkClassifyModal JSX，請告訴我，但通常只要改上面那段即可。
    
    const handleToggle = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleConfirm = () => {
        onConfirmBatch(Array.from(selectedIds), targetCategory, targetPropertyId, targetMember);
        onClose();
    };

    if (!isOpen || !templateTx) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
            {/* ... (原本的 JSX 內容保持不變) ... */}
            <div className="bg-white rounded-xl shadow-2xl p-6 w-[95%] md:w-[800px] max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-start mb-4 border-b pb-2">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-700">
                            <ICONS.Data /> 智能批量歸類 Smart Batch
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            以 <span className="font-bold text-slate-800">{templateTx.merchant} (${templateTx.amount})</span> 為範本
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-indigo-900 mb-1">歸類 Category</label>
                        <select className="w-full border border-indigo-300 rounded px-2 py-1.5 text-sm" value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)}>
                            {/* [修正] 這裡也要改成讀取 settings */}
                            {(settings?.categories || DEFAULT_CATEGORIES).map((c:any) => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    {/* ... (其他 JSX 保持不變) ... */}
                    <div>
                        <label className="block text-xs font-bold text-indigo-900 mb-1">物業 Property</label>
                        <select className="w-full border border-indigo-300 rounded px-2 py-1.5 text-sm" value={targetPropertyId} onChange={(e) => setTargetPropertyId(e.target.value)}>
                            <option value="">(不指定 / None)</option>
                            {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-indigo-900 mb-1">成員 Member</label>
                        <select className="w-full border border-indigo-300 rounded px-2 py-1.5 text-sm" value={targetMember} onChange={(e) => setTargetMember(e.target.value)}>
                            {/* 加上 (m: string) */}
                            {(settings?.members || ['Charles', 'Family']).map((m: string) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                            <tr>
                                <th className="p-3 w-10"><input type="checkbox" checked={selectedIds.size === candidates.length && candidates.length > 0} onChange={(e) => setSelectedIds(e.target.checked ? new Set(candidates.map((t:any)=>t.id)) : new Set())} /></th>
                                <th className="p-3">Date</th>
                                <th className="p-3">Merchant</th>
                                <th className="p-3 text-right">Amount</th>
                                <th className="p-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {candidates.map((t: any) => (
                                <tr key={t.id} className={selectedIds.has(t.id) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}>
                                    <td className="p-3"><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => handleToggle(t.id)} /></td>
                                    <td className="p-3 text-xs font-mono text-slate-500">{t.date}</td>
                                    <td className="p-3 font-medium">{t.merchant}</td>
                                    <td className={`p-3 text-right font-mono ${t.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(t.amount)}</td>
                                    <td className="p-3 text-xs text-slate-400">{t.category}</td>
                                </tr>
                            ))}
                            {candidates.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">沒有找到其他相似的交易</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-2 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">取消</button>
                    <button onClick={handleConfirm} disabled={selectedIds.size === 0} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"><ICONS.Edit /> 確認修改 ({selectedIds.size} 筆)</button>
                </div>
            </div>
        </div>
    );
};

const PropertyDashboard = ({ 
    properties, totalValuation, totalMonthlyRent, propStats, 
    stressRate, setStressRate, rentDrop, setRentDrop, 
    onSelectProperty, onAddProperty, onInitializeDefaults,
    onDeleteProperty
}: any) => {
    // --- 新增：篩選狀態 ---
    const [filterStatus, setFilterStatus] = useState('All'); // All, Held, Sold
    const [filterOwnership, setFilterOwnership] = useState('All'); // All, Self-owned, Managed
    const [timeType, setTimeType] = useState('Purchase'); // Purchase, Sale
    const [filterYear, setFilterYear] = useState('All');

    // --- 邏輯：計算篩選後的物業列表 ---
    const filteredProps = useMemo(() => {
        // 1. 先執行篩選 (Filter) - 保持不變
        let result = propStats.filter((p: any) => {
            if (filterStatus === 'Held' && p.status === 'Sold') return false;
            if (filterStatus === 'Sold' && p.status !== 'Sold') return false;
            if (filterOwnership !== 'All' && p.ownershipType !== filterOwnership) return false;
            if (filterYear !== 'All') {
                const dateTarget = timeType === 'Purchase' ? p.purchaseDate : p.saleDate;
                if (!dateTarget) return false;
                const year = new Date(dateTarget).getFullYear().toString();
                if (year !== filterYear) return false;
            }
            return true;
        });

        // 2. 再執行排序 (Sort) - 修改此處
        return result.sort((a: any, b: any) => {
            // 優先級 1: 狀態 (已售出永遠沈底)
            const isSoldA = a.status === 'Sold';
            const isSoldB = b.status === 'Sold';
            if (isSoldA !== isSoldB) {
                return isSoldA ? 1 : -1;
            }

            // 優先級 2: 最近查看 (只針對持有中的物業)
            // 剛點過的物業 (lastViewed 較大) 會排在最前面
            if (!isSoldA) {
                const viewA = a.lastViewed || 0;
                const viewB = b.lastViewed || 0;
                // 如果兩者查看時間不同，新的在前
                if (viewA !== viewB) {
                    return viewB - viewA; 
                }
            }

            // 優先級 3: 原始時間排序 (買入/賣出日期)
            const dateA = new Date(isSoldA ? (a.saleDate || '1900-01-01') : (a.purchaseDate || '1900-01-01')).getTime();
            const dateB = new Date(isSoldB ? (b.saleDate || '1900-01-01') : (b.purchaseDate || '1900-01-01')).getTime();
            
            return dateB - dateA;
        });
    }, [propStats, filterStatus, filterOwnership, timeType, filterYear]);

    // --- 邏輯：動態生成年份選單 (只顯示有資料的年份) ---
    const availableYears = useMemo(() => {
        const years = new Set<string>();
        propStats.forEach((p: any) => {
            const dateTarget = timeType === 'Purchase' ? p.purchaseDate : p.saleDate;
            if (dateTarget) {
                years.add(new Date(dateTarget).getFullYear().toString());
            }
        });
        return Array.from(years).sort().reverse(); // 從新到舊排序
    }, [propStats, timeType]);

    // --- 邏輯：重置所有篩選 ---
    const clearFilters = () => {
        setFilterStatus('All');
        setFilterOwnership('All');
        setFilterYear('All');
        setTimeType('Purchase'); // 重置回預設
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            {/* 頂部統計卡片 (保持不變) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard title="物業總估值 Total Valuation" value={formatCurrency(totalValuation)} color="blue" iconName="Home" subtext={`${properties.length} Properties`} />
                <StatCard title="每月租金收入 Monthly Rent" value={formatCurrency(totalMonthlyRent)} color="emerald" iconName="DollarSign" />
                <StatCard title="整體出租率 Occupancy Rate" value={`${properties.length ? (properties.filter((p:any)=>p.status==='Occupied').length / properties.length * 100).toFixed(0) : 0}%`} color="indigo" iconName="PieChart" />
                <StatCard title="應收未收 Arrears" value={propStats.filter((p:any)=>p.isLate).length} color="red" iconName="Shield" subtext="Units Late" />
                <StatCard title="私募與借貸 Investments" value={formatCurrency(4000000)} // 300萬借款 + 100萬PE
                    subtext="ROI 6% / IPO Pending" 
                    color="purple" 
                    iconName="Briefcase" // 或 DollarSign
                />
            </div>

            {/* --- 新增：篩選工具列 --- */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <ICONS.Search /> 篩選條件:
                    </div>
                    
                    {/* 1. 狀態篩選 */}
                    <select className="border rounded-lg px-2 py-1 text-sm bg-slate-50" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                        <option value="All">全部狀態 (All Status)</option>
                        <option value="Held">持有中 (In Hand)</option>
                        <option value="Sold">已賣出 (Sold)</option>
                    </select>

                    {/* 2. 業權篩選 */}
                    <select className="border rounded-lg px-2 py-1 text-sm bg-slate-50" value={filterOwnership} onChange={e=>setFilterOwnership(e.target.value)}>
                        <option value="All">全部業權 (All Types)</option>
                        <option value="Self-owned">自行持有 (Self)</option>
                        <option value="Managed">代管 (Managed)</option>
                    </select>

                    {/* 3. 時間篩選 (類型 + 年份) */}
                    <div className="flex border rounded-lg overflow-hidden">
                        <select className="px-2 py-1 text-sm bg-slate-100 border-r" value={timeType} onChange={e=>{setTimeType(e.target.value); setFilterYear('All');}}>
                            <option value="Purchase">購入年份</option>
                            <option value="Sale">賣出年份</option>
                        </select>
                        <select className="px-2 py-1 text-sm bg-white" value={filterYear} onChange={e=>setFilterYear(e.target.value)}>
                            <option value="All">所有年份</option>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    {/* 清除按鈕 */}
                    {(filterStatus!=='All' || filterOwnership!=='All' || filterYear!=='All') && (
                        <button onClick={clearFilters} className="text-xs text-red-500 hover:underline bg-red-50 px-2 py-1 rounded">
                            ✕ 清除條件
                        </button>
                    )}
                </div>

                {/* 壓力測試 (保持不變) */}
                <div className="flex items-center gap-4 border-l pl-4 hidden xl:flex">
                    <div className="font-bold text-slate-700 text-xs">壓力測試:</div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px]">Rate +{stressRate}%</span>
                        <input type="range" min="0" max="5" step="0.5" value={stressRate} onChange={e=>setStressRate(Number(e.target.value))} className="w-16 h-1" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px]">Rent -{rentDrop}%</span>
                        <input type="range" min="0" max="30" step="5" value={rentDrop} onChange={e=>setRentDrop(Number(e.target.value))} className="w-16 h-1" />
                    </div>
                </div>
            </div>

            {/* 物業卡片列表 (已套用篩選) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 顯示結果數量 */}
                {filteredProps.length === 0 && (
                    <div className="col-span-full text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed">
                        沒有符合條件的物業
                    </div>
                )}

                {filteredProps.map((p: any) => (
                    <div 
                    key={p.id} 
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                        e.preventDefault();
                        if (p.id) onSelectProperty(p.id);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectProperty(p.id)}
                    className={`rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer group relative overflow-hidden active:scale-95 z-0 hover:z-10 ${p.status === 'Sold' ? 'bg-slate-100 grayscale-[0.5]' : 'bg-white'}`}
                    >
                        <div className={`h-24 relative pointer-events-none ${p.status === 'Sold' ? 'bg-gradient-to-r from-gray-400 to-slate-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
                            <span className={`absolute top-4 left-4 px-3 py-1 text-xs rounded-full font-bold shadow-sm z-20 ${
                                p.status === 'Occupied' 
                                    ? (p.isLate ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700') 
                                    : p.status === 'Sold' ? 'bg-black text-white' : 'bg-red-100 text-red-700'
                            }`}>
                                {p.status === 'Occupied' ? (p.isLate ? '欠租 Arrears' : '出租 Occupied') : p.status === 'Sold' ? '已售出 SOLD' : '空置 Vacant'}
                            </span>

                            <div className="absolute top-4 right-16 flex gap-1 pointer-events-auto">
                                {p.displayTags?.map((tag:string, idx:number) => (
                                    <span key={idx} className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded backdrop-blur-sm">{tag}</span>
                                ))}
                            </div>

                            <button 
                                onClick={(e) => {
                                    e.stopPropagation(); 
                                    onDeleteProperty(p.id);
                                }}
                                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-red-500 text-white rounded-full transition-all duration-200 z-50 backdrop-blur-sm pointer-events-auto hover:scale-110"
                            >
                                <ICONS.Trash />
                            </button>
                        </div>
                        
                        <div className="p-5 pt-2">
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <h3 className="font-bold text-xl text-slate-800 mb-1">{p.name}</h3>
                                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{p.address || 'No Address'}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Held: {calculateDuration(p.purchaseDate, p.saleDate)}</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{p.status==='Sold' ? 'Sold Price' : 'Valuation'}</p>
                                    <p className="font-mono font-bold text-slate-700">{formatCurrency(p.status==='Sold' ? p.salePrice : p.currentValue)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{p.status==='Sold' ? 'Profit' : 'Rent'}</p>
                                    <p className={`font-mono font-bold ${p.status==='Sold' ? 'text-green-600' : 'text-emerald-600'}`}>
                                        {p.status==='Sold' ? formatCurrency((p.salePrice||0) - (p.purchasePrice||0)) : (p.activeLease ? formatCurrency(p.activeLease.monthlyRent) : '-')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Net Income</p>
                                    <p className={`font-mono font-bold ${p.net >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatCurrency(p.net)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Expense (Stress)</p>
                                    <p className="font-mono text-red-400">-{formatCurrency(p.stressedExpense)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                {/* 新增按鈕 (保持不變) */}
                <button onClick={onAddProperty} className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-2xl hover:bg-slate-50 transition text-slate-400 hover:text-slate-600 cursor-pointer z-10 min-h-[240px]"><ICONS.Plus /><span className="mt-2 font-bold">新增物業 Add Property</span></button>
                {properties.length === 0 && (
                    <button onClick={onInitializeDefaults} className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-blue-300 bg-blue-50 rounded-2xl hover:bg-blue-100 transition text-blue-500 cursor-pointer z-10 min-h-[240px]"><ICONS.Plus /><span className="mt-2 font-bold">初始化預設物業</span></button>
                )}
            </div>
        </div>
    );
};

// --- 2. 物業詳情組件 (PropertyDetailView) ---
const PropertyDetailView = ({ 
    propId, propStats, transactions, leases, 
    onBack, setDocConfig, setModalMode, setEditingProp, setEditingTx, 
    setEditingLease, deleteItem,
    ledgerFilter, setLedgerFilter, handleUpdateCategory,
    handleOpenReceipt,
    settings 
}: any) => {
    const p = propStats.find((x: any) => x.id === propId);
    
    if (!p) return <div className="p-8 text-center text-slate-500">找不到該物業資料 (Property not found)</div>;

    const getTxType = (catName: string) => {
        const cat = (catName || '').toLowerCase();
        if (cat.includes('rental income') || cat.includes('rent') || cat.includes('sale') || cat.includes('deposit') || cat.includes('income') || cat.includes('interest') || cat.includes('收入')) {
            return 'Income';
        }
        if (settings?.categories) {
            const found = settings.categories.find((c: any) => c.name === catName);
            if (found) return found.type;
        }
        return 'Expense'; 
    };
    
    const filteredTxs = transactions
        .filter((t: any) => t.propertyId === propId)
        .filter((t: any) => (JSON.stringify(t) || '').toLowerCase().includes(ledgerFilter.toLowerCase()))
        .sort((a: any,b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const pLeases = leases.filter((l: any) => l.propertyId === propId);

    const periodIncome = filteredTxs
        .filter((t:any) => getTxType(t.category) === 'Income')
        .reduce((sum:number, t:any) => sum + Math.abs(t.amount || 0), 0);

    const periodExpense = filteredTxs
        .filter((t:any) => getTxType(t.category) === 'Expense')
        .reduce((sum:number, t:any) => sum + Math.abs(t.amount || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in">
            <button onClick={onBack} className="text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1">← 返回總覽 Back to Dashboard</button>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">{p.name} <span className={`text-sm px-2 py-1 rounded-full font-normal ${p.status==='Occupied'?'bg-green-100 text-green-800': p.status==='Sold' ? 'bg-black text-white' : 'bg-red-100 text-red-800'}`}>{p.status}</span></h1>
                    <p className="text-slate-500 mt-1">{p.address}</p>
                    <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">{p.ownershipType}</span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Owner: {p.owner}</span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Held: {calculateDuration(p.purchaseDate, p.saleDate)}</span>
                        {p.displayTags?.map((tag:string, idx:number) => (
                            <span key={idx} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">#{tag}</span>
                        ))}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setDocConfig((prev: any) => ({ ...prev, propId: p.id, type: 'lease', amount: p.activeLease?.monthlyRent || 0, tenant: p.activeLease?.tenantName || '' })); setModalMode('doc'); }} className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-100">建立租約</button>
                    <button onClick={() => { setEditingProp(p); setModalMode('property'); }} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><ICONS.Edit /></button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border space-y-4">
                    <h3 className="font-bold border-b pb-2">財務摘要 Financials</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-slate-500">買入價 Purchase</p><p className="font-mono">{formatCurrency(p.purchasePrice)}</p></div>
                        <div><p className="text-slate-500">{p.status==='Sold' ? '賣出價 Sold' : '現估值 Value'}</p><p className="font-mono font-bold text-blue-600">{formatCurrency(p.status==='Sold' ? p.salePrice : p.currentValue)}</p></div>
                        <div><p className="text-slate-500">尚餘按揭 Loan</p><p className="font-mono">{formatCurrency(p.outstandingLoan)}</p></div>
                        <div><p className="text-slate-500">月供款 Mortgage</p><p className="font-mono text-red-500">-{formatCurrency(p.mortgageAmount)}</p></div>
                        {p.purchaseCommission > 0 && <div><p className="text-slate-500">買入佣金 Comm.</p><p className="font-mono">{formatCurrency(p.purchaseCommission)}</p></div>}
                        {p.purchaseAgent && <div><p className="text-slate-500">買入代理 Agent</p><p className="font-medium">{p.purchaseAgent}</p></div>}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border space-y-4">
                    <h3 className="font-bold border-b pb-2">收支紀錄 Expenses</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-slate-500">管理費 Mgt</p><p className="font-mono">{formatCurrency(p.managementFee)}/mo</p></div>
                        <div><p className="text-slate-500">差餉 Rates</p><p className="font-mono">{formatCurrency(p.govtRates)}/qtr</p></div>
                        <div><p className="text-slate-500">地租 Govt Rent</p><p className="font-mono">{formatCurrency(p.govtRent)}/qtr</p></div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <h3 className="font-bold">租約紀錄 Lease History</h3>
                    <button onClick={()=>{
                        setEditingLease({ id: '', propertyId: p.id, tenantName: '', tenantID: '', startDate: '', endDate: '', monthlyRent: 0, deposit: 0, status: 'Active', attachments: [] } as Lease);
                        setModalMode('lease');
                    }} className="text-sm text-blue-600 hover:underline">+ Register New Lease</button>
                 </div>
                 {pLeases.map((l: any) => (
                     <div key={l.id} className={`p-4 rounded-xl border ${l.status === 'Active' ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                         <div className="flex justify-between">
                             <div>
                                 <p className="font-bold text-slate-800">{l.tenantName} <span className="text-xs font-normal text-slate-500">({l.tenantID})</span></p>
                                 <p className="text-sm">{l.startDate} to {l.endDate}</p>
                                 {l.attachments && l.attachments.length > 0 && (
                                     <div className="flex gap-2 mt-2">
                                         {l.attachments.map((img:string, idx:number) => (
                                             <img key={idx} src={img} className="w-10 h-10 object-cover rounded border" alt="lease doc" />
                                         ))}
                                     </div>
                                 )}
                             </div>
                             <div className="text-right">
                                 <p className="font-bold font-mono">{formatCurrency(l.monthlyRent)}/mo</p>
                                 <div className="flex gap-2 justify-end mt-1">
                                     {l.status === 'Active' && <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">Active</span>}
                                     <button onClick={() => { setEditingLease(l); setModalMode('lease'); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                                 </div>
                             </div>
                         </div>
                     </div>
                 ))}
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 flex justify-between items-center border-b">
                    <h3 className="font-bold">流水帳 Ledger</h3>
                    <button onClick={() => { setEditingTx({ propertyId: p.id, date: new Date().toISOString().split('T')[0], attachments: [] } as any); setModalMode('transaction'); }} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 font-bold">+ 新增紀錄 Add Record</button>
                </div>
                <div className="p-4 bg-slate-50 border-b space-y-3">
                    <input 
                        type="text" 
                        placeholder="Search transactions..." 
                        className="border rounded px-2 py-1 text-sm w-full" 
                        value={ledgerFilter} 
                        onChange={e => setLedgerFilter(e.target.value)} 
                    />
                    <div className="flex gap-4 text-sm">
                        <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded font-bold border border-emerald-100">
                            區間總收入: {formatCurrency(periodIncome)}
                        </div>
                        <div className="bg-red-50 text-red-700 px-3 py-1 rounded font-bold border border-red-100">
                            區間總支出: {formatCurrency(periodExpense)}
                        </div>
                    </div>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0"><tr><th className="p-3">Date</th><th className="p-3">Category</th><th className="p-3">Detail</th><th className="p-3 text-right">Amount</th><th className="p-3">Action</th></tr></thead>
                        <tbody className="divide-y">
                            {filteredTxs.map((t: any) => {
                                const isIncome = getTxType(t.category) === 'Income';
                                const absAmount = Math.abs(t.amount || 0);
                                
                                return (
                                    <tr key={t.id} className="hover:bg-blue-50">
                                        <td className="p-3">{t.date}</td>
                                        <td className="p-3">
                                            <select 
                                                className="bg-transparent border-none max-w-[140px] truncate" 
                                                value={t.category} 
                                                onChange={e => handleUpdateCategory(t.id, e.target.value)}
                                            >
                                                {(settings?.categories || []).map((c: any) => (
                                                    <option key={c.name} value={c.name}>{c.name}</option>
                                                ))}
                                                {!(settings?.categories || []).some((c:any)=>c.name === t.category) && (
                                                    <option value={t.category}>{t.category}</option>
                                                )}
                                            </select>
                                        </td>
                                        <td className="p-3 font-medium">
                                            <div>{t.merchant} <span className="text-slate-400 text-xs">{t.note}</span></div>
                                            {t.attachments && t.attachments.length > 0 && (
                                                <div className="flex gap-1 mt-1">
                                                    {t.attachments.map((img:string, idx:number) => (
                                                        <img key={idx} src={img} className="w-6 h-6 object-cover rounded border" alt="receipt" />
                                                    ))}
                                                </div>
                                            )}
                                            {t.receiptNo && (
                                                <span className="inline-block mt-1 text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded border border-green-200 font-bold">
                                                    🧾 {t.receiptNo}
                                                </span>
                                            )}
                                        </td>
                                        
                                        <td className={`p-3 text-right font-mono font-bold ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {isIncome ? '+' : '-'}{formatCurrency(absAmount)}
                                        </td>
                                        
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => handleOpenReceipt(t)} 
                                                    className={`text-xs px-2 py-1 rounded border flex flex-col items-center min-w-[70px] transition-colors ${
                                                        t.receiptNo 
                                                        ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' 
                                                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                                    }`}
                                                    title={t.receiptNo ? "查看已存檔收據" : "建立新收據"}
                                                >
                                                    <span className="font-bold flex items-center gap-1">
                                                        <ICONS.FileText /> {t.receiptNo ? 'View' : 'Receipt'}
                                                    </span>
                                                    {t.receiptNo && <span className="text-[9px]">{t.receiptNo}</span>}
                                                </button>

                                                <button onClick={() => { setEditingTx(t); setModalMode('transaction'); }} className="text-blue-400 hover:text-blue-600 p-1"><ICONS.Edit /></button>
                                                <button onClick={() => deleteItem('transactions', t.id)} className="text-red-400 hover:text-red-600 p-1"><ICONS.Trash /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- 確定能被調用的結算區塊 --- */}
            {(p.owner === 'Joint' || p.ownershipType === 'Joint') && (
                <div className="mt-8">
                    <PartnershipSettlement 
                        property={p} 
                        transactions={transactions} 
                    />
                </div>
            )}
        </div>
    );
};

// --- 請將此組件貼在 DocModal 之前 ---
const DocPreviewContent = ({ 
    docConfig, 
    properties, 
    transactions, 
    settings 
}: { 
    docConfig: DocConfig, 
    properties: Property[], 
    transactions: Transaction[], 
    settings: AppSettings 
}) => {
    const prop = properties.find(p => p.id === docConfig.propId) || { name: 'Unknown Property', address: '' } as Property;

    // --- 1. 收據樣式 (Receipt) ---
    if (docConfig.type === 'receipt') {
        const receiptNo = docConfig.existingReceiptNo || `PREVIEW`; 
        const englishAmount = convertNumberToEnglish(docConfig.amount);
        const isTenant = true; 
        const isRent = true;   

        return (
             <div className="doc-print-container w-full bg-white text-black font-sans relative border-[3px] border-blue-400 p-8 box-border mx-auto">
                <div className="flex justify-between items-end mb-4">
                    <div className="text-sm font-bold w-1/3">
                        收據編號<br/>
                        Receipt No. : <span className="text-red-600 text-xl font-mono ml-2">{receiptNo}</span>
                    </div>
                    <div className="text-center w-1/3">
                        <h1 className="text-3xl font-bold whitespace-nowrap">收 OFFICIAL RECEIPT 據</h1>
                    </div>
                    <div className="text-right w-1/3 text-sm">
                        日期<br/>
                        Date : <span className="border-b border-black inline-block w-32 text-center">{docConfig.period || new Date().toLocaleDateString()}</span>
                    </div>
                </div>

                <div className="space-y-4 text-sm font-medium">
                    <div className="flex items-end">
                        <div className="whitespace-nowrap pb-1">茲 收 到<br/>Received From :</div>
                        <div className="border-b border-black flex-1 mx-2 px-2 text-lg font-bold pb-1">{docConfig.tenant}</div>
                        <div className="flex gap-4 text-xs items-end pb-1">
                            <label className="flex items-center gap-1"><div className="w-4 h-4 border border-black flex items-center justify-center"></div> 賣家 Vendor</label>
                            <label className="flex items-center gap-1"><div className="w-4 h-4 border border-black flex items-center justify-center"></div> 業主 Landlord</label>
                            <label className="flex items-center gap-1"><div className="w-4 h-4 border border-black flex items-center justify-center"></div> 買家 Purchaser</label>
                            <label className="flex items-center gap-1"><div className="w-4 h-4 border border-black flex items-center justify-center">{isTenant ? '✔' : ''}</div> 租客 Tenant</label>
                        </div>
                    </div>

                    <div className="flex items-end">
                        <div className="whitespace-nowrap pb-1">港 幣<br/>H.K.Dollars :</div>
                        <div className="border-b border-black flex-1 mx-2 px-2 pb-1 relative">
                            <span className="relative z-10 text-lg italic">{englishAmount}</span>
                            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gray-200 z-0"></div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center my-4">
                        <div className="text-4xl font-serif italic font-bold border-b-2 border-black border-t-2 py-2 px-12 text-center bg-gray-50">
                            HK$ {docConfig.amount.toLocaleString()}
                        </div>
                    </div>

                    <div className="flex items-end">
                        <div className="whitespace-nowrap pb-1">物 業 地 址<br/>Property at :</div>
                        <div className="border-b border-black flex-1 mx-2 px-2 pb-1 truncate font-bold">{prop.address}</div>
                    </div>

                    <div className="flex justify-end">
                        <div className="w-1/2 flex items-end">
                            <div className="whitespace-nowrap pb-1">合 約 編 號<br/>Contract No. :</div>
                            <div className="border-b border-black flex-1 mx-2 px-2 pb-1 text-right">{docConfig.linkedTransactionId ? `TX-${docConfig.linkedTransactionId.slice(0,6)}` : ''}</div>
                        </div>
                    </div>

                    <div className="flex items-end pt-2">
                        <div className="whitespace-nowrap mr-2">該 款 係 付<br/>In Payment of :</div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs flex-1 items-end">
                            <label className="flex items-center gap-1"><div className="w-4 h-4 border border-black"></div> 按金 Deposit</label>
                            <label className="flex items-center gap-1"><div className="w-4 h-4 border border-black flex items-center justify-center">{isRent ? '✔' : ''}</div> 租金 Rent</label>
                            <label className="flex items-center gap-1"><div className="w-4 h-4 border border-black"></div> 訂金 Deposit</label>
                            <label className="flex items-center gap-1"><div className="w-4 h-4 border border-black"></div> 佣金 Commission Fee</label>
                            <label className="flex items-center gap-1"><div className="w-4 h-4 border border-black"></div> 釐印 Stamp Duty</label>
                            <label className="flex items-center gap-1"><div className="w-4 h-4 border border-black"></div> 其它 Others</label>
                        </div>
                    </div>

                    <div className="flex items-end mt-4 text-xs border-t pt-2">
                        <div className="flex gap-4 items-center">
                            <label className="flex items-center gap-1"><div className="w-4 h-4 border border-black flex items-center justify-center">{docConfig.paymentMethod === 'Cash' ? '✔' : ''}</div> 現金 Cash</label>
                            <label className="flex items-center gap-1"><div className="w-4 h-4 border border-black flex items-center justify-center">{docConfig.paymentMethod === 'Cheque' ? '✔' : ''}</div> 支票 Cheque</label>
                        </div>
                        <div className="border-b border-black w-24 mx-1"></div>
                        <div className="mx-2">銀行 Bank</div>
                        <div className="border-b border-black w-24 mx-1 flex-1 text-center">{docConfig.paymentMethod === 'Bank Transfer' ? 'Bank Transfer' : ''}</div>
                        <div className="mx-2 text-right">日期 Date</div>
                        <div className="border-b border-black w-24 mx-1"></div>
                    </div>
                </div>

                <div className="mt-12 flex justify-between items-end signature-section">
                    <div className="text-xs w-1/2 text-gray-500">
                        交來支票收妥作實<br/>
                        Cheques received are subject to clearance
                    </div>
                    <div className="w-1/2 flex flex-col items-end">
                        <div className="w-64 border-b border-black mb-1 text-center font-script text-2xl relative h-12 flex items-end justify-center">
                            {docConfig.landlord}
                        </div>
                        <div className="w-64 flex justify-between text-xs font-bold">
                            <span>經手收款人</span>
                            <span>Received by</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    } 
    
    // --- 2. 對數單樣式 (Statement) ---
    if (docConfig.type === 'statement') {
        const dateFilteredTxs = transactions
            .filter(t => t.propertyId === docConfig.propId && (!docConfig.statementDateStart || t.date >= docConfig.statementDateStart) && (!docConfig.statementDateEnd || t.date <= docConfig.statementDateEnd))
            .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const showDebit = docConfig.showDebit !== false; 
        const showCredit = docConfig.showCredit !== false;
        const showNotes = docConfig.showRowNotes !== false;

        // [關鍵修正] 最強大的收入判斷邏輯
        const checkIsIncome = (t: Transaction) => {
            const cat = (t.category || '').toLowerCase();
            
            // 1. 優先：檢查關鍵字 (增加 'rent', 'deposit' 等常見字)
            if (cat.includes('rental income') || cat.includes('rent') || cat.includes('sale') || cat.includes('income') || cat.includes('收入') || cat.includes('deposit')) {
                return true;
            }
            
            // 2. 次要：檢查系統設定 (如果 settings 有傳進來)
            if (settings?.categories) {
                const settingType = settings.categories.find((c: any) => c.name === t.category)?.type;
                if (settingType === 'Income') return true;
                if (settingType === 'Expense') return false;
            }

            // 3. [最後防線]：如果分類不明，直接看金額正負號
            // 如果 CSV 匯入時是正數 (e.g. 15000)，就當作收入
            if (t.amount > 0) return true;

            return false; // 預設為支出
        };

        // 2. 進階篩選：根據「顯示 Debit/Credit」的設定，移除不顯示的行數
        const finalTxs = dateFilteredTxs.filter(t => {
            const isIncome = checkIsIncome(t);
            return isIncome ? showCredit : showDebit;
        });

        // 3. 計算總數
        let totalDebit = 0;
        let totalCredit = 0;
        
        finalTxs.forEach(t => {
            const isIncome = checkIsIncome(t);
            const absAmount = Math.abs(t.amount || 0);

            if (isIncome) {
                totalCredit += absAmount;
            } else {
                totalDebit += absAmount;
            }
        });

        const netBalance = totalCredit - totalDebit;
        
        const colCount = 2 + (showDebit ? 1 : 0) + (showCredit ? 1 : 0);

        return (
            <div className="doc-print-container bg-white w-full text-black font-serif mx-auto relative p-4">
                <div className="text-center mb-4">
                    <h1 className="text-2xl font-bold underline">RENTAL STATEMENT 租務對數單</h1>
                </div>
                
                <div className="flex justify-between items-start mb-4 text-sm header-info border-b pb-2">
                    <div className="w-[55%]">
                        <div className="flex mb-1"><span className="font-bold w-20 flex-shrink-0">Property:</span> <span>{prop.name}</span></div>
                        <div className="flex"><span className="font-bold w-20 flex-shrink-0">Address:</span> <span>{prop.address}</span></div>
                    </div>
                    <div className="w-[40%] text-right">
                        <div className="flex justify-end mb-1"><span className="font-bold mr-2">Tenant:</span> <span>{docConfig.tenant}</span></div>
                        <div className="flex justify-end mb-1"><span className="font-bold mr-2">Period:</span> <span>{docConfig.statementDateStart || 'Start'} to {docConfig.statementDateEnd || 'Now'}</span></div>
                        <div className="text-xs text-gray-500 mt-1">Generated: {new Date().toLocaleDateString()}</div>
                    </div>
                </div>

                <table className="w-full border-collapse border border-black text-sm mb-2">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-black p-2 text-left w-[15%]">Date</th>
                            <th className="border border-black p-2 text-left">Description / Particulars</th>
                            {showDebit && <th className="border border-black p-2 text-right w-[18%]">Debit (Dr)</th>}
                            {showCredit && <th className="border border-black p-2 text-right w-[18%]">Credit (Cr)</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {finalTxs.length === 0 && <tr><td colSpan={colCount} className="p-4 text-center">No records found for this period.</td></tr>}
                        
                        {finalTxs.map(t => {
                             const isIncome = checkIsIncome(t);
                             const displayAmount = formatCurrency(Math.abs(t.amount || 0));

                            return (
                                <tr key={t.id}>
                                    <td className="border border-black p-2 align-top whitespace-nowrap">{t.date}</td>
                                    <td className="border border-black p-2 align-top">
                                        <span className="font-bold block">{t.category}</span>
                                        {t.merchant && <span className="block text-slate-700">{t.merchant}</span>}
                                        {showNotes && t.note && <span className="block text-slate-500 italic text-xs mt-0.5">Note: {t.note}</span>}
                                    </td>
                                    
                                    {showDebit && (
                                        <td className="border border-black p-2 text-right align-top text-slate-600">
                                            {!isIncome ? displayAmount : ''}
                                        </td>
                                    )}
                                    
                                    {showCredit && (
                                        <td className="border border-black p-2 text-right align-top text-black font-medium">
                                            {isIncome ? displayAmount : ''}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                    
                    <tfoot>
                        <tr className="bg-gray-50 font-bold border-t-2 border-black">
                            <td className="border border-black p-2 text-right" colSpan={2}>
                                Total ({finalTxs.length} items):
                            </td>
                            {showDebit && <td className="border border-black p-2 text-right">{formatCurrency(totalDebit)}</td>}
                            {showCredit && <td className="border border-black p-2 text-right">{formatCurrency(totalCredit)}</td>}
                        </tr>
                        
                        <tr className="bg-gray-100 font-bold text-lg">
                            <td className="border border-black p-2 text-right" colSpan={colCount - 1}>
                                Net Balance (結餘):
                            </td>
                            <td className={`border border-black p-2 text-right ${netBalance >= 0 ? 'text-black' : 'text-red-600'}`}>
                                {formatCurrency(netBalance)}
                            </td>
                        </tr>
                    </tfoot>
                </table>

                <div className="avoid-break">
                    {docConfig.statementFooterNote && (
                        <div className="border p-2 bg-slate-50 text-sm footer-note mb-4">
                            <p className="font-bold underline mb-1">Notes / Remarks:</p>
                            <p className="whitespace-pre-wrap leading-tight">{docConfig.statementFooterNote}</p>
                        </div>
                    )}
                    
                    <div className="flex justify-between signature-section mt-8">
                        <div className="w-1/3">
                            <div className="border-t border-black pt-2 text-center text-xs font-bold">Prepared By</div>
                            <div className="h-12"></div>
                        </div>
                        <div className="w-1/3">
                            <div className="border-t border-black pt-2 text-center text-xs font-bold">Received & Confirmed By</div>
                            <div className="h-12"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- 3. 租約樣式 (Lease) ---
    return (
        <div className="doc-print-container text-black font-serif text-sm leading-relaxed">
          {/* Page 1 */}
          <div className="w-full bg-white mx-auto relative page-break pb-8">
            <div className="text-right text-xs mb-4">Ref. No./編號: {new Date().getFullYear()}-{Math.floor(Math.random()*1000)}</div>
            <h1 className="text-2xl font-bold text-center mb-6 underline">TENANCY AGREEMENT 租約</h1>
            
            <div className="mb-4">
                <p><strong>An Agreement</strong> made the <span className="underline decoration-dotted mx-1">{new Date().getDate()}</span> day of <span className="underline decoration-dotted mx-1">{new Date().toLocaleString('default', { month: 'long' })}</span> <span className="underline decoration-dotted mx-1">{new Date().getFullYear()}</span> between the Landlord and the Tenant as more particularly described in Schedule I.</p>
                <p className="mt-1 text-xs text-gray-600">此合約由業主及租客（雙方資料詳列於附表一）於上述日期訂立。</p>
            </div>

            <div className="mb-4">
               <p>The Landlord shall let and the Tenant shall take the Premises for the Term and at the Rent as more particularly described in Schedule I and both parties agree to observe and perform the terms and conditions as follows:-</p>
               <p className="mt-1 text-xs text-gray-600">業主及租客雙方以詳列於附表一的租期及租金分別租出及租入詳列於附表一的物業，並同意遵守及履行下列條款：</p>
            </div>

            <ol className="list-decimal pl-6 space-y-3 text-sm">
                <li>
                    <p>The Tenant shall pay to the Landlord the Rent in advance on the 1st day of each and every calendar month during the Term. If the Tenant shall fail to pay the Rent within 7 days from the due date, the Landlord shall have the right to institute appropriate action to recover the Rent and all costs.</p>
                    <p className="text-xs text-gray-600">1. 租客須在租期內每個月份第一天預繳付指定的租金予業主。倘租客於應繳租金之日的七天內仍未付該租金，則業主有權採取適當行動追討。</p>
                </li>
                <li>
                    <p>The Tenant shall not make any alteration and/or additions to the Premises without the prior written consent of the Landlord.</p>
                    <p className="text-xs text-gray-600">2. 租客在沒有業主書面同意前，不得對該物業作任何改動及/或加建。</p>
                </li>
                <li>
                    <p>The Tenant shall not assign, transfer, sublet or part with the possession of the Premises or any part thereof to any other person.</p>
                    <p className="text-xs text-gray-600">3. 租客不得轉讓、轉租或分租該物業或其任何部分。</p>
                </li>
                <li>
                    <p>The Tenant shall comply with all ordinances, regulations and rules of Hong Kong and Deed of Mutual Covenant.</p>
                    <p className="text-xs text-gray-600">4. 租客須遵守香港一切法律條例及大廈公契。</p>
                </li>
                <li>
                    <p>The Tenant shall during the Term pay and discharge all charges in respect of water, electricity, gas and telephone.</p>
                    <p className="text-xs text-gray-600">5. 租客須在租約期內清繳一切有關該物業的水費、電費、煤氣費、電話費等。</p>
                </li>
                <li>
                    <p>The Tenant shall during the Term keep the interior of the Premises in good and tenantable repair and condition.</p>
                    <p className="text-xs text-gray-600">6. 租客須在租約期內保持物業內部的維修狀態良好。</p>
                </li>
                 <li>
                    <p>The Tenant shall pay to the Landlord the Security Deposit set out in Schedule I.</p>
                    <p className="text-xs text-gray-600">7. 租客須交予業主保証金（金額如附表一所列）。</p>
                </li>
            </ol>
             <div className="text-right text-xs mt-4">Page 1 of 4</div>
          </div>

          {/* Page 2 */}
          <div className="w-full bg-white mx-auto relative page-break pb-10">
             <ol className="list-decimal pl-6 space-y-3 text-sm" start={8}>
                 <li>
                    <p>The Landlord shall refund the Security Deposit to the Tenant without interest within 7 days from the date of delivery of vacant possession. The Landlord may deduct any loss or damage from the deposit.</p>
                    <p className="text-xs text-gray-600">8. 若租客無違約，業主須於收回物業後七天內無息退還保証金。業主可從保証金內扣除因租客違約之損失。</p>
                </li>
                 <li>
                    <p>The Landlord shall keep and maintain the structural parts of the Premises including main drains, pipes and cables.</p>
                    <p className="text-xs text-gray-600">9. 業主須保養及適當維修該物業內各主要結構部分。</p>
                </li>
                <li>
                    <p>The Tenant shall cover insurance for his/her own belongings. The Landlord shall not be responsible for any damage or loss.</p>
                    <p className="text-xs text-gray-600">10. 租客須自投買財物保險，業主不負任何責任。</p>
                </li>
                 <li>
                    <p>The Landlord shall pay the Property Tax.</p>
                    <p className="text-xs text-gray-600">11. 業主負責繳付物業稅。</p>
                </li>
                 <li>
                    <p>Stamp Duty shall be borne by the Landlord and the Tenant in equal shares.</p>
                    <p className="text-xs text-gray-600">12. 業主及租客各負責印花稅一半費用。</p>
                </li>
                <li>
                    <p>Both parties agree to be bound by the additional terms in Schedule II (if any).</p>
                    <p className="text-xs text-gray-600">13. 雙方同意遵守附表二內的附加條款。</p>
                </li>
                <li>
                    <p>If there is conflict between English and Chinese version, English version prevails.</p>
                    <p className="text-xs text-gray-600">14. 中英文本有差異時，以英文本為準。</p>
                </li>
                 <li>
                    <p>Tenant has to move out all belongings upon delivery of vacant possession.</p>
                    <p className="text-xs text-gray-600">15. 租客遷出時，須搬走所有物品。</p>
                </li>
            </ol>

             <div className="mt-8 mb-4 border-t pt-4">
                <h2 className="font-bold text-lg mb-2">SECURITY DEPOSIT RECEIPT 按金收據</h2>
                <div className="flex justify-between items-end mb-2">
                    <span>Received the Security Deposit of HK$: <span className="font-bold underline text-xl">{docConfig.deposit.toLocaleString()}</span></span>
                </div>
                <div className="flex justify-between items-end">
                    <span>by the Landlord 業主收到租客所交的保證金: <span className="font-bold underline text-xl">{convertNumberToEnglish(docConfig.deposit)}</span> (HK Dollars)</span>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-16 mt-8 signature-section">
                 <div>
                     <p className="mb-4 text-sm">Confirmed and Accepted by the <strong>Landlord 業主</strong>:</p>
                     <div className="h-24 border-b border-black mb-2"></div>
                     <p>Signature 簽署</p>
                     <p className="mt-2 text-sm">Name: {docConfig.landlord}</p>
                     <p className="text-sm">HKID: {docConfig.landlordID || '__________________'}</p>
                 </div>
                 <div>
                     <p className="mb-4 text-sm">Confirmed and Accepted by the <strong>Tenant 租客</strong>:</p>
                     <div className="h-24 border-b border-black mb-2"></div>
                     <p>Signature 簽署</p>
                     <p className="mt-2 text-sm">Name: {docConfig.tenant}</p>
                     <p className="text-sm">HKID: {docConfig.tenantID || '__________________'}</p>
                 </div>
             </div>
             
             <div className="text-right text-xs mt-4">Page 2 of 4</div>
          </div>
          
           {/* Page 3 - Schedule I */}
          <div className="w-full bg-white mx-auto relative page-break pb-10">
            <h1 className="text-2xl font-bold text-center mb-8 underline">Schedule I 附表一</h1>
            
            <table className="w-full border-collapse border border-black mb-8">
                <tbody>
                    <tr>
                        <td className="border border-black p-4 w-1/4 font-bold bg-gray-50">The Premises<br/>物業地址</td>
                        <td className="border border-black p-4">{prop.name} <br/> {prop.address}</td>
                    </tr>
                    <tr>
                        <td className="border border-black p-4 w-1/4 font-bold bg-gray-50">The Landlord<br/>業主</td>
                        <td className="border border-black p-4">
                            Name: {docConfig.landlord}<br/>
                            ID: {docConfig.landlordID || '__________________'}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black p-4 w-1/4 font-bold bg-gray-50">The Tenant<br/>租客</td>
                        <td className="border border-black p-4">
                            Name: {docConfig.tenant}<br/>
                            ID: {docConfig.tenantID || '__________________'}
                        </td>
                    </tr>
                     <tr>
                        <td className="border border-black p-4 w-1/4 font-bold bg-gray-50">Term<br/>租期</td>
                        <td className="border border-black p-4">
                            From: {docConfig.startDate}<br/>
                            To: {docConfig.endDate}<br/>
                            (Both days inclusive 包括首尾兩天)
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black p-4 w-1/4 font-bold bg-gray-50">Rent<br/>租金</td>
                        <td className="border border-black p-4">
                            HK$ {docConfig.amount.toLocaleString()} per month<br/>
                            (每月港幣 {convertNumberToEnglish(docConfig.amount)})
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black p-4 w-1/4 font-bold bg-gray-50">Security Deposit<br/>保證金</td>
                        <td className="border border-black p-4">
                            HK$ {docConfig.deposit.toLocaleString()}<br/>
                            (港幣 {convertNumberToEnglish(docConfig.deposit)})
                        </td>
                    </tr>
                </tbody>
            </table>

             <div className="mt-12 pt-8 border-t-2 border-black signature-section">
                <h2 className="font-bold text-lg mb-4">KEY RECEIPT 鎖匙收據</h2>
                <p className="mb-4 text-sm">Acknowledged the receipt of keys of the premises by the Tenant 租客接收業主所交屬該物業之鎖匙：</p>
                
                <div className="space-y-2 mb-8 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" /> Main Door (大門)</label>
                    <label className="flex items-center gap-2"><input type="checkbox" /> Iron Gate (鐵閘)</label>
                    <label className="flex items-center gap-2"><input type="checkbox" /> Mail Box (信箱)</label>
                    <label className="flex items-center gap-2"><input type="checkbox" /> Bedroom (睡房)</label>
                    <label className="flex items-center gap-2"><input type="checkbox" /> Other (其他): _________________</label>
                </div>

                <div className="w-1/2">
                    <div className="h-16 border-b border-black mb-2"></div>
                     <p className="text-sm">Tenant's Signature 租客簽署</p>
                </div>
             </div>

            <div className="text-right text-xs mt-4">Page 3 of 4</div>
          </div>
          
           {/* Page 4 - Schedule II */}
          <div className="w-full bg-white mx-auto relative page-break pb-10">
             <h1 className="text-2xl font-bold text-center mb-8 underline">Schedule II 附表二</h1>
             
             <div className="space-y-8">
                 <div>
                     <h3 className="font-bold border-b border-black inline-block mb-2">1. User 用途</h3>
                     <p className="text-sm">The Tenant shall not use the Premises for any purpose other than for <strong>Residential (住宅)</strong> purpose only.</p>
                     <p className="text-xs text-gray-600">租客除將該物業作住宅用途外，不可將該物業作其他用途。</p>
                 </div>

                 <div>
                     <h3 className="font-bold border-b border-black inline-block mb-2">2. Miscellaneous Payments 雜項費用</h3>
                     <p className="text-sm">(a) Management fee paid by <strong>Landlord (業主)</strong>.</p>
                     <p className="text-sm">(b) Government Rates paid by <strong>Landlord (業主)</strong>.</p>
                     <p className="text-sm">(c) Government Rent paid by <strong>Landlord (業主)</strong>.</p>
                 </div>

                 <div>
                     <h3 className="font-bold border-b border-black inline-block mb-2">3. Rent Free Period 免租期</h3>
                     <p className="text-sm">The Tenant shall be entitled to a rent free period from ___________ to ___________.</p>
                     <p className="text-xs text-gray-600">租客可享有免租期（如有）。租客仍需負責水電煤等雜費。</p>
                 </div>

                 <div>
                     <h3 className="font-bold border-b border-black inline-block mb-2">4. Break Clause 退租權</h3>
                     <p className="text-sm">Either party shall be entitled to terminate this Agreement earlier by serving not less than <strong>2 months</strong> written notice after <strong>12 months</strong> of the Term (Fixed Term).</p>
                     <p className="text-xs text-gray-600">死約一年，生約一年。任何一方可於首 12 個月後給予對方不少於 2 個月通知期解除合約。</p>
                 </div>

                 <div className="pt-8 border-t-2 border-dashed border-gray-300">
                     <h3 className="font-bold mb-4">Furniture & Fixture List 傢俬及設備清單</h3>
                     <div className="grid grid-cols-2 gap-4 text-sm">
                         <label><input type="checkbox" /> Air-conditioner 冷氣機</label>
                         <label><input type="checkbox" /> Water Heater 熱水爐</label>
                         <label><input type="checkbox" /> Range Hood 抽油煙機</label>
                         <label><input type="checkbox" /> Cooker 煮食爐</label>
                         <label><input type="checkbox" /> Refrigerator 雪櫃</label>
                         <label><input type="checkbox" /> Washing Machine 洗衣機</label>
                         <label><input type="checkbox" /> Wardrobe 衣櫃</label>
                         <label><input type="checkbox" /> Bed 床</label>
                         <label><input type="checkbox" /> Sofa 梳化</label>
                         <label><input type="checkbox" /> Television 電視</label>
                     </div>
                 </div>
                 
                 <div className="mt-8 text-sm">
                    <p className="font-bold mb-2">Useful Numbers 公共事務電話:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <p>China Power 中電: 2678-2678</p>
                        <p>HK Electric 港燈: 2887-3411</p>
                        <p>Towngas 煤氣: 2880-6988</p>
                        <p>Water Supply 水務署: 2824-5000</p>
                    </div>
                 </div>
             </div>
             <div className="text-right text-xs mt-4">Page 4 of 4</div>
          </div>
        </div>
    );
};

interface DocModalProps {
    isOpen: boolean;
    onClose: () => void;
    docConfig: DocConfig;
    setDocConfig: (config: DocConfig) => void;
    handlePrint: () => void;
    properties: Property[];
    transactions: Transaction[];
    settings: AppSettings; // <--- 5. 新增這裡
}

const InvestorDetailModal = ({ investor, onClose }: { investor: OtherInvestor | null, onClose: () => void }) => {
    if (!investor) return null;
    const [startYear, setStartYear] = useState(new Date().getFullYear() - 1);
    const [endYear, setEndYear] = useState(new Date().getFullYear());
    const [records, setRecords] = useState(investor.records);

    // 篩選用於報表的紀錄
    const filteredRecords = records.filter(r => {
        const y = new Date(r.startDate).getFullYear();
        return y >= startYear && y <= endYear;
    });

    const periodInterest = filteredRecords.reduce((sum, r) => sum + r.interest, 0);
    
    // 自動生成下一年紀錄
    const handleAddNextYear = () => {
        if (records.length === 0) return;
        const last = records[records.length - 1];
        const lastYear = new Date(last.startDate).getFullYear();
        const nextStart = `${lastYear + 1}/1/1`;
        const nextEnd = `${lastYear + 1}/12/31`;
        const newRecord: InvestmentRecord = {
            startDate: nextStart,
            endDate: nextEnd,
            principal: last.principal,
            months: 12,
            rate: last.rate,
            interest: Math.round(last.principal * last.rate)
        };
        setRecords([...records, newRecord]);
    };

    const handlePrint = () => {
         const printContent = document.getElementById('investor-report-print');
         if (!printContent) return;
         const clone = printContent.cloneNode(true) as HTMLElement;
         const wrapper = document.createElement('div');
         wrapper.id = 'print-clone-root';
         wrapper.appendChild(clone);
         document.body.appendChild(wrapper);
         document.body.classList.add('printing-mode');
         setTimeout(() => {
             window.print();
             document.body.classList.remove('printing-mode');
             if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
         }, 500); 
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
            <div className="bg-white rounded-xl shadow-2xl w-[95%] md:w-[900px] max-h-[90vh] flex flex-col animate-in fade-in zoom-in">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <ICONS.Briefcase /> {investor.name} - 投資詳情
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
                    {/* 左側：編輯與列表 */}
                    <div className="flex-1 space-y-6">
                        <div className="bg-white border rounded-lg p-4 shadow-sm">
                            <h4 className="font-bold text-slate-700 mb-3 flex justify-between items-center">
                                <span>投資紀錄 (Investment Records)</span>
                                <button onClick={handleAddNextYear} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">+ 自動生成下一年</button>
                            </h4>
                            <div className="max-h-[300px] overflow-y-auto border rounded">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 sticky top-0">
                                        <tr>
                                            <th className="p-2">期數 (Start-End)</th>
                                            <th className="p-2 text-right">本金</th>
                                            <th className="p-2 text-right">息率</th>
                                            <th className="p-2 text-right">利息</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {records.map((r, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="p-2 text-slate-600">{r.startDate} <br/>~ {r.endDate}</td>
                                                <td className="p-2 text-right font-mono">{formatCurrency(r.principal)}</td>
                                                <td className="p-2 text-right text-blue-600">{(r.rate * 100).toFixed(1)}%</td>
                                                <td className="p-2 text-right font-bold text-emerald-600">+{formatCurrency(r.interest)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white border rounded-lg p-4 shadow-sm">
                            <h4 className="font-bold text-slate-700 mb-3">其他調整 (Adjustments / Paid)</h4>
                             <div className="max-h-[200px] overflow-y-auto border rounded">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 sticky top-0"><tr><th className="p-2">日期</th><th className="p-2">詳情</th><th className="p-2 text-right">金額</th></tr></thead>
                                    <tbody className="divide-y">
                                        {investor.adjustments.map((a, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="p-2 text-slate-500">{a.date}</td>
                                                <td className="p-2">{a.description}</td>
                                                <td className={`p-2 text-right font-bold ${a.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(a.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* 右側：年報預覽 */}
                    <div className="w-full md:w-[400px] bg-slate-100 p-4 rounded-xl flex flex-col">
                        <div className="mb-4 flex gap-2 items-center bg-white p-2 rounded shadow-sm">
                            <span className="text-xs font-bold text-slate-500">報表區間:</span>
                            <select className="border rounded text-xs p-1" value={startYear} onChange={e=>setStartYear(Number(e.target.value))}>
                                {[2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
                            </select>
                            <span className="text-xs text-slate-400">to</span>
                            <select className="border rounded text-xs p-1" value={endYear} onChange={e=>setEndYear(Number(e.target.value))}>
                                {[2023,2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
                            </select>
                            <button onClick={handlePrint} className="ml-auto text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 flex items-center gap-1"><ICONS.Printer /> 列印</button>
                        </div>

                        <div className="flex-1 bg-white shadow-lg p-6 overflow-hidden relative text-xs" id="investor-report-print">
                             {/* 這裡就是列印的內容 (A4樣式) */}
                             <div className="doc-print-container w-full h-full font-serif text-black">
                                 <div className="text-center border-b-2 border-black pb-4 mb-4">
                                     <h2 className="text-xl font-bold">ANNUAL INVESTMENT STATEMENT</h2>
                                     <p className="text-sm tracking-widest mt-1">投資年度結單</p>
                                 </div>
                                 
                                 <div className="flex justify-between mb-6">
                                     <div>
                                         <p className="font-bold">To: {investor.name}</p>
                                         <p>Date: {new Date().toLocaleDateString()}</p>
                                     </div>
                                     <div className="text-right">
                                         <p className="font-bold">Period:</p>
                                         <p>{startYear} - {endYear}</p>
                                     </div>
                                 </div>

                                 <table className="w-full border-collapse border border-black mb-4">
                                     <thead className="bg-gray-100">
                                         <tr>
                                             <th className="border border-black p-1 text-left">Period</th>
                                             <th className="border border-black p-1 text-right">Principal</th>
                                             <th className="border border-black p-1 text-right">Rate</th>
                                             <th className="border border-black p-1 text-right">Interest</th>
                                         </tr>
                                     </thead>
                                     <tbody>
                                         {filteredRecords.map((r, idx) => (
                                             <tr key={idx}>
                                                 <td className="border border-black p-1">{r.startDate} ~<br/>{r.endDate}</td>
                                                 <td className="border border-black p-1 text-right">{formatCurrency(r.principal)}</td>
                                                 <td className="border border-black p-1 text-right">{(r.rate*100).toFixed(1)}%</td>
                                                 <td className="border border-black p-1 text-right">{formatCurrency(r.interest)}</td>
                                             </tr>
                                         ))}
                                         {filteredRecords.length === 0 && <tr><td colSpan={4} className="border border-black p-4 text-center italic">No records in this period.</td></tr>}
                                     </tbody>
                                     <tfoot>
                                         <tr className="bg-gray-50 font-bold">
                                             <td colSpan={3} className="border border-black p-1 text-right">Period Total Interest:</td>
                                             <td className="border border-black p-1 text-right">{formatCurrency(periodInterest)}</td>
                                         </tr>
                                     </tfoot>
                                 </table>

                                 <div className="mt-8 border-t-2 border-black pt-2">
                                     <div className="flex justify-between items-end">
                                         <div>
                                             <p className="font-bold text-sm">Account Summary (All Time)</p>
                                             <p>Total Principal: {formatCurrency(investor.stats.principal)}</p>
                                         </div>
                                         <div className="text-right">
                                             <p className="text-lg font-bold">Net Balance: {formatCurrency(investor.stats.balance)}</p>
                                         </div>
                                     </div>
                                 </div>
                                 
                                 <div className="mt-12 text-center text-[10px] text-gray-500">
                                     Generated by Charles Wealth Nav System
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InvestmentDashboard = () => {
    // --- 1. [Fix] 修復借貸日期邏輯 ---
    // 改進：動態計算下一個扣款日，解決 2026 年顯示 2024 的問題
    const loanHistory = useMemo(() => {
        const principal = 3000000;
        const rate = 0.06;
        const history = [];
        const startYear = 2015;
        const currentYear = new Date().getFullYear(); // 2026
        const currentDate = new Date();

        // 1. 生成過去所有紀錄 (從 2015 到 今年)
        for (let y = startYear; y <= currentYear; y++) {
            // 上半年 1/1
            if (new Date(y, 0, 1) < currentDate) {
                 history.push({ year: y, month: 1, amount: principal * rate / 2, type: 'Interest', note: '上半年利息' });
            }
            // 下半年 7/1
            if (new Date(y, 6, 1) < currentDate) {
                 history.push({ year: y, month: 7, amount: principal * rate / 2, type: 'Interest', note: '下半年利息' });
            }
        }
        
        // 2. 預測「下一次」扣款日
        let nextDate = new Date(currentYear, 0, 1); // 今年 1/1
        if (nextDate < currentDate) nextDate = new Date(currentYear, 6, 1); // 今年 7/1
        if (nextDate < currentDate) nextDate = new Date(currentYear + 1, 0, 1); // 明年 1/1
        
        const nextDateStr = nextDate.toISOString().split('T')[0];
        const nextAmount = principal * rate / 2;

        return {
            history: history.sort((a,b) => b.year - a.year),
            totalReceived: history.reduce((acc, h) => acc + h.amount, 0),
            nextDate: nextDateStr,
            nextAmount: nextAmount
        };
    }, []);

    const totalInterestReceived = loanHistory.totalReceived;
    
    // 定義現在的資產狀態
    const loans = INITIAL_LOANS;
    const peProjects = INITIAL_PE_PROJECTS;

    const totalLoanPrincipal = loans.reduce((acc, l) => acc + l.principal, 0);
    const totalPEInvested = peProjects.reduce((acc, p) => acc + p.investmentAmount, 0);
    const totalPEValuation = peProjects.reduce((acc, p) => acc + p.valuation, 0); 
    const totalAssets = totalLoanPrincipal + totalPEValuation;

    // A. 借貸回報分析
    const loanROI = (totalInterestReceived / totalLoanPrincipal) * 100;
    
    // B. 私募基金潛在回報
    const simulatedPEValuation = 
        (peProjects.find(p=>p.projectName.includes('鑫茂'))?.investmentAmount || 0) * 1.5 + 
        (peProjects.find(p=>p.projectName.includes('玻思韬'))?.investmentAmount || 0) * 1.0;
    
    const peUnrealizedProfit = simulatedPEValuation - totalPEInvested;
    const peROI = (peUnrealizedProfit / totalPEInvested) * 100;

    // C. 風險評分
    const riskScore = Math.round(
        (totalLoanPrincipal * 20 + totalPEInvested * 80) / (totalLoanPrincipal + totalPEInvested)
    );

    // D. 處理家庭基金
    const [selectedInvestor, setSelectedInvestor] = useState<OtherInvestor | null>(null);

    return (
        <div className="space-y-6 animate-in fade-in pb-10">
            {/* 1. 動態獲利分析卡 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 借貸獲利分析 */}
                <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-2xl shadow-sm border border-emerald-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><ICONS.DollarSign /></div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg"><ICONS.TrendingUp /></div>
                        <h3 className="font-bold text-slate-700">借貸現金流 (Cash Cow)</h3>
                    </div>
                    
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm text-slate-500">累計已收利息 (Since 2015)</span>
                        <span className="text-2xl font-bold text-emerald-600">+{formatCurrency(totalInterestReceived)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full mb-2">
                        <div className="bg-emerald-500 h-2 rounded-full" style={{width: `${Math.min(loanROI, 100)}%`}}></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>已回本比例: {loanROI.toFixed(1)}%</span>
                        <span>本金仍在庫: {formatCurrency(totalLoanPrincipal)}</span>
                    </div>
                </div>

                {/* PE 潛在獲利 */}
                <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><ICONS.Briefcase /></div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg"><ICONS.TrendingUp /></div>
                        <h3 className="font-bold text-slate-700">PE 潛在價值 (Growth)</h3>
                    </div>

                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm text-slate-500">預估浮盈 (Unrealized)</span>
                        <div className="text-right">
                            <span className="text-2xl font-bold text-indigo-600 block">+{formatCurrency(peUnrealizedProfit)}</span>
                            <span className="text-xs font-bold text-indigo-400">ROI: +{peROI.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div className="flex gap-2 text-xs mb-3">
                        <span className="px-2 py-1 bg-white border rounded text-slate-600">成本: {formatCurrency(totalPEInvested)}</span>
                        <span className="px-2 py-1 bg-indigo-600 text-white rounded">最新估值: {formatCurrency(simulatedPEValuation)}</span>
                    </div>
                </div>

                {/* 風險儀表板 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div>
                        <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <ICONS.ShieldCheck /> 投資組合風險 (Risk)
                        </h3>
                        <div className="flex items-center gap-4 mt-4">
                            <div className="relative w-24 h-24 flex items-center justify-center">
                                <svg className="transform -rotate-90 w-24 h-24">
                                    <circle cx="48" cy="48" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                                    <circle cx="48" cy="48" r="40" stroke={riskScore > 50 ? "#f87171" : "#34d399"} strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 * (1 - riskScore / 100)} />
                                </svg>
                                <div className="absolute text-center">
                                    <span className={`text-xl font-bold ${riskScore > 50 ? "text-red-500" : "text-green-500"}`}>{riskScore}</span>
                                    <span className="block text-[10px] text-slate-400">Score</span>
                                </div>
                            </div>
                            <div className="flex-1 text-sm text-slate-600 space-y-2">
                                <p>您的投資組合屬於 <strong>{riskScore > 60 ? '進取型 (Aggressive)' : '穩健型 (Balanced)'}</strong>。</p>
                                <p className="text-xs text-slate-400">
                                    總資產 {formatCurrency(totalAssets)} 中，
                                    {((totalLoanPrincipal/totalAssets)*100).toFixed(0)}% 位於固定收益，
                                    {((totalPEValuation/totalAssets)*100).toFixed(0)}% 位於高風險創投。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- 2. 原始投資模塊 (借貸 & PE) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><ICONS.DollarSign /> 私人借貸履約監控</h3>
                        <span className="text-xs font-mono bg-green-100 text-green-700 px-2 py-1 rounded">Active</span>
                    </div>
                    {loans.map(loan => (
                        <div key={loan.id} className="p-6">
                            <div className="flex flex-wrap justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-bold text-lg">{loan.name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">年化 {loan.rate}%</span>
                                        <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">每半年結算</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-mono font-bold text-slate-800">{formatCurrency(loan.principal)}</div>
                                    <div className="text-xs text-slate-500">本金 (Principal)</div>
                                </div>
                            </div>
                            
                            <div className="mt-6">
                                <h5 className="text-xs font-bold text-slate-500 uppercase mb-3">Recent Cash Flow Timeline</h5>
                                <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pb-2">
                                    {/* [Fix] 使用動態計算的 Next Date */}
                                    <div className="relative pl-6">
                                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-sm"></div>
                                        <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                                            <div>
                                                <span className="font-bold text-blue-800 block text-sm">下次結算 ({loanHistory.nextDate})</span>
                                                <span className="text-xs text-blue-600">預計利息收入</span>
                                            </div>
                                            <span className="font-mono font-bold text-blue-700">+{formatCurrency(loanHistory.nextAmount)}</span>
                                        </div>
                                    </div>
                                    
                                    {loanHistory.history.slice(0, 3).map((h, idx) => (
                                        <div key={idx} className="relative pl-6 opacity-75">
                                            <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-full bg-slate-300"></div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">{h.year} {h.month === 1 ? 'Jan' : 'Jul'} - {h.note}</span>
                                                <span className="font-mono text-emerald-600">+{formatCurrency(h.amount)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><ICONS.Briefcase /> 蟻米基金投資追蹤</h3>
                        <span className="text-xs font-mono bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Total: {formatCurrency(totalPEInvested)}</span>
                    </div>
                    <div className="divide-y">
                        {peProjects.map(proj => (
                            <div key={proj.id} className="p-6">
                                <div className="flex justify-between mb-4">
                                    <div>
                                        <h4 className="font-bold text-lg flex items-center gap-2">
                                            {proj.projectName}
                                            {proj.projectName.includes('鑫茂') && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full animate-pulse">Hot</span>}
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-1">投入本金: {formatCurrency(proj.investmentAmount)}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-indigo-600">+{(peROI > 0 ? peROI : 0).toFixed(0)}%</div>
                                        <div className="text-xs text-slate-400">預估回報</div>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative mb-2">
                                    <div className={`h-full rounded-full transition-all duration-1000 ${proj.projectName.includes('鑫茂') ? 'w-[75%] bg-blue-500' : 'w-[40%] bg-slate-400'}`}></div>
                                </div>
                                <p className="text-xs text-slate-500 mt-1 bg-slate-50 p-2 rounded"><span className="font-bold">最新動態：</span> {proj.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- 3. [New] 家庭基金與其他投資人 --- */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <ICONS.Data /> 家庭基金管理 (Family Fund / Other Investors)
                    </h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {INITIAL_OTHER_INVESTORS.map((inv, idx) => (
                        <div 
                            key={idx} 
                            onClick={() => setSelectedInvestor(inv)}
                            className="border rounded-xl p-4 hover:shadow-md cursor-pointer transition-all hover:border-blue-300 bg-white group"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-2 bg-orange-50 text-orange-600 rounded-full group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                    <ICONS.Briefcase />
                                </div>
                                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">詳情 &gt;</span>
                            </div>
                            <h4 className="font-bold text-lg text-slate-800 mb-1">{inv.name}</h4>
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">本金</span>
                                    <span className="font-mono">{formatCurrency(inv.stats.principal)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">當前結餘</span>
                                    <span className="font-mono font-bold text-emerald-600">{formatCurrency(inv.stats.balance)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 投資詳情與年報 Modal */}
            <InvestorDetailModal investor={selectedInvestor} onClose={() => setSelectedInvestor(null)} />
        </div>
    );
};

const DocModal: React.FC<DocModalProps> = ({ 
    isOpen, onClose, docConfig, setDocConfig, handlePrint, properties, transactions, settings
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
            {/* [修改] 寬度改為響應式 w-[98%] md:w-[1200px] */}
            <div className="bg-white rounded-xl shadow-2xl p-4 md:p-6 w-[98%] md:w-[1200px] h-[95vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-xl font-bold flex items-center gap-2"><ICONS.FileText /> 文書生成器</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
                    <div className="w-full md:w-1/4 space-y-4 overflow-y-auto pr-2 border-r md:border-r-0 md:border-b-0 border-b pb-4 md:pb-0">
                        {/* 設定區域內容保持不變 */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">文件類型</label>
                            <div className="flex rounded bg-slate-100 p-1">
                                {['receipt', 'lease', 'statement'].map(t => (
                                    <button key={t} onClick={() => setDocConfig({ ...docConfig, type: t as any })} className={`flex-1 text-xs py-1 rounded capitalize ${docConfig.type === t ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>{t}</button>
                                ))}
                            </div>
                        </div>
                        
                        <div><label className="block text-xs font-bold text-slate-500">Property</label><select className="w-full border rounded p-1" value={docConfig.propId} onChange={e=>{
                             const p = properties.find(x=>x.id===e.target.value);
                             if(p) setDocConfig({...docConfig, propId: p.id }); 
                        }}>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                        
                        {docConfig.type === 'statement' && (
                             <div className="p-3 bg-blue-50 rounded text-sm space-y-3 border border-blue-100">
                                 <p className="font-bold text-blue-800 border-b border-blue-200 pb-1">對數單設定 Statement Options</p>
                                 <div><label className="text-xs block text-blue-600">Start Date</label><input type="date" className="w-full border rounded text-xs p-1" value={docConfig.statementDateStart} onChange={e=>setDocConfig({...docConfig, statementDateStart: e.target.value})} /></div>
                                 <div><label className="text-xs block text-blue-600">End Date</label><input type="date" className="w-full border rounded text-xs p-1" value={docConfig.statementDateEnd} onChange={e=>setDocConfig({...docConfig, statementDateEnd: e.target.value})} /></div>
                                 <div className="space-y-2 pt-2 border-t border-blue-200 mt-2">
                                     <div className="flex gap-4">
                                         <label className="flex items-center gap-2 text-xs cursor-pointer font-bold text-slate-700"><input type="checkbox" checked={docConfig.showDebit !== false} onChange={e=>setDocConfig({...docConfig, showDebit: e.target.checked})} /> 顯示 Debit</label>
                                         <label className="flex items-center gap-2 text-xs cursor-pointer font-bold text-slate-700"><input type="checkbox" checked={docConfig.showCredit !== false} onChange={e=>setDocConfig({...docConfig, showCredit: e.target.checked})} /> 顯示 Credit</label>
                                     </div>
                                     <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-600"><input type="checkbox" checked={docConfig.showRowNotes !== false} onChange={e=>setDocConfig({...docConfig, showRowNotes: e.target.checked})} /> 顯示交易備註</label>
                                 </div>
                                 <div><label className="text-xs block text-blue-600 font-bold mb-1">底部備註 Footer Note</label><textarea className="w-full border rounded text-xs p-1 h-16" placeholder="例如: 請於收到後七天內付款..." value={docConfig.statementFooterNote || ''} onChange={e=>setDocConfig({...docConfig, statementFooterNote: e.target.value})} /></div>
                             </div>
                        )}
                        
                        <div className="space-y-2">
                            <label className="block text-xs font-bold">Tenant Name</label><input type="text" className="w-full border rounded p-1" value={docConfig.tenant} onChange={e=>setDocConfig({...docConfig, tenant: e.target.value})} />
                            <label className="block text-xs font-bold">Period / Date</label><input type="text" className="w-full border rounded p-1" value={docConfig.period} onChange={e=>setDocConfig({...docConfig, period: e.target.value})} />
                            <label className="block text-xs font-bold">Amount ($)</label><input type="number" className="w-full border rounded p-1" value={docConfig.amount} onChange={e=>setDocConfig({...docConfig, amount: Number(e.target.value)})} />
                        </div>
                        
                        {docConfig.linkedTransactionId && <div className="bg-green-50 p-2 rounded text-xs text-green-700 border border-green-200">此收據已連結至交易紀錄 (Archived)</div>}
                        <button onClick={handlePrint} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow mt-4 flex justify-center items-center gap-2"><ICONS.Printer /> Print / Save PDF</button>
                    </div>
                    <div className="w-full md:w-3/4 bg-slate-200 rounded-lg p-4 md:p-8 overflow-y-auto flex justify-center shadow-inner">
                        <div className="doc-print-container scale-[0.6] md:scale-100 origin-top">
                            <DocPreviewContent docConfig={docConfig} properties={properties} transactions={transactions} settings={settings} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- 新增：合夥結算組件 ---
interface PartnerShare {
  name: string;
  ratio: number;
}

const PartnershipSettlement = ({ property, transactions }: any) => {
  if (!property) return null;

  // 判斷是否為最終結算 (Sold)
  const isFinal = property.status === 'Sold';

  const shares: PartnerShare[] = [
    { name: 'JOYCE LAU', ratio: 0.6 },
    { name: 'Charles', ratio: 0.4 }
  ];

  const propTxs = transactions.filter((t: any) => t.propertyId === property.id || t.propertyId === property.name);
  
  // 關鍵改良：如果是最終結算用 salePrice，否則用 currentValue (現估值)
  const targetPrice = isFinal ? (property.salePrice || 0) : (property.currentValue || 0);
  const capitalGain = targetPrice - (property.purchasePrice || 0) - (property.purchaseCommission || 0);
  
  const totalIncome = propTxs
    .filter((t: any) => (t.category || '').includes('Income') || t.category?.includes('Sale'))
    .reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);

  const totalExpense = propTxs
    .filter((t: any) => !(t.category || '').includes('Income') && !t.category?.includes('Sale'))
    .reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);

  const netOperatingProfit = totalIncome - totalExpense;
  const totalProjectProfit = capitalGain + netOperatingProfit;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden animate-in fade-in slide-in-from-bottom-4 ${isFinal ? 'border-slate-200' : 'border-blue-200'}`}>
      <div className={`p-6 text-white ${isFinal ? 'bg-slate-900' : 'bg-blue-600'}`}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">
              {property.name} {isFinal ? '投資結算報告' : '預計結算報告 (Holding)'}
            </h2>
            <p className="text-white/80 text-sm mt-1">基準日期: {new Date().toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold uppercase tracking-widest opacity-80">
              {isFinal ? 'Total Net Profit' : 'Est. Net Profit'}
            </span>
            <div className="text-3xl font-mono font-bold">{formatCurrency(totalProjectProfit)}</div>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h3 className="font-bold text-slate-700 border-b pb-2 flex items-center gap-2">
            <ICONS.Home /> {isFinal ? '物業清算摘要' : '估算摘要'}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">{isFinal ? '資產增值 (Capital Gain)' : '預計增值 (Unrealized)'}</span>
              <span className="font-mono">{formatCurrency(capitalGain)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">歷年淨租金 (Net Rent)</span>
              <span className="font-mono">{formatCurrency(netOperatingProfit)}</span>
            </div>
            <div className="pt-2 border-t flex justify-between font-bold text-lg">
              <span>{isFinal ? '總結算利潤' : '預計總利潤'}</span>
              <span className={isFinal ? 'text-blue-600' : 'text-blue-500'}>{formatCurrency(totalProjectProfit)}</span>
            </div>
            {!isFinal && (
              <p className="text-[10px] text-blue-400 italic mt-2">
                * 以現估值 {formatCurrency(property.currentValue)} 作為計算基準
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold text-slate-700 border-b pb-2 flex items-center gap-2">
            <ICONS.PieChart /> 收益分配表 (Distribution)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shares.map(partner => {
              const alreadyReceived = propTxs
                .filter((t: any) => t.member === partner.name && ((t.category || '').includes('Income')))
                .reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);

              const alreadyPaid = propTxs
                .filter((t: any) => t.member === partner.name && !((t.category || '').includes('Income')))
                .reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);

              const dueShare = totalProjectProfit * partner.ratio;
              const finalSettlement = dueShare - alreadyReceived + alreadyPaid;

              return (
                <div key={partner.name} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-lg text-slate-800">{partner.name}</span>
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-bold">股份 {partner.ratio * 100}%</span>
                  </div>
                  <div className="space-y-1 text-xs mb-4">
                    <div className="flex justify-between text-slate-500">
                      <span>應得利潤份額 ({partner.ratio * 100}%):</span>
                      <span className="font-mono">{formatCurrency(dueShare)}</span>
                    </div>
                    <div className="flex justify-between text-red-500">
                      <span>已領取現金 (-):</span>
                      <span className="font-mono">-{formatCurrency(alreadyReceived)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>已墊付費用 (+):</span>
                      <span className="font-mono">+{formatCurrency(alreadyPaid)}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t-2 border-dashed border-slate-200 flex justify-between items-end">
                    <span className="text-xs font-bold text-slate-400">{isFinal ? '最終應收/付' : '目前應收/付'}</span>
                    <span className={`text-xl font-mono font-bold ${finalSettlement >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatCurrency(finalSettlement)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className={`p-4 border-t text-[11px] flex items-center gap-2 ${isFinal ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-blue-50/50 border-blue-100 text-blue-600'}`}>
        <ICONS.Shield /> 
        {isFinal 
          ? "註：已售出結算。本報告根據「Member」欄位標記之資金往來進行自動核算。" 
          : "註：預計結算。這是基於「現值」的模擬結算，方便合夥人掌握當前投資狀況。"}
      </div>
    </div>
  );
};

// --- 9. 主應用程式 ---
const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [eduDB, setEduDB] = useState<Record<string, EduConfig>>(INITIAL_EDUCATION_DB);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  
  const [dataLoaded, setDataLoaded] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');
  const [propertyViewId, setPropertyViewId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'none' | 'transaction' | 'property' | 'doc' | 'lease'>('none');
  const [editingLease, setEditingLease] = useState<Lease | null>(null);

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingProp, setEditingProp] = useState<Property | null>(null);
  const [docConfig, setDocConfig] = useState<DocConfig>({ 
      type: 'receipt', propId: '', tenant: '', tenantID: '', period: '', amount: 0, 
      deposit: 0, startDate: '', endDate: '', landlord: 'Charles Lam', 
      paymentMethod: 'Cash', statementDateStart: '', statementDateEnd: '' 
  });
  
  const reportMode = false;

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkTemplateTx, setBulkTemplateTx] = useState<Transaction | null>(null);

  // Filters
  const [ledgerFilter, setLedgerFilter] = useState('');
  const [filterYear, setFilterYear] = useState('All');
  const [filterMember, setFilterMember] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [eduRegionV, setEduRegionV] = useState('UK');
  const [eduRegionJ, setEduRegionJ] = useState('AUS');
  const [childType, setChildType] = useState('Vocational');
  const [stressRate, setStressRate] = useState(0);
  const [rentDrop, setRentDrop] = useState(0);
  const [displayLimit, setDisplayLimit] = useState(50);

const [isSidebarOpen, setIsSidebarOpen] = useState(false); // 控制手機版側邊欄
const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false); // 控制電腦版側邊欄縮放

const getTxType = (catName: string) => {
      // 使用 ?. 來防止 settings 或 categories 為 undefined 時崩潰
      const found = settings?.categories?.find(c => c.name === catName);
      if (found) return found.type;

      // 舊資料相容邏輯
      if ((catName || '').includes('Income') || (catName || '').includes('Sale') || (catName || '').includes('收入')) {
          return 'Income';
      }
      return 'Expense';
  };

// ... 其他函數
  const handleBatchUpdate = async (ids: string[], newCategory: string, newPropertyId: string, newMember: string) => {
      if (ids.length === 0) return;
      
      const confirmMsg = `確定要批量更新 ${ids.length} 筆交易嗎？\n\n` +
                         `• 類別: ${newCategory}\n` +
                         `• 物業: ${newPropertyId ? '指定物業' : '(無)'}\n` +
                         `• 成員: ${newMember}`;
                         
      if (!window.confirm(confirmMsg)) return;

      try {
          const batch = writeBatch(db);
          ids.forEach(id => {
              const ref = doc(db, "transactions", id);
              batch.update(ref, { 
                  category: newCategory,
                  propertyId: newPropertyId,
                  member: newMember
              });
          });
          await batch.commit();
          alert("批量更新成功！");
      } catch (e) {
          console.error(e);
          alert("更新失敗，請檢查網絡");
      }
  };

// --- 新增：動態計算篩選清單 (Dynamic Filters) ---
  const uniqueYears = useMemo(() => {
      const years = new Set(transactions.map(t => t.year));
      years.add(new Date().getFullYear()); // 確保包含今年
      return Array.from(years).sort((a, b) => b - a); // 降序排列 (2025, 2024...)
  }, [transactions]);

  const uniqueMembers = useMemo(() => {
      const mems = new Set(transactions.map(t => t.member).filter(Boolean));
      // 改為讀取動態 settings，並加上 (m: string) 型別標註
      (settings?.members || ['Charles', 'Family']).forEach((m: string) => mems.add(m)); 
      return Array.from(mems).sort();
  }, [transactions, settings]); // 注意：依賴陣列加上了 settings

  const uniqueCategories = useMemo(() => {
      const cats = new Set(transactions.map(t => t.category).filter(Boolean));
      CATEGORIES.forEach(c => cats.add(c)); // 包含預設類別
      return Array.from(cats).sort();
  }, [transactions]);

  useEffect(() => {
    const qTx = query(collection(db, "transactions"), orderBy("date", "desc"));
    const unsubTx = onSnapshot(qTx, s => 
        setTransactions(s.docs.map(d => ({...d.data(), id: d.id} as Transaction))));
    
    const unsubProp = onSnapshot(collection(db, "properties"), s => 
        setProperties(s.docs.map(d => ({ ...d.data(), id: d.id } as Property))));
    
    const unsubLease = onSnapshot(collection(db, "leases"), s => 
        setLeases(s.docs.map(d => ({...d.data(), id: d.id} as Lease)))); // 這裡也建議改一下確保安全
    
    const unsubEdu = onSnapshot(doc(db, "settings", "education"), (docSnap) => {
      if (docSnap.exists()) {
        setEduDB(docSnap.data() as Record<string, EduConfig>);
      } else {
        setDoc(doc(db, "settings", "education"), INITIAL_EDUCATION_DB);
      }
    });
    
    const unsubSettings = onSnapshot(doc(db, "settings", "general"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as AppSettings;
            
            // --- ✅ 修改開始：自動補全缺失的分類 ---
            // 如果資料庫裡沒有 categories，就使用 DEFAULT_CATEGORIES
            if (!data.categories || data.categories.length === 0) {
                const fixedSettings = { ...data, categories: DEFAULT_CATEGORIES };
                setSettings(fixedSettings);
                // 選項：自動將修復後的設定寫回資料庫 (這樣下次重整就不會空了)
                updateDoc(doc(db, "settings", "general"), { categories: DEFAULT_CATEGORIES });
            } else {
                setSettings(data);
            }
            // --- ✅ 修改結束 ---
            
        } else {
            // 如果完全沒有設定檔，就初始化
            setDoc(doc(db, "settings", "general"), INITIAL_SETTINGS);
            setSettings(INITIAL_SETTINGS);
        }
    });

    setDataLoaded(true);
    return () => { unsubTx(); unsubProp(); unsubLease(); unsubEdu(); unsubSettings(); };
  }, []);

    
  
useEffect(() => {
    // 設定 Favicon (瀏覽器分頁圖標)
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = '/logo.png'; // 確保您的 public 資料夾有 logo.png

    // 設定 Apple Touch Icon (iPhone 桌面圖標)
    let appleLink = document.querySelector("link[rel~='apple-touch-icon']") as HTMLLinkElement;
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      document.getElementsByTagName('head')[0].appendChild(appleLink);
    }
    appleLink.href = '/logo.png';
  }, []);
  
  const updateSettings = async (newSettings: AppSettings) => {
      setSettings(newSettings);
      await setDoc(doc(db, "settings", "general"), newSettings);
  };

  const propStats = useMemo(() => {
    return properties.map(p => {
        const pTxs = transactions.filter(t => t.propertyId === p.id);
        
       // [修正] 加入 Math.abs() 確保金額為正數，避免 CSV 負數導致計算錯誤
        const income = pTxs
            .filter(t => getTxType(t.category) === 'Income')
            .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
        
        // [修正] 加入 Math.abs()
        const expense = pTxs
            .filter(t => getTxType(t.category) === 'Expense')
            .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
        
        const activeLease = leases.find(l => l.propertyId === p.id && l.status === 'Active');
        
        // ... (後面的邏輯保持不變)
        let isLate = false;
        if (activeLease && p.status === 'Occupied') {
            const lastRentTx = pTxs
                .filter(t => (t.category || '').includes('Rental Income'))
                .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            if (lastRentTx) {
                const daysSince = (new Date().getTime() - new Date(lastRentTx.date).getTime()) / (1000 * 3600 * 24);
                if (daysSince > 35) isLate = true;
            }
        }
        const estRent = activeLease ? activeLease.monthlyRent : (p.estRent || 0);
        const stressedExpense = (p.managementFee + p.mortgageAmount) * (1 + stressRate * 0.01);

        const autoTags = [];
        if (p.outstandingLoan > 0) autoTags.push('Mortgaged');
        if (p.currentValue > 10000000) autoTags.push('Luxury');
        if (p.status === 'Occupied') autoTags.push('Leased');
        
        const displayTags = [...(p.tags || []), ...autoTags];

        return { 
            ...p, 
            income, 
            expense, 
            net: income - expense, 
            activeLease, 
            isLate, 
            estRent, 
            stressedExpense, 
            displayTags 
        } as PropertyWithStats;
    });
  }, [properties, transactions, leases, stressRate, settings]); // 記得確認依賴項包含 settings

  const totalValuation = properties.reduce((sum, p) => sum + (p.currentValue || 0), 0);
  const totalMonthlyRent = leases.filter(l => l.status === 'Active').reduce((sum, l) => sum + (l.monthlyRent || 0), 0);

  const stats = useMemo(() => {
    let filtered = transactions;
    if(filterYear !== 'All') filtered = filtered.filter(d => d.year === parseInt(filterYear));
    if(filterMember !== 'All') filtered = filtered.filter(d => d.member === filterMember);
    if(filterCategory !== 'All') filtered = filtered.filter(d => d.category === filterCategory);
    if(searchTerm) filtered = filtered.filter(d => (d.merchant || '').toLowerCase().includes(searchTerm.toLowerCase()));
    
    const total = filtered.reduce((a,b) => a + (b.amount || 0), 0);
    const byYear: Record<string, number> = {}; 
    const byCat: Record<string, number> = {}; 
    const insuranceByMember: Record<string, InsurancePolicy[]> = {};

    filtered.forEach(d => {
        if(!byYear[d.year]) byYear[d.year] = 0; byYear[d.year] += (d.amount || 0);
        const cat = d.category || 'Other'; if(!byCat[cat]) byCat[cat] = 0; byCat[cat] += (d.amount || 0);
        
        if ((cat || '').includes('Insurance')) {
            let memberKey = d.member === 'Family (公用)' ? 'Charles' : d.member;
            if(!insuranceByMember[memberKey]) insuranceByMember[memberKey] = [];
            const existing = insuranceByMember[memberKey].find(p => p.name === d.merchant);
            if(existing) {
                 existing.totalPaid += d.amount;
            } else {
                 insuranceByMember[memberKey].push({ 
                     name: d.merchant, 
                     totalPaid: d.amount, 
                     note: d.note || '',
                     lastPaid: d.date,
                     endYear: null,
                     rawMerchant: d.merchant
                 });
            }
        }
    });
    
    return { 
        total, 
        count: filtered.length, 
        byYear: Object.entries(byYear).map(([k,v])=>({year:k, amount:v})).sort((a:any,b:any)=>Number(a.year)-Number(b.year)), 
        byCat: Object.entries(byCat).map(([k,v])=>({name:k, value:v})).sort((a:any,b:any)=>b.value-a.value), 
        insuranceByMember
    };
  }, [transactions, filterYear, filterMember, filterCategory, searchTerm]);

  const eduForecast = useMemo(() => {
    const db = eduDB || INITIAL_EDUCATION_DB;
    const regV = db[eduRegionV] || INITIAL_EDUCATION_DB.UK; 
    const regJ = db[eduRegionJ] || INITIAL_EDUCATION_DB.AUS;
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
        // [修正] 取得當前有效的分類列表
        const availableCats = (settings?.categories || DEFAULT_CATEGORIES).map((c: any) => c.name);
        
        // [修正] 智慧防呆：
        // 如果當前的 category 不在有效列表中（例如是舊資料 "General"），
        // 且使用者沒有動過選單（介面上看到的是第一個選項），
        // 則存檔時強制將其更新為列表的第一個選項（即 "Rental Income"）。
        let finalCategory = editingTx.category;
        if (!availableCats.includes(finalCategory) && availableCats.length > 0) {
            finalCategory = availableCats[0];
        }

        const txData = { 
            ...editingTx, 
            category: finalCategory, // 使用修正後的分類
            amount: Number(editingTx.amount), 
            year: new Date(editingTx.date).getFullYear(), 
            month: new Date(editingTx.date).getMonth() + 1 
        };

        if(editingTx.id) await setDoc(doc(db, "transactions", editingTx.id), txData);
        else await addDoc(collection(db, "transactions"), txData);
        setModalMode('none');
      } catch(e) { alert(e); }
  };

  const handleSaveProperty = async () => {
      if(!editingProp) return;
      try {
        let calcMortgage = editingProp.mortgageAmount || 0;
        if (editingProp.mortgageLoan && editingProp.interestRate && editingProp.tenure) {
            const r = editingProp.interestRate / 100 / 12;
            const n = editingProp.tenure * 12;
            if (r > 0 && n > 0) {
                 calcMortgage = editingProp.mortgageLoan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            }
        }

        const { activeLease, income, expense, net, isLate, stressedExpense, estRent, id, displayTags, holdingPeriod, ...rawData } = editingProp as any;

        const pData = { 
            ...rawData, 
            currentValue: Number(rawData.currentValue || 0), 
            purchasePrice: Number(rawData.purchasePrice || 0),
            mortgageAmount: Number(calcMortgage || 0),
            estRent: Number(editingProp.estRent || 0), 
            tenure: Number(rawData.tenure || 0),
            managementFee: Number(rawData.managementFee || 0),
            govtRates: Number(rawData.govtRates || 0),
            govtRent: Number(rawData.govtRent || 0),
            initialDeposit: Number(rawData.initialDeposit || 0),
            furtherDeposit: Number(rawData.furtherDeposit || 0),
            balancePayment: Number(rawData.balancePayment || 0),
            mortgageLoan: Number(rawData.mortgageLoan || 0),
            interestRate: Number(rawData.interestRate || 0),
            outstandingLoan: Number(rawData.outstandingLoan || 0),
            bank: rawData.bank || 'Standard Bank',
            purchaseAgent: rawData.purchaseAgent || '',
            purchaseCommission: Number(rawData.purchaseCommission || 0),
            salePrice: Number(rawData.salePrice || 0),
            saleDate: rawData.saleDate || '',
        };

        if(editingProp.id) {
            await setDoc(doc(db, "properties", editingProp.id), pData);
        } else {
            await addDoc(collection(db, "properties"), pData);
        }
        
        setModalMode('none');
      } catch(e) { 
          console.error("Save failed:", e);
          alert("儲存失敗: " + e); 
      }
  };

  const handleSaveLease = async () => {
      if (!editingLease) return;
      try {
        const leaseData = {
             ...editingLease,
             monthlyRent: Number(editingLease.monthlyRent),
             deposit: Number(editingLease.deposit)
        };
        if (editingLease.id) {
             await setDoc(doc(db, "leases", editingLease.id), leaseData);
        } else {
             await addDoc(collection(db, "leases"), leaseData);
        }
        setModalMode('none');
      } catch(e) { alert(e); }
  }
  
  const handleSelectProperty = async (id: string) => {
      // 1. 打開詳情頁
      setPropertyViewId(id);
      
      // 2. 背景更新該物業的 lastViewed 時間 (不影響 UI 操作)
      try {
          await updateDoc(doc(db, "properties", id), { 
              lastViewed: Date.now() 
          });
      } catch (e) {
          console.error("更新排序失敗 (但不影響使用):", e);
      }
  };

  const handleDeleteProperty = async (id: string) => {
      if(window.confirm('確定刪除此物業？ (此操作無法復原)')) {
          await deleteDoc(doc(db, "properties", id));
      }
  };

  const deleteItem = async (col: string, id: string) => {
      if(window.confirm('確定刪除?')) await deleteDoc(doc(db, col, id));
  };

  const handleClearData = async () => {
      if (!window.confirm("警告：這將會清除所有資料！確定嗎？ (此操作無法復原)")) return;
      try {
          const batch = writeBatch(db);
          const collections = ["transactions", "properties", "leases"];
          for (const colName of collections) {
              const q = query(collection(db, colName));
              const querySnapshot = await getDocs(q);
              querySnapshot.forEach((doc) => {
                  batch.delete(doc.ref);
              });
          }
          await batch.commit();
          setTransactions([]);
          setProperties([]);
          setLeases([]);
          alert("所有資料已成功清除。");
      } catch (e) {
          console.error("清除失敗:", e);
          alert("清除資料時發生錯誤，請查看 Console。");
      }
  };

  const handlePrint = async () => {
      // 1. 如果是收據，先處理編號邏輯 (保持不變)
      if (docConfig.type === 'receipt' && docConfig.linkedTransactionId) {
           let finalReceiptNo = docConfig.existingReceiptNo;
           if (!finalReceiptNo) {
               finalReceiptNo = `${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
               try {
                   await updateDoc(doc(db, "transactions", docConfig.linkedTransactionId), { receiptNo: finalReceiptNo });
                   setTransactions(prev => prev.map(t => t.id === docConfig.linkedTransactionId ? { ...t, receiptNo: finalReceiptNo } : t));
                   setDocConfig(prev => ({ ...prev, existingReceiptNo: finalReceiptNo }));
               } catch (error) { console.error("Error saving receipt no:", error); }
           }
      }

      // 2. 準備列印內容
      const printContent = document.querySelector('.doc-print-container');
      if (!printContent) {
          alert("找不到列印內容");
          return;
      }

      // 3. 簡單複製與列印 (不縮放)
      const clone = printContent.cloneNode(true) as HTMLElement;
      const wrapper = document.createElement('div');
      wrapper.id = 'print-clone-root';
      wrapper.appendChild(clone);
      
      document.body.appendChild(wrapper);
      document.body.classList.add('printing-mode');

      setTimeout(() => {
          window.print();
          document.body.classList.remove('printing-mode');
          if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
      }, 500); 
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const readFile = (encoding: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file, encoding);
        });
    };

    if (!window.confirm("確定要導入此 CSV？")) return;

    try {
        let text = await readFile('UTF-8');
        let lines = text.split('\n').filter(l => l.trim() !== '');
        let headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^\ufeff/, ''));
        
        let idxDate = headers.indexOf('繳費日期');
        let idxAmount = headers.indexOf('費用');
        let idxProp = headers.indexOf('物業');

        if (idxDate === -1 || idxAmount === -1) {
            text = await readFile('big5');
            lines = text.split('\n').filter(l => l.trim() !== '');
            headers = parseCSVLine(lines[0]).map(h => h.trim());
            idxDate = headers.indexOf('繳費日期');
            idxAmount = headers.indexOf('費用');
            idxProp = headers.indexOf('物業');
        }

        if (idxDate === -1 || idxAmount === -1) { alert("CSV 格式不符"); return; }

        const idxItem = headers.indexOf('項目');
        const idxOwner = headers.indexOf('業主');
        const idxMethod = headers.indexOf('繳費方法');
        const idxNote = headers.indexOf('備註(A/C)');
        const idxType = headers.indexOf('物業性質');

        let batch = writeBatch(db);
        let operationCount = 0;
        const newPropertiesMap: Record<string, string> = {}; 
        let newTxCount = 0;
        let dupTxCount = 0;
        let newPropCount = 0;

        const existingTxKeys = new Set(transactions.map(t => `${t.date}_${t.amount}_${properties.find(p => p.id === t.propertyId)?.name || t.merchant}`));
        const existingPropMap = new Map(properties.map(p => [p.name, p.id]));

        for (let i = 1; i < lines.length; i++) {
            const row = parseCSVLine(lines[i]);
            if (row.length < headers.length) continue;

            const rawDate = row[idxDate];
            const propName = row[idxProp];
            const item = row[idxItem] || ''; // ensure not undefined
            const owner = row[idxOwner];
            const amountStr = row[idxAmount];
            const note = row[idxNote] || '';
            const method = row[idxMethod] || '';
            const propType = row[idxType] || 'Investment';

            const date = parseChineseDate(rawDate);
            const amount = parseAmount(amountStr);

            if (!date || !amount) continue;

            let propId = existingPropMap.get(propName) || newPropertiesMap[propName];

            if (!propId) {
                const newPropRef = doc(collection(db, "properties"));
                propId = newPropRef.id;
                
                const newPropData: any = {
                    name: propName,
                    address: propName, 
                    type: propType.includes('自置') ? 'Self-use' : 'Investment',
                    status: 'Occupied', 
                    currentValue: 0,
                    purchasePrice: 0,
                    mortgageLoan: 0, mortgageAmount: 0, outstandingLoan: 0,
                    managementFee: 0, govtRates: 0, govtRent: 0, estRent: 0,
                    tenure: 0, interestRate: 0, bank: '',
                    initialDeposit: 0, furtherDeposit: 0, balancePayment: 0,
                    owner: '', ownershipType: 'Self-owned', tags: [],
                    purchaseDate: '', purchaseAgent: '', purchaseCommission: 0
                };

                batch.set(newPropRef, newPropData);
                newPropertiesMap[propName] = propId;
                newPropCount++;
                operationCount++;
            }

            const txKey = `${date}_${amount}_${propName}`;
            if (existingTxKeys.has(txKey)) {
                dupTxCount++;
                continue; 
            }

            const newTxRef = doc(collection(db, "transactions"));
            
            // 智能分類
            let category = 'Other (其他)';
            const itemText = (item + (note || '')).toLowerCase();

            if (itemText.includes('租') || itemText.includes('rent') || itemText.includes('income')) {
                category = 'Rental Income (租金收入)';
            }
            else if (itemText.includes('差餉') || itemText.includes('rates')) category = 'Govt Rates (差餉)';
            else if (itemText.includes('管理') || itemText.includes('mgt')) category = 'Management Fee (管理費)';
            else if (itemText.includes('保險') || itemText.includes('insurance')) category = 'Insurance (保險)';
            else if (itemText.includes('維修') || itemText.includes('repair')) category = 'Repair & Maint (維修)';

            const newTxData: any = {
                date: date,
                amount: amount,
                merchant: item,
                category: category,
                member: owner || 'Family',
                note: `${note} (${method})`,
                year: new Date(date).getFullYear(),
                month: new Date(date).getMonth() + 1,
                propertyId: propId,
                isVerified: true
            };

            batch.set(newTxRef, newTxData);
            existingTxKeys.add(txKey);
            newTxCount++;
            operationCount++;

            if (operationCount >= 450) {
                await batch.commit();
                batch = writeBatch(db);
                operationCount = 0;
            }
        }

        if (operationCount > 0) {
            await batch.commit();
        }

        alert(`導入完成！\n- 新增紀錄: ${newTxCount} 筆\n- 略過重複: ${dupTxCount} 筆\n- 新增物業: ${newPropCount} 個`);
        
    } catch (err) {
        console.error(err);
        alert("匯入失敗: " + err);
    }
  };

// --- 輔助函數：清洗銀行流水雜訊 ---
  const cleanMerchantText = (text: string) => {
      if (!text) return '';
      let clean = text;

      // 1. 移除金額
      clean = clean.replace(/\b[\d,]+\.\d{2}\b/g, '');

      // 2. 移除日期代碼
      clean = clean.replace(/\b\d{1,2}\s?(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z0-9]*\b/ig, '');

      // 3. 移除常見無意義的銀行術語
      clean = clean.replace(/\b(CR TO|TRF|TRANSFER|ATM|B\/F BALANCE|M\/T|FPS)\b/ig, '');

      // 4. 移除長串的參考編號
      clean = clean.replace(/\b[A-Z0-9]{8,}\b/g, '');

      // 5. 整理多餘的空格
      clean = clean.replace(/\s+/g, ' ').trim();

      return clean;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 提示用戶
    if(!window.confirm("系統將執行：\n1. 防重覆檢查 (跳過已存在資料)\n2. 智慧配對 (自動分類租金/管理費)\n\n確定繼續？")) return;
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const result = ev.target?.result;
            if (typeof result !== 'string') return;
            const json = JSON.parse(result);
            const list = Array.isArray(json) ? json : (json.data || []);
            
            // --- A. 建立現有資料的指紋庫 (用於比對重複) ---
            const existingFingerprints = new Set(
                transactions.map(t => `${t.date}_${t.amount}_${(t.merchant || '').trim()}`)
            );

            const batch = writeBatch(db);
            let newCount = 0;
            let dupCount = 0;

            list.forEach((item: any) => {
                // --- 步驟 1: 基礎清洗 ---
                const rawMerchant = item.merchant || '';
                const cleanMerchant = cleanMerchantText(rawMerchant);
                const finalMerchant = cleanMerchant || rawMerchant || 'Transaction';
                
                // --- 步驟 2: 防重覆檢查 ---
                const itemFingerprint = `${item.date}_${item.amount}_${finalMerchant.trim()}`;
                
                if (existingFingerprints.has(itemFingerprint)) {
                    dupCount++;
                    return; 
                }

                // --- 步驟 3: 準備寫入 ---
                const docRef = doc(collection(db, "transactions"));
                
                // 轉成小寫方便比對
                const searchStr = (finalMerchant + (item.note || '')).toLowerCase();

                let category = item.category || 'Other (其他)';
                let propId = item.propertyId || '';

                // A. 租客配對 -> 租金收入
                if (item.amount > 0) {
                    const matchedLease = leases.find(l => 
                        l.tenantName && searchStr.includes(l.tenantName.toLowerCase())
                    );
                    if (matchedLease) {
                        category = 'Rental Income (租金收入)';
                        propId = matchedLease.propertyId;
                    }
                }

                // B. 物業配對 -> 管理費
                if (item.amount < 0) {
                    const matchedProp = properties.find(p => 
                        p.name && searchStr.includes(p.name.toLowerCase())
                    );
                    if (matchedProp) {
                        propId = matchedProp.id;
                        if (category === 'General' || category === 'Other (其他)') {
                            category = 'Management Fee (管理費)';
                        }
                    }
                }

                // C. 關鍵字補強
                if (category === 'General' || category === 'Other (其他)') {
                    if (searchStr.includes('rent') || searchStr.includes('租') || searchStr.includes('income')) category = 'Rental Income (租金收入)';
                    else if (searchStr.includes('rates') || searchStr.includes('差餉')) category = 'Govt Rates (差餉)';
                    else if (searchStr.includes('management') || searchStr.includes('mgt')) category = 'Management Fee (管理費)';
                    else if (searchStr.includes('insurance') || searchStr.includes('prudential') || searchStr.includes('aia')) category = 'Insurance (保險)';
                    else if (searchStr.includes('interest') || searchStr.includes('利息')) category = 'Bank Interest (利息)';
                }
                
                // D. 構建資料物件 (移除原始 ID)
                const itemData = { ...item }; 
                delete itemData.id; 

                batch.set(docRef, {
                    ...itemData, 
                    merchant: finalMerchant, 
                    category: category,
                    propertyId: propId,
                    year: new Date(item.date).getFullYear(),
                    month: new Date(item.date).getMonth() + 1
                });
                
                newCount++;
            });
            
            if (newCount > 0) {
                await batch.commit();
                alert(`匯入完成！\n\n✅ 成功新增: ${newCount} 筆\n🚫 自動略過重複: ${dupCount} 筆\n\n系統已執行智慧分類與配對。`);
            } else {
                alert(`沒有新增任何資料。\n\n所有 ${dupCount} 筆資料都已存在於系統中 (重複)。`);
            }
            
        } catch (err) { 
            console.error(err);
            alert("匯入失敗: " + err); 
        }
    };
    reader.readAsText(file);
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
      document.body.removeChild(link);
  };


  const handleUpdateCategory = async (id: string, newCat: string) => {
      try { await updateDoc(doc(db, "transactions", id), { category: newCat }); } catch (e) { console.error(e); }
  };

  const updateEduDB = async (newConfig: Record<string, EduConfig>) => {
      setEduDB(newConfig); await setDoc(doc(db, "settings", "education"), newConfig);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'transaction' | 'lease') => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const currentImages = target === 'transaction' ? editingTx?.attachments || [] : editingLease?.attachments || [];
      if (currentImages.length + files.length > 10) { alert("最多只能上傳 10 張圖片"); return; }
      const newImages: string[] = [];
      for (let i = 0; i < files.length; i++) {
          const compressed = await compressImage(files[i]);
          newImages.push(compressed);
      }
      if (target === 'transaction') { setEditingTx({ ...editingTx, attachments: [...currentImages, ...newImages] } as Transaction); } 
      else { setEditingLease({ ...editingLease, attachments: [...currentImages, ...newImages] } as Lease); }
  };

  const handleRemoveImage = (index: number, target: 'transaction' | 'lease') => {
      if (target === 'transaction' && editingTx) {
          const newAtt = [...(editingTx.attachments || [])];
          newAtt.splice(index, 1);
          setEditingTx({ ...editingTx, attachments: newAtt } as Transaction);
      } else if (target === 'lease' && editingLease) {
          const newAtt = [...(editingLease.attachments || [])];
          newAtt.splice(index, 1);
          setEditingLease({ ...editingLease, attachments: newAtt } as Lease);
      }
  };

  const handleOpenReceipt = (tx: Transaction) => {
      const activeLease = leases.find(l => l.propertyId === tx.propertyId && l.status === 'Active');
      setDocConfig({
          type: 'receipt',
          propId: tx.propertyId || '',
          tenant: activeLease ? activeLease.tenantName : '',
          tenantID: activeLease ? activeLease.tenantID : '',
          period: tx.date, 
          amount: tx.amount,
          deposit: 0,
          startDate: '',
          endDate: '',
          landlord: 'Charles Lam',
          paymentMethod: 'Bank Transfer',
          linkedTransactionId: tx.id,
          existingReceiptNo: tx.receiptNo 
      });
      setModalMode('doc');
  };

  if (!dataLoaded) {
       return <div className="h-screen flex items-center justify-center text-slate-500 animate-pulse">正在連接到 Firebase 雲端資料庫...</div>;
  }

  return (
      // [修改 1] 最外層容器：設定高度為螢幕高度 (h-screen)，並隱藏超出範圍 (overflow-hidden)
      // 這樣可以鎖死瀏覽器視窗，強制使用內部滾動
      <div className="flex flex-col md:flex-row h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
          
          <style>{`
  /* 基礎滾動條樣式 */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
  .modal-overlay { background-color: rgba(0, 0, 0, 0.5); }
  .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
  .scroll-smooth { -webkit-overflow-scrolling: touch; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

  /* --- 🖨️ 列印專用樣式 (Print Styles) - 正規 A4 版 --- */
  @media print {
      @page { 
          size: A4 portrait; 
          margin: 10mm; /* 設定標準 1cm 邊距，最大化內容空間 */
      }
      
      html, body {
          width: 100%;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          overflow: visible !important;
      }

      /* 隱藏系統介面 */
      #root, .modal-overlay, nav, header, .no-print {
          display: none !important;
      }

      /* 顯示列印容器 */
      #print-clone-root {
          display: block !important;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          z-index: 9999;
          background-color: white;
      }

      /* 容器設定：強制 100% 寬度，不縮放 */
      .doc-print-container {
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important; /* 內距由 @page margin 控制 */
          border: none !important;
          box-shadow: none !important;
          transform: none !important; /* 關鍵：禁止縮放 */
          font-size: 11pt !important; /* 設定標準文件字級 */
          line-height: 1.3;
      }

      /* 表格設定 */
      table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin-bottom: 10px !important;
      }
      
      th, td {
          padding: 4px 6px !important; /* 適度留白 */
          border: 1px solid #000 !important;
          font-size: 10pt !important;
      }

      /* 分頁控制 */
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }

      /* 簽名區與備註區：盡量不分頁，但間距縮小 */
      .signature-section {
          page-break-inside: avoid;
          margin-top: 20px !important; /* 保持適當距離 */
      }

      .footer-note {
          page-break-inside: avoid;
          margin-top: 5px !important; /* 備註緊貼表格 */
          margin-bottom: 10px !important;
      }

      /* 強制背景列印 */
      * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
      }
      
      .page-break {
          page-break-before: always !important;
          break-before: page !important;
          display: block;
          height: 0;
      }
  }
`}</style>

          {/* 1. 手機版頂部導航列 (Mobile Header) - [保持不變] */}
          {!reportMode && (
    <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center shrink-0 z-30 shadow-md no-print">
        <h1 className="font-bold text-lg flex items-center gap-2">
            {/* ▼ 修改這裡：將 <ICONS.Home /> 換成 <img ... /> ▼ */}
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            Charles's 導航
        </h1>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded hover:bg-slate-800">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/></svg>
        </button>
    </div>
)}

          {/* 2. 側邊欄 (Sidebar) - [修改 2] 移除 sticky，改為高度 100% */}
          {!reportMode && (
    <>
        {/* ... (遮罩代碼保持不變) ... */}
        
        <div className={`
            fixed md:relative z-50 bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ease-in-out shadow-xl no-print
            h-full
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} 
            ${isDesktopSidebarCollapsed ? 'md:w-20' : 'md:w-64'} 
            w-64
        `}>
            <div className={`p-6 flex justify-between items-center shrink-0 ${isDesktopSidebarCollapsed ? 'md:justify-center' : ''}`}>
                
                {/* ▼ 修改這裡：展開狀態 ▼ */}
                {!isDesktopSidebarCollapsed && (
                    <h1 className="text-xl font-bold text-white flex items-center gap-2 truncate">
                        {/* 將 <ICONS.Home /> 換成 img */}
                        <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
                        Charles's 導航
                    </h1>
                )}

                {/* ▼ 修改這裡：收縮狀態 (只顯示 Logo) ▼ */}
                {isDesktopSidebarCollapsed && (
                    <div className="text-white">
                        {/* 將 <ICONS.Home /> 換成 img */}
                        <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
                    </div>
                )}

                <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">✕</button>
            </div>

                      {/* 選單區域 */}
                      <nav className="flex-1 px-3 space-y-2 overflow-y-auto no-scrollbar">
                          {[
                              {id: 'overview', icon: 'LayoutDashboard', label: '總覽 Overview'},
                              {id: 'dashboard', icon: 'Home', label: '物業管理 Properties'}, 
                              {id: 'data', icon: 'Data', label: '數據中心 Data Hub'},
                              {id: 'insurance', icon: 'Shield', label: '保險庫 Insurance'},
                              {id: 'education', icon: 'GraduationCap', label: '升學 Education'},
                              {id: 'investments', icon: 'Briefcase', label: '投資管理 Investments'},
                              {id: 'settings', icon: 'Settings', label: '系統設定 Settings'}
                          ].map(item => (
                              <button key={item.id} onClick={() => { setActiveTab(item.id); setPropertyViewId(null); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab===item.id && !propertyViewId ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'} ${isDesktopSidebarCollapsed ? 'justify-center' : ''}`} title={item.label}>
                                  {item.id === 'overview' ? <ICONS.LayoutDashboard /> : item.id === 'dashboard' ? <ICONS.Home /> : item.id === 'data' ? <ICONS.Data /> : item.id === 'insurance' ? <ICONS.Shield /> : item.id === 'education' ? <ICONS.GraduationCap /> : <ICONS.Settings />} 
                                  {!isDesktopSidebarCollapsed && <span>{item.label}</span>}
                              </button>
                          ))}
                      </nav>

                      {/* 底部收縮按鈕 */}
                      <div className="p-4 border-t border-slate-800 hidden md:flex justify-end shrink-0">
                          <button onClick={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)} className="p-2 text-slate-500 hover:text-white transition-colors">{isDesktopSidebarCollapsed ? '➝' : '←'}</button>
                      </div>
                  </div>
              </>
          )}

          {/* 3. 主要內容區域 (Main Content) */}
          {/* [修改 3] 加入 h-full 和 overflow-y-auto，創造獨立滾動區域 */}
          <div className="flex-1 h-full overflow-y-auto scroll-smooth p-4 md:p-8 pb-20 md:pb-8 pb-safe relative">
              
              {activeTab === 'overview' && (
                  <OverviewDashboard transactions={transactions} properties={properties} leases={leases} />
              )}

              {activeTab === 'dashboard' && !propertyViewId && (
                  <PropertyDashboard 
                      properties={properties} totalValuation={totalValuation} totalMonthlyRent={totalMonthlyRent} propStats={propStats}
                      stressRate={stressRate} setStressRate={setStressRate} rentDrop={rentDrop} setRentDrop={setRentDrop}
                      onSelectProperty={handleSelectProperty} setEditingProp={setEditingProp} setModalMode={setModalMode}
                      initializeDefaults={initializeDefaults} onDeleteProperty={handleDeleteProperty}
                      onAddProperty={() => { setEditingProp({ id: '', name: '', address: '', type: 'Investment', status: 'Vacant', currentValue: 0, purchasePrice: 0, initialDeposit: 0, furtherDeposit: 0, balancePayment: 0, mortgageLoan: 0, mortgageAmount: 0, outstandingLoan: 0, managementFee: 0, govtRates: 0, govtRent: 0, estRent: 0, tenure: 0, interestRate: 0, bank: '', owner: '', ownershipType: 'Self-owned', tags: [], purchaseDate: '', purchaseAgent: '', purchaseCommission: 0 } as Property); setModalMode('property'); }}
                      onInitializeDefaults={initializeDefaults}
                  />
              )}

              {activeTab === 'dashboard' && propertyViewId && (
                  <PropertyDetailView 
                      propId={propertyViewId} 
                      propStats={propStats} 
                      transactions={transactions} 
                      leases={leases}
                      settings={settings}
                      onBack={() => setPropertyViewId(null)} 
                      setDocConfig={setDocConfig} 
                      setModalMode={setModalMode}
                      setEditingProp={setEditingProp} 
                      setEditingTx={setEditingTx} 
                      setEditingLease={setEditingLease}
                      deleteItem={deleteItem} 
                      ledgerFilter={ledgerFilter} 
                      setLedgerFilter={setLedgerFilter}
                      handleUpdateCategory={handleUpdateCategory} 
                      handleOpenReceipt={handleOpenReceipt}
                  />
              )}
              
              {activeTab === 'investments' && (
                 <InvestmentDashboard />
              )}

              {activeTab === 'settings' && (
                  <SettingsView settings={settings} setSettings={setSettings} updateSettings={updateSettings} />
              )}

              {activeTab === 'data' && (
                  <div className="bg-white p-4 md:p-10 rounded-xl shadow animate-in fade-in h-full flex flex-col">
                      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800">數據中心 Data Hub</h2>
                            <p className="text-slate-500 text-xs md:text-sm">所有交易紀錄一覽 Table of All Transactions</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => { 
    // [修正] 新增時，預設分類直接抓取列表的第一個
    const defaultCat = settings?.categories?.[0]?.name || 'General';
    
    setEditingTx({ 
        id: '', 
        date: new Date().toISOString().split('T')[0], 
        merchant: '', 
        amount: 0, 
        category: defaultCat, // <--- 改這裡
        member: 'Charles', 
        note: '', 
        year: new Date().getFullYear(), 
        month: new Date().getMonth() + 1, 
        attachments: [] 
    } as Transaction); 
    setModalMode('transaction'); 
}} className="...">
    <ICONS.Plus /> 新增 Add
</button>
                            <button onClick={handleClearData} className="px-3 py-2 bg-white text-red-600 text-xs rounded hover:bg-red-50 flex items-center gap-2 border border-red-200 transition-colors"><ICONS.Trash /> 清空 Reset</button>
                            <label className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 text-xs rounded hover:bg-indigo-100 cursor-pointer border border-indigo-200 transition-colors"><ICONS.Upload /> CSV<input type="file" className="hidden" onChange={handleCSVUpload} accept=".csv" /></label>
                            <label className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 text-xs rounded hover:bg-green-100 cursor-pointer border border-green-200 transition-colors"><ICONS.Upload /> JSON<input type="file" className="hidden" onChange={handleFileUpload} accept=".json" /></label>
                            <button onClick={handleExportJSON} className="px-3 py-2 bg-slate-100 text-slate-600 text-xs rounded hover:bg-slate-200 flex items-center gap-2 border border-slate-200 transition-colors"><ICONS.Download /> 導出</button>
                        </div>
                      </div>

                      {(() => {
                          const filteredDataList = transactions.filter(t => {
                              const matchesCat = filterCategory === 'All' || t.category === filterCategory;
                              const matchesMem = filterMember === 'All' || t.member === filterMember;
                              const matchesYear = filterYear === 'All' || t.year === parseInt(filterYear);
                              const term = searchTerm.toLowerCase();
                              const matchesSearch = searchTerm === '' || (t.merchant || '').toLowerCase().includes(term) || (t.amount || 0).toString().includes(term);
                              return matchesCat && matchesMem && matchesYear && matchesSearch;
                          });

                          return (
                              <>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col"><span className="text-[10px] text-slate-500 font-bold uppercase">Total Records (總數)</span><span className="text-xl font-bold text-slate-700">{transactions.length} <span className="text-xs font-normal text-slate-400">筆</span></span></div>
                                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex flex-col"><span className="text-[10px] text-blue-500 font-bold uppercase">Filtered (篩選後)</span><span className="text-xl font-bold text-blue-700">{filteredDataList.length} <span className="text-xs font-normal text-blue-400">筆</span></span></div>
                                      <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex flex-col"><span className="text-[10px] text-emerald-600 font-bold uppercase">Source (資料來源)</span><div className="flex items-center gap-1 mt-1"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span className="text-sm font-bold text-emerald-800">Firebase Cloud</span></div></div>
                                      <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex flex-col"><span className="text-[10px] text-indigo-600 font-bold uppercase">Display Limit</span><span className="text-sm font-bold text-indigo-800 mt-1">{Math.min(displayLimit, filteredDataList.length)} / {filteredDataList.length}</span></div>
                                  </div>

                                  <div className="flex flex-wrap gap-3 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100 items-center">
                                    <div className="relative flex-1 min-w-[200px]"><ICONS.Search /><input type="text" placeholder="Search merchant or amount..." className="pl-8 border rounded px-3 py-1.5 text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                                    <select className="border rounded px-3 py-1.5 text-sm bg-white min-w-[140px]" value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}><option value="All">所有類別 (All Cats)</option>{uniqueCategories.map(c=><option key={c} value={c}>{c}</option>)}</select>
                                    <select className="border rounded px-3 py-1.5 text-sm bg-white min-w-[120px]" value={filterMember} onChange={e=>setFilterMember(e.target.value)}><option value="All">所有成員 (All)</option>{uniqueMembers.map(m=><option key={m} value={m}>{m}</option>)}</select>
                                    <select className="border rounded px-3 py-1.5 text-sm bg-white min-w-[100px]" value={filterYear} onChange={e=>setFilterYear(e.target.value)}><option value="All">所有年份</option>{uniqueYears.map(y=><option key={y} value={y}>{y}</option>)}</select>
                                  </div>

                                  <div className="border rounded-lg overflow-hidden flex-1 flex flex-col bg-white">
                                      <div className="overflow-auto flex-1">
                                          <table className="w-full text-sm text-left border-collapse">
                                              <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10 shadow-sm">
                                                  <tr>
                                                      <th className="p-3 whitespace-nowrap w-24">Date</th>
                                                      <th className="p-3 whitespace-nowrap min-w-[150px]">Merchant</th>
                                                      <th className="p-3 whitespace-nowrap text-right">Amt</th>
                                                      <th className="p-3 whitespace-nowrap hidden md:table-cell">Cat</th>
                                                      <th className="p-3 whitespace-nowrap hidden md:table-cell">Prop</th>
                                                      <th className="p-3 whitespace-nowrap text-center hidden md:table-cell">Src</th>
                                                      <th className="p-3 whitespace-nowrap text-center">Act</th>
                                                  </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100">
                                                  {filteredDataList.slice(0, displayLimit).map(t => {
                                                        const linkedProp = properties.find(p => p.id === t.propertyId);
                                                        return (
                                                          <tr key={t.id} className="hover:bg-blue-50/50 group transition-colors">
                                                              <td className="p-3 whitespace-nowrap text-slate-600 font-mono text-xs">{t.date}</td>
                                                              <td className="p-3 max-w-[150px] md:max-w-[300px]" title={t.merchant}><div className="flex items-center gap-2"><span className="truncate font-medium text-slate-700 block">{t.merchant}</span>{t.receiptNo && <span className="flex-shrink-0 text-[9px] text-green-600 bg-green-50 px-1 rounded border border-green-100">🧾 {t.receiptNo}</span>}</div>{t.note && <div className="text-[10px] text-slate-400 truncate">{t.note}</div>}</td>
                                                              <td className={`p-3 text-right whitespace-nowrap font-mono font-bold ${((t.category || '').includes('Income') || t.category?.includes('Sale')) ? 'text-emerald-600' : 'text-slate-700'}`}>{formatCurrency(t.amount)}</td>
                                                              <td className="p-3 whitespace-nowrap hidden md:table-cell"><span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600 border border-slate-200">{t.category}</span></td>
                                                              <td className="p-3 whitespace-nowrap hidden md:table-cell">{linkedProp ? <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold flex items-center w-fit gap-1 border border-blue-100"><ICONS.Home /> {linkedProp.name}</span> : <span className="text-slate-500 text-xs px-2 py-1">{t.member}</span>}</td>
                                                              <td className="p-3 whitespace-nowrap text-center hidden md:table-cell"><span className="text-[10px] text-slate-400 border px-1 rounded bg-slate-50">DB</span></td>
                                                              <td className="p-3 whitespace-nowrap">
                                                                <div className="flex items-center justify-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => { setBulkTemplateTx(t); setIsBulkModalOpen(true); }} className="p-1.5 rounded text-indigo-500 hover:bg-indigo-50 hover:border-indigo-200 border border-transparent transition-colors" title="智能批量歸類"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M9 3v4"/><path d="M3 5h4"/><path d="M3 9h4"/></svg></button>
                                                                    {((t.category || '').includes('Income') || t.category?.includes('Sale')) && (<button onClick={() => handleOpenReceipt(t)} className={`p-1.5 rounded hover:bg-white border ${t.receiptNo ? 'text-green-600 border-green-200 bg-green-50' : 'text-slate-400 border-transparent hover:border-slate-200'}`} title="收據"><ICONS.FileText /></button>)}
                                                                    <button onClick={() => { setEditingTx(t); setModalMode('transaction'); }} className="p-1.5 rounded text-blue-500 hover:bg-white hover:border-blue-200 border border-transparent" title="編輯"><ICONS.Edit /></button>
                                                                    <button onClick={() => deleteItem('transactions', t.id)} className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-white hover:border-red-200 border border-transparent" title="刪除"><ICONS.Trash /></button>
                                                                </div>
                                                              </td>
                                                          </tr>
                                                        );
                                                    })}
                                              </tbody>
                                          </table>
                                      </div>
                                      <div className="p-3 bg-slate-50 border-t flex justify-center gap-4 text-xs">
                                          {displayLimit < filteredDataList.length ? (<><button onClick={() => setDisplayLimit(prev => prev + 100)} className="text-blue-600 hover:underline">載入更多 (+100)</button><span className="text-slate-300">|</span><button onClick={() => setDisplayLimit(filteredDataList.length)} className="text-slate-500 hover:text-slate-700">顯示全部</button></>) : (<span className="text-slate-400">已顯示所有資料 ({filteredDataList.length} 筆)</span>)}
                                      </div>
                                  </div>
                              </>
                          );
                      })()}
                  </div>
              )}
              
              {activeTab === 'insurance' && (
                  <div className="space-y-6 animate-in fade-in">
                      <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 text-indigo-900 text-sm"><h3 className="font-bold text-lg mb-2 flex items-center gap-2"><ICONS.ShieldCheck /> 保險 AI 深度透視</h3>系統已自動分析您導入的 <code>payment_data.json</code> 中的 CSV 備註欄位。</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {Object.entries(stats.insuranceByMember).map(([member, policies]) => (
                              <div key={member} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                                  <div className="bg-slate-50 px-4 py-3 border-b font-bold text-slate-700 flex justify-between"><span>{member}</span><span className="text-xs font-normal bg-white px-2 py-1 rounded border">總投入: ${(policies.reduce((a,b)=>a+b.totalPaid,0)/1000000).toFixed(2)}M</span></div>
                                  <div className="overflow-x-auto">
                                      <table className="w-full text-xs">
                                          <thead><tr className="text-slate-400 bg-slate-50/50"><th className="p-2 text-left">計劃名稱</th><th className="p-2 text-right">已繳總額</th><th className="p-2 text-left">備註</th></tr></thead>
                                          <tbody>{policies.map((p, idx) => (
                                              <tr key={idx} className="border-t hover:bg-slate-50"><td className="p-2 font-medium text-slate-700">{p.name}</td><td className="p-2 text-right font-mono text-emerald-600">${p.totalPaid.toLocaleString()}</td><td className="p-2 text-slate-500 truncate max-w-xs text-[10px]">{p.note}</td></tr>
                                          ))}</tbody>
                                      </table>
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
                      <div className="grid grid-cols-2 gap-6">
                          <div className="bg-white p-6 rounded-xl shadow-sm border">
                              <div className="flex justify-between">
                                <h3 className="font-bold text-lg mb-2">Virginia ({FAMILY_INFO.Virginia.age})</h3>
                                <select className="text-xs border rounded p-1" value={eduRegionV} onChange={e=>setEduRegionV(e.target.value)}>{Object.keys(eduDB).map(r=><option key={r} value={r}>{eduDB[r].name}</option>)}</select>
                              </div>
                              <p>目標: {eduDB[eduRegionV].name}</p>
                              <p>預算: {formatCurrency(eduDB[eduRegionV].tuition + eduDB[eduRegionV].living)} / year</p>
                          </div>
                          <div className="bg-white p-6 rounded-xl shadow-sm border">
                              <div className="flex justify-between">
                                <h3 className="font-bold text-lg mb-2">Jason ({FAMILY_INFO.Jason.age})</h3>
                                <select className="text-xs border rounded p-1" value={eduRegionJ} onChange={e=>setEduRegionJ(e.target.value)}>{Object.keys(eduDB).map(r=><option key={r} value={r}>{eduDB[r].name}</option>)}</select>
                              </div>
                              <p>目標: {eduDB[eduRegionJ].name}</p>
                              <p>預算: {formatCurrency(eduDB[eduRegionJ].tuition + eduDB[eduRegionJ].living)} / year</p>
                          </div>
                      </div>
                      <div className="bg-slate-100 p-4 rounded-xl">
                          <h4 className="font-bold text-slate-700 mb-2 text-sm flex items-center gap-2"><ICONS.Edit2 /> 調整預算參數 (AI Research 基準)</h4>
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
                      <div className="bg-white p-6 rounded-xl border shadow-sm h-80">
                          <h3 className="font-bold text-slate-700 mb-4">未來 10 年資金需求預測</h3>
                          <ResponsiveContainer><AreaChart data={eduForecast.data}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="year" /><YAxis tickFormatter={v=>`${v/1000}k`}/><Tooltip formatter={v=>`$${v.toLocaleString()}`} /><Legend /><Area type="monotone" dataKey="vCost" name="Virginia" stackId="1" stroke="#8884d8" fill="#8884d8" /><Area type="monotone" dataKey="jCost" name="Jason" stackId="1" stroke="#82ca9d" fill="#82ca9d" /></AreaChart></ResponsiveContainer>
                      </div>
                   </div>
              )}
          </div>

          {/* Modals - 全部加入 md:w-[] 響應式寬度 */}
          {modalMode === 'doc' && <DocModal isOpen={modalMode === 'doc'} onClose={() => setModalMode('none')} docConfig={docConfig} setDocConfig={setDocConfig} handlePrint={handlePrint} properties={properties} transactions={transactions} settings={settings} />}
          
          {/* --- 交易編輯視窗 (Transaction Modal) --- */}
          {modalMode === 'transaction' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
                  <div className="bg-white rounded-xl shadow-2xl p-6 w-[500px] animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold mb-4">{editingTx?.id ? '編輯交易 Edit Record' : '新增交易 New Record'}</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">日期 Date</label>
                                    <input type="date" className="w-full border rounded p-2" value={editingTx?.date} onChange={e=>setEditingTx({...editingTx, date: e.target.value} as any)} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">歸屬物業 Link Property</label>
                                    <select 
                                        className="w-full border rounded p-2" 
                                        value={editingTx?.propertyId || ''} 
                                        onChange={e=>setEditingTx({...editingTx, propertyId: e.target.value} as any)}
                                    >
                                        <option value="">(無 / 一般消費)</option>
                                        {properties.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">商戶/詳情 Merchant</label>
                                <input type="text" placeholder="Detail/Merchant" className="w-full border rounded p-2" value={editingTx?.merchant} onChange={e=>setEditingTx({...editingTx, merchant: e.target.value} as any)} />
                            </div>
                            
                            {/* 金額輸入優化 */}
                            <div className="relative">
                                <label className="text-xs font-bold text-slate-500 mb-1 block">金額 Amount (輸入數字即可)</label>
                                <input 
                                    type="number" 
                                    placeholder="0" 
                                    className="w-full border rounded p-2 pr-24 font-mono text-lg" 
                                    value={editingTx?.amount} 
                                    onChange={e=>setEditingTx({...editingTx, amount: Number(e.target.value)} as any)} 
                                />
                                <span className="absolute right-3 top-9 text-sm text-gray-400 font-mono pointer-events-none">
                                    {formatCurrency(editingTx?.amount)}
                                </span>
                            </div>

                            {/* --- ✅ 這裡就是更新後的類別選擇區塊 --- */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">類別 Category</label>
                                <select 
                                    className="w-full border rounded p-2" 
                                    value={editingTx?.category} 
                                    onChange={e=>setEditingTx({...editingTx, category: e.target.value} as any)}
                                >
                                    {/* 讀取系統設定中的類別列表 */}
                                    {(settings.categories || DEFAULT_CATEGORIES).map((c:any) => (
                                        <option key={c.name} value={c.name}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                                
                                {/* 動態提示收支類型 */}
                                <div className={`text-xs mt-1 font-bold ${getTxType(editingTx?.category || '') === 'Income' ? 'text-emerald-600' : 'text-red-500'}`}>
                                    系統將記錄為: {getTxType(editingTx?.category || '') === 'Income' ? '(+) 收入 Income' : '(-) 支出 Expense'}
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">成員 Member</label>
                                <select 
                                    className="w-full border rounded p-2" 
                                    value={editingTx?.member} 
                                    onChange={e=>setEditingTx({...editingTx, member: e.target.value} as any)}
                                >
                                    {/* 同樣改為讀取動態 settings */}
                                    {(settings?.members || ['Charles', 'Family']).map((m: string) => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* 圖片上傳區塊 */}
                            <div className="border-t pt-3 mt-3">
                                <label className="block text-sm font-bold text-slate-700 mb-2">附件圖片 (最多10張)</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {editingTx?.attachments?.map((img, idx) => (
                                        <div key={idx} className="relative w-16 h-16">
                                            <img src={img} className="w-full h-full object-cover rounded border" alt="upload" />
                                            <button onClick={()=>handleRemoveImage(idx, 'transaction')} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"><ICONS.X /></button>
                                        </div>
                                    ))}
                                    <label className="w-16 h-16 flex items-center justify-center border-2 border-dashed border-gray-300 rounded cursor-pointer hover:bg-gray-50 text-gray-400">
                                        <ICONS.Plus />
                                        <input type="file" className="hidden" accept="image/*" multiple onChange={(e)=>handleImageUpload(e, 'transaction')} />
                                    </label>
                                </div>
                            </div>
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
                  {/* [修改] 寬度響應式 w-[95%] md:w-[600px] */}
                  <div className="bg-white rounded-xl shadow-2xl p-6 w-[95%] md:w-[600px] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                      <h3 className="font-bold text-xl mb-6">Edit Property</h3>
                      {/* ... Property Modal 內容 ... */}
                      <div className="space-y-6">
                          <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Basic Info</label>
                              <input className="border w-full p-2 rounded" placeholder="Property Name" value={editingProp?.name || ''} onChange={e => setEditingProp({...editingProp, name: e.target.value} as any)} />
                              <input className="border w-full p-2 rounded" placeholder="Full Address" value={editingProp?.address || ''} onChange={e => setEditingProp({...editingProp, address: e.target.value} as any)} />
                              <div className="flex gap-2">
                                <select className="border w-full p-2 rounded" value={editingProp?.status} onChange={e => setEditingProp({...editingProp, status: e.target.value} as any)}><option value="Occupied">Occupied</option><option value="Vacant">Vacant</option><option value="Sold">Sold</option></select>
                                <select className="border w-full p-2 rounded" value={editingProp?.ownershipType} onChange={e => setEditingProp({...editingProp, ownershipType: e.target.value} as any)}><option value="Self-owned">Self-owned</option><option value="Managed">Managed</option></select>
                              </div>
                              <div className="flex gap-2">
                                  <div className="flex-1"><label className="text-xs block text-slate-500">Owner</label><select className="border w-full p-2 rounded" value={editingProp?.owner} onChange={e => setEditingProp({...editingProp, owner: e.target.value} as any)}><option value="">Select...</option>{settings.owners.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                                  <div className="flex-1"><label className="text-xs block text-slate-500">Tags (Enter to add)</label><div className="border rounded p-2 flex flex-wrap gap-1 min-h-[42px]">{editingProp?.tags?.map(t => (<span key={t} className="text-xs bg-slate-100 px-1 rounded flex items-center">{t} <button className="ml-1 text-red-400" onClick={()=>setEditingProp({...editingProp, tags: editingProp!.tags.filter(x=>x!==t)} as any)}>x</button></span>))}<input className="outline-none text-xs w-20" onKeyDown={(e)=>{if(e.key==='Enter' && editingProp) { const val = (e.target as HTMLInputElement).value; if(val) { setEditingProp({...editingProp, tags: [...(editingProp.tags||[]), val]} as any); (e.target as HTMLInputElement).value = ''; }}}} /></div></div>
                              </div>
                          </div>
                          <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase">Purchase & Sale Detail</label><div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-3"><div className="grid grid-cols-2 gap-2"><div className="relative"><label className="text-xs text-slate-500 block mb-1">Purchase Price</label><input className="border w-full p-2 rounded text-sm" type="number" value={editingProp?.purchasePrice || ''} onChange={e => setEditingProp({...editingProp, purchasePrice: Number(e.target.value)} as any)} /><span className="absolute right-2 top-8 text-xs text-gray-400 pointer-events-none">{formatCurrency(editingProp?.purchasePrice)}</span></div><div><label className="text-xs text-slate-500 block mb-1">Purchase Date</label><input className="border w-full p-2 rounded text-sm" type="date" value={editingProp?.purchaseDate || ''} onChange={e => setEditingProp({...editingProp, purchaseDate: e.target.value} as any)} /></div></div><div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-slate-500 block mb-1">Agent</label><select className="border w-full p-2 rounded text-sm" value={editingProp?.purchaseAgent} onChange={e => setEditingProp({...editingProp, purchaseAgent: e.target.value} as any)}><option value="">Select...</option>{settings.agents.map(a => <option key={a} value={a}>{a}</option>)}</select></div><div className="relative"><label className="text-xs text-slate-500 block mb-1">Commission</label><input className="border w-full p-2 rounded text-sm" type="number" value={editingProp?.purchaseCommission || ''} onChange={e => setEditingProp({...editingProp, purchaseCommission: Number(e.target.value)} as any)} /><span className="absolute right-2 top-8 text-xs text-gray-400 pointer-events-none">{formatCurrency(editingProp?.purchaseCommission)}</span></div></div>{editingProp?.status === 'Sold' && (<div className="mt-2 border-t pt-2 border-blue-200 bg-blue-100/50 p-2 rounded"><div className="grid grid-cols-2 gap-2"><div className="relative"><label className="text-xs text-slate-700 font-bold block mb-1">Sale Price (賣出價)</label><input className="border w-full p-2 rounded text-sm font-bold text-green-700" type="number" value={editingProp?.salePrice || ''} onChange={e => setEditingProp({...editingProp, salePrice: Number(e.target.value)} as any)} /><span className="absolute right-2 top-8 text-xs text-gray-500 pointer-events-none">{formatCurrency(editingProp?.salePrice)}</span></div><div><label className="text-xs text-slate-700 font-bold block mb-1">Sale Date (賣出日)</label><input className="border w-full p-2 rounded text-sm" type="date" value={editingProp?.saleDate || ''} onChange={e => setEditingProp({...editingProp, saleDate: e.target.value} as any)} /></div></div></div>)}</div></div>
                          <details className="group border rounded-lg p-2"><summary className="font-bold text-sm cursor-pointer text-slate-700 flex justify-between items-center">銀行按揭設定 (點擊展開) <span className="text-xs text-slate-400">▼</span></summary><div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100 grid grid-cols-2 gap-4 mt-2"><div><label className="text-xs text-slate-500 block mb-1">Bank</label><select className="border w-full p-2 rounded text-sm" value={editingProp?.bank} onChange={e => setEditingProp({...editingProp, bank: e.target.value} as any)}><option value="">Select...</option>{settings.banks.map(b => <option key={b} value={b}>{b}</option>)}</select></div><div><label className="text-xs text-slate-500 block mb-1">Mortgage Loan</label><div className="relative"><input className="border w-full p-2 rounded text-sm" type="number" value={editingProp?.mortgageLoan || ''} onChange={e => setEditingProp({...editingProp, mortgageLoan: Number(e.target.value)} as any)} /><span className="absolute right-2 top-2 text-xs text-gray-400 pointer-events-none">{formatCurrency(editingProp?.mortgageLoan)}</span></div></div><div><label className="text-xs text-slate-500 block mb-1">Outstanding</label><div className="relative"><input className="border w-full p-2 rounded text-sm" type="number" value={editingProp?.outstandingLoan || ''} onChange={e => setEditingProp({...editingProp, outstandingLoan: Number(e.target.value)} as any)} /><span className="absolute right-2 top-2 text-xs text-gray-400 pointer-events-none">{formatCurrency(editingProp?.outstandingLoan)}</span></div></div><div><label className="text-xs text-slate-500 block mb-1">Rate (%)</label><input className="border w-full p-2 rounded text-sm" type="number" step="0.1" value={editingProp?.interestRate || ''} onChange={e => setEditingProp({...editingProp, interestRate: Number(e.target.value)} as any)} /></div><div><label className="text-xs text-slate-500 block mb-1">Tenure (Yrs)</label><input className="border w-full p-2 rounded text-sm" type="number" value={editingProp?.tenure || ''} onChange={e => setEditingProp({...editingProp, tenure: Number(e.target.value)} as any)} /></div><div><label className="text-xs text-slate-500 block mb-1">Monthly Pay</label><div className="relative"><input className="border w-full p-2 rounded text-sm bg-white font-bold text-red-600" type="number" value={editingProp?.mortgageAmount || ''} onChange={e => setEditingProp({...editingProp, mortgageAmount: Number(e.target.value)} as any)} /><span className="absolute right-2 top-2 text-xs text-gray-400 pointer-events-none">{formatCurrency(editingProp?.mortgageAmount)}</span></div></div></div></details>
                          <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase">Valuation & Expenses</label><div className="grid grid-cols-2 gap-3"><div><label className="text-xs">Current Value</label><div className="relative"><input className="border w-full p-2 rounded" type="number" value={editingProp?.currentValue || ''} onChange={e => setEditingProp({...editingProp, currentValue: Number(e.target.value)} as any)} /><span className="absolute right-2 top-2 text-xs text-gray-400 pointer-events-none">{formatCurrency(editingProp?.currentValue)}</span></div></div><div><label className="text-xs">Est. Rent</label><div className="relative"><input className="border w-full p-2 rounded" type="number" value={editingProp?.estRent || ''} onChange={e => setEditingProp({...editingProp, estRent: Number(e.target.value)} as any)} /><span className="absolute right-2 top-2 text-xs text-gray-400 pointer-events-none">{formatCurrency(editingProp?.estRent)}</span></div></div></div><div className="grid grid-cols-3 gap-2"><div><label className="text-xs">Mgt Fee</label><input className="border p-1 text-sm w-full rounded" type="number" value={editingProp?.managementFee || ''} onChange={e=>setEditingProp({...editingProp, managementFee: Number(e.target.value)} as any)} /></div><div><label className="text-xs">Rates (Qtr)</label><input className="border p-1 text-sm w-full rounded" type="number" value={editingProp?.govtRates || ''} onChange={e=>setEditingProp({...editingProp, govtRates: Number(e.target.value)} as any)} /></div><div><label className="text-xs">Govt Rent</label><input className="border p-1 text-sm w-full rounded" type="number" value={editingProp?.govtRent || ''} onChange={e=>setEditingProp({...editingProp, govtRent: Number(e.target.value)} as any)} /></div></div></div>
                      </div>
                      <div className="flex gap-2 mt-8 pt-4 border-t">
                          <button onClick={handleSaveProperty} className="flex-1 bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700">Save Property</button>
                          <button onClick={() => setModalMode('none')} className="flex-1 bg-gray-100 text-slate-600 p-3 rounded-lg font-bold hover:bg-gray-200">Cancel</button>
                      </div>
                  </div>
              </div>
          )}

          {modalMode === 'lease' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
                  {/* [修改] 寬度響應式 w-[90%] md:w-[500px] */}
                  <div className="bg-white rounded-xl shadow-2xl p-6 w-[90%] md:w-[500px] animate-in fade-in zoom-in duration-200">
                      <h3 className="font-bold text-xl mb-6">Manage Lease</h3>
                      {/* ... Lease Modal 內容 ... */}
                      <div className="space-y-4">
                          <input className="border w-full p-2 rounded" placeholder="Tenant Name" list="tenant-list" value={editingLease?.tenantName || ''} onChange={e => setEditingLease({...editingLease, tenantName: e.target.value} as any)} />
                          <datalist id="tenant-list">{settings.tenants.map(t => <option key={t} value={t} />)}</datalist>
                          <input className="border w-full p-2 rounded" placeholder="Tenant ID" value={editingLease?.tenantID || ''} onChange={e => setEditingLease({...editingLease, tenantID: e.target.value} as any)} />
                          <div className="grid grid-cols-2 gap-4"><div><label className="text-xs">Start Date</label><input type="date" className="border w-full p-2 rounded" value={editingLease?.startDate || ''} onChange={e => setEditingLease({...editingLease, startDate: e.target.value} as any)} /></div><div><label className="text-xs">End Date</label><input type="date" className="border w-full p-2 rounded" value={editingLease?.endDate || ''} onChange={e => setEditingLease({...editingLease, endDate: e.target.value} as any)} /></div></div>
                          <div className="grid grid-cols-2 gap-4"><div><label className="text-xs">Monthly Rent</label><input type="number" className="border w-full p-2 rounded" value={editingLease?.monthlyRent || ''} onChange={e => setEditingLease({...editingLease, monthlyRent: Number(e.target.value)} as any)} /></div><div><label className="text-xs">Deposit</label><input type="number" className="border w-full p-2 rounded" value={editingLease?.deposit || ''} onChange={e => setEditingLease({...editingLease, deposit: Number(e.target.value)} as any)} /></div></div>
                          <select className="border w-full p-2 rounded" value={editingLease?.status} onChange={e => setEditingLease({...editingLease, status: e.target.value} as any)}><option value="Active">Active</option><option value="Terminated">Terminated</option></select>
                          <div className="border-t pt-3 mt-3"><label className="block text-sm font-bold text-slate-700 mb-2">租約文件圖片 (最多10張)</label><div className="flex flex-wrap gap-2 mb-2">{editingLease?.attachments?.map((img, idx) => (<div key={idx} className="relative w-16 h-16"><img src={img} className="w-full h-full object-cover rounded border" alt="upload" /><button onClick={()=>handleRemoveImage(idx, 'lease')} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"><ICONS.X /></button></div>))}<label className="w-16 h-16 flex items-center justify-center border-2 border-dashed border-gray-300 rounded cursor-pointer hover:bg-gray-50 text-gray-400"><ICONS.Plus /><input type="file" className="hidden" accept="image/*" multiple onChange={(e)=>handleImageUpload(e, 'lease')} /></label></div></div>
                      </div>
                      <div className="flex gap-2 mt-6">
                          <button onClick={handleSaveLease} className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Save Lease</button>
                          <button onClick={() => setModalMode('none')} className="flex-1 bg-gray-200 p-2 rounded hover:bg-gray-300">Cancel</button>
                      </div>
                  </div>
              </div>
          )}

          <BulkClassifyModal 
              isOpen={isBulkModalOpen} 
              onClose={() => setIsBulkModalOpen(false)} 
              templateTx={bulkTemplateTx} 
              transactions={transactions}
              properties={properties} 
              onConfirmBatch={handleBatchUpdate} 
              settings={settings}
          />
      </div>
  );
};

export default App;
