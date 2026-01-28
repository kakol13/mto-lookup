import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  FileUp, 
  User, 
  Calendar, 
  ChevronRight,
  Database,
  X,
  AlertCircle,
  Loader2,
  Copy,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  Users
} from 'lucide-react';

const XLSX_SCRIPT_URL = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
const TAILWIND_CDN = 'https://cdn.tailwindcss.com';

export default function App() {
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [libLoaded, setLibLoaded] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    // Inject Tailwind CSS dynamically for local environments
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = TAILWIND_CDN;
      document.head.appendChild(script);
    }

    if (window.XLSX) {
      setLibLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = XLSX_SCRIPT_URL;
    script.async = true;
    script.onload = () => setLibLoaded(true);
    document.head.appendChild(script);
  }, []);

  const isAccountNumber = (val) => {
    const s = String(val || "").trim();
    return /^\d{4}-\d{4}-\d{5}$/.test(s);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);

    const reader = new FileReader();
    
    reader.onload = (evt) => {
      try {
        const dataBuffer = evt.target.result;
        const workbook = window.XLSX.read(dataBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        let headerRowIndex = -1;
        let baseColMap = { 
          name: 1, 
          date: 4, 
          amount: 5, 
          acct: 11, 
          bps: 3, 
          overdue: 7, 
          sponsorName: 14 
        };

        for (let i = 0; i < Math.min(jsonRows.length, 20); i++) {
          const row = jsonRows[i];
          if (!Array.isArray(row)) continue;
          
          const nameIdx = row.findIndex(c => String(c || "").toLowerCase().includes("last, first name"));
          if (nameIdx !== -1) {
            headerRowIndex = i;
            baseColMap.name = nameIdx;
            
            const findCol = (term) => row.findIndex(c => String(c || "").toLowerCase().trim() === term.toLowerCase());
            const findColContains = (term) => row.findIndex(c => String(c || "").toLowerCase().includes(term.toLowerCase()));
            
            const acctIdx = findCol("acct. no.");
            if (acctIdx !== -1) baseColMap.acct = acctIdx;
            const dateIdx = findColContains("due date");
            if (dateIdx !== -1) baseColMap.date = dateIdx;
            const amtIdx = findColContains("due amount");
            if (amtIdx !== -1) baseColMap.amount = amtIdx;
            const bpsIdx = findCol("bps");
            if (bpsIdx !== -1) baseColMap.bps = bpsIdx;
            const overdueIdx = findColContains("amount overdue");
            if (overdueIdx !== -1) baseColMap.overdue = overdueIdx;
            const sponsorNameIdx = findCol("sponsor name");
            if (sponsorNameIdx !== -1) baseColMap.sponsorName = sponsorNameIdx;
            
            break;
          }
        }

        const dataRows = jsonRows.slice(headerRowIndex + 1);
        
        const formattedData = dataRows
          .filter(row => row[baseColMap.name] && String(row[baseColMap.name]).trim() !== "")
          .map((row, index) => {
            let acct = String(row[baseColMap.acct] || "").trim();
            if (!isAccountNumber(acct)) {
              const found = row.find(cell => isAccountNumber(cell));
              if (found) acct = String(found).trim();
            }

            let upline = String(row[baseColMap.sponsorName] || "").trim();
            if (upline === "" || !isNaN(upline.replace(/-/g, ''))) {
                const acctIndices = [];
                row.forEach((cell, idx) => { if(isAccountNumber(cell)) acctIndices.push(idx); });
                if (acctIndices.length > 0) {
                    const lastAcctIdx = acctIndices[acctIndices.length - 1];
                    const possibleName = String(row[lastAcctIdx + 1] || "").trim();
                    if (possibleName && isNaN(possibleName.replace(/-/g, ''))) {
                        upline = possibleName;
                    }
                }
            }

            return {
              id: index,
              memberName: String(row[baseColMap.name] || "").trim(),
              accountNumber: acct,
              dueDate: row[baseColMap.date] ? formatExcelDate(row[baseColMap.date]) : "N/A",
              dueAmount: row[baseColMap.amount] || 0,
              bps: row[baseColMap.bps] || 0,
              overdue: row[baseColMap.overdue] || 0,
              upline: upline || "N/A"
            };
          });

        setData(formattedData);
      } catch (error) {
        console.error("Parse error", error);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCopy = (text, id) => {
    if (!text) return;
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatExcelDate = (val) => {
    const s = String(val).trim();
    if (s.length === 8 && !isNaN(val)) {
      return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
    }
    return s;
  };

  const formatCurrency = (val) => {
    const n = parseFloat(val) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filteredResults = useMemo(() => {
    if (!searchTerm) return [];
    return data.filter(i => i.memberName.toLowerCase().includes(searchTerm.toLowerCase().trim())).slice(0, 50);
  }, [data, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      <div className="bg-blue-600 h-40 w-full absolute top-0 left-0 rounded-b-[40px] shadow-lg" />
      
      <div className="relative z-10 max-w-md mx-auto px-4 pt-10 space-y-6">
        <header className="text-center text-white pb-2">
          <h1 className="text-3xl font-black tracking-tight uppercase">MTO Lookup</h1>
          <p className="text-blue-100 text-xs font-bold tracking-[0.2em] opacity-80 uppercase">Member Database</p>
        </header>

        <div className="bg-white rounded-[32px] shadow-2xl shadow-blue-900/10 p-6 space-y-6 border border-white/20">
          {!data.length ? (
            <div className="relative group">
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} disabled={isLoading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className="border-2 border-dashed rounded-2xl p-10 text-center space-y-4 bg-blue-50/30 border-blue-200">
                {isLoading ? <Loader2 className="animate-spin text-blue-600 w-10 h-10 mx-auto" /> : <FileUp className="text-blue-600 w-10 h-10 mx-auto" />}
                <div>
                  <p className="font-extrabold text-slate-800">Upload Excel File</p>
                  <p className="text-xs text-slate-500 mt-1 italic">Formatted Currency Display Enabled</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-slate-100/50 rounded-2xl p-4">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="bg-blue-600 p-2.5 rounded-xl shrink-0"><Database className="text-white w-4 h-4" /></div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold truncate text-slate-800">{fileName}</p>
                  <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">{data.length} Accounts</p>
                </div>
              </div>
              <button onClick={() => {setData([]); setSearchTerm('');}} className="p-2 bg-white hover:text-red-500 rounded-full text-slate-400 shadow-sm transition-all"><X className="w-5 h-5" /></button>
            </div>
          )}

          {data.length > 0 && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search member name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {searchTerm && filteredResults.map((item) => (
            <div key={item.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
                    <User className="text-blue-600 w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-black text-slate-800 text-base leading-tight uppercase truncate max-w-[200px]">{item.memberName}</h3>
                    <div className="flex items-center text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                      <Users className="w-3 h-3 mr-1 text-slate-400" />
                      Upline: <span className="text-blue-600 ml-1 truncate max-w-[140px]">{item.upline}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div onClick={() => handleCopy(item.accountNumber, item.id)} className="bg-slate-900 rounded-2xl p-4 mb-4 cursor-pointer active:scale-95 transition-all group relative">
                <div className="flex justify-between items-center relative z-10">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Account Number</span>
                    <p className="text-xl font-mono font-bold text-white tracking-wider">{item.accountNumber || "NOT FOUND"}</p>
                  </div>
                  <div className={`p-2 rounded-xl transition-all ${copiedId === item.id ? 'bg-green-500' : 'bg-slate-800 text-slate-400'}`}>
                    {copiedId === item.id ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Due Date</span>
                  <div className="flex items-center text-sm font-bold text-slate-700 mt-1">
                    <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                    {item.dueDate}
                  </div>
                </div>
                <div className="bg-blue-50/50 rounded-2xl p-3 border border-blue-100">
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest text-right block">Amount Due</span>
                  <div className="flex items-center justify-end text-lg font-black text-blue-700 mt-1">
                    <span className="mr-0.5">₱</span>{formatCurrency(item.dueAmount)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50/50 rounded-2xl p-3 border border-orange-100">
                  <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest flex items-center">
                    <ShieldAlert className="w-2.5 h-2.5 mr-1" /> Overdue
                  </span>
                  <div className="text-sm font-black text-orange-700 mt-1">
                    ₱{formatCurrency(item.overdue)}
                  </div>
                </div>
                <div className="bg-emerald-50/50 rounded-2xl p-3 border border-emerald-100">
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center justify-end">
                    BPS <TrendingUp className="w-2.5 h-2.5 ml-1" />
                  </span>
                  <div className="text-sm font-black text-emerald-700 mt-1 text-right uppercase">
                    ₱{formatCurrency(item.bps)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}