/* global __app_id, __firebase_config, __initial_auth_token */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { 
  Search, 
  FileUp, 
  User, 
  Database,
  X,
  Loader2,
  Copy,
  Lock,
  KeyRound,
  Check,
  Activity,
  Terminal,
  Trash2,
  Eye,
  Table as TableIcon,
  ShoppingBag,
  AlertCircle
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(''); 
  const [copiedId, setCopiedId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [db, setDb] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);

  const MAPPING = { 
    name: 1, 
    acct: 11, 
    due: 4,  
    amt: 5, 
    upl: 14,
    bps: 3,  
    ovr: 7   
  };

  const addLog = (msg, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    // Ensure msg is always a string to prevent React "Objects are not valid as child" error
    const messageString = typeof msg === 'object' ? JSON.stringify(msg) : String(msg);
    setLogs(prev => [...prev, { timestamp, msg: messageString, type }]);
  };

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const CORRECT_PIN = "5256";
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'mto-lookup-app';

  const loadXlsxScript = () => {
    return new Promise((resolve, reject) => {
      if (window.XLSX) return resolve();
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const formatAsMMDDYYYY = (val) => {
    if (val === undefined || val === null || val === "") return "N/A";
    const strVal = String(val).trim();
    if (/^\d{8}$/.test(strVal)) {
      const y = strVal.substring(0, 4);
      const m = strVal.substring(4, 6);
      const d = strVal.substring(6, 8);
      return `${m}/${d}/${y}`;
    }
    if (typeof val === 'number' && val > 10000 && val < 60000) {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
    }
    return strVal;
  };

  // 1. Initialize Firebase & Auth
  useEffect(() => {
    const initApp = async () => {
      try {
        await loadXlsxScript();
        const firebaseConfig = typeof __firebase_config !== 'undefined' 
          ? JSON.parse(__firebase_config) 
          : { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "" };

        if (!firebaseConfig.projectId) {
            addLog("Missing Firebase Configuration", "error");
            setIsLoading(false);
            return;
        }

        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        const auth = getAuth(app);
        const firestore = getFirestore(app);
        setDb(firestore);

        const initAuth = async () => {
          try {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
              await signInWithCustomToken(auth, __initial_auth_token);
            } else {
              await signInAnonymously(auth);
            }
          } catch (e) {
            addLog(`Auth Error: ${e.message}`, 'error');
          }
        };
        await initAuth();

        const unsubscribe = onAuthStateChanged(auth, (u) => {
          setUser(u);
          if (u) {
            setConnectionStatus('connected');
            addLog(`Authenticated: ${u.uid}`, 'info');
          }
        });
        return () => unsubscribe();
      } catch (err) {
        addLog(`Init Error: ${err.message}`, 'error');
        setConnectionStatus('error');
      } finally {
        setIsLoading(false);
      }
    };
    initApp();
  }, []);

  // 2. Data Synchronization (Persists for all users)
  useEffect(() => {
    if (!user || !db) return;

    // RULE 1 FIXED: segments must be even. artifacts(1)/id(2)/public(3)/data(4)/reports(5)/main(6)
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'reports', 'mainReport');
    
    addLog("Syncing cloud masterlist...", "info");
    
    const unsubscribe = onSnapshot(docRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const report = docSnap.data();
          setData(report.items || []);
          const dateStr = report.updatedAt?.toDate 
            ? report.updatedAt.toDate().toLocaleString() 
            : new Date(report.updatedAt).toLocaleString();
          setLastUpdated(dateStr);
          addLog(`Sync: ${report.items?.length || 0} records updated`, 'success');
        } else {
          addLog("Database empty. Waiting for admin upload.", "info");
        }
      }, 
      (err) => {
        addLog(`Sync Fail: ${err.message}`, 'error');
      }
    );
    
    return () => unsubscribe();
  }, [user, db, appId]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !user || !db) return;

    const XLSX = window.XLSX;
    if (!XLSX) {
      addLog("Library Error: XLSX not loaded", "error");
      return;
    }

    setIsUploading(true);
    setUploadStatus('Reading Excel File...');
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataArr = new Uint8Array(evt.target.result);
        const wb = XLSX.read(dataArr, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        
        if (raw.length < 1) throw new Error("Empty file detected.");

        const formatted = raw
          .filter(r => r[MAPPING.name] && String(r[MAPPING.name]).trim().toLowerCase() !== "name")
          .map((r, i) => ({
            id: i,
            name: String(r[MAPPING.name] || "").trim().toUpperCase(),
            acct: String(r[MAPPING.acct] || "N/A").trim(),
            nextDate: formatAsMMDDYYYY(r[MAPPING.due]),
            amt: parseFloat(String(r[MAPPING.amt] || "0").replace(/[^0-9.-]+/g, "")) || 0,
            bps: parseFloat(String(r[MAPPING.bps] || "0").replace(/[^0-9.-]+/g, "")) || 0,
            ovr: parseFloat(String(r[MAPPING.ovr] || "0").replace(/[^0-9.-]+/g, "")) || 0,
            upl: String(r[MAPPING.upl] || "N/A").trim()
          }))
          .filter(item => item.name.length > 2);

        setUploadStatus('Cloud Upload in progress...');
        
        // FIXED segment path
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'reports', 'mainReport');
        await setDoc(docRef, {
          items: formatted,
          updatedAt: new Date(),
          uploader: user.uid
        });
        
        addLog(`Success: Published ${formatted.length} accounts.`, 'success');
        setUploadStatus('Complete');
        setTimeout(() => { setIsUploading(false); }, 1000);

      } catch (err) {
        addLog(`Upload Error: ${err.message}`, 'error');
        setUploadStatus('Error');
        setTimeout(() => setIsUploading(false), 2000);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const filtered = useMemo(() => {
    if (searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    return data.filter(d => d.name.toLowerCase().includes(term)).slice(0, 30);
  }, [data, searchTerm]);

  const copyToClipboard = (text, id) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    document.body.removeChild(el);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="font-black italic tracking-widest uppercase text-xs animate-pulse">Syncing Environment...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 font-sans select-none overflow-x-hidden bg-slate-50 text-slate-900">
      <div className="bg-gradient-to-br from-indigo-700 to-slate-900 h-64 w-full rounded-b-[50px] shadow-2xl absolute top-0" />
      
      <div className="relative z-10 max-w-md mx-auto px-4 pt-10 space-y-6 md:max-w-xl lg:max-w-4xl">
        <header className="flex justify-between items-start">
          <div className="text-white">
            <h1 className="text-2xl font-black uppercase tracking-tighter italic leading-none">MTO Lookup</h1>
            <div className="flex items-center mt-3 space-x-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
              <Activity className={`w-3 h-3 ${connectionStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'}`} />
              <p className="text-[9px] font-bold text-indigo-100 uppercase tracking-widest">
                {lastUpdated || "Establishing Data Link..."}
              </p>
            </div>
          </div>
          <button 
            onClick={() => isAdmin ? setIsAdmin(false) : setShowPinModal(true)} 
            className={`p-4 backdrop-blur-md rounded-2xl text-white transition-all active:scale-90 ${isAdmin ? 'bg-indigo-500 shadow-lg shadow-indigo-500/50' : 'bg-white/10'}`}
          >
            {isAdmin ? <X className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </button>
        </header>

        {showPinModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-white rounded-[32px] p-8 w-full max-w-xs shadow-2xl animate-slide-up">
              <div className="flex flex-col items-center text-center">
                <KeyRound className="w-8 h-8 text-indigo-600 mb-4" />
                <h3 className="font-black uppercase tracking-tight text-slate-800">Admin Login</h3>
                <input 
                  type="password" 
                  maxLength={4} 
                  autoFocus 
                  value={pinInput} 
                  onChange={(e) => { 
                    const val = e.target.value.replace(/\D/g, '');
                    setPinInput(val);
                    if (val === CORRECT_PIN) { 
                        setIsAdmin(true); 
                        setShowPinModal(false); 
                        setPinInput(''); 
                        setPinError(false);
                        addLog("Admin Mode Activated", "success");
                    }
                    else if (val.length === 4) { setPinError(true); setPinInput(''); }
                  }} 
                  placeholder="PIN" 
                  className={`w-full text-center text-3xl font-black py-4 mt-4 rounded-xl border-2 outline-none transition-all ${pinError ? 'border-red-500 bg-red-50 shake' : 'border-slate-100 focus:border-indigo-500'}`} 
                />
                <button onClick={() => setShowPinModal(false)} className="mt-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Dismiss</button>
              </div>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="bg-white rounded-[32px] shadow-2xl p-6 border-b-4 border-indigo-500 space-y-4 animate-slide-up overflow-hidden">
            <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-black uppercase text-indigo-600 flex items-center">
                <Database className="w-3 h-3 mr-2" /> Master Database Update
              </h2>
            </div>

            {isUploading ? (
              <div className="bg-slate-900 rounded-2xl p-10 text-center border border-indigo-500/30">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-4" />
                <p className="text-[10px] font-black text-white uppercase tracking-widest animate-pulse">{uploadStatus}</p>
              </div>
            ) : (
              <div className="relative group">
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="border-2 border-dashed border-indigo-100 rounded-3xl p-10 text-center bg-indigo-50/30 group-hover:bg-indigo-100/50 transition-all group-hover:border-indigo-300">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
                    <FileUp className="w-8 h-8 text-indigo-500" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Upload Spreadsheet</p>
                  <p className="text-[8px] text-slate-400 mt-1 font-bold italic text-indigo-500 italic">Overrides global data for all users</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-[32px] shadow-xl p-4 border border-white/20">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Start typing client name..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full bg-slate-50 border-none rounded-2xl py-5 pl-14 pr-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 ring-indigo-500/20 transition-all placeholder:text-slate-300" 
            />
          </div>
        </div>

        <div className="bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl border-2 border-slate-800">
          <div className="px-5 py-3 bg-slate-800 flex justify-between items-center border-b border-slate-700">
            <div className="flex items-center space-x-2">
              <Terminal className="w-3 h-3 text-indigo-400" />
              <span className="text-[8px] font-black text-white uppercase tracking-widest">Network Activity</span>
            </div>
            <button onClick={() => setLogs([])} className="text-slate-500 hover:text-white"><Trash2 className="w-3 h-3" /></button>
          </div>
          <div className="h-24 overflow-y-auto p-4 font-mono text-[9px] space-y-1.5 bg-black/40 custom-scrollbar">
            {logs.length === 0 ? <p className="text-slate-700 italic">Watching for cloud data updates...</p> : logs.map((log, i) => (
              <div key={i} className="flex space-x-2 border-l-2 border-slate-800 pl-2">
                  <span className="text-slate-600">{log.timestamp}</span>
                  <span className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-indigo-300'}>{log.msg}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>

        <div className="space-y-4">
          {searchTerm.length >= 2 ? (
            filtered.length > 0 ? (
              filtered.map(item => (
                <div key={item.id} className="bg-white rounded-[40px] p-6 shadow-xl border border-slate-100 animate-slide-up">
                  <div className="flex items-center space-x-5 mb-5">
                    <div className="w-14 h-14 bg-indigo-600 rounded-[22px] flex items-center justify-center text-white shadow-xl flex-shrink-0">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-slate-800 uppercase truncate text-lg leading-none">{item.name}</h3>
                      <p className="text-[9px] text-slate-400 font-black uppercase mt-2">Upline: <span className="text-indigo-600">{item.upl}</span></p>
                    </div>
                  </div>
                  
                  <div onClick={() => copyToClipboard(item.acct, item.id)} className="bg-slate-900 rounded-[24px] p-5 flex justify-between items-center cursor-pointer active:scale-95 transition-all">
                    <div>
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">MTO Account Number</p>
                      <p className="text-2xl font-black text-white tracking-widest italic font-mono">{item.acct}</p>
                    </div>
                    <div className={`${copiedId === item.id ? 'bg-emerald-500' : 'bg-slate-800'} p-3 rounded-xl`}>
                      {copiedId === item.id ? <Check className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5 text-slate-500" />}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Due Date</p>
                      <p className="text-xs font-black text-slate-700">{item.nextDate}</p>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-3xl text-right border border-indigo-100">
                      <p className="text-[8px] font-black text-indigo-400 uppercase mb-1">Current Balance</p>
                      <p className="text-sm font-black text-indigo-800">₱{item.amt.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-amber-50 p-4 rounded-3xl border border-amber-100 flex items-center space-x-3">
                      <ShoppingBag className="w-4 h-4 text-amber-500" />
                      <div>
                        <p className="text-[7px] font-black text-amber-600 uppercase">Brochure Sales</p>
                        <p className="text-[11px] font-black text-amber-800">₱{item.bps.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="bg-rose-50 p-4 rounded-3xl border border-rose-100 flex items-center space-x-3 justify-end text-right">
                      <div>
                        <p className="text-[7px] font-black text-rose-500 uppercase">Overdue</p>
                        <p className="text-[11px] font-black text-rose-800">₱{item.ovr.toLocaleString()}</p>
                      </div>
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center">
                <p className="text-xs font-black uppercase text-slate-300 italic tracking-widest">No matching results in cloud</p>
              </div>
            )
          ) : (
            <div className="py-20 text-center opacity-10">
                <Database className="w-16 h-16 mx-auto text-slate-900" />
                <p className="text-[10px] font-black uppercase tracking-tighter mt-4 text-slate-400 italic font-black">Sync Protocol Active</p>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
}