import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  Search, 
  FileUp, 
  User, 
  Calendar, 
  Database,
  X,
  Loader2,
  Copy,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  Users,
  Download,
  Lock,
  Cloud,
  Wallet
} from 'lucide-react';

// External Scripts
const XLSX_SCRIPT_URL = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';

// Firebase Setup
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'mto-lookup-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Helper for formatting date to MM/DD/YYYY
  const formatAsMMDDYYYY = (dateInput) => {
    let date;
    
    // Handle Excel Date objects
    if (dateInput instanceof Date) {
      date = dateInput;
    } 
    // Handle string/number inputs like "20231225" or "2023-12-25"
    else if (dateInput) {
      const strDate = String(dateInput).trim();
      
      // Check if it's in YYYYMMDD format (8 digits)
      if (/^\d{8}$/.test(strDate)) {
        const y = strDate.substring(0, 4);
        const m = strDate.substring(4, 6);
        const d = strDate.substring(6, 8);
        return `${m}/${d}/${y}`;
      }
      
      const parsed = new Date(strDate);
      if (!isNaN(parsed.getTime())) {
        date = parsed;
      }
    }

    if (!date || isNaN(date.getTime())) {
      return cleanVal(dateInput) || "N/A";
    }

    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth failed", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);

    if (!window.XLSX) {
      const script = document.createElement('script');
      script.src = XLSX_SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    }

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const reportRef = doc(db, 'artifacts', appId, 'public', 'data', 'reports', 'latest');
    
    const unsubscribe = onSnapshot(reportRef, (docSnap) => {
      if (docSnap.exists()) {
        const report = docSnap.data();
        setData(report.items || []);
        const dateObj = report.updatedAt?.toDate();
        setLastUpdated(dateObj ? dateObj.toLocaleString() : "Recently");
      } else {
        setData([]);
      }
      setIsLoading(false);
    }, (err) => {
      console.error("Firestore error:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const cleanVal = (v) => {
    if (v === null || v === undefined) return "";
    return String(v).replace(/[\u00A0\u1680​\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/g, " ").trim();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX || !user) return;
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = window.XLSX.read(evt.target.result, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        const M = { name: 1, acct: 11, due: 4, amt: 5, ovr: 7, bps: 3, upl: 14 };

        const formatted = raw
          .filter(r => r[M.name] && cleanVal(r[M.name]).length > 2 && cleanVal(r[M.name]).toLowerCase() !== "name")
          .map((r, i) => ({
            id: i,
            name: cleanVal(r[M.name]).toUpperCase(),
            acct: cleanVal(r[M.acct] || "N/A"),
            nextDate: formatAsMMDDYYYY(r[M.due]),
            amt: parseFloat(String(r[M.amt]).replace(/[^0-9.-]+/g, "")) || 0,
            ovr: parseFloat(String(r[M.ovr]).replace(/[^0-9.-]+/g, "")) || 0,
            bps: parseFloat(String(r[M.bps]).replace(/[^0-9.-]+/g, "")) || 0,
            upl: cleanVal(r[M.upl] || "N/A")
          }));

        const reportRef = doc(db, 'artifacts', appId, 'public', 'data', 'reports', 'latest');
        await setDoc(reportRef, {
          items: formatted,
          updatedAt: new Date(),
          uploaderId: user.uid
        });
        
        setIsAdmin(false); 
      } catch (err) {
        console.error("Upload failed", err);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filtered = useMemo(() => {
    if (searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    return data.filter(d => d.name.toLowerCase().includes(term)).slice(0, 30);
  }, [data, searchTerm]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <p className="font-black uppercase tracking-widest text-[10px] animate-pulse">Syncing Cloud Database...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans select-none">
      <div className="bg-gradient-to-br from-indigo-700 to-blue-900 h-56 w-full rounded-b-[50px] shadow-2xl absolute top-0" />
      
      <div className="relative z-10 max-w-md mx-auto px-4 pt-10 space-y-6">
        <header className="flex justify-between items-start">
          <div className="text-white">
            <h1 className="text-2xl font-black uppercase tracking-tighter italic leading-none">Rep Search</h1>
            <div className="flex items-center mt-2 space-x-2">
              <Cloud className="w-3 h-3 text-indigo-300" />
              <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">
                Updated: {lastUpdated ? String(lastUpdated) : "Never"}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsAdmin(!isAdmin)}
            className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-white/20 transition-colors"
          >
            {isAdmin ? <X className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </button>
        </header>

        {isAdmin && (
          <div className="bg-white rounded-[32px] shadow-2xl p-6 border-4 border-indigo-500 animate-in zoom-in-95">
            <h2 className="text-sm font-black uppercase text-indigo-600 mb-4 flex items-center">
              <Database className="w-4 h-4 mr-2" /> Admin: Update Master File
            </h2>
            <div className="relative">
              <input type="file" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className="border-2 border-dashed border-indigo-200 rounded-2xl p-8 text-center bg-indigo-50/50">
                {isUploading ? <Loader2 className="animate-spin w-8 h-8 text-indigo-600 mx-auto" /> : <FileUp className="w-8 h-8 text-indigo-500 mx-auto" />}
                <p className="mt-2 text-xs font-bold text-slate-600">
                  {isUploading ? "Uploading to Cloud..." : "Upload New Master XLSX"}
                </p>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 mt-3 text-center uppercase font-bold">Updates everyone instantly.</p>
          </div>
        )}

        <div className="bg-white rounded-[32px] shadow-xl p-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-6 h-6 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search representative name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl py-5 pl-14 pr-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-4">
          {searchTerm.length < 2 ? (
            <div className="text-center py-20 opacity-20">
              <Search className="w-16 h-16 mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-xs">Search to view results</p>
            </div>
          ) : (
            filtered.map(item => (
              <div key={item.id} className="bg-white rounded-[32px] p-6 shadow-lg border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-100">
                    <User className="text-white w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-800 uppercase truncate text-lg tracking-tight leading-tight">{item.name}</h3>
                    <div className="flex items-center mt-1">
                      <Users className="w-3.5 h-3.5 text-indigo-400 mr-2" />
                      <p className="text-[10px] text-slate-400 font-bold uppercase truncate tracking-widest">
                        Upline: <span className="text-indigo-600 font-black">{item.upl}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div 
                  onClick={() => {
                    const t = document.createElement('textarea'); t.value = item.acct; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t);
                    setCopiedId(item.id); setTimeout(() => setCopiedId(null), 1500);
                  }}
                  className="bg-slate-900 rounded-[24px] p-5 flex justify-between items-center cursor-pointer hover:bg-slate-800 transition-all active:scale-95"
                >
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Account Number</p>
                    <p className="text-2xl font-black text-white tracking-[0.1em] uppercase italic leading-none">{item.acct}</p>
                  </div>
                  <div className={`${copiedId === item.id ? 'bg-green-500' : 'bg-slate-700'} p-3 rounded-2xl transition-all duration-300 shadow-xl`}>
                    {copiedId === item.id ? <CheckCircle2 className="w-6 h-6 text-white" /> : <Copy className="w-6 h-6 text-slate-300" />}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Next Due Date</p>
                    <div className="flex items-center text-xs font-bold text-slate-700">
                      <Calendar className="w-4 h-4 mr-2 text-indigo-400" /> {item.nextDate}
                    </div>
                  </div>
                  <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex flex-col justify-between">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 text-right">Next Due Amount</p>
                    <div className="text-sm font-black text-indigo-700 text-right flex items-center justify-end">
                      <Wallet className="w-3.5 h-3.5 mr-1.5 opacity-50" /> ₱{item.amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100 col-start-2">
                    <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1.5 text-right">Overdue Amt</p>
                    <div className="flex items-center justify-end text-xs font-black text-red-600">
                      <ShieldAlert className="w-4 h-4 mr-2" /> ₱{item.ovr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 col-start-1 row-start-1">
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1.5">Sales (BPS)</p>
                    <div className="flex items-center text-xs font-black text-emerald-700">
                      <TrendingUp className="w-4 h-4 mr-2" /> ₱{item.bps.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}